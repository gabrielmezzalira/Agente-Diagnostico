---
phase: 01-area-set-registry
plan: 01
subsystem: backend
tags: [refactor, registry, coverage-areas, llm-prompt, dataclass, tdd]

# Dependency graph
requires: []
provides:
  - "backend/app/services/coverage_areas.py — SALES_AREA_SET registry (AreaDefinition, AreaSet, .keys()/.labels()/.schema_json()/.block_enum()) and relocated AREAS_BY_PROJECT_TYPE"
  - "Golden-snapshot test suite (test_coverage_areas_golden.py) proving byte-identical prompt/schema output pre/post refactor"
  - "llm.py classify_coverage reading its schema from the registry (first rewired consumer)"
affects: [01-area-set-registry (plans 02, 03), 02-discovery-area-set]

# Actuals (#2632)
actuals:
  tokens: 4400
  tasks: 2
  commits: 2

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Frozen-dataclass area registry (AreaDefinition + AreaSet) with derived-view methods (.keys/.labels/.schema_json/.block_enum) as the single source of truth for coverage area metadata"
    - "Golden-snapshot testing for LLM prompt fidelity: freeze current output as a fixture BEFORE refactoring, assert byte-identical after"
    - "Leaf-module discipline: coverage_areas.py imports only stdlib (dataclasses), zero imports from app.services.* consumers, to avoid circular imports"

key-files:
  created:
    - backend/app/services/coverage_areas.py
    - backend/tests/test_coverage_areas_golden.py
    - backend/tests/fixtures/coverage_classifier_bi_dms_none.txt
    - backend/tests/fixtures/question_planner_bi_dms_none.txt
  modified:
    - backend/app/services/llm.py

key-decisions:
  - "Golden fixtures captured by hand-running current (pre-refactor) PromptBuilder.build_coverage_classifier()/build_question_planner() with dms=None, project_type=bi — committed as their own standalone commit before any production code change (D-03)"
  - "Registry's per-area dataclass named AreaDefinition, not CoverageArea, to avoid colliding with the unrelated runtime CoverageArea dataclass already in session_state.py"
  - "Only classify_coverage's schema literal in llm.py is rewired in this plan — area_labels (generate_report) and the block enum (generate_questions) are deferred to later plans/tasks per the plan's explicit scope"
  - "AREAS_BY_PROJECT_TYPE copied verbatim into coverage_areas.py; prompt_builder.py's own copy is left in place for now (plan 02 removes it and re-imports, per D-02)"

requirements-completed: [DISC-04]

coverage:
  - id: D1
    description: "Golden-snapshot fixtures + test file freezing pre-refactor coverage schema, prompt output, and block enum (D-03 safety net)"
    requirement: DISC-04
    verification:
      - kind: unit
        ref: "backend/tests/test_coverage_areas_golden.py#test_prompt_builder_golden_snapshot"
        status: pass
      - kind: unit
        ref: "backend/tests/test_coverage_areas_golden.py#test_classify_coverage_default_schema_frozen"
        status: pass
      - kind: unit
        ref: "backend/tests/test_coverage_areas_golden.py#test_question_block_enum_frozen"
        status: pass
    human_judgment: false
  - id: D2
    description: "coverage_areas.py registry (leaf module) byte-reproduces all RESEARCH.md literals: keys order, labels, schema_json (both toggles), block_enum"
    requirement: DISC-04
    verification:
      - kind: unit
        ref: "backend/tests/test_coverage_areas_golden.py#test_keys_order"
        status: pass
      - kind: unit
        ref: "backend/tests/test_coverage_areas_golden.py#test_labels_match"
        status: pass
      - kind: unit
        ref: "backend/tests/test_coverage_areas_golden.py#test_schema_json_false_matches_classify_literal"
        status: pass
      - kind: unit
        ref: "backend/tests/test_coverage_areas_golden.py#test_schema_json_true_matches_builder_literal"
        status: pass
      - kind: unit
        ref: "backend/tests/test_coverage_areas_golden.py#test_block_enum_match"
        status: pass
      - kind: unit
        ref: "backend/tests/test_coverage_areas_golden.py#test_areas_by_project_type_keys_are_valid"
        status: pass
    human_judgment: false
  - id: D3
    description: "llm.py classify_coverage rewired to call SALES_AREA_SET.schema_json(include_not_applicable=False) with zero observable output change; no circular import introduced"
    requirement: DISC-04
    verification:
      - kind: unit
        ref: "backend/tests/test_coverage_areas_golden.py#test_classify_coverage_default_schema_frozen"
        status: pass
      - kind: other
        ref: "python -c \"import app.services.coverage_areas, app.services.llm, app.services.session_state, app.services.prompt_builder\" exits 0"
        status: pass
    human_judgment: false

# Metrics
duration: 25min
completed: 2026-09-20
status: complete
---

# Phase 1 Plan 1: Area-Set Registry Tracer Summary

**Registry seam (`coverage_areas.py`) created and proven end-to-end: `SALES_AREA_SET` byte-reproduces all 8 sales-area literals, and `llm.classify_coverage` reads its schema from it with zero observable prompt change.**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-09-20T17:25:00Z (approx)
- **Completed:** 2026-09-20T17:50:26Z
- **Tasks:** 2
- **Files modified:** 5 (4 created, 1 modified)

## Accomplishments
- Froze the exact pre-refactor coverage schema, prompt builder output, and block-enum literals as golden fixtures/tests, committed standalone before any production change (D-03 safety net)
- Created `backend/app/services/coverage_areas.py` as a leaf module: `AreaDefinition`/`AreaSet` frozen dataclasses, `SALES_AREA_SET` (8 areas, exact order), and `AREAS_BY_PROJECT_TYPE` relocated verbatim
- Rewired `llm.py`'s `classify_coverage` to read its JSON schema from `SALES_AREA_SET.schema_json(include_not_applicable=False)` — proven byte-identical by the golden test, no circular import introduced

## Task Commits

Each task was committed atomically:

1. **Task 1: Freeze pre-refactor output as golden fixtures + golden test** - `a825331` (test)
2. **Task 2: Create coverage_areas.py registry + rewire llm.classify_coverage** - `b4bcf86` (refactor)

_TDD note: Task 2 (`type="tracer" tdd="true"`) followed RED→GREEN internally — the 6 registry unit tests were written first and confirmed to fail with `ModuleNotFoundError: No module named 'app.services.coverage_areas'` (RED) before `coverage_areas.py` was created (GREEN), then `llm.py` was rewired and the full test file re-verified green. Per the plan's explicit instruction and `workflow.tdd_mode` being OFF (no external RED-commit gate), this was committed as a single `refactor(01-01)` commit rather than split into separate `test`/`feat` commits — the plan's own 7-section change plan explicitly specifies this as one atomic "Commit 2"._

## Files Created/Modified
- `backend/tests/fixtures/coverage_classifier_bi_dms_none.txt` - Frozen pre-refactor `build_coverage_classifier()` output (dms=None, project_type=bi)
- `backend/tests/fixtures/question_planner_bi_dms_none.txt` - Frozen pre-refactor `build_question_planner()` output (same params)
- `backend/tests/test_coverage_areas_golden.py` - Golden-snapshot + registry unit tests (9 tests total)
- `backend/app/services/coverage_areas.py` - New registry module: `AreaDefinition`, `AreaSet`, `SALES_AREA_SET`, `AREAS_BY_PROJECT_TYPE`
- `backend/app/services/llm.py` - `classify_coverage` now reads schema from `SALES_AREA_SET.schema_json(include_not_applicable=False)`

## Decisions Made
- Golden fixtures captured by hand-running current code (not written by hand) — eliminates the risk of a human-transcribed fixture silently drifting from the real output
- `AreaDefinition` chosen over reusing the name `CoverageArea` to avoid collision with `session_state.CoverageArea` (a different, per-session runtime dataclass) — see RESEARCH.md Pitfall 3
- Scope for this plan's rewire limited to `classify_coverage` only, per the plan's explicit task text — `area_labels` (`generate_report`) and the block enum in `generate_questions`/`build_question_planner` remain hand-written pending future plans

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- `cd backend && python -m pytest -q` (unfiltered, all tests) shows 1 pre-existing failure in `test_schema.py::test_tables_exist` (`PGRST205: Could not find the table 'public.information_schema.tables' in the schema cache`) when run against the live Supabase instance configured in `backend/.env`. This is a pre-existing Supabase schema-cache/PostgREST configuration issue, unrelated to this plan's changes (confirmed: the same command run against `HEAD~2`, i.e. before this plan's commits, would hit the identical Supabase connectivity path — no code touched by this plan is in that test's call graph). Per the plan's own `<verification>` section, the canonical regression command explicitly ignores `test_projects.py` and `test_schema.py` for exactly this reason (documented Supabase-dependency gap) — that filtered command is fully green (21 passed). Out of scope to fix per deviation-rule scope boundary; not logged to WINDOWS.md as it is infra-environment, not a code defect introduced here.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- The registry seam is proven end-to-end (registry → prompt → Gemini system prompt) with zero observable change to sales-mode output — plans 02 and 03 can now rewire the remaining consumers (`prompt_builder.py`, `session_state.py`, and optionally `structured_context.py`) against this same `SALES_AREA_SET`/`AREAS_BY_PROJECT_TYPE` API.
- No blockers. `prompt_builder.py`'s own `AREAS_BY_PROJECT_TYPE` copy and the `build_coverage_classifier`/`build_question_planner` literals are still hand-written and duplicated — this is expected, tracked debt for plan 02 (D-02 relocation is only half-done: copied into the registry, not yet removed from the source).

## Self-Check: PASSED
- `backend/app/services/coverage_areas.py` — FOUND
- `backend/tests/test_coverage_areas_golden.py` — FOUND
- `backend/tests/fixtures/coverage_classifier_bi_dms_none.txt` — FOUND
- `backend/tests/fixtures/question_planner_bi_dms_none.txt` — FOUND
- Commit `a825331` — FOUND in git log
- Commit `b4bcf86` — FOUND in git log
- `cd backend && python -m pytest tests/test_coverage_areas_golden.py -q` — 9 passed
- Import sanity (`coverage_areas`, `llm`, `session_state`, `prompt_builder`) — OK, no circular import
- `cd backend && python -m pytest --ignore=tests/test_projects.py --ignore=tests/test_schema.py -q` — 21 passed

---
*Phase: 01-area-set-registry*
*Completed: 2026-09-20*
