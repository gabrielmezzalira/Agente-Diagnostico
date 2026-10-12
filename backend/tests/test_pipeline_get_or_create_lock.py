# =============================================================================
# test_pipeline_get_or_create_lock.py
#
# Fase 8 (Taqciti Session Association) / Plano 08-06 — Task 1 (TAQ-02, T-08-09,
# Pitfall 5b).
#
# O problema: PipelineManager.get_or_create só registra o pipeline em _pipelines
# depois de fazer `await` ao LLM (infer_project_type / extract_structured_context
# para projetos com pre_meeting_context). Dois chunks quase simultâneos da mesma
# reunião passam os dois pela checagem "já existe?" antes de qualquer um registrar
# — criando dois pipelines e deixando um com tarefas órfãs chamando o Gemini.
#
# O conserto: um asyncio.Lock por session_id, com nova checagem depois de adquirir.
#
# Casos cobertos (todos puros — db, llm e SessionPipeline.start são fakes):
#   1. duas chamadas concorrentes para a MESMA sessão -> 1 pipeline, 1 start,
#      1 consulta à tabela sessions
#   2. chamadas concorrentes para sessões DIFERENTES não se bloqueiam
#   3. sessão encerrada com allow_finished=True -> pipeline de uso único,
#      não registrado, sem start
#   4. sessão inexistente -> None e nenhuma entrada sobra em _locks
# =============================================================================

import asyncio

import pytest

from app.services import pipeline as pipeline_mod
from app.services import structured_context as structured_context_mod
from app.services.pipeline import PipelineManager, SessionPipeline

_SID = "11111111-1111-1111-1111-111111111111"
_SID_A = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"
_SID_B = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"


# --------------------------------------------------------------------------- #
# Fakes de banco
# --------------------------------------------------------------------------- #

class _Result:
    def __init__(self, data):
        self.data = data


class _FakeQuery:
    def __init__(self, db: "_FakeDB", table: str):
        self._db = db
        self._table = table
        self._filters: dict = {}

    def select(self, *a, **k):
        return self

    def eq(self, column, value):
        self._filters[column] = value
        return self

    def order(self, *a, **k):
        return self

    def update(self, *a, **k):
        return self

    def insert(self, *a, **k):
        return self

    def execute(self):
        if self._table == "sessions":
            self._db.sessions_queries += 1
            row = self._db.sessions.get(self._filters.get("id"))
            if row is None:
                return _Result([])
            wanted_status = self._filters.get("status")
            if wanted_status and row["status"] != wanted_status:
                return _Result([])
            return _Result([row])
        return _Result([])


class _FakeDB:
    def __init__(self, sessions: dict):
        self.sessions = sessions
        self.sessions_queries = 0

    def table(self, name):
        return _FakeQuery(self, name)

    def rpc(self, *a, **k):
        return _FakeQuery(self, "rpc")


def _session_row(sid: str, status: str = "active", context: str = "contexto do projeto") -> dict:
    return {
        "id": sid,
        "status": status,
        "tokens_used": 0,
        "cost_usd": 0,
        "projects": {
            "id": f"proj-{sid}",
            "project_type": "",
            "pre_meeting_context": context,
            "mode": "sales",
        },
    }


class _EmptyCtx:
    def is_empty(self) -> bool:
        return True


@pytest.fixture
def pipeline_env(monkeypatch):
    """Isola get_or_create da rede: db fake, LLM fake e start/load_state_only
    contados. Devolve (instalar_db, contadores)."""
    counters = {"start": 0, "load_state_only": 0}

    async def _fake_start(self):
        counters["start"] += 1

    async def _fake_load_state_only(self):
        counters["load_state_only"] += 1

    monkeypatch.setattr(SessionPipeline, "start", _fake_start)
    monkeypatch.setattr(SessionPipeline, "load_state_only", _fake_load_state_only)
    monkeypatch.setenv("GEMINI_API_KEY", "chave-fake-so-para-teste")

    async def _fast_infer(key, context):
        await asyncio.sleep(0)  # cede o controle — abre a janela da corrida
        return "bi", 0, 0

    async def _fast_extract(key, context):
        await asyncio.sleep(0)
        return _EmptyCtx(), 0, 0

    monkeypatch.setattr(pipeline_mod.llm_service, "infer_project_type", _fast_infer)
    monkeypatch.setattr(structured_context_mod, "extract_structured_context", _fast_extract)

    def _install(db: _FakeDB):
        monkeypatch.setattr(pipeline_mod, "get_supabase", lambda: db)
        return db

    return _install, counters


# --------------------------------------------------------------------------- #
# 1. Mesma sessão, duas chamadas concorrentes -> um único pipeline
# --------------------------------------------------------------------------- #

async def test_concurrent_calls_same_session_create_single_pipeline(pipeline_env):
    install, counters = pipeline_env
    db = install(_FakeDB({_SID: _session_row(_SID)}))
    pm = PipelineManager()

    first, second = await asyncio.gather(pm.get_or_create(_SID), pm.get_or_create(_SID))

    assert first is not None
    assert first is second
    assert counters["start"] == 1
    assert len(pm._pipelines) == 1
    assert db.sessions_queries == 1


# --------------------------------------------------------------------------- #
# 2. Sessões diferentes não se bloqueiam (lock por session_id)
# --------------------------------------------------------------------------- #

async def test_concurrent_calls_different_sessions_do_not_block(pipeline_env, monkeypatch):
    install, counters = pipeline_env
    install(_FakeDB({
        _SID_A: _session_row(_SID_A, context="lenta-A"),
        _SID_B: _session_row(_SID_B, context="rapida-B"),
    }))
    gate_a = asyncio.Event()

    async def _selective_infer(key, context):
        if context == "lenta-A":
            await gate_a.wait()  # A só termina quando o teste liberar
        else:
            await asyncio.sleep(0)
        return "bi", 0, 0

    monkeypatch.setattr(pipeline_mod.llm_service, "infer_project_type", _selective_infer)
    pm = PipelineManager()

    task_a = asyncio.create_task(pm.get_or_create(_SID_A))
    await asyncio.sleep(0)  # A entra no lock e fica presa no LLM

    # B tem que terminar mesmo com A ainda presa; se o lock fosse global, estouraria o timeout.
    pipeline_b = await asyncio.wait_for(pm.get_or_create(_SID_B), timeout=1.0)
    assert pipeline_b is not None
    assert not task_a.done()

    gate_a.set()
    pipeline_a = await asyncio.wait_for(task_a, timeout=1.0)
    assert pipeline_a is not None
    assert pipeline_a is not pipeline_b
    assert set(pm._pipelines) == {_SID_A, _SID_B}
    assert counters["start"] == 2


# --------------------------------------------------------------------------- #
# 3. Sessão encerrada com allow_finished=True -> uso único, sem registrar
# --------------------------------------------------------------------------- #

async def test_finished_session_allow_finished_is_single_use(pipeline_env):
    install, counters = pipeline_env
    install(_FakeDB({_SID: _session_row(_SID, status="finished")}))
    pm = PipelineManager()

    pipeline = await pm.get_or_create(_SID, allow_finished=True)

    assert pipeline is not None
    assert _SID not in pm._pipelines
    assert counters["start"] == 0
    assert counters["load_state_only"] == 1


# --------------------------------------------------------------------------- #
# 4. Sessão inexistente -> None e nenhum lock sobrando
# --------------------------------------------------------------------------- #

async def test_unknown_session_returns_none_and_leaves_no_lock(pipeline_env):
    install, counters = pipeline_env
    install(_FakeDB({}))
    pm = PipelineManager()

    assert await pm.get_or_create("inexistente") is None
    assert pm._locks == {}
    assert counters["start"] == 0
