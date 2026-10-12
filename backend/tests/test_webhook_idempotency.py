# =============================================================================
# test_webhook_idempotency.py
#
# Fase 8 (Taqciti Session Association) / Plano 08-09 — D-19.
#
# O reenvio automático da Taqciti pode mandar a mesma fala duas vezes quando a
# resposta se perde. Com `chunk_id` + índice único (session_id, chunk_id), o
# segundo insert falha com 23505 (unique_violation); o repositório devolve False
# e o webhook responde 202 SEM empurrar a fala de novo para o pipeline.
#
# Teste unitário puro: db fake e APIError fake, sem rede e sem .env.
# =============================================================================

import asyncio

import pytest
from postgrest.exceptions import APIError
from pydantic import ValidationError

from app.repositories.transcript_chunks_repository import TranscriptChunksRepository
from app.routers.webhook import ExtensionChunk, extension_webhook
from app.services import pipeline as pipeline_mod


def _api_error(code: str) -> APIError:
    return APIError({"message": "erro de teste", "code": code, "details": None, "hint": None})


class _FakeInsert:
    def __init__(self, db: "_FakeDB", payload: dict):
        self._db = db
        self._payload = payload

    def execute(self):
        if self._db.raise_code is not None:
            raise _api_error(self._db.raise_code)
        self._db.inserts.append(self._payload)


class _FakeTable:
    def __init__(self, db: "_FakeDB"):
        self._db = db

    def insert(self, payload: dict):
        return _FakeInsert(self._db, payload)


class _FakeDB:
    def __init__(self, raise_code: str | None = None):
        self.inserts: list = []
        self.raise_code = raise_code

    def table(self, name: str):
        assert name == "transcript_chunks"
        return _FakeTable(self)


def test_insert_chunk_without_chunk_id_omits_the_key():
    db = _FakeDB()

    assert TranscriptChunksRepository(db).insert_chunk("s", "olá", None) is True
    assert db.inserts == [{"session_id": "s", "speaker": None, "text": "olá"}]
    assert "chunk_id" not in db.inserts[0]


def test_insert_chunk_with_chunk_id_stores_it():
    db = _FakeDB()

    ok = TranscriptChunksRepository(db).insert_chunk("s", "olá", "Ana", chunk_id="bulk:m1:0")

    assert ok is True
    assert db.inserts == [
        {"session_id": "s", "speaker": "Ana", "text": "olá", "chunk_id": "bulk:m1:0"}
    ]


def test_insert_chunk_returns_false_on_unique_violation():
    db = _FakeDB(raise_code="23505")

    assert TranscriptChunksRepository(db).insert_chunk("s", "olá", None, chunk_id="c1") is False


def test_insert_chunk_reraises_other_database_errors():
    db = _FakeDB(raise_code="42703")

    with pytest.raises(APIError) as exc_info:
        TranscriptChunksRepository(db).insert_chunk("s", "olá", None, chunk_id="c1")

    assert exc_info.value.code == "42703"


def test_extension_chunk_chunk_id_is_optional_and_capped_at_200():
    assert ExtensionChunk.model_validate({"session_id": "s", "text": "t"}).chunk_id is None
    assert ExtensionChunk.model_validate(
        {"session_id": "s", "text": "t", "chunk_id": "x" * 200}
    ).chunk_id == "x" * 200
    with pytest.raises(ValidationError):
        ExtensionChunk.model_validate({"session_id": "s", "text": "t", "chunk_id": "x" * 201})


async def _post(monkeypatch, db, payload: dict) -> list:
    pushed: list = []

    async def _fake_push_chunk(session_id, text, speaker=None):
        pushed.append((session_id, text, speaker))

    monkeypatch.setattr(pipeline_mod.pipeline_manager, "push_chunk", _fake_push_chunk)
    result = await extension_webhook(ExtensionChunk.model_validate(payload), db=db, _=None)
    await asyncio.sleep(0)  # deixa a task create_task(push_chunk) rodar
    assert result == {"accepted": True}
    return pushed


async def test_webhook_duplicate_chunk_id_returns_202_without_push(monkeypatch):
    db = _FakeDB(raise_code="23505")

    pushed = await _post(monkeypatch, db, {"session_id": "s", "text": "t", "chunk_id": "c1"})

    assert pushed == []


async def test_webhook_same_chunk_id_twice_pushes_once(monkeypatch):
    # Semente do plano: mesmo chunk_id duas vezes -> um único push_chunk.
    seen: set = set()
    pushed: list = []

    class _DedupDB(_FakeDB):
        def table(self, name: str):
            outer = self

            class _T:
                def insert(self, payload):
                    class _I:
                        def execute(_s):
                            key = (payload["session_id"], payload.get("chunk_id"))
                            if payload.get("chunk_id") and key in seen:
                                raise _api_error("23505")
                            seen.add(key)
                            outer.inserts.append(payload)
                    return _I()
            return _T()

    async def _fake_push_chunk(session_id, text, speaker=None):
        pushed.append((session_id, text, speaker))

    monkeypatch.setattr(pipeline_mod.pipeline_manager, "push_chunk", _fake_push_chunk)
    db = _DedupDB()
    payload = ExtensionChunk.model_validate({"session_id": "s", "text": "t", "chunk_id": "c1"})

    await extension_webhook(payload, db=db, _=None)
    await extension_webhook(payload, db=db, _=None)
    await asyncio.sleep(0)

    assert len(db.inserts) == 1
    assert pushed == [("s", "t", None)]


async def test_webhook_new_chunk_id_pushes_once(monkeypatch):
    db = _FakeDB()

    pushed = await _post(monkeypatch, db, {"session_id": "s", "text": "t", "chunk_id": "c1"})

    assert pushed == [("s", "t", None)]
    assert db.inserts[0]["chunk_id"] == "c1"


async def test_webhook_without_chunk_id_keeps_current_behavior(monkeypatch):
    db = _FakeDB()

    pushed = await _post(monkeypatch, db, {"session_id": "s", "text": "  t  ", "speaker": "Ana"})

    assert db.inserts == [{"session_id": "s", "speaker": "Ana", "text": "t"}]
    assert pushed == [("s", "t", "Ana")]
