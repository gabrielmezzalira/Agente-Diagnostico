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

from app.routers import extension_clients as router_mod
from app.routers.webhook import verify_extension_key
from app.services.extension_session_service import ExtensionSessionService

_PROJECT_ID = uuid4()


class _FakeRepo:
    """Repositório em memória: guarda o que o service pediu."""

    def __init__(self, clients=None, known_project=True):
        self._clients = clients or []
        self._known_project = known_project
        self.inserted: list[dict] = []

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
