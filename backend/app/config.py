# =============================================================================
# config.py
#
# Responsabilidade única: ler variáveis de ambiente e expor uma AppConfig imutável.
#
# Segue o mesmo padrão do diagnostico/config.py (frozen dataclass + load_dotenv +
# early ValueError), adaptado para as credenciais do Supabase.
# =============================================================================

import logging
import os
from dataclasses import dataclass, field
from urllib.parse import urlparse

from dotenv import load_dotenv

# load_dotenv() é chamado no nível do módulo para garantir que as variáveis
# do .env estejam disponíveis quando load_config() for chamado.
# Se as variáveis já existirem no ambiente (ex: exportadas no shell), o
# python-dotenv NÃO as sobrescreve — o ambiente sempre tem prioridade.
load_dotenv()

_log = logging.getLogger(__name__)


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


@dataclass(frozen=True)
class DocudataConfig:
    url: str
    # repr=False: a chave de serviço nunca pode aparecer em repr()/str()/logs.
    discovery_key: str = field(repr=False)


def load_docudata_config() -> DocudataConfig | None:
    """Integração com o DocuData é opcional: sem URL e chave, fica desligada (nada é enviado).

    `http` só vale em localhost; em qualquer outro host a chave de serviço sairia em texto puro.
    URLs com credenciais embutidas, query ou fragmento também são recusadas (retorna None).
    Lê o ambiente a cada chamada e nunca levanta exceção por configuração ausente/inválida.
    """
    url = os.environ.get("DOCUDATA_URL", "").strip().rstrip("/")
    key = os.environ.get("DOCUDATA_DISCOVERY_KEY", "").strip()
    if not url or not key:
        return None
    try:
        parsed = urlparse(url)
        _ = parsed.port  # valida a porta (levanta ValueError se inválida)
    except ValueError:
        _log.warning("DOCUDATA_URL ignorada: URL malformada")
        return None
    if parsed.username is not None or parsed.password is not None or "@" in parsed.netloc:
        _log.warning("DOCUDATA_URL ignorada: não use credenciais na URL")
        return None
    if parsed.query or parsed.fragment or "?" in url or "#" in url:
        _log.warning("DOCUDATA_URL ignorada: sem query string ou fragmento")
        return None
    if not parsed.hostname:
        _log.warning("DOCUDATA_URL ignorada: host ausente")
        return None
    if parsed.scheme == "https" or (parsed.scheme == "http" and parsed.hostname in ("localhost", "127.0.0.1")):
        return DocudataConfig(url=url, discovery_key=key)
    _log.warning("DOCUDATA_URL ignorada: use https (ou http em localhost)")
    return None
