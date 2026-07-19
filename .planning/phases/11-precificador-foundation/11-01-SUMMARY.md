# Plan 11-01 Summary — DB Schema + PricingCalculator + Projects Extension

**Phase:** 11-precificador-foundation
**Plan:** 01
**Status:** Complete

## What was built

### supabase/migrations/20260719000000_precificador_schema.sql
- ALTER TABLE projects: added `pricing_llm_provider TEXT`, `pricing_llm_model TEXT`, `pricing_api_key_secret_id UUID`
- CREATE TABLE pricings: id, project_id FK, status (draft/approved), start_date, num_analysts, hours_per_day, ticket_price, extra_calendar_days, created_at, updated_at + trigger trg_pricings_updated_at
- CREATE TABLE pricing_features: id, pricing_id FK, bloco, funcionalidade, horas, citi_responsible, ordem, created_at
- CREATE TABLE pricing_history: id, project_id FK, pricing_id FK, snapshot JSONB, approved_at
- CREATE TABLE pricing_chat_messages: id, pricing_id FK, role, content, tool_calls JSONB, created_at
- Indexes: idx_pricings_project_id, idx_pricing_features_pricing_id, idx_pricing_history_project_id, idx_pricing_chat_messages_pricing_id

### backend/app/core/__init__.py
Empty package marker (new directory created).

### backend/app/core/pricing_calculator.py
- `PricingInputs` frozen dataclass
- `PricingOutputs` Pydantic model
- `PricingCalculator` class with:
  - `calculate(features, inputs) -> PricingOutputs` — all 8 output fields
  - `feature_dias(horas, num_analysts, hours_per_day) -> Decimal` — per-feature day calc
- Zero-safe (avoids ZeroDivisionError when daily_capacity == 0)
- Verified: `calculate([{'horas': 30}], PricingInputs(2 analysts, 3h/day, 10000 BRL, 2026-01-01))` → dias_uteis=5.0, dias_corridos=7.0, preco_total=2333.33

### backend/app/models/projects.py
- Added to `ProjectCreate`: `pricing_llm_provider`, `pricing_llm_model`, `pricing_api_key` (all Optional)
- Added to `ProjectUpdate`: same 3 fields
- Added to `ProjectResponse`: `pricing_llm_provider`, `pricing_llm_model`, `has_pricing_api_key: bool`

### backend/app/routers/projects.py
- `_VAULT_EXCLUDED` extended to include `"pricing_api_key_secret_id"`
- `_to_response` adds `"has_pricing_api_key": bool(row.get("pricing_api_key_secret_id"))`
- `create_project`: stores `pricing_api_key` in Vault when present
- `update_project`: rotates `pricing_api_key` vault secret when updated; selects `pricing_api_key_secret_id` in existing query
- `delete_project`: deletes `pricing_api_key` vault secret on deletion

## Checkpoint
Migration applied to Supabase (confirmed by user — all 4 tables + 3 project columns exist).

## Key decisions
- LangChain packages and `llm_factory.py` deferred to Phase 12 (not touched in this plan)
- requirements.txt unchanged
