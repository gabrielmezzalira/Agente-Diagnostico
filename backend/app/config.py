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
    supabase_url: str
    supabase_key: str
    recall_api_key: str = ""
    recall_region: str = "us-west-2"


def load_config() -> AppConfig:
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

    return AppConfig(
        supabase_url=url,
        supabase_key=key,
        recall_api_key=os.environ.get("RECALL_API_KEY", ""),
        recall_region=os.environ.get("RECALL_REGION", "us-west-2"),
    )
