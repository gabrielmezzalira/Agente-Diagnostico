# =============================================================================
# config.py
#
# Responsabilidade única: ler variáveis de ambiente e expor uma AppConfig imutável.
#
# Segue o mesmo padrão do diagnostico/config.py (frozen dataclass + load_dotenv +
# early ValueError), adaptado para as credenciais do Supabase.
# =============================================================================

import os
from dataclasses import dataclass
from dotenv import load_dotenv

# load_dotenv() é chamado no nível do módulo para garantir que as variáveis
# do .env estejam disponíveis quando load_config() for chamado.
# Se as variáveis já existirem no ambiente (ex: exportadas no shell), o
# python-dotenv NÃO as sobrescreve — o ambiente sempre tem prioridade.
load_dotenv()


@dataclass(frozen=True)
class AppConfig:
    """Configurações imutáveis do backend v2.

    Por que frozen=True?
    O parâmetro frozen=True torna o dataclass imutável: após criado, nenhum
    campo pode ser alterado. Isso garante que a configuração carregada no
    início da execução não seja acidentalmente modificada em outro lugar do
    código. Se alguém tentar fazer config.supabase_url = "outro", o Python
    levanta FrozenInstanceError.

    Campos:
        supabase_url  → URL do projeto Supabase (ex: https://xyz.supabase.co).
                        Obrigatória: sem ela, nenhuma conexão com o banco funciona.
        supabase_key  → service_role key do Supabase. Nunca exposta ao frontend.
                        Obrigatória: usada para todas as operações server-side.
    """

    supabase_url: str
    supabase_key: str


def load_config() -> AppConfig:
    """Lê as variáveis de ambiente e retorna uma AppConfig validada.

    Lança ValueError se SUPABASE_URL ou SUPABASE_KEY não estiverem definidas —
    é melhor falhar cedo com mensagem clara do que deixar o erro aparecer mais
    tarde em uma chamada ao banco de dados.
    """
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_KEY")

    if not url:
        raise ValueError(
            "SUPABASE_URL environment variable not set. "
            "Add it to backend/.env: SUPABASE_URL=https://your-project.supabase.co"
        )
    if not key:
        raise ValueError(
            "SUPABASE_KEY environment variable not set. "
            "Add it to backend/.env: SUPABASE_KEY=your-service-role-key"
        )

    return AppConfig(supabase_url=url, supabase_key=key)
