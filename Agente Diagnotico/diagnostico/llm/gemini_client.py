# =============================================================================
# llm/gemini_client.py
#
# Implementação concreta do LLMClient usando a API do Google Gemini.
#
# O GeminiClient é a única classe da aplicação que conhece os detalhes do
# SDK do Gemini. Todo o resto do código usa apenas a interface LLMClient
# (base.py) — se trocarmos o Gemini por outro LLM, nada além deste arquivo
# precisa mudar.
# =============================================================================

import google.generativeai as genai  # SDK oficial do Google Gemini (deprecado mas funcional)
from .base import LLMClient, Message


class GeminiClient(LLMClient):
    """Cliente para o Google Gemini que implementa a interface LLMClient.

    O SDK do Gemini usa um modelo de "chat" com histórico: você inicia um
    chat com o histórico anterior e envia a próxima mensagem. O modelo
    retorna a resposta levando em conta todo o contexto.

    Por que o modelo é criado a cada chamada de generate()?
    O SDK do Gemini atual (google.generativeai) não mantém estado entre
    chamadas — o histórico precisa ser passado explicitamente toda vez.
    Criar o modelo em generate() em vez do __init__ permite que o histórico
    seja dinâmico e diferente a cada chamada (ex: a mesma instância de
    GeminiClient pode ser usada pelo DiagnosticAgent e pelo CoverageClassifier
    com históricos diferentes).
    """

    def __init__(self, api_key: str, model_name: str) -> None:
        # genai.configure() é uma chamada global que configura a autenticação
        # para todas as chamadas subsequentes ao SDK do Gemini neste processo.
        # Só precisa ser chamado uma vez.
        genai.configure(api_key=api_key)
        self._model_name = model_name  # ex: "gemini-2.0-flash", "gemini-2.0-pro"

    def generate(self, messages: list[Message]) -> str:
        """Envia o histórico ao Gemini e retorna o texto da resposta.

        O Gemini distingue "system instruction" das mensagens de chat.
        A system instruction é passada separadamente na criação do modelo —
        não aparece no histórico de chat como se fosse uma fala do usuário.

        Fluxo:
        1. Separa as mensagens "system" das de "user"/"assistant"
        2. Cria o modelo com a system instruction
        3. Monta o histórico de chat (todas as mensagens exceto a última)
        4. Inicia o chat com esse histórico
        5. Envia a última mensagem e recebe a resposta
        """
        # Extrai todas as mensagens com role="system" e junta em um único texto.
        # Na prática, só existe um SYSTEM_PROMPT, mas a lista permite flexibilidade.
        system_parts = [m.content for m in messages if m.role == "system"]

        # Todas as mensagens que não são "system" formam o histórico de chat
        chat_messages = [m for m in messages if m.role != "system"]

        # join com "\n\n" para separar múltiplas instruções de sistema com linha em branco.
        # Se não houver mensagens system, system_instruction fica None — o Gemini aceita.
        system_instruction = "\n\n".join(system_parts) if system_parts else None

        # GenerativeModel cria o objeto do modelo com as configurações fixas.
        # system_instruction é a "personalidade" e as regras do agente — é o SYSTEM_PROMPT.
        model = genai.GenerativeModel(
            model_name=self._model_name,
            system_instruction=system_instruction,
        )

        # Monta o histórico no formato que o SDK do Gemini espera:
        # lista de dicts com "role" e "parts".
        # O Gemini usa "model" onde nosso código usa "assistant" — fazemos a
        # tradução aqui para manter o resto da aplicação agnóstico ao provider.
        history = []
        for msg in chat_messages[:-1]:  # todos menos o último (o último é enviado via send_message)
            role = "user" if msg.role == "user" else "model"
            history.append({"role": role, "parts": [msg.content]})

        # start_chat() inicia uma sessão de chat com o histórico pré-carregado.
        # Isso é mais eficiente do que enviar todo o histórico como contexto
        # a cada mensagem — o SDK gerencia o estado internamente.
        chat = model.start_chat(history=history)

        # Pega o conteúdo da última mensagem para enviar agora.
        # Se chat_messages estiver vazio (improvável), usa string vazia.
        last_message = chat_messages[-1].content if chat_messages else ""

        # send_message() envia a última mensagem e aguarda a resposta do LLM.
        # É uma chamada BLOQUEANTE (síncrona) — espera o Gemini responder antes
        # de continuar. No modo realtime, isso é contornado via asyncio.to_thread().
        response = chat.send_message(last_message)

        # response.text extrai apenas o texto da resposta, descartando
        # metadados como tokens usados, candidatos alternativos, etc.
        return response.text
