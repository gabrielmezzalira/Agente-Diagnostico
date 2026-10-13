"""Envia ao DocuData o que uma sessão de discovery produziu (Spec 12 §2, lado do Agente).

Só roda para projeto em modo `discovery` com `docudata_project_id`. Em segundo plano e sem nunca
levantar: o encerramento da sessão não pode depender do DocuData estar no ar. A idempotência é do
DocuData (`fonte_session_id` = id da sessão).

Segurança: o pacote é montado por lista explícita de campos (nada de linhas do banco inteiras) e
nunca é logado; o log de falha leva só o nome da classe da exceção e o id da sessão.
"""
import asyncio
import logging
import math
from datetime import date, datetime
from typing import Any

from app.config import load_docudata_config
from app.database import get_supabase
from app.services.docudata_client import DiscoveryGateway, HttpDocudataGateway

_log = logging.getLogger(__name__)
_TAREFAS: set[asyncio.Task] = set()  # referência forte: tarefa solta pode ser coletada antes de terminar

# Tetos (o DocuData recusa transcrição acima de 2 MB; ficamos abaixo disso).
LIMITE_TRANSCRICAO_BYTES = 1_500_000
MAX_TEXTO_LINHA = 20_000
MAX_PERGUNTAS = 200
MAX_RED_FLAGS = 100
MAX_AREAS = 100
MAX_TEXTO = 2_000
MAX_CONTEXTO = 10_000
_PROFUNDIDADE_MAX = 8


def _json_seguro(valor: Any, nivel: int = 0) -> Any:
    """Converte para tipos JSON nativos: datas viram ISO, NaN/inf viram None, o resto vira str."""
    if valor is None or isinstance(valor, (bool, int, str)):
        return valor
    if isinstance(valor, float):
        return valor if math.isfinite(valor) else None
    if isinstance(valor, (datetime, date)):
        return valor.isoformat()
    if nivel >= _PROFUNDIDADE_MAX:
        return None
    if isinstance(valor, dict):
        return {str(k): _json_seguro(v, nivel + 1) for k, v in valor.items()}
    if isinstance(valor, (list, tuple)):
        return [_json_seguro(v, nivel + 1) for v in valor]
    return str(valor)  # UUID, Decimal e quaisquer outros


def _texto(valor: Any, limite: int = MAX_TEXTO) -> str | None:
    seguro = _json_seguro(valor)
    if seguro is None:
        return None
    return str(seguro)[:limite]


def _transcricao(chunks: list[dict]) -> tuple[str | None, bool]:
    """Linhas "Falante: texto" na ordem recebida, cortadas em linha inteira abaixo do limite em bytes."""
    linhas, usado, truncada = [], 0, False
    for c in chunks:
        if not c.get("text"):
            continue
        texto = str(c["text"])
        if len(texto) > MAX_TEXTO_LINHA:
            texto, truncada = texto[:MAX_TEXTO_LINHA], True
        linha = f"{c.get('speaker') or 'Participante'}: {texto}"
        custo = len(linha.encode("utf-8")) + (1 if linhas else 0)
        if usado + custo > LIMITE_TRANSCRICAO_BYTES:
            return "\n".join(linhas) or None, True
        linhas.append(linha)
        usado += custo
    return "\n".join(linhas) or None, truncada


def montar_pacote(
    *, sessao: dict, projeto: dict, chunks: list[dict], perguntas: list[dict],
    red_flags: list[dict], coverage_json: dict | None,
) -> dict:
    """Função pura: só campos da lista explícita, todos em tipos JSON nativos e com tetos."""
    transcricao, truncada = _transcricao(chunks)
    cobertura = _json_seguro(coverage_json) if isinstance(coverage_json, dict) else {}
    return {
        "docudata_project_id": _texto(projeto["docudata_project_id"], 100),
        "fonte_session_id": str(sessao["id"]),
        "tipo": "outra",
        "ocorrida_em": _texto(sessao.get("started_at"), 64),
        "conteudo_estruturado": {
            "origem": "agente_diagnostico",
            "contexto_pre_reuniao": _texto(projeto.get("pre_meeting_context"), MAX_CONTEXTO),
            "areas_cobertas": dict(list(cobertura.items())[:MAX_AREAS]),
            "red_flags": [
                {"text": _texto(r.get("text")), "severity": _texto(r.get("severity"), 50),
                 "evidence": _texto(r.get("evidence")), "lens": _texto(r.get("lens"), 50)}
                for r in red_flags[:MAX_RED_FLAGS]
            ],
            "perguntas": [
                {"text": _texto(q.get("text")), "block": _texto(q.get("block"), 50),
                 "lens": _texto(q.get("lens"), 50), "status": _texto(q.get("status"), 50)}
                for q in perguntas[:MAX_PERGUNTAS]
            ],
            "transcricao_truncada": truncada,
        },
        "transcricao": transcricao,
    }


def _linhas(db: Any, tabela: str, colunas: str, session_id: str, ordem: str | None = None) -> list[dict]:
    consulta = db.table(tabela).select(colunas).eq("session_id", session_id)
    if ordem:
        consulta = consulta.order(ordem)
    return consulta.execute().data or []


async def exportar_sessao(db: Any, session_id: str, gateway: DiscoveryGateway) -> str | None:
    """Só leitura. None = não se aplica (sessão ausente/não encerrada, projeto fora de discovery ou sem vínculo)."""
    sessao = (db.table("sessions").select("id, project_id, started_at, status").eq("id", session_id).execute().data or [None])[0]
    if sessao is None or sessao.get("status") not in (None, "finished"):
        return None
    projeto = (
        db.table("projects").select("id, mode, docudata_project_id, pre_meeting_context")
        .eq("id", sessao["project_id"]).execute().data or [None]
    )[0]
    vinculo = (projeto or {}).get("docudata_project_id")
    if projeto is None or projeto.get("mode") != "discovery" or not isinstance(vinculo, str) or not vinculo.strip():
        return None
    snapshot = (
        db.table("coverage_snapshots").select("coverage_json").eq("session_id", session_id)
        .order("snapshot_at", desc=True).limit(1).execute().data or [{}]
    )[0]
    pacote = montar_pacote(
        sessao=sessao, projeto=projeto,
        chunks=_linhas(db, "transcript_chunks", "speaker, text, timestamp", session_id, "timestamp"),
        perguntas=_linhas(db, "questions", "text, block, lens, status", session_id),
        red_flags=_linhas(db, "red_flags", "text, severity, evidence, lens", session_id),
        coverage_json=snapshot.get("coverage_json"),
    )
    return await gateway.enviar_reuniao(pacote)


async def _exportar_em_segundo_plano(url: str, chave: str, session_id: str) -> None:
    try:
        await exportar_sessao(get_supabase(), session_id, HttpDocudataGateway(url, chave))
    except Exception as exc:  # nunca derruba o encerramento; só a classe vai para o log
        _log.warning("exportacao_docudata_falhou sessao=%s exc=%s", session_id, type(exc).__name__)


def agendar_exportacao(session_id: str) -> None:
    """No-op sem DOCUDATA_URL/DOCUDATA_DISCOVERY_KEY. Síncrona, barata e nunca levanta."""
    try:
        config = load_docudata_config()
        if config is None:
            return
        try:
            loop = asyncio.get_running_loop()
        except RuntimeError:  # sem loop: não bloqueia o chamador, apenas avisa
            _log.warning("exportacao_docudata_ignorada sem_loop sessao=%s", session_id)
            return
        tarefa = loop.create_task(_exportar_em_segundo_plano(config.url, config.discovery_key, session_id))
        _TAREFAS.add(tarefa)
        tarefa.add_done_callback(_TAREFAS.discard)
    except Exception as exc:
        _log.warning("exportacao_docudata_nao_agendada sessao=%s exc=%s", session_id, type(exc).__name__)
