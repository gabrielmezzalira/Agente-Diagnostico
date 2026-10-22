# =============================================================================
# test_extension_clients.py
#
# Fase 8 (Taqciti Session Association) / Plano 08-07 — decisão B1 do time
# (rotas novas da extensão, aprovadas em 2026-10-12).
#
# Prova, sem rede e sem .env, as duas portas da extensão sob /webhook/extension:
#   - GET  /clients  -> só {id, client, name} de cada projeto (T-08-11 / LGPD);
#   - POST /sessions -> sessão nova active, source 'extension'; 404 para projeto
#                       inexistente (T-08-12).
# Ambas passam pelo mesmo gate x-agente-key da Fase 6 (verify_extension_key).
#
# Teste unitário puro: repositório fake no service, service fake nas funções de
# rota chamadas direto, inspeção do APIRouter para o gate e os caminhos.
# =============================================================================

from uuid import UUID, uuid4

import pytest
from fastapi import HTTPException
from fastapi.routing import APIRoute
from pydantic import ValidationError

from app.routers import extension_clients as router_mod
from app.models.extension import (
    ExtensionClientCreate,
    ExtensionClientResponse,
    ExtensionSessionCreate,
    ExtensionSessionFinishResponse,
    ExtensionSessionResponse,
)
from app.routers.webhook import verify_extension_key
from app.services.extension_session_service import ExtensionSessionService

_PROJECT_ID = uuid4()


class _FakeRepo:
    """Repositório em memória: guarda o que o service pediu."""

    def __init__(self, clients=None, known_project=True):
        self._clients = clients or []
        self._known_project = known_project
        self.inserted: list[dict] = []
        self.inserted_projects: list[dict] = []

    def list_client_names(self) -> list[str]:
        return [c.get("client") or "" for c in self._clients]

    def insert_project(self, row: dict) -> dict:
        self.inserted_projects.append(row)
        return {**row, "id": "33333333-3333-3333-3333-333333333333"}

    def list_clients(self) -> list[dict]:
        return self._clients

    def get_project_id(self, project_id: str):
        return project_id if self._known_project else None

    def insert_session(self, row: dict) -> dict:
        self.inserted.append(row)
        return {**row, "id": "11111111-1111-1111-1111-111111111111"}


class _FakeService:
    def list_clients(self):
        return [{"id": str(_PROJECT_ID), "client": "Acme", "name": "Pipeline"}]

    def create_client(self, name):
        return {"id": "33333333-3333-3333-3333-333333333333", "client": name, "name": name}

    def create_session(self, project_id, name):
        return {"id": "22222222-2222-2222-2222-222222222222"}


def _routes() -> dict[tuple[str, str], APIRoute]:
    return {
        (path_method, route.path): route
        for route in router_mod.router.routes
        if isinstance(route, APIRoute)
        for path_method in route.methods
    }


def _gate_calls(route: APIRoute) -> list:
    return [dep.call for dep in route.dependant.dependencies]


# ----------------------------- Task 2: GET /clients -----------------------------


def test_service_list_clients_returns_only_minimal_fields():
    repo = _FakeRepo(clients=[{
        "id": str(_PROJECT_ID), "client": "Acme", "name": "Pipeline",
        "pre_meeting_context": "segredo comercial", "budget_usd": 12.5,
    }])

    result = ExtensionSessionService(repo).list_clients()

    assert result == [{"id": str(_PROJECT_ID), "client": "Acme", "name": "Pipeline"}]
    assert set(result[0].keys()) == {"id", "client", "name"}


def test_service_list_clients_fills_blank_client_with_name_and_none_name():
    repo = _FakeRepo(clients=[
        {"id": "a", "client": "", "name": "Projeto A"},
        {"id": "b", "client": "Beta", "name": None},
    ])

    result = ExtensionSessionService(repo).list_clients()

    assert result[0]["client"] == "Projeto A"
    assert result[1]["name"] == ""


def test_route_list_clients_returns_service_list():
    route_fn = _routes()[("GET", "/webhook/extension/clients")].endpoint

    assert route_fn(service=_FakeService()) == _FakeService().list_clients()


def test_router_has_prefix_and_no_empty_path():
    paths = {path for (_, path) in _routes()}

    assert router_mod.router.prefix == "/webhook/extension"
    assert "/webhook/extension/clients" in paths
    assert "/webhook/extension" not in paths  # sem colisão com POST /webhook/extension


def test_clients_route_is_behind_extension_key_gate(monkeypatch):
    route = _routes()[("GET", "/webhook/extension/clients")]
    assert verify_extension_key in _gate_calls(route)

    monkeypatch.setenv("EXTENSION_SHARED_KEY", "s3cr3t")
    with pytest.raises(HTTPException) as exc_info:
        verify_extension_key(x_agente_key=None)
    assert exc_info.value.status_code == 401


# ---------------------------- Task 3: POST /sessions ----------------------------


def test_create_session_builds_extension_row_and_returns_id():
    repo = _FakeRepo()

    result = ExtensionSessionService(repo).create_session(
        _PROJECT_ID, "Reunião de 11/10 às 14:00"
    )

    assert repo.inserted == [{
        "project_id": str(_PROJECT_ID),
        "name": "Reunião de 11/10 às 14:00",
        "meeting_url": None,
        "source": "extension",
        "status": "active",
    }]
    assert result == {"id": "11111111-1111-1111-1111-111111111111"}


def test_create_session_without_name_uses_default_name():
    repo = _FakeRepo()

    ExtensionSessionService(repo).create_session(_PROJECT_ID, None)

    assert repo.inserted[0]["name"] == "Reunião pela Taqciti"


def test_create_session_unknown_project_is_404_and_inserts_nothing():
    repo = _FakeRepo(known_project=False)

    with pytest.raises(HTTPException) as exc_info:
        ExtensionSessionService(repo).create_session(_PROJECT_ID, "x")

    assert exc_info.value.status_code == 404
    assert exc_info.value.detail == "Project not found"
    assert repo.inserted == []


def test_sessions_route_is_201_response_model_and_gated():
    route = _routes()[("POST", "/webhook/extension/sessions")]

    assert route.status_code == 201
    assert route.response_model is ExtensionSessionResponse
    assert verify_extension_key in _gate_calls(route)


def test_route_create_session_delegates_to_service():
    route_fn = _routes()[("POST", "/webhook/extension/sessions")].endpoint
    payload = ExtensionSessionCreate(project_id=_PROJECT_ID, name="Reunião")

    assert route_fn(payload=payload, service=_FakeService()) == {
        "id": "22222222-2222-2222-2222-222222222222"
    }


def test_router_is_registered_once_in_package_and_app():
    from pathlib import Path

    app_dir = Path(router_mod.__file__).resolve().parents[1]
    init_src = (app_dir / "routers" / "__init__.py").read_text(encoding="utf-8")
    main_src = (app_dir / "main.py").read_text(encoding="utf-8")

    assert "extension_clients_router" in init_src
    assert '"extension_clients_router"' in init_src  # __all__
    assert main_src.count("include_router(extension_clients_router)") == 1


# --------------------- Plano 08-12 Task 1: POST /clients (B1/B4-a) ---------------------


def test_client_create_strips_name():
    assert ExtensionClientCreate(name="  Nova Co  ").name == "Nova Co"


@pytest.mark.parametrize("bad", ["", "   ", "x" * 121])
def test_client_create_rejects_empty_and_too_long_name(bad):
    with pytest.raises(ValidationError):
        ExtensionClientCreate(name=bad)


def test_client_create_accepts_120_chars():
    assert len(ExtensionClientCreate(name="x" * 120).name) == 120


def test_create_client_inserts_only_decided_columns():
    repo = _FakeRepo()

    result = ExtensionSessionService(repo).create_client("Nova Co")

    # B1/B4-a: mode 'discovery', source 'extension', sem chave Gemini.
    assert repo.inserted_projects == [{
        "name": "Nova Co",
        "client": "Nova Co",
        "mode": "discovery",
        "source": "extension",
    }]
    assert result == {
        "id": "33333333-3333-3333-3333-333333333333",
        "client": "Nova Co",
        "name": "Nova Co",
    }


def test_create_client_duplicate_ignoring_accent_and_case_is_409():
    repo = _FakeRepo(clients=[{"id": "a", "client": "Açaí Ltda", "name": "Açaí Ltda"}])

    with pytest.raises(HTTPException) as exc_info:
        ExtensionSessionService(repo).create_client("acai ltda")

    assert exc_info.value.status_code == 409
    assert exc_info.value.detail == "Client already exists"
    assert repo.inserted_projects == []


def test_create_client_different_name_is_not_duplicate():
    repo = _FakeRepo(clients=[{"id": "a", "client": "Acme", "name": "Acme"}])

    ExtensionSessionService(repo).create_client("Acme Brasil")

    assert len(repo.inserted_projects) == 1


def test_clients_post_route_is_201_response_model_and_gated():
    route = _routes()[("POST", "/webhook/extension/clients")]

    assert route.status_code == 201
    assert route.response_model is ExtensionClientResponse
    assert verify_extension_key in _gate_calls(route)


def test_route_create_client_delegates_to_service():
    route_fn = _routes()[("POST", "/webhook/extension/clients")].endpoint

    result = route_fn(payload=ExtensionClientCreate(name="Nova Co"), service=_FakeService())

    assert result["client"] == "Nova Co"


# --------- Plano 08-15 Task 2: POST /sessions/{id}/finish (B4-b, D-16, Pitfall 1) ---------

_FINISH_SID = UUID("44444444-4444-4444-4444-444444444444")


class _FinishRepo:
    """Repositório fake do finish: sessão fixa, compare-and-set controlável."""

    def __init__(self, session, cas_result=True):
        self._session = session
        self._cas_result = cas_result
        self.finished_calls: list[tuple[str, str]] = []

    def get_session(self, session_id: str):
        return self._session

    def mark_session_finished(self, session_id: str, finished_at: str) -> bool:
        self.finished_calls.append((session_id, finished_at))
        return self._cas_result


class _FakeStopper:
    def __init__(self, fail=False):
        self.stopped: list[str] = []
        self._fail = fail

    async def stop_session(self, session_id: str) -> None:
        self.stopped.append(session_id)
        if self._fail:
            raise RuntimeError("stop failed")


class _FakeExportScheduler:
    """Agendador de envio ao DocuData fake: só registra os ids (sem rede, sem env)."""

    def __init__(self, fail=False):
        self.scheduled: list[str] = []
        self._fail = fail

    def schedule(self, session_id: str) -> None:
        self.scheduled.append(session_id)
        if self._fail:
            raise RuntimeError("schedule failed")


def _finish_service(session, cas_result=True, fail_stop=False, fail_schedule=False):
    repo = _FinishRepo(session, cas_result)
    stopper = _FakeStopper(fail=fail_stop)
    scheduler = _FakeExportScheduler(fail=fail_schedule)
    return ExtensionSessionService(repo, stopper, scheduler), repo, stopper


async def test_finish_active_extension_session_writes_and_stops_pipeline():
    service, repo, stopper = _finish_service(
        {"id": str(_FINISH_SID), "status": "active", "source": "extension"}
    )

    result = await service.finish_session(_FINISH_SID)

    assert result == {"id": _FINISH_SID, "status": "finished"}
    assert len(repo.finished_calls) == 1
    assert repo.finished_calls[0][0] == str(_FINISH_SID)
    assert "T" in repo.finished_calls[0][1]  # finished_at em ISO
    assert stopper.stopped == [str(_FINISH_SID)]


async def test_finish_already_finished_is_idempotent_and_still_stops_pipeline():
    service, repo, stopper = _finish_service(
        {"id": str(_FINISH_SID), "status": "finished", "source": "extension"}
    )

    result = await service.finish_session(_FINISH_SID)

    assert result["status"] == "finished"
    assert repo.finished_calls == []  # não regrava
    assert stopper.stopped == [str(_FINISH_SID)]  # repara finish que parou no meio


async def test_finish_unknown_session_is_404_without_side_effects():
    service, repo, stopper = _finish_service(None)

    with pytest.raises(HTTPException) as exc_info:
        await service.finish_session(_FINISH_SID)

    assert exc_info.value.status_code == 404
    assert repo.finished_calls == [] and stopper.stopped == []


@pytest.mark.parametrize(
    "session",
    [
        {"id": "x", "status": "active", "source": "recall"},
        {"id": "x", "status": "active", "source": "import"},
        {"id": "x", "status": "cancelled", "source": "extension"},
    ],
)
async def test_finish_other_source_or_status_is_409_without_side_effects(session):
    service, repo, stopper = _finish_service(session)

    with pytest.raises(HTTPException) as exc_info:
        await service.finish_session(_FINISH_SID)

    assert exc_info.value.status_code == 409
    assert repo.finished_calls == [] and stopper.stopped == []


async def test_finish_lost_compare_and_set_is_treated_as_already_finished():
    service, repo, stopper = _finish_service(
        {"id": str(_FINISH_SID), "status": "active", "source": "extension"},
        cas_result=False,
    )

    result = await service.finish_session(_FINISH_SID)

    assert result["status"] == "finished"
    assert stopper.stopped == [str(_FINISH_SID)]


async def test_finish_stop_failure_keeps_200_finished():
    service, _, stopper = _finish_service(
        {"id": str(_FINISH_SID), "status": "active", "source": "extension"},
        fail_stop=True,
    )

    result = await service.finish_session(_FINISH_SID)

    assert result["status"] == "finished"
    assert stopper.stopped == [str(_FINISH_SID)]


def test_service_default_stopper_is_the_pipeline_singleton_adapter():
    from app.services.pipeline import pipeline_manager

    service = ExtensionSessionService(_FinishRepo(None))

    assert callable(getattr(service._pipeline_stopper, "stop_session", None))
    assert service._pipeline_stopper is not pipeline_manager  # adaptador, não o singleton


def test_finish_route_is_gated_and_has_response_model():
    route = _routes()[("POST", "/webhook/extension/sessions/{session_id}/finish")]

    assert route.response_model is ExtensionSessionFinishResponse
    assert verify_extension_key in _gate_calls(route)


async def test_route_finish_delegates_to_service():
    route_fn = _routes()[("POST", "/webhook/extension/sessions/{session_id}/finish")].endpoint
    service, repo, _ = _finish_service(
        {"id": str(_FINISH_SID), "status": "active", "source": "extension"}
    )

    result = await route_fn(session_id=_FINISH_SID, service=service)

    assert result["status"] == "finished"
    assert len(repo.finished_calls) == 1


def test_router_file_has_no_direct_db_access():
    from pathlib import Path

    src = Path(router_mod.__file__).read_text(encoding="utf-8")
    code = "\n".join(l for l in src.splitlines() if not l.strip().startswith("#"))

    assert "db.table" not in code


# --------- Envio ao DocuData no finish da Taqciti (mesmo gancho do finish REST e do WebSocket) ---------


async def test_finish_active_extension_session_schedules_docudata_export():
    service, _, _ = _finish_service(
        {"id": str(_FINISH_SID), "status": "active", "source": "extension"}
    )

    await service.finish_session(_FINISH_SID)

    assert service._export_scheduler.scheduled == [str(_FINISH_SID)]


async def test_finish_already_finished_schedules_export_again_because_it_is_idempotent():
    # Um finish que gravou e falhou no meio não pode perder o envio: o retry da Taqciti agenda de novo.
    service, repo, _ = _finish_service(
        {"id": str(_FINISH_SID), "status": "finished", "source": "extension"}
    )

    await service.finish_session(_FINISH_SID)

    assert repo.finished_calls == []
    assert service._export_scheduler.scheduled == [str(_FINISH_SID)]


async def test_finish_unknown_session_does_not_schedule_export():
    service, _, _ = _finish_service(None)

    with pytest.raises(HTTPException):
        await service.finish_session(_FINISH_SID)

    assert service._export_scheduler.scheduled == []


async def test_finish_other_source_does_not_schedule_export():
    service, _, _ = _finish_service({"id": "x", "status": "active", "source": "recall"})

    with pytest.raises(HTTPException):
        await service.finish_session(_FINISH_SID)

    assert service._export_scheduler.scheduled == []


async def test_finish_schedule_failure_keeps_200_finished():
    service, _, stopper = _finish_service(
        {"id": str(_FINISH_SID), "status": "active", "source": "extension"},
        fail_schedule=True,
    )

    result = await service.finish_session(_FINISH_SID)

    assert result == {"id": _FINISH_SID, "status": "finished"}
    assert stopper.stopped == [str(_FINISH_SID)]


async def test_finish_schedules_export_even_when_pipeline_stop_fails():
    service, _, _ = _finish_service(
        {"id": str(_FINISH_SID), "status": "active", "source": "extension"},
        fail_stop=True,
    )

    await service.finish_session(_FINISH_SID)

    assert service._export_scheduler.scheduled == [str(_FINISH_SID)]


def test_service_default_export_scheduler_delegates_to_agendar_exportacao(monkeypatch):
    calls: list[str] = []
    monkeypatch.setattr(
        "app.services.extension_session_service.agendar_exportacao", calls.append
    )

    ExtensionSessionService(_FinishRepo(None))._export_scheduler.schedule("abc")

    assert calls == ["abc"]
