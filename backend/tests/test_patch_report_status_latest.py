# =============================================================================
# test_patch_report_status_latest.py
#
# Gap-fix 04-gapfix (code-review Blocker 1 / CR-01):
# PATCH /sessions/{session_id}/report atualizava TODAS as linhas de `reports`
# com o mesmo session_id (uma sessão pode ter várias, uma por regeneração) e
# devolvia um membro arbitrário do conjunto atualizado. Este teste prova que,
# com duas linhas de reports para a mesma sessão, só a mais recente
# (generated_at maior) é atualizada e retornada.
#
# Fake Supabase com rastreamento de filtros (.eq) — mais completo que o
# FakeSupabase de test_upload_pdf_mode.py, que ignora filtros. Necessário
# aqui porque o bug só aparece quando o fake DIFERENCIA linhas por id.
# =============================================================================

from uuid import uuid4

import pytest

from app.routers.sessions import ReportStatusUpdate, update_session_report_status

SESSION_ID = uuid4()


class _FakeResult:
    def __init__(self, data):
        self.data = data


class _FakeReportsQuery:
    """Stub do encadeamento supabase-py só para a tabela `reports`, com
    filtros (.eq) aplicados de fato — para diferenciar linha antiga vs nova."""

    def __init__(self, rows: list[dict]):
        self._rows = rows
        self._filters: dict[str, str] = {}
        self._order_desc = False
        self._limit: int | None = None
        self._update_payload: dict | None = None

    def select(self, *_a, **_k):
        return self

    def update(self, payload):
        self._update_payload = payload
        return self

    def eq(self, column, value):
        self._filters[column] = str(value)
        return self

    def order(self, _column, desc=False):
        self._order_desc = desc
        return self

    def limit(self, n):
        self._limit = n
        return self

    def _matching_rows(self) -> list[dict]:
        rows = self._rows
        for column, value in self._filters.items():
            rows = [r for r in rows if str(r.get(column)) == value]
        return rows

    def execute(self):
        matched = self._matching_rows()

        if self._update_payload is not None:
            for row in matched:
                row.update(self._update_payload)
            return _FakeResult([dict(r) for r in matched])

        if self._order_desc:
            matched = sorted(matched, key=lambda r: r["generated_at"], reverse=True)
        if self._limit is not None:
            matched = matched[: self._limit]
        return _FakeResult([dict(r) for r in matched])


class FakeSupabaseReports:
    """Fake do Client supabase-py — só implementa `.table("reports")`."""

    def __init__(self, rows: list[dict]):
        self._rows = rows

    def table(self, name):
        assert name == "reports", f"tabela inesperada: {name}"
        return _FakeReportsQuery(self._rows)


@pytest.mark.asyncio
async def test_patch_report_status_updates_only_latest_report():
    """CR-01: com duas linhas de reports para a mesma sessão (regeneração),
    o PATCH deve atualizar e retornar SOMENTE a mais recente (generated_at
    maior) — a linha antiga permanece intocada."""
    old_report = {
        "id": str(uuid4()),
        "session_id": str(SESSION_ID),
        "status": "Rascunho",
        "generated_at": "2026-09-01T10:00:00Z",
        "markdown_content": "versão antiga",
    }
    new_report = {
        "id": str(uuid4()),
        "session_id": str(SESSION_ID),
        "status": "Rascunho",
        "generated_at": "2026-09-20T10:00:00Z",
        "markdown_content": "versão atual",
    }
    db = FakeSupabaseReports([old_report, new_report])

    payload = ReportStatusUpdate(status="Aprovado para build")
    result = await update_session_report_status(SESSION_ID, payload, db)

    assert result["id"] == new_report["id"]
    assert result["status"] == "Aprovado para build"
    assert old_report["status"] == "Rascunho"  # linha antiga não foi tocada


@pytest.mark.asyncio
async def test_patch_report_status_404_when_no_report():
    db = FakeSupabaseReports([])
    payload = ReportStatusUpdate(status="Aprovado para build")

    from fastapi import HTTPException

    with pytest.raises(HTTPException) as exc_info:
        await update_session_report_status(SESSION_ID, payload, db)

    assert exc_info.value.status_code == 404
