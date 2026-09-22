# =============================================================================
# test_expire_questions.py
#
# Task 4a (PLANO_AJUSTES.md) — ao expirar, a pergunta deve ser marcada como
# 'dismissed' TAMBÉM no banco (não só em memória), senão ressuscita como
# 'queued' no reload. Só pode afetar perguntas ainda em 'queued' (não
# sobrescrever pinned/used).
#
# Teste unitário puro: get_supabase é substituído por um fake que captura a
# query — sem rede, sem Supabase.
# =============================================================================

from datetime import datetime, timezone

from app.services import pipeline as pipeline_mod
from app.services.pipeline import SessionPipeline
from app.services.session_state import Question, SessionState

_PAST = "2000-01-01T00:00:00+00:00"
_FUTURE = "2999-01-01T00:00:00+00:00"
_NOW = datetime(2025, 1, 1, tzinfo=timezone.utc)


def _q(qid: str, status: str, expires_at: str) -> Question:
    return Question(
        id=qid, text="", block="", source="auto",
        status=status, generated_at="", expires_at=expires_at,
    )


class _FakeQuery:
    def __init__(self, calls: dict):
        self._calls = calls

    def update(self, payload):
        self._calls["payload"] = payload
        return self

    def in_(self, col, ids):
        self._calls["in_"] = (col, list(ids))
        return self

    def eq(self, col, val):
        self._calls["eq"] = (col, val)
        return self

    def execute(self):
        self._calls["executed"] = True
        return type("R", (), {"data": []})()


class _FakeDB:
    def __init__(self, calls: dict):
        self._calls = calls

    def table(self, name):
        self._calls["table"] = name
        return _FakeQuery(self._calls)


def _install_fake_db(monkeypatch) -> dict:
    calls: dict = {}
    monkeypatch.setattr(pipeline_mod, "get_supabase", lambda: _FakeDB(calls))
    return calls


def test_expires_only_due_queued_questions(monkeypatch):
    calls = _install_fake_db(monkeypatch)
    state = SessionState(session_id="s")
    state.questions = [
        _q("q1", "queued", _PAST),    # vencida → expira
        _q("q2", "queued", _FUTURE),  # não vencida → fica
        _q("q3", "pinned", _PAST),    # fixada → intocada
    ]
    pipe = SessionPipeline(state)

    expired = pipe._expire_due_questions(_NOW)

    assert expired == ["q1"]
    assert state.questions[0].status == "dismissed"
    assert state.questions[1].status == "queued"
    assert state.questions[2].status == "pinned"


def test_persists_expiration_in_batch(monkeypatch):
    calls = _install_fake_db(monkeypatch)
    state = SessionState(session_id="s")
    state.questions = [_q("q1", "queued", _PAST), _q("q2", "queued", _PAST)]
    pipe = SessionPipeline(state)

    expired = pipe._expire_due_questions(_NOW)

    assert set(expired) == {"q1", "q2"}
    assert calls["table"] == "questions"
    assert calls["payload"] == {"status": "dismissed"}
    assert calls["in_"] == ("id", ["q1", "q2"])
    assert calls["eq"] == ("status", "queued")  # não sobrescreve pinned/used
    assert calls["executed"] is True


def test_no_db_write_when_nothing_expires(monkeypatch):
    calls = _install_fake_db(monkeypatch)
    state = SessionState(session_id="s")
    state.questions = [_q("q1", "queued", _FUTURE)]
    pipe = SessionPipeline(state)

    assert pipe._expire_due_questions(_NOW) == []
    assert "executed" not in calls  # nenhuma escrita disparada


def test_db_failure_does_not_raise(monkeypatch):
    """Falha de persistência é logada, não propagada — a fila não pode parar."""
    class _BoomDB:
        def table(self, name):
            raise RuntimeError("supabase down")

    monkeypatch.setattr(pipeline_mod, "get_supabase", lambda: _BoomDB())
    state = SessionState(session_id="s")
    state.questions = [_q("q1", "queued", _PAST)]
    pipe = SessionPipeline(state)

    # Não deve levantar; a transição em memória já aconteceu.
    expired = pipe._expire_due_questions(_NOW)
    assert expired == ["q1"]
    assert state.questions[0].status == "dismissed"
