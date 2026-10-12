# =============================================================================
# services/extension_session_service.py
#
# Regra de negócio das rotas da extensão Chrome: listar clientes (dados
# mínimos) e criar a sessão de uma reunião. Fala só com o ExtensionRepository.
# =============================================================================

from app.repositories.extension_repository import ExtensionRepository


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
