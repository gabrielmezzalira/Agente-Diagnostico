# =============================================================================
# coverage/classifier.py
#
# CoverageClassifier: analisa a transcrição recente e atualiza o mapa de
# cobertura de risco usando o LLM.
#
# Como funciona:
#   1. O RealtimeOrchestrator chama classify() a cada 30s (ou quando o buffer
#      acumula >250 tokens novos — "early trigger").
#   2. O classificador monta uma mensagem para o LLM descrevendo:
#      - o estado atual de todas as áreas (id, nome, status, evidence)
#      - os chunks novos desde o último flush (não a transcrição inteira)
#   3. O LLM responde com um JSON contendo:
#      - updates: quais áreas mudaram de status e por quê
#      - activate_presets: presets dinâmicos a ativar (ia_ml, mobile, etc.)
#      - new_dynamic_areas: novas áreas específicas do projeto
#   4. O classificador aplica as mudanças no CoverageTracker.
#   5. Chama buffer.flush() para marcar os chunks como processados.
#
# Por que enviar apenas os deltas e não a transcrição inteira?
# Custo de LLM. Em uma reunião de 1h com timer de 30s = ~120 chamadas.
# Se mandasse a transcrição inteira (~10k tokens por chamada no final),
# o custo seria inaceitável. Enviando apenas os deltas (~200-500 tokens/chamada),
# mantemos o custo controlado. O CoverageTracker guarda o estado acumulado
# entre as chamadas — o LLM não precisa reler tudo do zero.
# =============================================================================

import logging

from llm.base import LLMClient, Message
from prompts import CLASSIFIER_SYSTEM_PROMPT
from transcription.buffer import TranscriptBuffer

from .area import RiskArea, Status
from .tracker import CoverageTracker

logger = logging.getLogger(__name__)


class CoverageClassifier:
    """Usa o LLM para analisar a transcrição recente e atualizar o CoverageTracker.

    Recebe por injeção de dependência:
    - LLMClient    → para chamar o modelo (Gemini, Claude, etc.)
    - CoverageTracker → onde aplicar as mudanças detectadas
    - TranscriptBuffer → de onde buscar os deltas de transcrição

    Por que injeção de dependência?
    O classificador não sabe (nem precisa saber) qual LLM está sendo usado,
    como o tracker funciona internamente, ou como o buffer acumula chunks.
    Ele só conhece as interfaces. Isso facilita trocar componentes sem mudar
    esta classe.
    """

    def __init__(
        self,
        llm: LLMClient,
        tracker: CoverageTracker,
        buffer: TranscriptBuffer,
    ) -> None:
        self._llm = llm
        self._tracker = tracker
        self._buffer = buffer

    def classify(self) -> bool:
        """Analisa os deltas de transcrição e atualiza o mapa de cobertura.

        Retorna True se houve alguma mudança no tracker (útil para o renderer
        saber quando precisa redesenhar o painel com prioridade).

        Retorna False sem fazer nada se o buffer não tiver novos chunks —
        evita chamadas desnecessárias ao LLM.

        Este método é síncrono porque o GeminiClient é síncrono. O orchestrator
        envolve a chamada em asyncio.to_thread() para não bloquear o event loop.
        """
        # Se não há nada novo, não vale chamar o LLM
        delta_chunks = self._buffer.window_since_flush()
        if not delta_chunks:
            return False

        # Monta o texto dos deltas no formato "[speaker]: texto"
        # O CLASSIFIER_SYSTEM_PROMPT instrui o LLM a analisar exatamente esse
        # formato para identificar quais áreas de risco foram tocadas.
        delta_text = "\n".join(
            f"[{chunk.speaker}]: {chunk.text}" for chunk in delta_chunks
        )

        # Monta o estado atual das áreas para o LLM usar como contexto.
        # Enviamos id, nome, status atual e evidence — o suficiente para o
        # classificador entender o que já foi coberto e o que ainda está em aberto.
        areas_state = self._build_areas_state_text()

        # Monta as mensagens para a chamada ao LLM:
        # - system: CLASSIFIER_SYSTEM_PROMPT (instrução de comportamento)
        # - user:   estado das áreas + deltas de transcrição
        messages: list[Message] = [
            Message(role="system", content=CLASSIFIER_SYSTEM_PROMPT),
            Message(
                role="user",
                content=(
                    "=== ESTADO ATUAL DAS ÁREAS DE RISCO ===\n"
                    f"{areas_state}\n\n"
                    "=== TRECHO NOVO DA TRANSCRIÇÃO (desde última análise) ===\n"
                    f"{delta_text}"
                ),
            ),
        ]

        # Chama o LLM e faz parse do JSON. generate_json() tem 3 níveis de
        # fallback e nunca levanta exceção — retorna {} em caso de falha.
        result = self._llm.generate_json(messages)

        # Marca os chunks como processados ANTES de aplicar as mudanças.
        # Se a aplicação falhar parcialmente, os chunks não serão reprocessados
        # na próxima chamada — evita duplicar atualizações.
        self._buffer.flush()

        # Aplica as mudanças retornadas pelo LLM
        changed = self._apply_result(result)

        if changed:
            logger.info(
                "CoverageClassifier: %d chunks processados, mudanças aplicadas.",
                len(delta_chunks),
            )
        else:
            logger.debug(
                "CoverageClassifier: %d chunks processados, sem mudanças no tracker.",
                len(delta_chunks),
            )

        return changed

    # ── Métodos privados ──────────────────────────────────────────────────────

    def _build_areas_state_text(self) -> str:
        """Serializa o estado atual das áreas em texto legível para o LLM.

        Formato por linha:
          [id] Nome (status) — evidence

        Exemplo:
          [auth_seguranca] Auth / Segurança (yellow) — cliente confirmou JWT
          [integracoes] Integrações Externas (red) —

        O LLM usa esse texto para entender o que já foi coberto e evitar
        classificar como "nova informação" algo que já foi registrado.
        """
        lines: list[str] = []
        for area in self._tracker.get_state().values():
            evidence_part = f" — {area.evidence}" if area.evidence else " —"
            lines.append(
                f"[{area.id}] {area.name} ({area.status.value}){evidence_part}"
            )
        return "\n".join(lines)

    def _apply_result(self, result: dict) -> bool:
        """Aplica o JSON retornado pelo LLM no CoverageTracker.

        Processa três campos:
        1. updates          → atualiza status e evidence de áreas existentes
        2. activate_presets → ativa conjuntos pré-definidos de áreas dinâmicas
        3. new_dynamic_areas → adiciona áreas específicas do projeto

        Retorna True se pelo menos uma mudança foi aplicada.

        Por que validar cada campo individualmente?
        O LLM pode retornar campos ausentes, com tipos errados ou com ids
        inválidos. Validamos defensivamente para não corromper o estado do
        tracker — preferimos ignorar dados inválidos do que travar a sessão.
        """
        changed = False

        # ── 1. Atualiza áreas existentes ──────────────────────────────────────
        for update in result.get("updates", []):
            # Valida que o update tem a estrutura esperada
            if not isinstance(update, dict):
                continue

            area_id = update.get("area_id", "")
            new_status_raw = update.get("new_status", "")
            evidence = update.get("evidence", "")

            # Converte string → Status enum. Ignora se o LLM devolveu valor inválido.
            new_status = _parse_status(new_status_raw)
            if not new_status:
                logger.debug("update ignorado: status inválido %r para área %r", new_status_raw, area_id)
                continue

            # update_area() ignora silenciosamente se area_id não existir
            self._tracker.update_area(area_id, new_status, evidence)
            changed = True

        # ── 2. Ativa presets dinâmicos ────────────────────────────────────────
        for preset_key in result.get("activate_presets", []):
            if not isinstance(preset_key, str):
                continue
            added = self._tracker.activate_preset(preset_key)
            if added > 0:
                logger.info("Preset '%s' ativado: %d áreas adicionadas.", preset_key, added)
                changed = True

        # ── 3. Adiciona áreas específicas do projeto ──────────────────────────
        for new_area_data in result.get("new_dynamic_areas", []):
            if not isinstance(new_area_data, dict):
                continue

            area_id = new_area_data.get("id", "")
            area_name = new_area_data.get("name", "")
            evidence = new_area_data.get("evidence", "")

            # Valida que id e nome existem e são strings não-vazias
            if not area_id or not area_name or not isinstance(area_id, str):
                logger.debug("new_dynamic_area ignorada: dados incompletos %r", new_area_data)
                continue

            # Cria como "specific" — tipo reservado para áreas criadas pela IA
            # para projetos atípicos que não se encaixam nos presets padrão.
            area = RiskArea(
                id=area_id,
                name=area_name,
                kind="specific",
                evidence=evidence[:200],  # limita o tamanho como no tracker
            )

            added = self._tracker.add_dynamic_area(area)
            if added:
                logger.info("Nova área específica adicionada: '%s' (%s).", area_name, area_id)
                changed = True

        return changed


# ── Função auxiliar (module-level) ────────────────────────────────────────────

def _parse_status(raw: str) -> Status | None:
    """Converte string do JSON do LLM para o enum Status.

    Retorna None se a string não for um valor válido — o chamador decide
    o que fazer com None (tipicamente: ignorar o update).

    Por que não usar Status(raw) diretamente?
    Status(raw) levanta ValueError se raw não for um valor válido.
    Precisamos de um parse que seja seguro e não trave a sessão.
    """
    try:
        return Status(raw.lower())  # Status.RED = "red", então normaliza para minúsculas
    except (ValueError, AttributeError):
        return None
