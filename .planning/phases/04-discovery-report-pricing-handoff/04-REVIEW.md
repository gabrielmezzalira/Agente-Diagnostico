---
phase: 04-discovery-report-pricing-handoff
reviewed: 2026-09-23T00:00:00Z
depth: standard
files_reviewed: 12
files_reviewed_list:
  - backend/app/repositories/pricing_repository.py
  - backend/app/routers/sessions.py
  - backend/app/services/discovery_prompt_builder.py
  - backend/app/services/llm.py
  - backend/app/services/llm_pricing_service.py
  - backend/app/services/pipeline.py
  - backend/app/services/session_state.py
  - backend/tests/test_discovery_report.py
  - backend/tests/test_import_from_diagnosis_gate.py
  - backend/tests/test_readiness_score.py
  - backend/tests/test_upload_pdf_mode.py
  - supabase/migrations/20260923000000_add_status_to_reports.sql
findings:
  critical: 2
  warning: 4
  info: 1
  total: 7
status: resolved
resolution: "Blockers CR-01/CR-02 + W4/Info fixed in 47a343f, 7f3cdeb, f81da47 (gap-closure). W1/W2 accepted per continuous-PRD/no-mode-coupling."
---

# Phase 04: Code Review Report

**Reviewed:** 2026-09-23T00:00:00Z
**Depth:** standard
**Files Reviewed:** 12
**Status:** issues_found

## Summary

This phase adds a status-gated discovery→pricing handoff: a nullable `reports.status` column,
a `PATCH /sessions/{session_id}/report` transition route, a service-level approval gate in
`LLMPricingService.import_from_diagnosis`, the 16-section PRD skeleton in
`DiscoveryPromptBuilder.build_report_generator`, per-lens report assembly in `llm.generate_report`,
and a pure `SessionState.readiness_score()`.

The architecture placement is correct — the gate check lives in the service
(`llm_pricing_service.py`), not the router, matching the project's SOLID conventions, and the sales
code path is proven byte-identical by `test_discovery_report.py::test_sales_mode_unchanged`. However,
two real correctness/security gaps were found in the handoff itself: (1) the new `PATCH` endpoint
mutates every report row sharing a `session_id` instead of only the current one, and (2) the approval
gate can be skipped entirely by simply omitting `session_id` from the import call, which is the
documented "legacy" code path and remains completely unguarded. Both directly undermine the stated
purpose of this phase (status-gated handoff) and should be fixed before shipping.

## Critical Issues

### CR-01: PATCH /sessions/{session_id}/report mutates every report row for the session, not just the current one

**File:** `backend/app/routers/sessions.py:349-364`
**Issue:** A session can have more than one row in `reports` — every report regeneration (`POST
/sessions/{id}/report`, `POST /sessions/{id}/transcript/upload`, or the pipeline's automatic
`_run_report_generator`) inserts a **new** row rather than upserting; `GET`/`POST` on `/report`
both correctly select the current one via `.order("generated_at", desc=True).limit(1)`. The new
`PATCH` handler does not do this — it updates by `session_id` alone:

```python
result = (
    db.table("reports")
    .update({"status": payload.status})
    .eq("session_id", str(session_id))
    .execute()
)
...
return result.data[0]
```

This has two consequences: (a) every historical report version for that session — including old
drafts that predate a regeneration — silently gets its `status` flipped to whatever the caller
just set (e.g. "Aprovado para build"), corrupting the audit trail the `status` column is meant to
represent (`REP-02`/`D-38` explicitly frame `status` as tracking one document's lifecycle); and (b)
`result.data[0]` is an arbitrary member of the updated set (Supabase does not guarantee it is the
most recently generated row), so the `ReportResponse` returned to the caller can show stale
`markdown_content`/`cost_usd` from an old report even though the "current" one is a different row.
No test exercises the multi-report-per-session scenario, which is why this was not caught.

**Fix:** Scope the update to the latest report for the session (mirroring the pattern already used
by `GET`/`POST` on the same route), e.g.:
```python
latest = (
    db.table("reports")
    .select("id")
    .eq("session_id", str(session_id))
    .order("generated_at", desc=True)
    .limit(1)
    .execute()
)
if not latest.data:
    raise HTTPException(status_code=404, detail="No report found for this session")
result = (
    db.table("reports")
    .update({"status": payload.status})
    .eq("id", latest.data[0]["id"])
    .execute()
)
return result.data[0]
```

### CR-02: REP-02 approval gate is fully bypassed when `session_id` is omitted from import-from-diagnosis

**File:** `backend/app/services/llm_pricing_service.py:93-124`
**Issue:** `POST /pricings/{pricing_id}/import-from-diagnosis` accepts an **optional** body
(`ImportFromDiagnosisBody.session_id: Optional[UUID] = None`, see
`backend/app/models/pricings.py:143-151`, and `backend/app/routers/pricings.py:211-217`, where
`body: ImportFromDiagnosisBody | None = None`). The new status gate is only wired into the
`if session_id:` branch:

```python
if session_id:
    ...
    report = self._repo.get_session_report(session_id)
    if report and report.get("status") not in (None, "Aprovado para build"):
        raise HTTPException(status_code=422, detail="... precisa estar 'Aprovado para build' ...")
    reports = [report] if report else []
else:
    reports = self._repo.get_project_reports(project_id)   # <-- no status check at all
```

The `else` branch (session_id absent — the "legacy" project-wide code path retained on purpose,
per the docstring at line 82-84: `"Se None, mantém o comportamento legado de usar todos os
relatórios do projeto"`) pulls **every** report for the project via `get_project_reports`, with
zero filtering on `status`. Any discovery report still sitting at `status='Rascunho'` or `'Em
revisão'` is happily concatenated into `combined_md` and fed to the LLM for feature extraction —
the entire point of this phase (block extraction until a human explicitly approves the PRD) is
defeated by simply not sending `session_id` in the request body, which is the *default* shape of
the call (`body: ImportFromDiagnosisBody | None = None`, `session_id: Optional[UUID] = None`).
This matches the STRIDE entry `T-04-01` in `04-01-PLAN.md` (severity "high", disposition
"mitigate") but the mitigation only covers half of the trust boundary.

**Fix:** Apply the same status filter to the project-wide path — either reject reports whose
`status` is a discovery-draft value before concatenating, or require `session_id` whenever any
report in the project has a non-null `status` (i.e. once a project has any discovery report, force
callers through the gated path):
```python
else:
    reports = [
        r for r in self._repo.get_project_reports(project_id)
        if r.get("status") in (None, "Aprovado para build")
    ]
```

## Warnings

### WR-01: PATCH /sessions/{session_id}/report has no mode/ownership check — can set a non-null status on a sales report

**File:** `backend/app/routers/sessions.py:349-364`
**Issue:** The route accepts any `session_id` and writes `status` unconditionally. Nothing stops a
caller from PATCHing the report of a `mode='sales'` session. `REP-03` guarantees "relatórios sales
têm status NULL... portanto o gate é no-op" — but that guarantee only holds while status stays
NULL. Once a sales report's `status` is set to anything (even accidentally, e.g. a stray frontend
call or a copy-pasted `session_id`), it stops being NULL and the `import_from_diagnosis` gate will
begin applying the "Aprovado para build" requirement to what is really a sales report, causing a
false-negative rejection later (denial of a legitimate sales import) that the current design says
should never happen. There is no server-side check that the target report belongs to a
`mode='discovery'` project before allowing the transition.
**Fix:** Look up the session's project `mode` (or check that the report row already has a non-null
status, i.e. it started life as discovery) before applying the update, and reject with 422/409 for
sales-mode sessions.

### WR-02: Regenerating a discovery report always resets status to 'Rascunho', silently reverting an approval

**File:** `backend/app/services/pipeline.py:471-476`, `backend/app/routers/sessions.py:507-516`
**Issue:** Both `_run_report_generator` (pipeline auto/report-button path) and
`upload_pdf_transcript` insert a brand-new `reports` row with `status='Rascunho'` every time a
discovery report is (re)generated, with no check for an existing `'Aprovado para build'` report on
the same session. If a pricer has already approved a report and started/finished a pricing import
that references `pricings.session_id`, a subsequent "Gerar relatório" click (e.g. after the
comercial keeps talking) silently creates a new draft, and the discovery→pricing handoff state
becomes inconsistent (features already imported from an "approved" version, while the session now
shows a fresh, unapproved draft with no link back to what was imported).
**Fix:** At minimum, surface this to the user (e.g. warn before regenerating an already-approved
report) or track the specific `report_id` that was actually approved/imported instead of always
reading "the latest report for this session".

### WR-03: No test exercises the PATCH /sessions/{session_id}/report route directly

**File:** `backend/tests/test_import_from_diagnosis_gate.py`, `backend/tests/test_discovery_report.py`
**Issue:** The two new phase-4 integration-style tests cover `LLMPricingService.import_from_diagnosis`
(the read-side gate) and `generate_report` (content assembly), but neither the router-level `PATCH`
handler nor the "session has 2+ reports" scenario is tested anywhere. This is exactly the scenario
that hides CR-01 — a single-report-per-session fixture (as used throughout `test_upload_pdf_mode.py`'s
`FakeSupabase`) can never surface the bug.
**Fix:** Add a router-level test (in the style of `test_upload_pdf_mode.py`'s `FakeSupabase`) that
seeds two `reports` rows for the same `session_id` with different `generated_at` values, PATCHes the
status, and asserts only the most recent row's status changed and was returned.

### WR-04: `questions_used` parameter type loosened from `list[str]` to bare `list`

**File:** `backend/app/services/llm.py:315-321`
**Issue:** `generate_report`'s `questions_used` type hint was widened from `list[str]` to `list`
to accommodate both the pipeline's new `list[dict]` shape (`{"text": ..., "lens": ...}`) and the
upload path's legacy `list[str]` shape. `list` (bare) type-checks nothing and documents nothing —
a reader has no static signal that two incompatible shapes are expected here, which is exactly
what `_lens_bucket`'s runtime `isinstance` dance has to defend against.
**Fix:** Use an explicit union, e.g. `questions_used: "list[str] | list[dict]"`, so the two
supported shapes are visible at the call site without reading `_lens_bucket`'s docstring.

## Info

### IN-01: `_dms_str()` produces a redundant phrase when DMS is unmapped

**File:** `backend/app/services/discovery_prompt_builder.py:70-73`
**Issue:** When `dms is None`, `self.dms_label` is set to the literal string `"Não mapeado"`
(line 54), and `_dms_str()` then renders `f"Não mapeado ({self.dms_label}): {self.dms_desc}"`,
producing the prompt text `"Não mapeado (Não mapeado): maturidade de dados ainda não avaliada..."`
— a duplicated "Não mapeado" that reads as a copy-paste artifact to anyone inspecting the generated
prompt (e.g. via `session_prompts` for debugging).
**Fix:** Drop the redundant label when `dms is None`, e.g. `return f"Não mapeado: {self.dms_desc}"`.

---

_Reviewed: 2026-09-23T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
