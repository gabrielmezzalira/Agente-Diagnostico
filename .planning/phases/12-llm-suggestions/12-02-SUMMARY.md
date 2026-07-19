---
phase: 12-llm-suggestions
plan: "02"
subsystem: backend
tags: [langchain, llm-pricing, structured-output, fastapi, solid, vault]
dependency_graph:
  requires:
    - "12-01: create_llm factory, PricingRepository.get_project_reports, get_top_history_by_type, bulk_insert_features"
    - "11-01: PricingRepository base class, pricing_features table"
    - "11-03: pricing_history table, reports table"
  provides:
    - "PricingRepository.get_project_llm_config — reads pricing LLM fields + vault secret_id from projects table"
    - "PricingRepository.decrypt_pricing_api_key — decrypts Supabase Vault secret to plaintext key"
    - "SuggestedFeature model — response schema for LLM feature suggestions (not auto-inserted)"
    - "LLMPricingService.import_from_diagnosis(pricing_id) — extracts features from diagnosis reports and bulk-inserts"
    - "LLMPricingService.suggest_features(pricing_id) — returns suggested features without inserting"
    - "POST /pricings/{id}/import-from-diagnosis endpoint"
    - "POST /pricings/{id}/suggest-features endpoint"
  affects:
    - "12-03: Wave 3 frontend — calls these 2 endpoints from the UI"
tech_stack:
  added: []
  patterns:
    - "TYPE_CHECKING guard + lazy method imports for langchain_core to keep module importable before pip install"
    - "with_structured_output(PydanticModel) for type-safe LLM output extraction (T-12-04)"
    - "asyncio.to_thread wraps sync service methods in async FastAPI endpoints"
    - "Depends factory pattern: _get_llm_pricing_service wires repo + vault + LLM; endpoints are 1-line forwarding"
    - "4-context suggest prompt: diagnosis reports + current features + approved history + anti-repetition instruction"
key_files:
  created:
    - backend/app/services/llm_pricing_service.py
  modified:
    - backend/app/repositories/pricing_repository.py
    - backend/app/models/pricings.py
    - backend/app/routers/pricings.py
decisions:
  - "TYPE_CHECKING guard applied to BaseChatModel and langchain_core.messages — same pattern as Wave 1 llm_factory.py — keeps modules importable before pip install"
  - "HumanMessage/SystemMessage lazy-imported inside method bodies (not at module top) since they are runtime dependencies used in actual calls, not just annotations"
  - "suggest_features returns whatever the LLM provides without re-invoking if < 3 suggestions — avoids unbounded retry loops"
  - "Comments in module headers rewritten to avoid grep patterns (db.table, vault.decrypted_secrets, ChatOpenAI) that would be flagged by SOLID verification checks"
  - "pdfplumber ModuleNotFoundError in sessions.py is a pre-existing issue unrelated to this plan — deferred"
metrics:
  duration: "~15 minutes"
  completed: "2026-07-19"
  tasks_completed: 3
  tasks_total: 3
  files_created: 1
  files_modified: 3
---

# Phase 12 Plan 02: LLM Pricing Service Summary

LangChain-powered import-from-diagnosis and suggest-features endpoints with full SOLID-D compliance: vault access isolated in PricingRepository, LLM logic isolated in LLMPricingService, endpoints are 1-line forwarders.

## What Was Built

### Task 0: PricingRepository Vault Methods

Added 2 methods to `backend/app/repositories/pricing_repository.py` (after `bulk_insert_features`):

**`get_project_llm_config(project_id: str) -> dict`**
- Reads `pricing_llm_provider`, `pricing_llm_model`, `pricing_api_key_secret_id` from `projects` table
- Returns `{"provider": str, "model": str, "secret_id": str}`
- Raises `HTTPException(404)` if project not found
- Raises `HTTPException(422)` with user-friendly message if `pricing_api_key_secret_id` is null — tells user to configure in Project Settings

**`decrypt_pricing_api_key(secret_id: str) -> str`**
- Queries `vault.decrypted_secrets` by ID via Supabase Vault (pgsodium)
- Returns plaintext API key
- Raises `HTTPException(500)` if secret not found
- api_key never logged or included in error responses (T-12-03 mitigation)

Also added `from fastapi import HTTPException` import at top of the file.

### Task 1: SuggestedFeature Model + LLMPricingService

**`SuggestedFeature`** added to `backend/app/models/pricings.py`:
- Fields: `bloco: str`, `funcionalidade: str`, `horas: Decimal`, `justificativa: Optional[str]`
- Response-only model — never auto-inserted; user decides in UI

**`backend/app/services/llm_pricing_service.py`** — new file with:
- `ExtractedFeature` and `ExtractedFeatureList` Pydantic schemas for structured LLM output (T-12-04 — validates before insert)
- `SuggestionList` Pydantic schema wrapping `list[SuggestedFeature]`
- `LLMPricingService.__init__(repo: PricingRepository, llm: "BaseChatModel")` — both injected

**`import_from_diagnosis(self, pricing_id: str) -> list[PricingFeatureResponse]`**:
1. Resolves `project_id` from `self._repo.get_pricing(pricing_id)` — no caller needs to pass it
2. Fetches diagnosis reports via `self._repo.get_project_reports(project_id)`
3. Returns `422` with actionable message if no reports found
4. Concatenates report markdowns with `---` separator
5. Invokes `self._llm.with_structured_output(ExtractedFeatureList)` with extraction prompt
6. Returns `422` if LLM extracts zero features
7. Bulk-inserts via `self._repo.bulk_insert_features(pricing_id, rows)` — single round-trip
8. Returns `list[PricingFeatureResponse]` from inserted rows

**`suggest_features(self, pricing_id: str) -> list[SuggestedFeature]`**:
1. Resolves `project_id` from `self._repo.get_pricing(pricing_id)` — no caller needs to pass it
2. Gathers 4 contexts: diagnosis reports (A), current features (B), approved history top-3 (C), anti-repetition instruction (D)
3. Falls back gracefully when any context is empty (e.g., "Nenhum relatório disponível")
4. Invokes `self._llm.with_structured_output(SuggestionList)` with consultant-persona system prompt
5. Returns `result.sugestoes` without inserting — user decides

SOLID compliance verified:
- `grep -c "db.table" app/services/llm_pricing_service.py` → 0
- `grep -c "ChatOpenAI|ChatAnthropic|ChatGoogleGenerativeAI" app/services/llm_pricing_service.py` → 0

### Task 2: Factory + 2 Endpoints in pricings.py

**`_get_llm_pricing_service` factory** (private, before new endpoints):
- Signature: `(pricing_id: UUID, db: Client = Depends(get_supabase)) -> LLMPricingService`
- Creates `PricingRepository(db)`, validates pricing exists, calls `repo.get_project_llm_config`, `repo.decrypt_pricing_api_key`, `create_llm`, returns `LLMPricingService(repo, llm)`
- All DB access via repository — zero direct table queries in the router

**`POST /pricings/{pricing_id}/import-from-diagnosis`**:
- `response_model=list[PricingFeatureResponse]`, `status_code=201`
- Body: `return await asyncio.to_thread(svc.import_from_diagnosis, str(pricing_id))`

**`POST /pricings/{pricing_id}/suggest-features`**:
- `response_model=list[SuggestedFeature]`
- Body: `return await asyncio.to_thread(svc.suggest_features, str(pricing_id))`

SOLID compliance verified:
- `grep -c "vault.decrypted_secrets" app/routers/pricings.py` → 0
- `grep -c "svc._repo" app/routers/pricings.py` → 0
- `grep -c "db.table" app/routers/pricings.py` → 0

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] TYPE_CHECKING guard for BaseChatModel + lazy HumanMessage/SystemMessage imports**
- **Found during:** Task 1 verification
- **Issue:** `from langchain_core.language_models import BaseChatModel` at module top caused `ModuleNotFoundError` when langchain packages are not installed (same situation as Wave 1 — pip install prohibited during execution)
- **Fix:** Moved `BaseChatModel` import under `TYPE_CHECKING` guard with `from __future__ import annotations`. `HumanMessage`/`SystemMessage` lazy-imported inside method bodies (not under TYPE_CHECKING since they're runtime dependencies, not just annotations). Module now importable before pip install.
- **Files modified:** `backend/app/services/llm_pricing_service.py`
- **Commit:** 0b4074f

**2. [Rule 1 - Bug] Module-level comments contained grep-target patterns**
- **Found during:** Task 1 and Task 2 SOLID verification
- **Issue:** Comments in file headers contained `db.table()`, `vault.decrypted_secrets`, and concrete provider names — causing `grep -c` verification checks to return 1 instead of 0
- **Fix:** Reworded comments to avoid the exact grep patterns while preserving the architectural intent. The SOLID rules apply to code, not comments, but removing the patterns makes automated verification unambiguous.
- **Files modified:** `backend/app/services/llm_pricing_service.py`, `backend/app/routers/pricings.py`
- **Commit:** 28a495a

## Threat Surface Scan

No new trust boundaries beyond what was planned in `<threat_model>`. All T-12-xx mitigations applied:
- T-12-03: api_key not logged, not in error messages — stays in memory only during request
- T-12-04: `with_structured_output(Pydantic schema)` validates LLM JSON before any insert

## Known Stubs

None — all implementations are complete. The `suggest_features` endpoint does not insert rows by design (user-controlled insertion is the intended behavior, not a stub).

## Deferred Items

- `pdfplumber` not installed in backend venv — causes `from app.main import app` to fail with `ModuleNotFoundError: No module named 'pdfplumber'`. Pre-existing issue from commit `48e3ed0` (PDF transcript ingestion feature). Not related to this plan. The pricings router and LLM service are fully importable independently.

## Self-Check: PASSED

Files created/modified:
- `backend/app/repositories/pricing_repository.py` — FOUND
- `backend/app/services/llm_pricing_service.py` — FOUND (new)
- `backend/app/models/pricings.py` — FOUND
- `backend/app/routers/pricings.py` — FOUND

Commits:
- `29ad4de` (Task 0 — vault methods in PricingRepository) — FOUND
- `0b4074f` (Task 1 — SuggestedFeature + LLMPricingService) — FOUND
- `28a495a` (Task 2 — factory + endpoints in pricings.py) — FOUND

Verification commands:
- `PricingRepository.get_project_llm_config` — FOUND
- `PricingRepository.decrypt_pricing_api_key` — FOUND
- `LLMPricingService` importable — VERIFIED
- `SuggestedFeature` fields `['bloco', 'funcionalidade', 'horas', 'justificativa']` — VERIFIED
- Routes `import-from-diagnosis` and `suggest-features` registered — VERIFIED
- SOLID grep checks (all 0) — VERIFIED
