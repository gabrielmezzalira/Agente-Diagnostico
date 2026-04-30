# =============================================================================
# conversation.py
#
# Responsabilidade única: gerenciar o histórico da conversa entre o
# comercial e o agente.
#
# O ConversationManager é o "caderno de anotações" da entrevista — guarda
# todas as mensagens trocadas em ordem cronológica. O DiagnosticAgent usa
# o histórico completo a cada chamada ao LLM, porque o Gemini precisa de
# todo o contexto para gerar perguntas cada vez mais específicas.
# =============================================================================

from llm.base import Message


class ConversationManager:
    """Armazena e fornece o histórico completo da conversa.

    
    Estrutura interna: uma lista de Message em ordem cronológica.
    A primeira mensagem é sempre o SYSTEM_PROMPT (role="system"),
    seguida pela descrição do projeto, e então as perguntas e respostas
    alternando entre "assistant" e "user".

    Exemplo de histórico após 2 turnos:
        [0] Message(role="system",    content="Você é um tech lead...")
        [1] Message(role="user",      content="Projeto: app de gestão...")
        [2] Message(role="assistant", content="Quantos usuários simultâneos...")
        [3] Message(role="user",      content="Esperamos 500 por dia...")
        [4] Message(role="assistant", content="⚠️ RED FLAG: integração OAuth...")
    """

    def __init__(self) -> None:
        # Lista privada — ninguém de fora altera o histórico diretamente.
        # A convenção _ no início do nome indica que é de uso interno.
        self._history: list[Message] = []

    def add_message(self, role: str, content: str) -> None:
        """Adiciona uma mensagem ao final do histórico.

        Args:
            role:    "system", "user" ou "assistant"
            content: texto completo da mensagem
        """
        self._history.append(Message(role=role, content=content))

    def append_transcript(self, chunk) -> None:
        """Adiciona um chunk de transcrição ao histórico como mensagem do usuário.

        Usado no modo realtime: os chunks de transcrição são adicionados com
        uma tag [TRANSCRIPT] para que o LLM (e futuro classificador) saiba
        que veio da transcrição ao vivo, não de digitação manual.

        O formato "[TRANSCRIPT speaker=client t=14:32]: texto" preserva
        o contexto de quem falou e quando — útil para o classificador.

        Args:
            chunk: TranscriptChunk com text, speaker e ts
        """
        tag = f"[TRANSCRIPT speaker={chunk.speaker} t={chunk.ts.strftime('%H:%M:%S')}]"
        self._history.append(Message(role="user", content=f"{tag}: {chunk.text}"))

    def get_history(self) -> list[Message]:
        """Retorna uma cópia do histórico completo.

        Por que retornar uma CÓPIA (list()) em vez da lista interna?
        Para proteger o estado interno: quem recebe o histórico pode modificar
        a lista retornada (ex: adicionar o REPORT_PROMPT antes de gerar o
        relatório) sem afetar o histórico real do ConversationManager.
        Isso é especialmente importante em generate_report(), que adiciona
        uma mensagem temporária sem querer gravar no histórico permanente.
        """
        return list(self._history)  # list() cria uma nova lista com os mesmos elementos

    def clear(self) -> None:
        """Limpa o histórico. Útil para reiniciar uma sessão sem recriar o objeto."""
        self._history.clear()
