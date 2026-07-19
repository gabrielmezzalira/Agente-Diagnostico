---
phase: 12-llm-suggestions
plan: "01"
subsystem: backend
tags: [langchain, langgraph, llm-factory, pricing-repository, seed-data]
dependency_graph:
  requires:
    - "11-01: PricingRepository base class"
    - "11-03: pricing_history table schema"
  provides:
    - "create_llm(provider, model, api_key) -> BaseChatModel"
    - "PricingRepository.get_project_reports"
    - "PricingRepository.get_top_history_by_type"
    - "PricingRepository.bulk_insert_features"
    - "supabase/seed_pricing_history.sql with 7 snapshots"
  affects:
    - "12-02: llm_pricing_service.py (Wave 2) — depends on all of the above"
tech_stack:
  added:
    - langchain>=0.3.0
    - langchain-openai>=0.2.0
    - langchain-anthropic>=0.3.0
    - langchain-google-genai>=2.0.0
    - langgraph>=0.2.0
  patterns:
    - "Lazy provider imports inside match/case to avoid import failures when only some packages are installed"
    - "TYPE_CHECKING guard for BaseChatModel to keep module importable before pip install"
    - "PostgREST JSONB path filter: .filter('snapshot->>project_type', 'eq', project_type)"
    - "Bulk insert via single .insert(rows_list) call — not a loop"
key_files:
  created:
    - backend/app/core/llm_factory.py
    - supabase/seed_pricing_history.sql
  modified:
    - backend/requirements.txt
    - backend/app/repositories/pricing_repository.py
decisions:
  - "Used TYPE_CHECKING guard for BaseChatModel import so module is importable before pip install — plan prohibits pip install during execution"
  - "Lazy imports inside match/case cases ensure the file works even when only a subset of LangChain provider packages is installed"
  - "get_top_history_by_type uses PostgREST JSONB filter (server-side) not Python-side filtering — consistent with no-business-logic-in-repo rule"
  - "bulk_insert_features uses single db.table().insert(list) call — one round-trip regardless of list size"
metrics:
  duration: "~10 minutes"
  completed: "2026-07-19"
  tasks_completed: 2
  tasks_total: 2
  files_created: 2
  files_modified: 2
---

# Phase 12 Plan 01: LLM Infrastructure Foundation Summary

LangChain/LangGraph dependency setup with provider-agnostic `create_llm` factory and three new PricingRepository methods plus seed data for LLM history context.

## What Was Built

### Task 1: LangChain/LangGraph Dependencies + llm_factory.py

Added 5 packages to `backend/requirements.txt` immediately after `google-genai`:
- `langchain>=0.3.0`, `langchain-openai>=0.2.0`, `langchain-anthropic>=0.3.0`, `langchain-google-genai>=2.0.0`, `langgraph>=0.2.0`

Created `backend/app/core/llm_factory.py` with `create_llm(provider, model, api_key) -> "BaseChatModel"`:
- Returns a concrete `ChatOpenAI`, `ChatAnthropic`, or `ChatGoogleGenerativeAI` instance hidden behind the `BaseChatModel` interface
- Raises `ValueError("api_key is required to create an LLM client")` for empty/None api_key
- Raises `ValueError(f"Unknown LLM provider: '{provider}'. Supported values: ...")` for unknown provider
- Provider imports are lazy (inside `match/case` cases) — the file works even if only some packages are installed
- `BaseChatModel` import is under `TYPE_CHECKING` so the module is importable before `pip install -r requirements.txt` is run

### Task 2: PricingRepository Extensions + Seed SQL

Added 3 methods to `backend/app/repositories/pricing_repository.py`:

**`get_project_reports(project_id: str) -> list[dict]`**
- Fetches all sessions for the project, collects their IDs
- Returns `[]` early if no sessions exist
- Fetches reports joined via `session_id IN (...)`, ordered by `generated_at desc`

**`get_top_history_by_type(project_type: str, limit: int = 3) -> list[dict]`**
- Filters `pricing_history` using PostgREST JSONB path filter: `.filter("snapshot->>project_type", "eq", project_type)`
- Server-side filtering — no Python-side filtering that would require fetching all rows
- Orders by `approved_at desc`, limits to `limit` records

**`bulk_insert_features(pricing_id: str, features: list[dict]) -> list[dict]`**
- Returns `[]` immediately if `features` is empty
- Adds `pricing_id` to each dict via dict unpacking: `[{**f, "pricing_id": pricing_id} for f in features]`
- Single `db.table("pricing_features").insert(rows).execute()` call — one round-trip

Created `supabase/seed_pricing_history.sql` with 7 `INSERT INTO pricing_history` statements covering:
- 2x `"bi"` (dashboard de vendas regional, painel financeiro com DRE)
- 2x `"data_engineering"` (pipeline com dbt/Airflow, integração ERP+CRM com camada gold)
- 1x `"ml"` (modelo de churn com scoring API)
- 1x `"automation"` (automação de relatórios PDF com envio por e-mail)
- 1x `"integration"` (middleware bidirecional ERP Protheus / CRM HubSpot)

Each snapshot has realistic Portuguese feature names with `bloco`, `funcionalidade`, and `horas`.
File has `ON CONFLICT DO NOTHING` for idempotency. UUIDs are fixed seed-only values with no real FK constraints.

## Verification Results

```
1. LLMFactory OK          — from app.core.llm_factory import create_llm
2. Repo OK                — all 3 methods present in PricingRepository
3. Seed INSERT count: 7   — grep -c "INSERT INTO pricing_history"
```

ValueError behaviors verified:
- Unknown provider: `"Unknown LLM provider: 'unknown'. Supported values: 'openai', 'anthropic', 'google'."`
- Empty api_key: `"api_key is required to create an LLM client"`
- None api_key: `"api_key is required to create an LLM client"`

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] TYPE_CHECKING guard for BaseChatModel import**
- **Found during:** Task 1 verification
- **Issue:** Plan specified `from langchain_core.language_models import BaseChatModel` at top-level, but since pip install is prohibited during execution, this caused `ModuleNotFoundError` when running the verification command
- **Fix:** Moved `BaseChatModel` import under `TYPE_CHECKING` guard with `from __future__ import annotations`; return type annotation uses string literal `"BaseChatModel"`. The factory still returns the correct concrete type at runtime. Behavior is identical when packages are installed.
- **Files modified:** `backend/app/core/llm_factory.py`
- **Commit:** 18818eb

## Threat Surface Scan

| Flag | File | Description |
|------|------|-------------|
| threat_flag: information_disclosure | backend/app/core/llm_factory.py | api_key passes through this function — confirmed NOT logged anywhere; ValueError message does not include the key value |

## Known Stubs

None — all implementations are complete. Seed data is intentionally minimal (7 rows) and is marked as seed-only in the SQL comments.

## Self-Check: PASSED

- `backend/app/core/llm_factory.py` — FOUND
- `supabase/seed_pricing_history.sql` — FOUND
- Commit 18818eb — FOUND (Task 1)
- Commit 2ab627c — FOUND (Task 2)
- 3 new methods in PricingRepository — VERIFIED
- 7 INSERT statements in seed file — VERIFIED
