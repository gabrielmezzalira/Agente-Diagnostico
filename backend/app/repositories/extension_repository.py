# =============================================================================
# repositories/extension_repository.py
#
# Responsabilidade única: as chamadas db.table() das rotas da extensão Chrome
# (listar clientes, criar sessão). Sem lógica de negócio. Devolve dicts brutos.
# =============================================================================

from supabase import Client


class ExtensionRepository:
    def __init__(self, db: Client) -> None:
        self._db = db

    def list_clients(self) -> list[dict]:
        # select mínimo de propósito: só o que a extensão pode ver (T-08-11).
        result = (
            self._db.table("projects")
            .select("id, client, name")
            .order("client")
            .execute()
        )
        return result.data or []
