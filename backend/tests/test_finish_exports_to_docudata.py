# Task C5 — encerrar a sessão (REST ou WebSocket) agenda o envio ao DocuData, uma vez só,
# e nunca deixa uma falha do gancho quebrar o encerramento. Fakes/monkeypatch, sem rede.
import json
from uuid import UUID

import pytest
from fastapi import HTTPException, WebSocketDisconnect

from app.routers import sessions as sessions_mod
from app.routers import ws as ws_mod
from app.services import pipeline as pipeline_mod
from tests.test_finish_stops_pipeline import _FakeDB

_SID = "11111111-1111-1111-1111-111111111111"
_ROW = {"id": _SID, "status": "active", "source": "extension", "recall_bot_id": None}


async def _sem_parar(sid):
    return None


# ----------------------------- REST -----------------------------

async def test_finish_agenda_a_exportacao_da_sessao(monkeypatch):
    agendadas = []
    monkeypatch.setattr(pipeline_mod.pipeline_manager, "stop_session", _sem_parar)
    monkeypatch.setattr(sessions_mod, "agendar_exportacao", lambda sid: agendadas.append(sid))
    result = await sessions_mod.finish_session(UUID(_SID), db=_FakeDB(dict(_ROW)))
    assert result["status"] == "finished" and agendadas == [_SID]


async def test_falha_ao_agendar_nao_quebra_o_encerramento(monkeypatch):
    monkeypatch.setattr(pipeline_mod.pipeline_manager, "stop_session", _sem_parar)

    def _boom(sid):
        raise RuntimeError("sem loop")

    monkeypatch.setattr(sessions_mod, "agendar_exportacao", _boom)
    result = await sessions_mod.finish_session(UUID(_SID), db=_FakeDB(dict(_ROW)))
    assert result["status"] == "finished"


async def test_sessao_que_nao_esta_ativa_nao_agenda(monkeypatch):
    """Re-encerrar sessão já 'finished' dá 409 antes da lógica de encerramento: não agenda."""
    agendadas = []
    monkeypatch.setattr(sessions_mod, "agendar_exportacao", lambda sid: agendadas.append(sid))
    with pytest.raises(HTTPException) as exc:
        await sessions_mod.finish_session(UUID(_SID), db=_FakeDB({**_ROW, "status": "finished"}))
    assert exc.value.status_code == 409 and agendadas == []


async def test_sessao_inexistente_nao_agenda(monkeypatch):
    class _VazioDB:
        def table(self, name):
            q = _FakeDB({}).table(name)
            q.execute = lambda: type("R", (), {"data": []})()
            return q

    agendadas = []
    monkeypatch.setattr(sessions_mod, "agendar_exportacao", lambda sid: agendadas.append(sid))
    with pytest.raises(HTTPException) as exc:
        await sessions_mod.finish_session(UUID(_SID), db=_VazioDB())
    assert exc.value.status_code == 404 and agendadas == []


async def test_agenda_depois_de_gravar_finished(monkeypatch):
    """A linha já está 'finished' (update executado) quando o gancho é chamado."""
    eventos = []

    class _Q:
        def __init__(self):
            self._upd = False

        def select(self, *a, **k):
            return self

        def update(self, payload, *a, **k):
            self._upd = True
            self._payload = payload
            return self

        def eq(self, *a, **k):
            return self

        def execute(self):
            if self._upd:
                eventos.append("update")
                return type("R", (), {"data": [{**_ROW, **self._payload}]})()
            return type("R", (), {"data": [dict(_ROW)]})()

    class _DB:
        def table(self, name):
            return _Q()

    monkeypatch.setattr(pipeline_mod.pipeline_manager, "stop_session", _sem_parar)
    monkeypatch.setattr(sessions_mod, "agendar_exportacao", lambda sid: eventos.append("agendar"))
    await sessions_mod.finish_session(UUID(_SID), db=_DB())
    assert eventos == ["update", "agendar"]


# --------------------------- WebSocket ---------------------------

class _FakeWS:
    def __init__(self, mensagens):
        self._msgs = list(mensagens)
        self.enviadas = []

    async def accept(self):
        pass

    async def send_text(self, t):
        self.enviadas.append(t)

    async def receive_text(self):
        if not self._msgs:
            raise WebSocketDisconnect()
        return self._msgs.pop(0)

    async def close(self, code=1000, reason=""):
        pass


class _FakeState:
    tokens_used = 7
    cost_usd = 0.5

    def coverage_to_dict(self):
        return {}

    red_flags: list = []
    questions: list = []
    transcript_chunks: list = []


class _FakePipeline:
    state = _FakeState()

    def _budget_payload(self):
        return {}


def _preparar_ws(monkeypatch, eventos):
    class _PM:
        async def get_or_create(self, sid):
            return _FakePipeline()

        async def stop_session(self, sid):
            eventos.append("stop")

    class _Q:
        def update(self, payload, *a, **k):
            self._p = payload
            return self

        def eq(self, *a, **k):
            return self

        def execute(self):
            eventos.append("update:" + self._p.get("status", ""))

    class _DB:
        def table(self, name):
            return _Q()

    monkeypatch.setattr(ws_mod, "pipeline_manager", _PM())
    monkeypatch.setattr(ws_mod, "get_supabase", lambda: _DB())


async def test_ws_finish_agenda_exatamente_uma_vez_apos_gravar(monkeypatch):
    eventos = []
    _preparar_ws(monkeypatch, eventos)
    monkeypatch.setattr(ws_mod, "agendar_exportacao", lambda sid: eventos.append(("agendar", sid)))
    ws = _FakeWS([json.dumps({"event": "finish_session"})])
    await ws_mod.websocket_endpoint(_SID, ws)
    assert eventos == ["update:finished", "stop", ("agendar", _SID)]


async def test_ws_falha_ao_agendar_nao_quebra(monkeypatch):
    eventos = []
    _preparar_ws(monkeypatch, eventos)

    def _boom(sid):
        raise RuntimeError("sem loop")

    monkeypatch.setattr(ws_mod, "agendar_exportacao", _boom)
    ws = _FakeWS([json.dumps({"event": "finish_session"})])
    await ws_mod.websocket_endpoint(_SID, ws)  # não levanta
    assert eventos == ["update:finished", "stop"]


async def test_ws_sem_finish_nao_agenda(monkeypatch):
    eventos = []
    _preparar_ws(monkeypatch, eventos)
    monkeypatch.setattr(ws_mod, "agendar_exportacao", lambda sid: eventos.append("agendar"))
    ws = _FakeWS([json.dumps({"event": "ping"})])  # depois desconecta
    await ws_mod.websocket_endpoint(_SID, ws)
    assert "agendar" not in eventos
