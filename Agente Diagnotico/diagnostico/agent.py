# =============================================================================
# agent.py
#
# O DiagnosticAgent orquestra a entrevista técnica de diagnóstico.
#
# É o "cérebro" da aplicação no modo interativo: sabe em que passo está
# (iniciando, entrevistando, oferecendo relatório), mas não sabe como o
# LLM funciona, como o histórico é guardado, ou como o relatório é salvo —
# ele delega tudo isso para os componentes injetados.
#
# Fluxo da entrevista:
#   start(descrição) → [loop] respond(resposta) → generate_report()
# =============================================================================

from llm.base import LLMClient, Message
from conversation import ConversationManager
from report import ReportGenerator
from prompts import SYSTEM_PROMPT, REPORT_PROMPT
from pathlib import Path


class DiagnosticAgent:
    """Orquestra a entrevista de diagnóstico técnico.

    Recebe os três componentes por injeção de dependência no construtor:
    - LLMClient         → como gerar texto (Gemini, Claude, etc.)
    - ConversationManager → como guardar o histórico
    - ReportGenerator   → como salvar o relatório em disco

    Por que injeção de dependência?
    O agente não cria seus próprios componentes — recebe prontos de fora.
    Isso permite:
    1. Trocar o LLM sem mudar o agente (passa outro LLMClient)
    2. Testar o agente com mocks sem precisar da API real
    3. Reusar o mesmo agente com configurações diferentes
    """

    def __init__(
        self,
        llm: LLMClient,
        conversation: ConversationManager,
        reporter: ReportGenerator,
    ) -> None:
        self._llm = llm
        self._conversation = conversation
        self._reporter = reporter

        # Flag que sinaliza quando o agente chegou na fase de oferecer o relatório.
        # O main.py lê este flag no loop para saber quando perguntar ao usuário
        # se quer gerar o relatório ou continuar.
        self.offered_report: bool = False

    def start(self, project_description: str) -> str:
        """Inicia a entrevista com a descrição do projeto.

        Injeta o SYSTEM_PROMPT no início do histórico e em seguida a descrição
        do projeto como primeira mensagem do "usuário". Então chama o LLM para
        gerar a primeira pergunta do agente.

        Por que o SYSTEM_PROMPT vai no histórico e não na API diretamente?
        O ConversationManager guarda tudo — incluindo o system prompt — em uma
        lista uniforme de Message. O GeminiClient depois separa as mensagens
        "system" das demais na hora de montar a chamada à API. Isso mantém
        o ConversationManager simples (só lista) e o GeminiClient como único
        conhecedor do formato da API.

        Args:
            project_description: descrição livre do projeto fornecida pelo comercial.

        Returns:
            Primeira pergunta gerada pelo agente.
        """
        # Injeta as instruções de comportamento do agente
        self._conversation.add_message("system", SYSTEM_PROMPT)

        # A descrição do projeto é tratada como a primeira "fala do usuário"
        self._conversation.add_message("user", f"Projeto: {project_description}")

        # Chama o LLM com todo o histórico (system + descrição do projeto)
        # O Gemini vai gerar a primeira pergunta seguindo as regras do SYSTEM_PROMPT
        response = self._llm.generate(self._conversation.get_history())

        # Adiciona a resposta do agente ao histórico para que as próximas
        # chamadas tenham contexto de tudo que já foi perguntado
        self._conversation.add_message("assistant", response)

        return response

    def respond(self, user_input: str) -> str:
        """Processa a resposta do usuário e gera a próxima pergunta do agente.

        Adiciona a resposta do usuário ao histórico, chama o LLM com o
        histórico completo, e verifica se o agente está sinalizando que
        quer gerar o relatório.

        O LLM usa TODO o histórico acumulado — não só a última mensagem.
        Isso é fundamental para o agente não repetir perguntas e fazer
        perguntas cada vez mais específicas com base em tudo que foi dito.

        Args:
            user_input: resposta do comercial para a última pergunta do agente.

        Returns:
            Próxima pergunta ou comentário do agente.
        """
        # Adiciona a resposta do usuário ao histórico antes de chamar o LLM
        self._conversation.add_message("user", user_input)

        # Chama o LLM com o histórico completo atualizado
        response = self._llm.generate(self._conversation.get_history())

        # Registra a resposta do agente no histórico
        self._conversation.add_message("assistant", response)

        # Verifica se o agente chegou na fase de oferecer o relatório.
        # O SYSTEM_PROMPT instrui o agente a dizer "Posso gerar o relatório agora?"
        # quando tiver contexto suficiente. Fazemos a detecção via busca de string
        # na resposta (simples mas suficiente — o prompt é bem específico sobre o texto).
        response_lower = response.lower()
        self.offered_report = (
            "posso gerar o relatório" in response_lower
            or "posso gerar o relatório" in response_lower  # variante sem acento
            or "gerar o relatório agora" in response_lower
        )

        return response

    def generate_report(self) -> tuple[str, Path]:
        """Gera e salva o relatório final de diagnóstico (modo interativo).

        Injeta o REPORT_PROMPT no FIM do histórico como se fosse uma instrução
        do usuário — o LLM vai "responder" a essa instrução gerando o relatório
        estruturado em Markdown.

        Por que criar history_with_report em vez de adicionar ao histórico real?
        O REPORT_PROMPT é uma instrução de geração, não uma pergunta da entrevista.
        Se o adicionássemos ao ConversationManager, ele apareceria nas próximas
        chamadas ao LLM e confundiria o contexto da entrevista. Criar uma lista
        separada (sem modificar o histórico) mantém a separação limpa.

        Returns:
            Tupla (conteúdo_do_relatório, caminho_do_arquivo_salvo)
        """
        # Cria uma nova lista com o histórico atual + instrução de relatório.
        # get_history() retorna uma CÓPIA da lista interna, então o + aqui
        # cria uma terceira lista sem modificar nenhuma das duas originais.
        history_with_report = self._conversation.get_history() + [
            Message(role="user", content=REPORT_PROMPT)
        ]

        # Gera o relatório completo com base em toda a entrevista + instrução
        report_content = self._llm.generate(history_with_report)

        # Delega a persistência em disco para o ReportGenerator
        filepath = self._reporter.save(report_content)

        return report_content, filepath

    def generate_report_with_coverage(self, tracker) -> tuple[str, Path]:
        """Gera relatório prefixado com o mapa de cobertura final (modo realtime).

        Args:
            tracker: CoverageTracker com o estado final das áreas de risco.

        Returns:
            Tupla (conteúdo_do_relatório, caminho_do_arquivo_salvo)
        """
        history_with_report = self._conversation.get_history() + [
            Message(role="user", content=_build_augmented_report_prompt(tracker))
        ]
        report_content = self._llm.generate(history_with_report)
        filepath = self._reporter.save(report_content)
        return report_content, filepath

    def ingest_transcript_chunk(self, chunk) -> None:
        """Adiciona um chunk de transcrição ao histórico. Usado no modo realtime.

        No modo tempo real, os chunks de transcrição substituem o input manual
        do usuário. Cada chunk é adicionado com uma tag [TRANSCRIPT] para que
        o LLM e o classificador saibam distinguir transcrição de digitação manual.

        Args:
            chunk: TranscriptChunk com text, speaker e ts (de transcription/base.py)
        """
        self._conversation.append_transcript(chunk)

    def request_questions(self, tracker, buffer) -> list[dict]:
        """Gera perguntas sugeridas com base no estado atual do mapa de cobertura.

        Usado no modo interativo quando o agente quer sugerir perguntas ao
        comercial com base nas áreas ainda não cobertas. No modo realtime,
        o RealtimeOrchestrator chama o QuestionPlanner diretamente (sem passar
        pelo DiagnosticAgent).

        Cria um QuestionPlanner a cada chamada (sem estado persistente entre
        chamadas neste método) e usa o histórico do ConversationManager como
        contexto — no modo interativo, é o histórico de perguntas e respostas
        da entrevista, não transcrição ao vivo.

        Args:
            tracker: CoverageTracker com o estado atual das áreas
            buffer:  TranscriptBuffer com o contexto recente (pode ser None
                     no modo interativo, onde o contexto vem do histórico)

        Returns:
            Lista de dicts com {area_id, question, rationale}
        """
        from analysis.question_planner import QuestionPlanner

        # Passa buffer=None se for do tipo errado — QuestionPlanner aceita None
        # e usa o histórico de mensagens como fallback de contexto.
        planner = QuestionPlanner(
            llm=self._llm,
            tracker=tracker,
            buffer=buffer,
        )
        # Passa o histórico da entrevista como contexto — o planner vai filtrar
        # as mensagens system e usar apenas as trocas user/assistant.
        return planner.plan(history=self._conversation.get_history())


# ── Funções auxiliares (module-level) ────────────────────────────────────────

def _build_augmented_report_prompt(tracker) -> str:
    """Combina o mapa de cobertura com o REPORT_PROMPT para geração de relatório."""
    coverage_context = _build_coverage_summary(tracker)
    return (
        "=== MAPA DE COBERTURA FINAL DA REUNIÃO ===\n"
        f"{coverage_context}\n\n"
        "Use o mapa acima para preencher a seção 4 (Perguntas sem resposta) "
        "com as áreas que ficaram em RED, e para calibrar o nível de complexidade "
        "baseado na profundidade real do diagnóstico.\n\n"
        f"{REPORT_PROMPT}"
    )


def _build_coverage_summary(tracker) -> str:
    """Serializa o estado final do CoverageTracker em texto para o LLM.

    Formato por linha: "[id] Nome (status) — evidence"
    Agrupa por prioridade: RED primeiro (maior risco), depois YELLOW, depois GREEN.
    Inclui o score de saturação no final para o LLM calibrar a confiança.

    Por que módulo-nível e não método do DiagnosticAgent?
    Single Responsibility: a serialização do tracker não é responsabilidade
    do agente — ele apenas usa o resultado. Função pura facilita teste.

    Args:
        tracker: qualquer objeto com get_state() → dict[str, RiskArea]
                 e saturation_score() → float.
    """
    from coverage.area import Status

    areas = tracker.get_state().values()

    # Ordena por prioridade: RED → YELLOW → GREEN
    order = {Status.RED: 0, Status.YELLOW: 1, Status.GREEN: 2}
    sorted_areas = sorted(areas, key=lambda a: order.get(a.status, 3))

    lines: list[str] = []
    for area in sorted_areas:
        icon = {"red": "🔴", "yellow": "🟡", "green": "🟢"}.get(area.status.value, "⚪")
        evidence_part = f" — {area.evidence}" if area.evidence else " — (não investigada)"
        lines.append(f"{icon} [{area.id}] {area.name} ({area.status.value}){evidence_part}")

    # Score de saturação como indicador de confiança diagnóstica
    score = tracker.saturation_score()
    lines.append(f"\nSaturação diagnóstica: {score:.0%}")

    return "\n".join(lines)
