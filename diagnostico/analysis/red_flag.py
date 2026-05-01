# =============================================================================
# analysis/red_flag.py
#
# RedFlagDetector: detecta riscos críticos na transcrição em tempo real.
#
# Diferença em relação ao CoverageClassifier:
#   - Classificador → atualiza o MAPA de cobertura (quais áreas foram tocadas)
#                     Roda a cada 30s, processa deltas acumulados.
#   - RedFlagDetector → emite ALERTAS pontuais sobre riscos específicos
#                     Roda a cada 15s, lê uma janela curta do que foi dito recentemente.
#
# Por que janelas diferentes?
#   O classificador precisa de contexto acumulado para entender o projeto como um todo.
#   O detector de red flags precisa de janelas curtas e frequentes para reagir rápido
#   a sinais de risco — "prazo de 2 semanas", "nunca testamos OAuth", "não temos acesso
#   aos dados reais" são frases que precisam gerar alerta em segundos, não minutos.
#
# Estratégia anti-duplicata:
#   O detector mantém um histórico dos últimos N alertas emitidos. Antes de cada
#   chamada ao LLM, inclui esses alertas no prompt com a instrução "já sinalizamos
#   isso — não repita". O LLM naturalmente evita duplicatas quando informado.
#   Isso é mais robusto que comparação de strings (que quebraria com variações
#   de texto) e mais simples que deduplição por embedding.
# =============================================================================

import logging
from dataclasses import dataclass, field
from datetime import datetime

from llm.base import LLMClient, Message
from prompts import RED_FLAG_SYSTEM_PROMPT
from transcription.buffer import TranscriptBuffer

logger = logging.getLogger(__name__)

# Máximo de alertas do histórico recente que são enviados ao LLM para
# evitar duplicatas. Mais que 10 começa a poluir o contexto sem ganho.
_MAX_HISTORY_FOR_DEDUP = 10

# Máximo de tokens da janela de transcrição enviada ao detector.
# ~600 tokens ≈ 60-90 segundos de fala, dependendo da velocidade do falante.
# Enviamos mais que 30s para capturar o contexto imediato da frase de risco.
_WINDOW_TOKENS = 600


@dataclass
class RedFlag:
    """Representa um alerta de risco detectado na transcrição.

    Diferente do Alert do renderer (que é um objeto de UI), o RedFlag é o
    modelo de domínio — contém também o campo 'evidence' (trecho exato da
    transcrição que gerou o alerta), útil para debug e para a estratégia
    anti-duplicata.

    Por que separar RedFlag (domínio) de Alert (UI)?
    Single Responsibility: o detector não deve conhecer detalhes do renderer.
    O orchestrator faz a tradução: RedFlag → Alert quando passa para o renderer.
    """
    level: str     # "warning" ou "critical"
    text: str      # descrição do risco (1-2 frases)
    evidence: str  # trecho da transcrição que gerou o alerta (≤120 chars)
    ts: datetime = field(default_factory=datetime.now)


class RedFlagDetector:
    """Analisa a transcrição recente e emite alertas de risco em tempo real.

    Recebe por injeção de dependência:
    - LLMClient         → para chamar o modelo com o RED_FLAG_SYSTEM_PROMPT
    - TranscriptBuffer  → para ler a janela recente de transcrição

    Não depende do CoverageTracker nem do CLIRenderer — não é sua
    responsabilidade atualizar o mapa ou exibir alertas. Ele só detecta
    e retorna a lista de RedFlags encontrados.
    """

    def __init__(self, llm: LLMClient, buffer: TranscriptBuffer) -> None:
        self._llm = llm
        self._buffer = buffer

        # Histórico dos alertas já emitidos, do mais recente para o mais antigo.
        # Usado para construir o contexto anti-duplicata enviado ao LLM.
        self._emitted: list[RedFlag] = []

    def detect(self) -> list[RedFlag]:
        """Analisa a janela recente e retorna os novos red flags encontrados.

        Retorna lista vazia se:
        - o buffer estiver vazio (reunião ainda não começou)
        - o LLM não encontrar red flags no trecho atual
        - o LLM retornar JSON malformado (generate_json() faz fallback para {})

        Este método é síncrono porque o LLMClient é síncrono. O orchestrator
        chama via asyncio.to_thread() para não bloquear o event loop.
        """
        # Sem transcrição, sem análise — evita chamada desnecessária ao LLM
        if self._buffer.is_empty():
            return []

        # Texto recente da transcrição para análise.
        # recent_text() retorna os chunks mais recentes até o limite de tokens,
        # no formato "[speaker]: texto" — exatamente o que o prompt espera.
        recent = self._buffer.recent_text(max_tokens=_WINDOW_TOKENS)
        if not recent.strip():
            return []

        # Monta o contexto anti-duplicata: lista dos últimos N alertas emitidos.
        # O RED_FLAG_SYSTEM_PROMPT instrui o LLM a não repetir alertas que já
        # constam nesta lista — reduz drasticamente ruído de duplicatas.
        dedup_context = self._build_dedup_context()

        # Monta a mensagem do usuário para o LLM.
        # A separação em seções "===" torna mais fácil para o LLM distinguir
        # qual parte é contexto histórico e qual é a nova transcrição.
        user_content_parts = [
            "=== TRECHO RECENTE DA TRANSCRIÇÃO ===",
            recent,
        ]
        if dedup_context:
            user_content_parts = [
                "=== ALERTAS JÁ EMITIDOS NESTA SESSÃO (não repita) ===",
                dedup_context,
                "",
            ] + user_content_parts

        messages: list[Message] = [
            Message(role="system", content=RED_FLAG_SYSTEM_PROMPT),
            Message(role="user", content="\n".join(user_content_parts)),
        ]

        # Chama o LLM com fallback robusto: se o JSON vier malformado,
        # generate_json() retorna {} e não levanta exceção.
        result = self._llm.generate_json(messages)

        # Converte o JSON em objetos RedFlag e filtra entradas inválidas
        new_flags = self._parse_flags(result)

        # Registra os novos alertas no histórico de deduplicação
        if new_flags:
            self._emitted = (new_flags + self._emitted)[:_MAX_HISTORY_FOR_DEDUP]
            logger.info(
                "RedFlagDetector: %d novo(s) alerta(s) emitido(s).", len(new_flags)
            )
        else:
            logger.debug("RedFlagDetector: nenhum red flag no trecho atual.")

        return new_flags

    # ── Métodos privados ──────────────────────────────────────────────────────

    def _build_dedup_context(self) -> str:
        """Serializa os alertas recentes em texto para o contexto anti-duplicata.

        Formato: "- [level] texto (evidência)"
        Enviamos apenas os _MAX_HISTORY_FOR_DEDUP mais recentes para não
        inflacionar demais o prompt.

        Retorna string vazia se ainda não houver alertas anteriores.
        """
        if not self._emitted:
            return ""

        lines = []
        for flag in self._emitted[:_MAX_HISTORY_FOR_DEDUP]:
            lines.append(f"- [{flag.level}] {flag.text}")
        return "\n".join(lines)

    def _parse_flags(self, result: dict) -> list[RedFlag]:
        """Converte o JSON retornado pelo LLM em objetos RedFlag.

        Valida cada alerta individualmente:
        - Ignora entradas que não são dict
        - Ignora alertas sem 'text' (campo obrigatório)
        - Normaliza 'level' para "warning" ou "critical" (default: "warning")
        - Limita 'evidence' a 120 chars (como o prompt especifica)

        Retorna apenas os alertas válidos — nunca levanta exceção.
        """
        flags: list[RedFlag] = []

        for alert in result.get("alerts", []):
            # Valida estrutura mínima
            if not isinstance(alert, dict):
                continue

            text = alert.get("text", "").strip()
            if not text:
                # Alerta sem texto é inútil — descarta
                continue

            # Normaliza o level: só aceita "warning" ou "critical"
            level_raw = alert.get("level", "warning").lower()
            level = level_raw if level_raw in ("warning", "critical") else "warning"

            evidence = alert.get("evidence", "")[:120]  # limita como o prompt pede

            flags.append(RedFlag(level=level, text=text, evidence=evidence))

        return flags
