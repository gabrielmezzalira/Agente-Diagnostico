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
