# backend/tests/test_discovery_export.py
from app.services import discovery_export as export

SID = "11111111-1111-1111-1111-111111111111"


class _Resp:
    def __init__(self, data):
        self.data = data


class _Query:
    requisicoes = 0  # contador global de execute() (para testar paginação)

    def __init__(self, linhas):
        self._linhas, self._filtros, self._limite = linhas, [], None
        self._ordem, self._faixa = [], None

    def select(self, *_a, **_k):
        return self

    def eq(self, col, val):
        self._filtros.append((col, val))
        return self

    def order(self, col, desc=False, **_k):
        self._ordem.append((col, desc))
        return self

    def range(self, ini, fim):
        self._faixa = (ini, fim)
        return self

    def limit(self, n):
        self._limite = n
        return self

    def execute(self):
        saida = [dict(l) for l in self._linhas if all(l.get(c) == v for c, v in self._filtros)]
        for col, desc in reversed(self._ordem):  # ordenações estáveis encadeadas
            saida.sort(key=lambda l: (l.get(col) is not None, str(l.get(col))), reverse=desc)
        if self._faixa:
            saida = saida[self._faixa[0]: self._faixa[1] + 1]
        _Query.requisicoes += 1
        return _Resp(saida[: self._limite] if self._limite else saida)


class _Db:
    def __init__(self, tabelas):
        self._t = tabelas

    def table(self, nome):
        return _Query(self._t.get(nome, []))


class _Gateway:
    def __init__(self):
        self.pacotes = []

    async def enviar_reuniao(self, pacote):
        self.pacotes.append(pacote)
        return "reuniao-docudata-1"


def _db(mode="discovery", vinculo="proj-docudata"):
    return _Db({
        "sessions": [{"id": SID, "project_id": "p1", "started_at": "2026-10-12T20:00:00+00:00"}],
        "projects": [{"id": "p1", "mode": mode, "docudata_project_id": vinculo, "pre_meeting_context": "cliente do varejo"}],
        "transcript_chunks": [
            {"session_id": SID, "speaker": "Marina", "text": "precisamos exportar PDF", "timestamp": "2026-10-12T20:01:00+00:00"},
            {"session_id": SID, "speaker": None, "text": "ok", "timestamp": "2026-10-12T20:02:00+00:00"},
        ],
        "questions": [{"session_id": SID, "text": "Quem usa?", "block": "negocio", "lens": "produto", "status": "used"}],
        "red_flags": [{"session_id": SID, "text": "ERP sem API", "severity": "critical", "evidence": "o ERP não tem API", "lens": "dados"}],
        "coverage_snapshots": [{"session_id": SID, "coverage_json": {"processo": {"status": "green"}}, "snapshot_at": "2026-10-12T20:03:00+00:00"}],
    })


def test_montar_pacote_traz_o_que_o_docudata_precisa():
    db = _db()
    pacote = export.montar_pacote(
        sessao=db.table("sessions").execute().data[0], projeto=db.table("projects").execute().data[0],
        chunks=db.table("transcript_chunks").execute().data, perguntas=db.table("questions").execute().data,
        red_flags=db.table("red_flags").execute().data, coverage_json={"processo": {"status": "green"}},
    )
    assert pacote["docudata_project_id"] == "proj-docudata" and pacote["fonte_session_id"] == SID
    assert pacote["transcricao"] == "Marina: precisamos exportar PDF\nParticipante: ok"
    conteudo = pacote["conteudo_estruturado"]
    assert conteudo["contexto_pre_reuniao"] == "cliente do varejo"
    assert conteudo["red_flags"][0] == {"text": "ERP sem API", "severity": "critical", "evidence": "o ERP não tem API", "lens": "dados"}
    assert conteudo["perguntas"][0]["status"] == "used" and conteudo["areas_cobertas"] == {"processo": {"status": "green"}}


async def test_exporta_sessao_de_projeto_discovery_vinculado():
    gateway = _Gateway()
    assert await export.exportar_sessao(_db(), SID, gateway) == "reuniao-docudata-1"
    assert gateway.pacotes[0]["fonte_session_id"] == SID


async def test_nao_exporta_projeto_de_vendas_nem_sem_vinculo():
    for db in (_db(mode="sales"), _db(vinculo=None)):
        gateway = _Gateway()
        assert await export.exportar_sessao(db, SID, gateway) is None
        assert gateway.pacotes == []


async def test_sessao_sem_transcricao_manda_transcricao_nula():
    db = _db()
    db._t["transcript_chunks"] = []
    gateway = _Gateway()
    await export.exportar_sessao(db, SID, gateway)
    assert gateway.pacotes[0]["transcricao"] is None


def test_agendar_sem_configuracao_nao_cria_tarefa(monkeypatch):
    monkeypatch.delenv("DOCUDATA_URL", raising=False)
    monkeypatch.delenv("DOCUDATA_DISCOVERY_KEY", raising=False)
    antes = len(export._TAREFAS)
    export.agendar_exportacao(SID)
    assert len(export._TAREFAS) == antes


# --- Obrigações adicionais (JSON puro, limites, segurança, agendamento) ---------------------------
import asyncio
import json
import logging
import math
import uuid
from datetime import datetime, timezone
from decimal import Decimal

import pytest

from app.services.docudata_client import EnvioDefinitivoErro, EnvioFalhouErro


def _montar(**sobre):
    base = dict(
        sessao={"id": SID, "started_at": "2026-10-12T20:00:00+00:00"},
        projeto={"docudata_project_id": "proj-docudata", "pre_meeting_context": "ctx"},
        chunks=[], perguntas=[], red_flags=[], coverage_json=None,
    )
    base.update(sobre)
    return export.montar_pacote(**base)


def test_pacote_e_json_puro_mesmo_com_tipos_nao_nativos():
    agora = datetime(2026, 10, 12, 20, 0, tzinfo=timezone.utc)
    pacote = _montar(
        sessao={"id": uuid.UUID(SID), "started_at": agora},
        perguntas=[{"text": "Q?", "block": "negocio", "lens": None, "status": "used", "id": uuid.uuid4()}],
        red_flags=[{"text": "x", "severity": "critical", "evidence": Decimal("1.5"), "lens": None}],
        coverage_json={"a": {"score": float("nan"), "n": Decimal("2"), "quando": agora, "i": float("inf")}},
    )
    json.dumps(pacote, allow_nan=False)
    assert pacote["fonte_session_id"] == SID and pacote["ocorrida_em"] == agora.isoformat()
    cov = pacote["conteudo_estruturado"]["areas_cobertas"]["a"]
    assert cov["score"] is None and cov["i"] is None and cov["n"] == "2"


def test_pacote_realista_do_exportar_serializa():
    db = _db()
    pacote = _montar(
        chunks=db.table("transcript_chunks").execute().data,
        perguntas=db.table("questions").execute().data,
        red_flags=db.table("red_flags").execute().data,
        coverage_json={"processo": {"status": "green"}},
    )
    json.dumps(pacote, allow_nan=False)


def test_whitelist_nao_vaza_campos_extras():
    pacote = _montar(
        projeto={"docudata_project_id": "p", "pre_meeting_context": "c", "gemini_api_key": "SEGREDO", "name": "n"},
        perguntas=[{"text": "q", "block": "b", "lens": "l", "status": "s", "session_id": SID, "token": "SEGREDO"}],
        red_flags=[{"text": "t", "severity": "s", "evidence": "e", "lens": "l", "id": "x", "token": "SEGREDO"}],
    )
    assert "SEGREDO" not in json.dumps(pacote)
    assert set(pacote) == {"docudata_project_id", "fonte_session_id", "tipo", "ocorrida_em", "conteudo_estruturado", "transcricao"}
    assert set(pacote["conteudo_estruturado"]) == {
        "origem", "contexto_pre_reuniao", "areas_cobertas", "red_flags", "perguntas", "transcricao_truncada",
    }
    assert pacote["tipo"] == "outra"


def test_transcricao_grande_e_cortada_em_linha_inteira_dentro_do_limite():
    linha = "é" * 1000  # 2 bytes por caractere
    chunks = [{"speaker": "A", "text": linha} for _ in range(2000)]
    pacote = _montar(chunks=chunks)
    texto = pacote["transcricao"]
    assert len(texto.encode("utf-8")) <= export.LIMITE_TRANSCRICAO_BYTES
    assert all(l == f"A: {linha}" for l in texto.split("\n"))
    assert pacote["conteudo_estruturado"]["transcricao_truncada"] is True


def test_transcricao_pequena_nao_e_marcada_como_truncada():
    pacote = _montar(chunks=[{"speaker": "A", "text": "oi"}])
    assert pacote["conteudo_estruturado"]["transcricao_truncada"] is False


def test_listas_e_textos_tem_teto():
    perguntas = [{"text": "q" * 5000, "block": "b", "lens": None, "status": "queued"} for _ in range(export.MAX_PERGUNTAS + 50)]
    flags = [{"text": "t", "severity": "warning", "evidence": "e" * 9000, "lens": None} for _ in range(export.MAX_RED_FLAGS + 50)]
    cov = {f"a{i}": {"status": "red"} for i in range(export.MAX_AREAS + 50)}
    c = _montar(perguntas=perguntas, red_flags=flags, coverage_json=cov)["conteudo_estruturado"]
    assert len(c["perguntas"]) == export.MAX_PERGUNTAS and len(c["perguntas"][0]["text"]) <= export.MAX_TEXTO
    assert len(c["red_flags"]) == export.MAX_RED_FLAGS and len(c["red_flags"][0]["evidence"]) <= export.MAX_TEXTO
    assert len(c["areas_cobertas"]) == export.MAX_AREAS


async def test_sessao_inexistente_ou_nao_encerrada_nao_exporta():
    gateway = _Gateway()
    assert await export.exportar_sessao(_db(), "outra-sessao", gateway) is None
    db = _db()
    db._t["sessions"][0]["status"] = "active"
    assert await export.exportar_sessao(db, SID, gateway) is None
    db._t["sessions"][0]["status"] = "finished"
    assert await export.exportar_sessao(db, SID, gateway) == "reuniao-docudata-1"
    assert len(gateway.pacotes) == 1


async def test_vinculo_em_branco_nao_exporta():
    gateway = _Gateway()
    assert await export.exportar_sessao(_db(vinculo="   "), SID, gateway) is None
    assert gateway.pacotes == []


async def test_reexportar_envia_o_mesmo_fonte_session_id():
    gateway = _Gateway()
    await export.exportar_sessao(_db(), SID, gateway)
    await export.exportar_sessao(_db(), SID, gateway)
    assert {p["fonte_session_id"] for p in gateway.pacotes} == {SID}


@pytest.fixture
def _config(monkeypatch):
    monkeypatch.setenv("DOCUDATA_URL", "https://docudata.exemplo.com")
    monkeypatch.setenv("DOCUDATA_DISCOVERY_KEY", "chave-secreta-xyz")


def test_agendar_sem_loop_nao_levanta_nem_cria_tarefa(_config, caplog):
    antes = len(export._TAREFAS)
    export.agendar_exportacao(SID)
    assert len(export._TAREFAS) == antes
    assert "chave-secreta-xyz" not in caplog.text


@pytest.mark.parametrize("erro", [EnvioDefinitivoErro("SEGREDO-no-texto"), EnvioFalhouErro("SEGREDO-no-texto"), ValueError("SEGREDO-no-texto")])
async def test_tarefa_engole_erro_e_loga_so_classe_e_sessao(_config, monkeypatch, caplog, erro):
    async def falha(*_a, **_k):
        raise erro

    monkeypatch.setattr(export, "get_supabase", lambda: object())
    monkeypatch.setattr(export, "exportar_sessao", falha)
    caplog.set_level(logging.DEBUG)
    export.agendar_exportacao(SID)
    assert len(export._TAREFAS) == 1
    await asyncio.gather(*list(export._TAREFAS))
    assert len(export._TAREFAS) == 0
    linhas = [r for r in caplog.records if r.name == export.__name__]
    assert len(linhas) == 1
    msg = linhas[0].getMessage()
    assert type(erro).__name__ in msg and SID in msg
    assert "SEGREDO" not in caplog.text and "chave-secreta-xyz" not in caplog.text and "docudata.exemplo" not in caplog.text


async def test_falha_ao_obter_banco_tambem_e_engolida(_config, monkeypatch):
    def quebra():
        raise RuntimeError("SUPABASE_URL ausente")

    monkeypatch.setattr(export, "get_supabase", quebra)
    export.agendar_exportacao(SID)
    await asyncio.gather(*list(export._TAREFAS))
    assert len(export._TAREFAS) == 0


# --- Fix round 1: paginação, ordem, speaker, surrogate, cobertura, thread ---------------------------
def _db_com_chunks(chunks):
    db = _db()
    db._t["transcript_chunks"] = chunks
    return db


def _chunk(i, texto="fala", speaker="A"):
    return {"id": f"{i:08d}", "session_id": SID, "speaker": speaker, "text": f"{texto} {i}",
            "timestamp": f"2026-10-12T20:{i // 3600:02d}:{(i // 60) % 60:02d}:{i % 60:02d}+00:00"}


async def test_paginacao_traz_todos_os_chunks_em_ordem_sem_truncar():
    chunks = [_chunk(i) for i in range(2300)]
    chunks.reverse()  # fora de ordem na fonte: a ordenação do banco é que decide
    gateway = _Gateway()
    await export.exportar_sessao(_db_com_chunks(chunks), SID, gateway)
    pacote = gateway.pacotes[0]
    linhas = pacote["transcricao"].split("\n")
    assert linhas == [f"A: fala {i}" for i in range(2300)]
    assert pacote["conteudo_estruturado"]["transcricao_truncada"] is False


async def test_paginacao_para_cedo_e_marca_truncado_ao_estourar_o_teto():
    grande = "x" * 15_000  # 1000 chunks = 15 MB: a 1a página já estoura
    chunks = [_chunk(i, grande) for i in range(5000)]
    _Query.requisicoes = 0
    db = _db_com_chunks(chunks)
    gateway = _Gateway()
    await export.exportar_sessao(db, SID, gateway)
    pacote = gateway.pacotes[0]
    assert pacote["conteudo_estruturado"]["transcricao_truncada"] is True
    assert len(pacote["transcricao"].encode("utf-8")) <= export.LIMITE_TRANSCRICAO_BYTES
    # 6 leituras fixas (sessão, projeto, cobertura, perguntas, red flags) + 1 página de chunks
    assert _Query.requisicoes <= 7


async def test_paginacao_termina_quando_a_fonte_sempre_devolve_pagina_cheia(monkeypatch):
    class _Sempre(_Query):
        def execute(self):
            _Query.requisicoes += 1
            return _Resp([{"id": "x", "speaker": "A", "text": "a", "timestamp": "t"}] * export.TAMANHO_PAGINA)

    class _DbSempre(_Db):
        def table(self, nome):
            return _Sempre([]) if nome == "transcript_chunks" else super().table(nome)

    _Query.requisicoes = 0
    gateway = _Gateway()
    await export.exportar_sessao(_DbSempre(_db()._t), SID, gateway)
    assert gateway.pacotes[0]["conteudo_estruturado"]["transcricao_truncada"] is True
    assert _Query.requisicoes <= export.MAX_PAGINAS + 6


async def test_perguntas_e_red_flags_vem_em_ordem_cronologica_e_com_teto():
    db = _db()
    db._t["questions"] = [{"id": f"{i:04d}", "session_id": SID, "text": f"q{i}", "block": "b", "lens": None,
                           "status": "queued", "generated_at": f"2026-10-12T20:{i // 60:02d}:{i % 60:02d}+00:00"}
                          for i in reversed(range(export.MAX_PERGUNTAS + 30))]
    gateway = _Gateway()
    await export.exportar_sessao(db, SID, gateway)
    textos = [q["text"] for q in gateway.pacotes[0]["conteudo_estruturado"]["perguntas"]]
    assert textos == [f"q{i}" for i in range(export.MAX_PERGUNTAS)]


def test_speaker_gigante_e_cortado_e_o_chunk_continua_entrando():
    pacote = _montar(chunks=[{"speaker": "S" * 2_000_000, "text": "oi"}])
    assert pacote["transcricao"] is not None and len(pacote["transcricao"]) <= export.MAX_SPEAKER + 4
    assert pacote["transcricao"].endswith(": oi")


async def test_surrogate_solto_nao_derruba_montar_nem_exportar():
    db = _db_com_chunks([{"id": "1", "session_id": SID, "speaker": "A\ud800", "text": "oi\ud800", "timestamp": "t"}])
    db._t["questions"][0]["text"] = "pergunta\udfff"
    gateway = _Gateway()
    await export.exportar_sessao(db, SID, gateway)
    json.dumps(gateway.pacotes[0], allow_nan=False).encode("utf-8")
    gateway.pacotes[0]["transcricao"].encode("utf-8")
    _montar(chunks=[{"speaker": None, "text": "\ud800"}], coverage_json={"a": {"notes": "\ud800"}})


def test_textos_dentro_das_areas_cobertas_tem_teto():
    cov = {"a": {"notes": "n" * 100_000, "sub": {"x": ["y" * 100_000]}}}
    areas = _montar(coverage_json=cov)["conteudo_estruturado"]["areas_cobertas"]
    assert len(areas["a"]["notes"]) == export.MAX_TEXTO and len(areas["a"]["sub"]["x"][0]) == export.MAX_TEXTO


async def test_leituras_rodam_fora_do_event_loop(monkeypatch):
    import threading
    visto = []
    original = export._ler_dados
    monkeypatch.setattr(export, "_ler_dados", lambda *a: (visto.append(threading.current_thread()), original(*a))[1])
    await export.exportar_sessao(_db(), SID, _Gateway())
    assert visto and visto[0] is not threading.main_thread()


# --- Revisão final: chunk gigante (PDF) e id com espaços ---------------------------------------------
def test_chunk_unico_de_300_mil_caracteres_entra_inteiro_sem_truncar():
    texto = "a" * 300_000
    pacote = _montar(chunks=[{"speaker": "transcript_upload", "text": texto}])
    assert pacote["transcricao"] == f"transcript_upload: {texto}"
    assert pacote["conteudo_estruturado"]["transcricao_truncada"] is False


def test_chunk_de_2mb_e_cortado_no_teto_com_utf8_valido_na_fronteira():
    for prefixo in ("", "b"):  # desloca a fronteira para cair no meio de "é" (2 bytes) em um dos casos
        pacote = _montar(chunks=[{"speaker": "S", "text": prefixo + "é" * 1_000_000}])
        bruto = pacote["transcricao"].encode("utf-8")
        assert LIMITE_MENOS_UM <= len(bruto) <= export.LIMITE_TRANSCRICAO_BYTES
        bruto.decode("utf-8")
        assert pacote["conteudo_estruturado"]["transcricao_truncada"] is True


LIMITE_MENOS_UM = export.LIMITE_TRANSCRICAO_BYTES - 3


async def test_paginacao_conta_bytes_reais_da_linha_e_para_cedo_com_chunk_gigante():
    chunks = [_chunk(0, "z" * 2_000_000)] + [_chunk(i) for i in range(1, 3000)]
    _Query.requisicoes = 0
    gateway = _Gateway()
    await export.exportar_sessao(_db_com_chunks(chunks), SID, gateway)
    assert gateway.pacotes[0]["conteudo_estruturado"]["transcricao_truncada"] is True
    assert _Query.requisicoes <= 6  # 5 leituras fixas + 1 página de chunks


def test_docudata_project_id_vai_sem_espacos():
    pacote = _montar(projeto={"docudata_project_id": " abc-123 ", "pre_meeting_context": None})
    assert pacote["docudata_project_id"] == "abc-123"
