# =============================================================================
# repositories/extension_repository.py
#
# Responsabilidade única: as chamadas db.table() das rotas da extensão Chrome
# (listar clientes, criar cliente, criar sessão). Sem lógica de negócio. Devolve dicts brutos.
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

    def list_client_names(self) -> list[str]:
        # só a coluna client: base da checagem de duplicidade.
        result = self._db.table("projects").select("client").execute()
        return [row.get("client") or "" for row in (result.data or [])]

    def insert_project(self, row: dict) -> dict:
        return self._db.table("projects").insert(row).execute().data[0]

    def get_project_id(self, project_id: str) -> str | None:
        result = (
            self._db.table("projects")
            .select("id")
            .eq("id", project_id)
            .execute()
        )
        return result.data[0]["id"] if result.data else None

    def insert_session(self, row: dict) -> dict:
        return self._db.table("sessions").insert(row).execute().data[0]
