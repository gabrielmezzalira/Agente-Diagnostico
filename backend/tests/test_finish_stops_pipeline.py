# =============================================================================
# test_finish_stops_pipeline.py
#
# Task 3 (PLANO_AJUSTES.md) — encerrar a sessão via REST (POST /sessions/:id/finish)
# deve parar o pipeline em memória, senão as tasks de coverage/red-flag continuam
# chamando o Gemini indefinidamente e queimando budget.
#
# Também cobre a idempotência de PipelineManager.stop_session (o duplo caminho
# WS + REST precisa ser seguro).
#
# Teste unitário puro: db e pipeline_manager são fakes/monkeypatch — sem rede.
# =============================================================================

from uuid import UUID

import pytest

from app.routers import sessions as sessions_mod
from app.services import pipeline as pipeline_mod
from app.services.pipeline import PipelineManager

_SID = "11111111-1111-1111-1111-111111111111"


# --------------------------------------------------------------------------- #
# PipelineManager.stop_session — idempotência
# --------------------------------------------------------------------------- #

async def test_stop_session_no_pipeline_is_noop():
    pm = PipelineManager()
    # Nenhum pipeline registrado → não deve levantar.
    await pm.stop_session("inexistente")


async def test_stop_session_stops_and_removes():
    pm = PipelineManager()
    stopped = {"v": False}

    class _FakePipe:
        async def stop(self):
            stopped["v"] = True

    pm._pipelines[_SID] = _FakePipe()
    await pm.stop_session(_SID)

    assert stopped["v"] is True
    assert _SID not in pm._pipelines
    # Segunda chamada (ex.: WS depois do REST) continua segura.
    await pm.stop_session(_SID)


# --------------------------------------------------------------------------- #
# finish_session (REST) — deve chamar stop_session
# --------------------------------------------------------------------------- #

class _FakeQuery:
    def __init__(self, row: dict):
        self._row = row
        self._is_update = False
        self._payload: dict = {}

    def select(self, *a, **k):
        return self

    def update(self, payload, *a, **k):
        self._is_update = True
        self._payload = payload
        return self

    def eq(self, *a, **k):
        return self

    def execute(self):
        if self._is_update:
            return type("R", (), {"data": [{**self._row, **self._payload}]})()
        return type("R", (), {"data": [self._row]})()


class _FakeDB:
    def __init__(self, row: dict):
        self._row = row

    def table(self, name):
        return _FakeQuery(self._row)


async def test_finish_session_calls_stop_session(monkeypatch):
    called = {"sid": None}

    async def _fake_stop(sid):
        called["sid"] = sid

    monkeypatch.setattr(pipeline_mod.pipeline_manager, "stop_session", _fake_stop)

    row = {
        "id": _SID, "status": "active",
        "source": "extension", "recall_bot_id": None,
    }
    result = await sessions_mod.finish_session(UUID(_SID), db=_FakeDB(row))

    assert called["sid"] == _SID
    assert result["status"] == "finished"


async def test_finish_session_stop_failure_does_not_break_response(monkeypatch):
    """Falha ao parar o pipeline não pode impedir a resposta — status já gravado."""
    async def _boom(sid):
        raise RuntimeError("stop failed")

    monkeypatch.setattr(pipeline_mod.pipeline_manager, "stop_session", _boom)

    row = {
        "id": _SID, "status": "active",
        "source": "extension", "recall_bot_id": None,
    }
    result = await sessions_mod.finish_session(UUID(_SID), db=_FakeDB(row))
    assert result["status"] == "finished"


async def test_finish_session_rejects_non_active(monkeypatch):
    from fastapi import HTTPException

    row = {"id": _SID, "status": "finished", "source": "extension", "recall_bot_id": None}
    with pytest.raises(HTTPException) as exc:
        await sessions_mod.finish_session(UUID(_SID), db=_FakeDB(row))
    assert exc.value.status_code == 409
