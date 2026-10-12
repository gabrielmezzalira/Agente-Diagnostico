# =============================================================================
# services/extension_session_service.py
#
# Regra de negócio das rotas da extensão Chrome: listar clientes (dados
# mínimos), criar a sessão de uma reunião e encerrá-la. Fala só com o
# ExtensionRepository e com a porta do "parador de pipeline" (injetada).
# =============================================================================

import logging
import unicodedata
from datetime import datetime, timezone
from typing import Protocol
from uuid import UUID

from fastapi import HTTPException

from app.repositories.extension_repository import ExtensionRepository

_log = logging.getLogger(__name__)

_DEFAULT_SESSION_NAME = "Reunião pela Taqciti"

# Decisão B1/B4-a do time (2026-10-12): cliente criado pela Taqciti nasce em
# modo 'discovery' (milestone de discovery), source 'extension', sem chave Gemini.
EXTENSION_CLIENT_MODE = "discovery"
_EXTENSION_CLIENT_SOURCE = "extension"


def _fold(text: str) -> str:
    """Compara nomes sem acento e sem diferença de caixa."""
    decomposed = unicodedata.normalize("NFKD", text)
    no_marks = "".join(ch for ch in decomposed if not unicodedata.combining(ch))
    return no_marks.casefold().strip()


class PipelineStopper(Protocol):
    """Porta: quem sabe parar o pipeline de IA em memória de uma sessão."""

    async def stop_session(self, session_id: str) -> None: ...


class _DefaultPipelineStopper:
    """Adaptador padrão: delega ao singleton do pipeline. O import é tardio, aqui
    dentro, para evitar import circular (mesmo padrão do finish do web app)."""

    async def stop_session(self, session_id: str) -> None:
        from app.services.pipeline import pipeline_manager

        await pipeline_manager.stop_session(session_id)


class ExtensionSessionService:
    def __init__(
        self,
        repo: ExtensionRepository,
        pipeline_stopper: PipelineStopper | None = None,
    ) -> None:
        self._repo = repo
        self._pipeline_stopper = pipeline_stopper or _DefaultPipelineStopper()

    def list_clients(self) -> list[dict]:
        """Reconstrói cada item só com id, client e name, mesmo que o
        repositório devolva mais colunas."""
        items = []
        for row in self._repo.list_clients():
            name = row.get("name") or ""
            client = row.get("client") or name
            items.append({"id": row["id"], "client": str(client), "name": str(name)})
        return items

    def create_client(self, name: str) -> dict:
        """Cria um cliente só com o nome. 409 se já existe (sem acento/caixa)."""
        folded = _fold(name)
        if any(_fold(existing) == folded for existing in self._repo.list_client_names()):
            raise HTTPException(status_code=409, detail="Client already exists")
        row = self._repo.insert_project({
            "name": name,
            "client": name,
            "mode": EXTENSION_CLIENT_MODE,
            "source": _EXTENSION_CLIENT_SOURCE,
        })
        return {"id": row["id"], "client": name, "name": name}

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

    async def finish_session(self, session_id: UUID) -> dict:
        """Encerra uma sessão de origem 'extension' (decisão B4-b, Pitfall 1).

        Idempotente: sessão já encerrada devolve 200 sem regravar, mas chama o
        parador de novo (conserta um finish que gravou e falhou ao parar o
        pipeline). 404 se não existe; 409 para outra origem ou outro status.

        Referência do comportamento: routers/sessions.py::finish_session (web app).
        Dívida registrada: unificar os dois num service comum (refator futuro)."""
        sid = str(session_id)
        row = self._repo.get_session(sid)
        if row is None:
            raise HTTPException(status_code=404, detail="Session not found")
        if row.get("source") != "extension" or row.get("status") not in ("active", "finished"):
            raise HTTPException(status_code=409, detail="Session cannot be finished")

        if row["status"] == "active":
            # False = outra chamada encerrou no meio: trata como já encerrada.
            self._repo.mark_session_finished(sid, datetime.now(timezone.utc).isoformat())

        # O status finished já está gravado; falha ao parar vai só para o log e a
        # Taqciti repete a chamada (idempotente).
        try:
            await self._pipeline_stopper.stop_session(sid)
        except Exception:
            _log.exception("falha ao parar pipeline da sessão %s no finish da extensão", sid)
        return {"id": session_id, "status": "finished"}
