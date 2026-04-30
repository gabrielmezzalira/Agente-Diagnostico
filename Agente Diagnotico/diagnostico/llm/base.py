# =============================================================================
# llm/base.py
#
# Contrato (interface) para qualquer cliente de LLM.
#
# Por que abstrair o LLM?
# Seguindo o princípio Aberto/Fechado (SOLID): o DiagnosticAgent depende desta
# abstração, não de uma implementação específica. Para trocar o Gemini por
# Claude ou GPT-4, basta criar um novo arquivo (ex: llm/openai_client.py) que
# implemente LLMClient. O agent.py, conversation.py e todo o resto ficam
# intocados.
#
# Além do método principal generate(), a interface define generate_json() —
# um método auxiliar com implementação padrão (default) que chama generate()
# e faz parse robusto do JSON retornado. Subclasses podem sobrescrever se
# o provider tiver suporte nativo a JSON mode (ex: Gemini response_schema).
# =============================================================================

import json    # parse do JSON retornado pelo LLM
import logging  # registra falhas de parse sem derrubar a sessão
import re       # expressão regular para extrair JSON de resposta com texto livre
from abc import ABC, abstractmethod  # ferramentas para criar classes abstratas
from dataclasses import dataclass

# Logger dedicado a este módulo — permite filtrar logs de parse JSON
# sem precisar alterar o nível de log global da aplicação.
logger = logging.getLogger(__name__)


@dataclass
class Message:
    """Representa uma mensagem no histórico da conversa.

    O LLM processa conversas como uma sequência de mensagens, cada uma com
    um papel (role) e um conteúdo. Esta estrutura é universal — tanto o
    Gemini quanto o Claude e o GPT usam esse padrão.

    Roles possíveis:
        "system"    → instruções de comportamento do agente (SYSTEM_PROMPT).
                      Não aparece como "fala" do usuário ou do agente —
                      é uma instrução de bastidor para o LLM.
        "user"      → mensagem do usuário (respostas do comercial na entrevista).
        "assistant" → resposta do agente/LLM (perguntas geradas pelo Gemini).

    Por que dataclass?
    Gera __init__, __repr__ e __eq__ automaticamente. Message é um container
    de dados simples, sem comportamento — dataclass é ideal para isso.
    """
    role: str     # "system", "user" ou "assistant"
    content: str  # texto completo da mensagem


class LLMClient(ABC):
    """Interface abstrata para clientes de Large Language Models.

    Define o contrato mínimo que qualquer provedor de LLM deve cumprir:
    receber um histórico de mensagens e retornar uma resposta em texto.

    Por que ABC (Abstract Base Class)?
    ABC impede que LLMClient seja instanciado diretamente — você não pode
    fazer LLMClient(). Só classes que implementam todos os @abstractmethod
    podem ser instanciadas. Isso garante em tempo de importação que nenhuma
    implementação "incompleta" escape para o código de produção.

    Implementações disponíveis:
        GeminiClient  → llm/gemini_client.py  (Google Gemini)
        ClaudeClient  → llm/claude_client.py  (Anthropic Claude)
    """

    @abstractmethod
    def generate(self, messages: list[Message]) -> str:
        """Envia o histórico de mensagens ao LLM e retorna a resposta gerada.

        Args:
            messages: lista completa do histórico da conversa até agora,
                      na ordem cronológica (system → user → assistant → user → ...).
                      O LLM usa todo esse histórico para gerar uma resposta
                      contextualizada — não só a última mensagem.

        Returns:
            Texto da resposta gerada pelo LLM. Pode conter Markdown, emojis,
            perguntas, red flags, etc. — depende das instruções do SYSTEM_PROMPT.

        Note:
            Implementações devem ser síncronas. Para uso em asyncio, o
            RealtimeOrchestrator envolve a chamada em asyncio.to_thread().
        """
        pass

    def generate_json(self, messages: list[Message]) -> dict:
        """Chama o LLM e interpreta a resposta como JSON.

        Implementação padrão: chama generate() e tenta fazer parse do texto
        retornado como JSON. Possui três níveis de fallback para lidar com
        respostas mal-formatadas (que o LLM pode gerar mesmo sendo instruído
        a retornar JSON puro):

        Nível 1 — json.loads() direto:
            O LLM retornou exatamente um objeto JSON válido. Caso ideal.

        Nível 2 — extração via regex:
            O LLM retornou JSON envolto em texto livre, por exemplo:
              "Claro! Aqui está o resultado: {"status": "ok", ...}"
            A regex r"\\{.*\\}" com DOTALL captura o primeiro bloco {...}.
            Esse padrão é comum quando o modelo ignora a instrução de "só JSON".

        Nível 3 — fallback para dict vazio:
            Nenhum JSON válido encontrado. Loga o texto completo para debug
            e retorna {} — o chamador recebe um dict vazio e pode tratar
            graciosamente (ex: pular a atualização do CoverageTracker sem
            derrubar a sessão).

        Por que não lançar exceção?
        O modo realtime é uma sessão contínua de 1 hora. Um JSON malformado
        ocasional não deve derrubar tudo — deve ser ignorado silenciosamente
        com log para debug posterior.

        Subclasses podem sobrescrever este método para usar recursos nativos
        do provider (ex: Gemini response_schema, OpenAI JSON mode) e obter
        respostas estruturadas mais confiáveis.

        Args:
            messages: mesmo formato de generate() — histórico completo.

        Returns:
            dict com os dados retornados pelo LLM, ou {} em caso de falha.
        """
        # Chama o LLM normalmente — recebe texto bruto
        raw = self.generate(messages)

        # Nível 1: tenta parse direto. Funciona quando o LLM obedece a instrução
        # de retornar apenas JSON.
        try:
            return json.loads(raw)
        except json.JSONDecodeError:
            pass

        # Nível 2: extrai o primeiro bloco {...} do texto.
        # re.DOTALL faz o '.' casar com '\n' também — necessário para JSON
        # multilinha (que é o padrão quando o LLM formata a resposta).
        match = re.search(r"\{.*\}", raw, re.DOTALL)
        if match:
            try:
                return json.loads(match.group())
            except json.JSONDecodeError:
                pass

        # Nível 3: não foi possível extrair JSON. Loga e retorna vazio.
        # O log inclui o texto completo para facilitar debug — em produção,
        # configura o nível para WARNING ou superior para suprimir.
        logger.warning(
            "generate_json: resposta do LLM não contém JSON válido. "
            "Retornando {}. Resposta bruta: %r",
            raw[:500],  # limita a 500 chars para não poluir os logs
        )
        return {}
