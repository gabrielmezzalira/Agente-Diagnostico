# =============================================================================
# test_readiness_route.py
#
# Fase 5 (Two-Lens Monitoring Frontend) / Plano 05-03 — Task 2 (D-49).
#
# GET /sessions/{session_id}/readiness expõe SessionState.readiness_score()
# (função pura, Fase 4/D-33/D-34) por uma rota REST mínima e aditiva. Este
# teste é isolado (sem rede, sem Supabase real, sem TestClient) — chama o
# handler do router diretamente, no mesmo espírito de test_upload_pdf_mode.py:
# monkeypatch de `pipeline_manager.get_or_create` (import lazy dentro da
# função) por um fake async, cobrindo:
#   - 200: pipeline resolvido -> retorna ReadinessScore com os 4 campos
#     (score/signals/ready/low_signals), 0.0 <= score <= 1.0
#   - 404: pipeline_manager.get_or_create devolve None -> HTTPException 404
# =============================================================================

from uuid import uuid4

import pytest
from fastapi import HTTPException

from app.routers import sessions as sessions_router
from app.services import pipeline as pipeline_service
from app.services.session_state import CoverageArea, ReadinessScore, SessionState

SESSION_ID = uuid4()


class _FakePipeline:
    """Stub mínimo — só precisa expor `.state` (o atributo real usado pela
    rota, confirmado em SessionPipeline.__init__, pipeline.py:26-28)."""

    def __init__(self, state: SessionState):
        self.state = state


def _covered() -> CoverageArea:
    return CoverageArea(status="covered", score=100)


@pytest.mark.asyncio
async def test_get_session_readiness_returns_score_for_existing_session(monkeypatch):
    """200: sessão resolvida pelo pipeline_manager -> devolve ReadinessScore
    com score/signals/ready/low_signals, score dentro de [0, 1]."""
    state = SessionState(session_id=str(SESSION_ID), mode="discovery")
    # Marca algumas áreas como cobertas para exercitar um score não-trivial
    # (não precisa ficar "ready", só provar que o cálculo real roda).
    for key in list(state.coverage)[:4]:
        state.coverage[key] = _covered()
    fake_pipeline = _FakePipeline(state)

    async def _fake_get_or_create(session_id: str, allow_finished: bool = False):
        assert session_id == str(SESSION_ID)
        assert allow_finished is True  # readiness legível pós-call (D-49)
        return fake_pipeline

    monkeypatch.setattr(
        pipeline_service.pipeline_manager, "get_or_create", _fake_get_or_create
    )

    result = await sessions_router.get_session_readiness(session_id=SESSION_ID, db=None)

    assert isinstance(result, ReadinessScore)
    assert 0.0 <= result.score <= 1.0
    assert isinstance(result.signals, dict)
    assert isinstance(result.ready, bool)
    assert isinstance(result.low_signals, list)


@pytest.mark.asyncio
async def test_get_session_readiness_404_for_missing_session(monkeypatch):
    """404: pipeline_manager.get_or_create devolve None (sessão inexistente ou
    blind id) -> HTTPException 404, mesmo padrão das rotas de report."""

    async def _fake_get_or_create_none(session_id: str, allow_finished: bool = False):
        return None

    monkeypatch.setattr(
        pipeline_service.pipeline_manager, "get_or_create", _fake_get_or_create_none
    )

    with pytest.raises(HTTPException) as exc_info:
        await sessions_router.get_session_readiness(session_id=uuid4(), db=None)

    assert exc_info.value.status_code == 404
