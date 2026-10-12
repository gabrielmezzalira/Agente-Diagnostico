# =============================================================================
# test_upload_pdf_mode.py
#
# Fase 4 (Discovery Report + Pricing Handoff) / Plano 04-04.
#
# CORREÇÃO ISOLADA (D-39): upload_pdf_transcript não propagava `mode=` para
# generate_report, então um PDF de sessão discovery gerava relatório sales
# silenciosamente (Pitfall 4 do RESEARCH). Este teste prova os dois caminhos:
#   - projeto mode='discovery' -> generate_report recebe mode='discovery' e o
#     INSERT de reports grava status='Rascunho' (mesmo grant do pipeline, D-36)
#   - projeto mode='sales' (ou sem mode) -> generate_report recebe mode='sales'
#     (default) e o INSERT NÃO grava status (comportamento atual, REP-03)
#
# Teste de integração com um FakeSupabase mínimo (sem rede, sem Supabase real)
# — chama upload_pdf_transcript diretamente (não via TestClient), no mesmo
# espírito de FakeRepo/FakeLLM em test_import_from_diagnosis_gate.py.
# =============================================================================

import io
from uuid import uuid4

import pytest
from fastapi import HTTPException, UploadFile

from app.routers import sessions as sessions_router
from app.services import llm as llm_service

SESSION_ID = uuid4()
PROJECT_ID = str(uuid4())


class _FakeResult:
    def __init__(self, data):
        self.data = data


class _FakeQuery:
    """Stub mínimo do encadeamento supabase-py (.select/.eq/.order/.limit/.in_/
    .insert/.update/.execute). Ignora os filtros — o FakeSupabase decide a
    resposta por nome de tabela e presença de payload (insert/update)."""

    def __init__(self, table_name, fake_db):
        self._table_name = table_name
        self._fake_db = fake_db
        self._payload = None

    def select(self, *a, **k):
        return self

    def eq(self, *a, **k):
        return self

    def order(self, *a, **k):
        return self

    def limit(self, *a, **k):
        return self

    def in_(self, *a, **k):
        return self

    def insert(self, payload):
        self._payload = payload
        return self

    def update(self, payload):
        self._payload = payload
        return self

    def execute(self):
        return self._fake_db._execute(self._table_name, self._payload)


class FakeSupabase:
    """Fake do Client supabase-py — só implementa o que upload_pdf_transcript usa.

    Fornece um coverage_snapshot NÃO vazio de propósito, para pular o ramo de
    classify_coverage automático (fora de escopo deste teste isolado)."""

    def __init__(self, mode: str | None, has_project_key: bool = True):
        project = {
            "id": PROJECT_ID,
            "project_type": "bi",
            "data_maturity_score": 3,
        }
        if has_project_key:
            project["gemini_api_key_secret_id"] = "fake-secret-id"
        if mode is not None:
            # Coluna projects.mode presente (caso comum pós-migration, D-38).
            project["mode"] = mode
        # mode is None -> chave ausente do dict, reproduzindo project.get("mode",
        # "sales") sem default explícito no dado (ex.: sessões/projetos legados
        # que não selecionam a coluna, ou pré-migration).
        self._session_row = {
            "id": str(SESSION_ID),
            "tokens_used": 0,
            "cost_usd": "0",
            "projects": project,
        }
        self.inserts: list[tuple[str, dict]] = []

    def table(self, name):
        return _FakeQuery(name, self)

    def rpc(self, name, params):
        return _FakeQuery(f"rpc:{name}", self)

    def _execute(self, table_name: str, payload):
        if payload is not None:
            self.inserts.append((table_name, payload))
            return _FakeResult([{**payload, "id": str(uuid4())}])

        if table_name == "rpc:vault_get_secret":
            return _FakeResult("fake-gemini-key")
        if table_name == "sessions":
            return _FakeResult([self._session_row])
        if table_name == "coverage_snapshots":
            return _FakeResult([{"coverage_json": {"gargalo": {"status": "covered", "score": 90, "notes": ""}}}])
        if table_name in ("red_flags", "questions", "session_prompts", "transcript_chunks"):
            return _FakeResult([])
        return _FakeResult([])


def _fake_pdfplumber_open(monkeypatch):
    """Evita depender de parsing real de PDF — pdfplumber.open(bytes reais)
    falharia com bytes fake. `upload_pdf_transcript` só usa `.pages` com
    `.extract_text()`."""

    class _FakePage:
        def extract_text(self):
            return "Reuniao de discovery: cliente relatou processo manual em planilhas."

    class _FakePdf:
        def __enter__(self):
            return self

        def __exit__(self, *a):
            return False

        @property
        def pages(self):
            return [_FakePage()]

    monkeypatch.setattr(sessions_router.pdfplumber, "open", lambda _bytes: _FakePdf())


async def _run_upload(
    monkeypatch, mode: str | None, has_project_key: bool = True
) -> tuple[FakeSupabase, dict]:
    _fake_pdfplumber_open(monkeypatch)

    captured: dict = {}

    async def _fake_generate_report(**kwargs):
        captured.update(kwargs)
        return "relatorio de teste", 10, 20

    monkeypatch.setattr(llm_service, "generate_report", _fake_generate_report)
    monkeypatch.setattr(sessions_router.llm_service, "generate_report", _fake_generate_report)

    fake_db = FakeSupabase(mode=mode, has_project_key=has_project_key)
    upload = UploadFile(file=io.BytesIO(b"%PDF-1.4 fake pdf bytes"), filename="transcricao.pdf")

    await sessions_router.upload_pdf_transcript(session_id=SESSION_ID, file=upload, db=fake_db)

    return fake_db, captured


@pytest.mark.asyncio
async def test_upload_discovery_mode_propagates_and_grants_status(monkeypatch):
    """REP-01: projeto mode='discovery' -> generate_report recebe mode='discovery'
    e o INSERT de reports grava status='Rascunho' (mesmo grant do pipeline, D-36)."""
    fake_db, captured = await _run_upload(monkeypatch, mode="discovery")

    assert captured["mode"] == "discovery"

    report_inserts = [payload for table, payload in fake_db.inserts if table == "reports"]
    assert len(report_inserts) == 1
    assert report_inserts[0]["status"] == "Rascunho"


@pytest.mark.asyncio
async def test_upload_sales_mode_unchanged(monkeypatch):
    """REP-03: projeto mode='sales' -> generate_report recebe mode='sales' (nada
    muda) e o INSERT de reports NÃO grava status (None/ausente) — comportamento
    sales atual preservado."""
    fake_db, captured = await _run_upload(monkeypatch, mode="sales")

    assert captured["mode"] == "sales"

    report_inserts = [payload for table, payload in fake_db.inserts if table == "reports"]
    assert len(report_inserts) == 1
    assert "status" not in report_inserts[0]


@pytest.mark.asyncio
async def test_upload_no_mode_defaults_to_sales(monkeypatch):
    """REP-03: projeto sem `mode` (coluna aditiva, sessões pré-migration) cai no
    default 'sales' — mesma garantia de generate_report(mode='sales' default)."""
    fake_db, captured = await _run_upload(monkeypatch, mode=None)

    assert captured["mode"] == "sales"

    report_inserts = [payload for table, payload in fake_db.inserts if table == "reports"]
    assert len(report_inserts) == 1
    assert "status" not in report_inserts[0]


@pytest.mark.asyncio
async def test_upload_without_project_key_uses_server_key(monkeypatch):
    """D-15 (pdf-fallback: sim): projeto sem chave no Vault + GEMINI_API_KEY no servidor ->
    a importação segue e generate_report recebe a chave do servidor."""
    monkeypatch.setenv("GEMINI_API_KEY", "chave-do-servidor")

    fake_db, captured = await _run_upload(monkeypatch, mode="sales", has_project_key=False)

    assert captured["api_key"] == "chave-do-servidor"
    assert len([1 for table, _ in fake_db.inserts if table == "reports"]) == 1


@pytest.mark.asyncio
async def test_upload_without_any_key_is_503(monkeypatch):
    """Sem chave no projeto E sem GEMINI_API_KEY no servidor -> 503 como sempre."""
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)

    with pytest.raises(HTTPException) as excinfo:
        await _run_upload(monkeypatch, mode="sales", has_project_key=False)

    assert excinfo.value.status_code == 503
    assert "Chave Gemini" in excinfo.value.detail


@pytest.mark.asyncio
async def test_upload_project_key_has_priority_over_server_key(monkeypatch):
    """Chave própria do projeto continua tendo prioridade sobre a do servidor."""
    monkeypatch.setenv("GEMINI_API_KEY", "chave-do-servidor")

    _, captured = await _run_upload(monkeypatch, mode="sales", has_project_key=True)

    assert captured["api_key"] == "fake-gemini-key"
