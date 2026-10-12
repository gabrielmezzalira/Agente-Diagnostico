# =============================================================================
# test_extension_chunk_extra_fields.py
#
# Fase 8 (Taqciti Session Association) / Plano 08-06 — Task 2 (suposição A1,
# insumo da decisão B3).
#
# A Fase 8 manda trechos em sequência rápida (envio em partes, reenvio) e o time
# ainda vai decidir (B3) se a Taqciti envia um `chunk_id` junto de cada trecho
# para dar idempotência ao backend. Este teste NÃO muda produção: ele só prova
# que, HOJE, o contrato de POST /webhook/extension:
#   - aceita um campo extra `chunk_id` (pydantic v2, sem extra='forbid');
#   - ignora esse campo (ele não chega ao banco nem ao pipeline).
# Ou seja: mandar `chunk_id` não quebra nada, mas também ainda não protege contra
# duplicata — isso depende da decisão B3.
#
# Teste unitário puro: db fake e pipeline_manager.push_chunk em monkeypatch,
# sem rede e sem .env.
# =============================================================================

import asyncio

from app.routers.webhook import ExtensionChunk, extension_webhook
from app.services import pipeline as pipeline_mod

_PAYLOAD_WITH_CHUNK_ID = {
    "session_id": "s",
    "text": "t",
    "speaker": None,
    "chunk_id": "bulk:m1:0",
}


class _FakeInsert:
    def __init__(self, sink: list, table: str, payload: dict):
        self._sink = sink
        self._table = table
        self._payload = payload

    def execute(self):
        self._sink.append((self._table, self._payload))


class _FakeTable:
    def __init__(self, sink: list, table: str):
        self._sink = sink
        self._table = table

    def insert(self, payload: dict):
        return _FakeInsert(self._sink, self._table, payload)


class _FakeDB:
    def __init__(self):
        self.inserts: list = []

    def table(self, name: str):
        return _FakeTable(self.inserts, name)


def test_extension_chunk_accepts_and_ignores_extra_chunk_id():
    chunk = ExtensionChunk.model_validate(_PAYLOAD_WITH_CHUNK_ID)

    assert chunk.session_id == "s"
    assert chunk.text == "t"
    assert "chunk_id" not in chunk.model_dump()


def test_extension_chunk_without_chunk_id_is_still_valid():
    chunk = ExtensionChunk.model_validate({"session_id": "s", "text": "t"})

    assert chunk.speaker is None
    assert chunk.model_dump() == {"session_id": "s", "text": "t", "speaker": None}


async def test_extension_webhook_does_not_persist_extra_chunk_id(monkeypatch):
    pushed: list = []

    async def _fake_push_chunk(session_id, text, speaker=None):
        pushed.append((session_id, text, speaker))

    monkeypatch.setattr(pipeline_mod.pipeline_manager, "push_chunk", _fake_push_chunk)
    db = _FakeDB()
    payload = ExtensionChunk.model_validate(_PAYLOAD_WITH_CHUNK_ID)

    result = await extension_webhook(payload, db=db, _=None)
    await asyncio.sleep(0)  # deixa a task create_task(push_chunk) rodar

    assert result == {"accepted": True}
    assert db.inserts == [
        ("transcript_chunks", {"session_id": "s", "speaker": None, "text": "t"})
    ]
    assert set(db.inserts[0][1].keys()) == {"session_id", "speaker", "text"}
    assert pushed == [("s", "t", None)]
