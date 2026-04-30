# =============================================================================
# config.py
#
# Responsabilidade única: ler variáveis de ambiente e expor uma Config imutável.
#
# Por que isolar a configuração aqui?
# Seguindo o princípio de Responsabilidade Única (SOLID), nenhum outro módulo
# precisa saber de onde vêm as configs. Se amanhã a chave vier de um secrets
# manager na nuvem em vez do .env, só este arquivo muda.
# =============================================================================

import os
from dataclasses import dataclass
from dotenv import load_dotenv  # lê o arquivo .env e exporta as variáveis para os.environ

# load_dotenv() é chamado no nível do módulo para garantir que as variáveis
# do .env estejam disponíveis quando load_config() for chamado.
# Se as variáveis já existirem no ambiente (ex: exportadas no shell), o
# python-dotenv NÃO as sobrescreve — o ambiente sempre tem prioridade.
load_dotenv()


@dataclass(frozen=True)
class Config:
    """Configurações imutáveis da aplicação.

    Por que frozen=True?
    O parâmetro frozen=True torna o dataclass imutável: após criado, nenhum
    campo pode ser alterado. Isso garante que a configuração carregada no
    início da execução não seja acidentalmente modificada em outro lugar do
    código. Se alguém tentar fazer config.model_name = "outro", o Python
    levanta FrozenInstanceError.

    Campos:
        gemini_api_key → chave de autenticação para a API do Gemini.
                         Obrigatória: a aplicação não funciona sem ela.
        model_name     → qual modelo Gemini usar (ex: "gemini-2.0-flash").
                         Controla custo e qualidade das respostas.
        reports_dir    → pasta onde os relatórios em Markdown serão salvos.
    """
    gemini_api_key: str
    model_name: str
    reports_dir: str


def load_config() -> Config:
    """Lê as variáveis de ambiente e retorna uma Config validada.

    Lança ValueError se GEMINI_API_KEY não estiver definida — é melhor
    falhar cedo com mensagem clara do que deixar o erro aparecer mais tarde
    no meio de uma chamada ao LLM.

    Valores padrão:
        GEMINI_MODEL  → "gemini-2.0-flash" (rápido e barato; troque para
                         "gemini-2.0-pro" se precisar de mais qualidade)
        REPORTS_DIR   → "reports" (pasta relativa ao diretório de execução)
    """
    api_key = os.environ.get("GEMINI_API_KEY")

    # os.environ.get() retorna None se a variável não existir (não lança exceção).
    # Checamos explicitamente para dar uma mensagem de erro útil ao usuário.
    if not api_key:
        raise ValueError(
            "GEMINI_API_KEY environment variable not set. "
            "Please export GEMINI_API_KEY=<your-key>"
        )

    return Config(
        gemini_api_key=api_key,
        # get() com segundo argumento → valor padrão se a variável não existir
        model_name=os.environ.get("GEMINI_MODEL", "gemini-2.0-flash"),
        reports_dir=os.environ.get("REPORTS_DIR", "reports"),
    )
