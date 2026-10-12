# =============================================================================
# services/extension_session_service.py
#
# Regra de negócio das rotas da extensão Chrome: listar clientes (dados
# mínimos) e criar a sessão de uma reunião. Fala só com o ExtensionRepository.
# =============================================================================

from uuid import UUID

from fastapi import HTTPException

from app.repositories.extension_repository import ExtensionRepository

_DEFAULT_SESSION_NAME = "Reunião pela Taqciti"


class ExtensionSessionService:
    def __init__(self, repo: ExtensionRepository) -> None:
        self._repo = repo

    def list_clients(self) -> list[dict]:
        """Reconstrói cada item só com id, client e name, mesmo que o
        repositório devolva mais colunas."""
        items = []
        for row in self._repo.list_clients():
            name = row.get("name") or ""
            client = row.get("client") or name
            items.append({"id": row["id"], "client": str(client), "name": str(name)})
        return items

    def create_session(self, project_id: UUID, name: str | None) -> dict:
        """Abre uma sessão nova (active, source extension) para o projeto.

        404 explícito quando o projeto não existe — a extensão trata como
        definitivo, sem novas tentativas (T-08-12)."""
        if self._repo.get_project_id(str(project_id)) is None:
            raise HTTPException(status_code=404, detail="Project not found")
        row = self._repo.insert_session({
            "project_id": str(project_id),
            "name": name or _DEFAULT_SESSION_NAME,
            "meeting_url": None,
            "source": "extension",
            "status": "active",
        })
        return {"id": row["id"]}
