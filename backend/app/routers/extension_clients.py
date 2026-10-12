# =============================================================================
# routers/extension_clients.py
#
# Responsabilidade única: roteamento HTTP das portas da extensão Chrome
# (Taqciti) sob /webhook/extension. Sem lógica de negócio e sem db.table():
# valida a entrada, chama o service e devolve a resposta.
#
# Gate: o mesmo verify_extension_key da Fase 6 (opt-in por EXTENSION_SHARED_KEY).
# Os caminhos são /clients e /sessions — não há rota vazia, para não colidir
# com o POST /webhook/extension existente.
# =============================================================================

from fastapi import APIRouter, Depends
from supabase import Client

from app.database import get_supabase
from app.models.extension import ExtensionClientResponse
from app.repositories.extension_repository import ExtensionRepository
from app.routers.webhook import verify_extension_key
from app.services.extension_session_service import ExtensionSessionService

router = APIRouter(prefix="/webhook/extension", tags=["webhook-extension"])


def _get_service(db: Client = Depends(get_supabase)) -> ExtensionSessionService:
    return ExtensionSessionService(ExtensionRepository(db))


@router.get("/clients", response_model=list[ExtensionClientResponse])
def list_clients(
    _: None = Depends(verify_extension_key),
    service: ExtensionSessionService = Depends(_get_service),
):
    return service.list_clients()
