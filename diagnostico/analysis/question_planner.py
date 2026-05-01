# =============================================================================
# analysis/question_planner.py
#
# QuestionPlanner: gera perguntas priorizadas para os pontos de risco ainda
# não cobertos na reunião, sob demanda do comercial (tecla P).
#
# Diferença em relação ao CoverageClassifier e RedFlagDetector:
#   - Classificador  → roda em timer (30s), atualiza o mapa de cobertura
#   - RedFlagDetector→ roda em timer (15s), emite alertas de risco
#   - QuestionPlanner→ roda SOB DEMANDA (tecla P), gera perguntas priorizadas
#
# Por que sob demanda e não em timer?
#   Perguntas sugeridas durante a reunião precisam ser relevantes ao MOMENTO.
#   Se gerarmos a cada 30s em background, o comercial pode apertar P e ver
#   perguntas obsoletas (o cliente já respondeu aquilo há 2min). Gerando
#   somente quando P é pressionado, garantimos que as sugestões refletem
#   o estado atual da conversa.
#
# Contexto enviado ao LLM:
#   1. Estado das áreas de risco (quais estão RED/YELLOW com seus evidences)
#   2. Contexto recente da reunião (últimas falas do buffer ou histórico CLI)
#   3. Últimas perguntas sugeridas (anti-repetição — LLM não repete o que
#      acabou de sugerir)
# =============================================================================

import logging
from llm.base import LLMClient, Message
from prompts import QUESTION_PLANNER_SYSTEM_PROMPT
from coverage.tracker import CoverageTracker
from transcription.buffer import TranscriptBuffer

logger = logging.getLogger(__name__)

# Máximo de tokens do contexto da reunião enviado ao planner.
# ~2000 tokens ≈ 10-15 minutos de conversa — contexto suficiente para o LLM
# entender o que já foi discutido sem estourar o orçamento de tokens.
_CONTEXT_MAX_TOKENS = 2000

# Quantas sugestões anteriores incluir no prompt anti-repetição.
# As últimas 3 são suficientes — o LLM não vai repetir o que acabou de sugerir.
_PREV_QUESTIONS_LIMIT = 3


class QuestionPlanner:
    """Gera perguntas priorizadas para as áreas de risco ainda não cobertas.

    Recebe por injeção de dependência:
    - LLMClient        → para chamar o modelo com o QUESTION_PLANNER_SYSTEM_PROMPT
    - CoverageTracker  → para saber quais áreas estão RED/YELLOW (priorizar)
    - TranscriptBuffer → para ter contexto recente da reunião (modo realtime)

    O buffer é opcional: se None, o planner funciona sem contexto de transcrição
    (útil no modo interativo, onde o contexto vem do histórico de mensagens).
    """

    def __init__(
        self,
        llm: LLMClient,
        tracker: CoverageTracker,
        buffer: TranscriptBuffer | None = None,
    ) -> None:
        self._llm = llm
        self._tracker = tracker
        self._buffer = buffer

        # Histórico das últimas sugestões geradas, usado para anti-repetição.
        # Guardamos como lista de dicts {area_id, question} — o mínimo para
        # o LLM entender o que já foi sugerido sem receber tudo.
        self._last_suggestions: list[dict] = []

    def plan(self, history: list[Message] | None = None) -> list[dict]:
        """Gera as 3 perguntas mais importantes para o momento atual da reunião.

        Args:
            history: histórico de mensagens do ConversationManager (modo interativo).
                     Se None, usa o buffer de transcrição (modo realtime).
                     Se ambos forem None/vazio, o LLM recebe só o mapa de cobertura.

        Returns:
            Lista de até 3 dicts com {area_id, question, rationale}.
            Retorna lista vazia se não houver áreas descobertas ou se o LLM
            retornar JSON inválido.
        """
        # Verifica se há áreas ainda não cobertas para perguntar
        red_zones = self._tracker.red_zones()
        if not red_zones:
            # Todas as áreas estão GREEN — nada a perguntar
            logger.info("QuestionPlanner: todas as áreas estão GREEN, nenhuma pergunta gerada.")
            return []

        # Serializa o estado das áreas para o LLM
        areas_text = self._build_areas_text()

        # Obtém o contexto da conversa: buffer de transcrição (realtime) ou
        # histórico de mensagens (interativo), o que estiver disponível.
        context_text = self._build_context_text(history)

        # Serializa as últimas sugestões para o contexto anti-repetição
        prev_text = self._build_prev_suggestions_text()

        # Monta a mensagem do usuário com todas as seções claramente delimitadas
        user_parts = [
            "=== ESTADO ATUAL DAS ÁREAS DE RISCO ===",
            areas_text,
        ]
        if context_text:
            user_parts += [
                "",
                "=== CONTEXTO RECENTE DA REUNIÃO ===",
                context_text,
            ]
        if prev_text:
            user_parts += [
                "",
                "=== ÚLTIMAS PERGUNTAS SUGERIDAS (não repita) ===",
                prev_text,
            ]

        messages: list[Message] = [
            Message(role="system", content=QUESTION_PLANNER_SYSTEM_PROMPT),
            Message(role="user", content="\n".join(user_parts)),
        ]

        # Chama o LLM com fallback robusto — generate_json() nunca lança exceção
        result = self._llm.generate_json(messages)

        # Converte o JSON em lista de dicts validados
        questions = self._parse_questions(result)

        # Atualiza o histórico anti-repetição com as novas sugestões
        if questions:
            self._last_suggestions = questions[:_PREV_QUESTIONS_LIMIT]
            logger.info("QuestionPlanner: %d pergunta(s) gerada(s).", len(questions))
        else:
            logger.debug("QuestionPlanner: LLM não retornou perguntas válidas.")

        return questions

    # ── Métodos privados ──────────────────────────────────────────────────────

    def _build_areas_text(self) -> str:
        """Serializa todas as áreas do tracker para o LLM.

        Formato: "[id] Nome (status) — evidence"
        Agrupa primeiro as áreas RED/YELLOW (prioritárias) e depois as GREEN,
        para o LLM entender visualmente qual é a ordem de prioridade.
        """
        from coverage.area import Status

        lines: list[str] = []

        # Primeiro as áreas que precisam de atenção (RED e YELLOW)
        for area in self._tracker.red_zones():
            evidence_part = f" — {area.evidence}" if area.evidence else " — (sem informação)"
            lines.append(f"[{area.id}] {area.name} ({area.status.value}){evidence_part}")

        # Depois as cobertas (para o LLM saber o que NÃO perguntar)
        for area in self._tracker.get_state().values():
            if area.status == Status.GREEN:
                lines.append(f"[{area.id}] {area.name} (green) — {area.evidence or 'coberta'}")

        return "\n".join(lines)

    def _build_context_text(self, history: list[Message] | None) -> str:
        """Monta o contexto da conversa a partir da melhor fonte disponível.

        Prioridade:
        1. Buffer de transcrição (modo realtime) — mais atual
        2. Histórico de mensagens (modo interativo) — fallback
        3. String vazia — se nenhum contexto estiver disponível

        Para o histórico de mensagens, filtramos as mensagens "system" (são
        instruções de comportamento, não contexto da reunião) e limitamos
        a ~2000 tokens para não estourar o orçamento.
        """
        # Modo realtime: buffer tem os chunks recentes da transcrição ao vivo
        if self._buffer is not None and not self._buffer.is_empty():
            return self._buffer.recent_text(max_tokens=_CONTEXT_MAX_TOKENS)

        # Modo interativo: histórico de mensagens user/assistant
        if history:
            # Filtra apenas user e assistant — ignora system prompt (muito longo)
            # e serializa no formato "role: conteúdo"
            lines: list[str] = []
            token_count = 0
            # Percorre do mais recente para o mais antigo para respeitar o limite
            for msg in reversed(history):
                if msg.role == "system":
                    continue  # system prompt não é contexto de conversa
                tokens = max(1, len(msg.content.split()) * 4 // 3)
                if token_count + tokens > _CONTEXT_MAX_TOKENS:
                    break
                lines.append(f"{msg.role}: {msg.content}")
                token_count += tokens
            # Reverte para ordem cronológica antes de retornar
            return "\n".join(reversed(lines))

        return ""

    def _build_prev_suggestions_text(self) -> str:
        """Serializa as últimas sugestões para o contexto anti-repetição.

        Formato: "- [area_id] pergunta"
        Retorna string vazia se ainda não houver sugestões anteriores.
        """
        if not self._last_suggestions:
            return ""
        lines = []
        for q in self._last_suggestions:
            area_id = q.get("area_id", "?")
            question = q.get("question", "")
            lines.append(f"- [{area_id}] {question}")
        return "\n".join(lines)

    def _parse_questions(self, result: dict) -> list[dict]:
        """Converte o JSON retornado pelo LLM em lista de perguntas validadas.

        Valida cada entrada individualmente:
        - Ignora entradas que não são dict
        - Ignora perguntas sem o campo 'question' (obrigatório)
        - Garante que 'area_id' e 'rationale' existem (strings vazias como default)

        Retorna no máximo 3 perguntas — o QUESTION_PLANNER_SYSTEM_PROMPT já
        instrui o LLM a gerar exatamente 3, mas validamos aqui por segurança.
        """
        questions: list[dict] = []

        for item in result.get("questions", []):
            if not isinstance(item, dict):
                continue

            question = item.get("question", "").strip()
            if not question:
                # Pergunta sem texto é inútil — descarta
                continue

            questions.append({
                "area_id":  item.get("area_id", ""),
                "question": question,
                "rationale": item.get("rationale", ""),
            })

        # Limita a 3 perguntas — mais que isso sobrecarrega o painel e o comercial
        return questions[:3]
