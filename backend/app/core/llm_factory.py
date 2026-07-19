# =============================================================================
# core/llm_factory.py
#
# Responsabilidade única: criar e retornar uma instância de BaseChatModel a
# partir de provider/model/api_key. O restante do código só conhece
# BaseChatModel — nunca o provider concreto.
#
# Os imports concretos de cada provider ficam DENTRO dos cases (lazy import)
# para que o arquivo não falhe ao importar caso apenas um pacote esteja
# instalado. Ex: se langchain-openai não estiver no ambiente, imports de
# anthropic e google continuam funcionando.
# =============================================================================

from __future__ import annotations

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from langchain_core.language_models import BaseChatModel


def create_llm(provider: str, model: str, api_key: str) -> "BaseChatModel":
    """Factory que retorna BaseChatModel a partir de provider/model/api_key.

    O restante do código só conhece BaseChatModel, nunca o provider concreto.
    Os imports concretos são lazy (dentro de cada case) para evitar falhas de
    importação quando apenas alguns pacotes estão instalados.

    Args:
        provider: "openai", "anthropic" ou "google"
        model: nome do modelo (ex: "gpt-4o", "claude-3-5-sonnet", "gemini-2.0-flash")
        api_key: chave de API do provider; nunca deve ser logada ou exposta

    Returns:
        Instância de BaseChatModel pronta para uso

    Raises:
        ValueError: se api_key estiver vazio/None ou provider desconhecido
    """
    if not api_key:
        raise ValueError("api_key is required to create an LLM client")

    match provider:
        case "openai":
            from langchain_openai import ChatOpenAI

            return ChatOpenAI(model=model, api_key=api_key)

        case "anthropic":
            from langchain_anthropic import ChatAnthropic

            return ChatAnthropic(model=model, api_key=api_key)

        case "google":
            from langchain_google_genai import ChatGoogleGenerativeAI

            return ChatGoogleGenerativeAI(model=model, google_api_key=api_key)

        case _:
            raise ValueError(
                f"Unknown LLM provider: '{provider}'. "
                "Supported values: 'openai', 'anthropic', 'google'."
            )
