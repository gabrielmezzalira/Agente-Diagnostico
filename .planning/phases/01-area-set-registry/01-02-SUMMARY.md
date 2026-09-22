---
phase: 01-area-set-registry
plan: 02
subsystem: backend
tags: [refactor, registry, coverage-areas, llm-prompt, prompt-builder, tdd]

# Dependency graph
requires:
  - phase: 01-area-set-registry (plan 01)
    provides: "backend/app/services/coverage_areas.py — SALES_AREA_SET registry + AREAS_BY_PROJECT_TYPE (relocated copy) + golden test scaffold"
provides:
  - "llm.py fully registry-sourced for areas (generate_report labels, generate_questions block enum, classify_coverage schema from plan 01)"
  - "prompt_builder.py fully registry-sourced for areas (AREAS_BY_PROJECT_TYPE imported not defined, build_coverage_classifier schema with include_not_applicable=True, build_question_planner block enum)"
  - "AREAS_BY_PROJECT_TYPE now defined in exactly one file: coverage_areas.py (D-02 complete)"
affects: [01-area-set-registry (plan 03), 02-discovery-area-set]

# Actuals (#2632)
actuals:
  tokens: 2034
  tasks: 2
  commits: 2

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Registry consumer rewiring: replace hand-written literal with a call to the frozen AreaSet's derived-view method, verified byte-identical by golden test before AND after each call-site change"
    - "include_not_applicable toggle made explicit at each of the two schema call sites (False for llm.classify_coverage's fallback, True for prompt_builder.build_coverage_classifier) rather than collapsed into one shared literal"

key-files:
  created: []
  modified:
    - backend/app/services/llm.py
    - backend/app/services/prompt_builder.py
    - backend/tests/test_coverage_areas_golden.py

key-decisions:
  - "AREAS_BY_PROJECT_TYPE import re-exports the name at prompt_builder.py's top level (`from app.services.coverage_areas import AREAS_BY_PROJECT_TYPE, SALES_AREA_SET`) specifically so session_state.py's existing `from app.services.prompt_builder import AREAS_BY_PROJECT_TYPE` keeps resolving without modification — plan 03 is the one that repoints session_state's import directly to the registry"
  - "test_build_coverage_classifier_golden added even though its assertion is a subset of the pre-existing test_prompt_builder_golden_snapshot (plan 01) — kept both per the plan's explicit task instruction; no harm in the overlap, and it names the specific Task 2 regression directly"
  - "_area_hint()'s body (critical/optional/inactive iteration) was left completely untouched — only its data source changed from a local dict to an imported one, per the plan's explicit scope boundary"

requirements-completed: [DISC-04]

coverage:
  - id: D1
    description: "llm.py generate_report sources area_labels from SALES_AREA_SET.labels(); generate_questions interpolates SALES_AREA_SET.block_enum() into its fallback JSON-shape prompt — both byte-identical to pre-refactor"
    requirement: DISC-04
    verification:
      - kind: unit
        ref: "backend/tests/test_coverage_areas_golden.py#test_generate_report_area_labels_unchanged"
        status: pass
      - kind: unit
        ref: "backend/tests/test_coverage_areas_golden.py#test_generate_questions_block_enum_unchanged"
        status: pass
    human_judgment: false
  - id: D2
    description: "prompt_builder.py no longer defines AREAS_BY_PROJECT_TYPE locally (imports from registry, D-02 complete); build_coverage_classifier uses schema_json(include_not_applicable=True); build_question_planner uses block_enum() — both byte-identical to pre-refactor"
    requirement: DISC-04
    verification:
      - kind: unit
        ref: "backend/tests/test_coverage_areas_golden.py#test_build_coverage_classifier_golden"
        status: pass
      - kind: unit
        ref: "backend/tests/test_coverage_areas_golden.py#test_prompt_builder_golden_snapshot"
        status: pass
      - kind: unit
        ref: "backend/tests/test_coverage_areas_golden.py#test_areas_by_project_type_keys_are_valid"
        status: pass
    human_judgment: false
  - id: D3
    description: "session_state.py's existing import of AREAS_BY_PROJECT_TYPE from prompt_builder still resolves after the relocation (re-export chain intact); no circular import introduced across coverage_areas/llm/prompt_builder/session_state"
    requirement: DISC-04
    verification:
      - kind: other
        ref: "python -c \"import app.services.session_state as s; print('OK', len(s.AREAS_BY_PROJECT_TYPE))\" -> OK 6"
        status: pass
      - kind: other
        ref: "python -c \"import app.services.session_state, app.services.prompt_builder, app.services.llm, app.services.coverage_areas\" exits 0"
        status: pass
    human_judgment: false

# Metrics
duration: 8min
completed: 2026-09-20
status: complete
---

# Phase 1 Plan 2: Rewire llm.py and prompt_builder.py to the Area-Set Registry Summary

**`llm.py` and `prompt_builder.py` fully registry-sourced for coverage areas — `AREAS_BY_PROJECT_TYPE` now lives in exactly one file (`coverage_areas.py`), and the `include_not_applicable` toggle distinction (`False` for `classify_coverage`, `True` for `build_coverage_classifier`) is proven byte-identical by 12 golden tests.**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-09-20T17:52:00Z (approx, immediately following plan 01-01)
- **Completed:** 2026-09-20T17:59:44Z
- **Tasks:** 2
- **Files modified:** 3 (`llm.py`, `prompt_builder.py`, `test_coverage_areas_golden.py`)

## Accomplishments
- `llm.py`'s `generate_report` now builds its coverage-table labels from `SALES_AREA_SET.labels()` instead of an inline dict; `generate_questions`' fallback prompt interpolates `SALES_AREA_SET.block_enum()` — both proven byte-identical to the pre-refactor literals
- `prompt_builder.py`'s module-level `AREAS_BY_PROJECT_TYPE` dict removed entirely; now imported from `coverage_areas.py` (D-02 complete — the dict lives in exactly one file)
- `build_coverage_classifier()` rewired to `SALES_AREA_SET.schema_json(include_not_applicable=True)` — the critical `True` toggle distinguishing it from `llm.classify_coverage`'s `False` toggle (Pitfall 1) — and `build_question_planner()` rewired to `SALES_AREA_SET.block_enum()`
- Extended the golden test suite from 9 to 12 tests; full backend regression (excluding the 2 Supabase-dependent tests) grew from 21 to 24 passing tests, all green

## Task Commits

Each task was committed atomically:

1. **Task 1: Rewire remaining llm.py sites — generate_report labels + generate_questions block enum** - `e36e5b8` (feat)
2. **Task 2: Rewire prompt_builder.py — relocate AREAS_BY_PROJECT_TYPE (D-02), schema (not_applicable=True), block enum** - `2300247` (refactor)

**Plan metadata:** (this commit, docs)

_TDD note: Both tasks are `tdd="true"`, but per the plan's own explicit instruction (extending the existing golden test to prove byte-identity, not writing net-new failing tests for net-new behavior) and `workflow.tdd_mode` being OFF, each task's golden-test extension + implementation change was verified green immediately and committed as a single atomic commit per task (matching the plan's "Commit 1" / "Commit 2" framing in its own 7-section change plan), rather than split into separate RED/GREEN commits. This mirrors the precedent set in plan 01-01's Task 2 for the same reason: the assertions being added prove non-regression of existing behavior, not a genuinely new failing-then-passing behavior cycle._

## Files Created/Modified
- `backend/app/services/llm.py` - `generate_report` sources `area_labels` from `SALES_AREA_SET.labels()`; `generate_questions` interpolates `SALES_AREA_SET.block_enum()`
- `backend/app/services/prompt_builder.py` - `AREAS_BY_PROJECT_TYPE` import replaces local definition; `build_coverage_classifier` and `build_question_planner` read schema/enum from the registry
- `backend/tests/test_coverage_areas_golden.py` - 3 new tests: `test_generate_report_area_labels_unchanged`, `test_generate_questions_block_enum_unchanged`, `test_build_coverage_classifier_golden`

## Decisions Made
- Re-export `AREAS_BY_PROJECT_TYPE` through `prompt_builder.py`'s top-level import (rather than repointing `session_state.py` directly) to keep this plan's diff scoped to its two named files — `session_state.py`'s own import statement is plan 03's job
- Kept `test_build_coverage_classifier_golden` alongside the functionally-overlapping `test_prompt_builder_golden_snapshot` (from plan 01) since the plan explicitly named it as a Task 2 deliverable — redundant coverage of the same invariant, not conflicting

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None. The full regression suite (`pytest --ignore=tests/test_projects.py --ignore=tests/test_schema.py`) is green at 24 passed; the pre-existing Supabase-connectivity gap in the two ignored files (documented in 01-01-SUMMARY.md) is unchanged and out of this plan's scope.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- `llm.py` and `prompt_builder.py` are both fully registry-sourced for areas (2 of the 3 named consumers from the roadmap's Success Criterion #3). `session_state.py` still holds its own `COVERAGE_AREAS` list and its `from app.services.prompt_builder import AREAS_BY_PROJECT_TYPE` import — both are plan 03's explicit scope (repoint the import directly to `coverage_areas.py`, replace `COVERAGE_AREAS` with `SALES_AREA_SET.keys()`).
- `structured_context.py`'s duplicate block-enum literal (Open Question 1 in RESEARCH.md) remains unaddressed — still open scope for plan 03 or later, per RESEARCH.md's recommendation to explicitly log rather than silently skip.
- No blockers.

## Self-Check: PASSED
- `backend/app/services/llm.py` — FOUND, contains `SALES_AREA_SET.labels()` and `SALES_AREA_SET.block_enum()`
- `backend/app/services/prompt_builder.py` — FOUND, no `AREAS_BY_PROJECT_TYPE: dict...=` definition remains; imports it from `app.services.coverage_areas`
- `backend/tests/test_coverage_areas_golden.py` — FOUND, 12 tests
- Commit `e36e5b8` — FOUND in git log
- Commit `2300247` — FOUND in git log
- `cd backend && python -m pytest tests/test_coverage_areas_golden.py -q` — 12 passed
- Import sanity (`coverage_areas`, `llm`, `session_state`, `prompt_builder`) — OK, no circular import
- `python -c "import app.services.session_state as s; print(len(s.AREAS_BY_PROJECT_TYPE))"` — OK 6
- `cd backend && python -m pytest --ignore=tests/test_projects.py --ignore=tests/test_schema.py -q` — 24 passed

---
*Phase: 01-area-set-registry*
*Completed: 2026-09-20*
