---
phase: 01-area-set-registry
plan: 03
subsystem: backend
tags: [refactor, registry, coverage-areas, session-state, prompt, tdd]

# Dependency graph
requires:
  - phase: 01-area-set-registry (plan 01)
    provides: "backend/app/services/coverage_areas.py — SALES_AREA_SET registry + AREAS_BY_PROJECT_TYPE"
  - phase: 01-area-set-registry (plan 02)
    provides: "llm.py and prompt_builder.py fully registry-sourced for areas"
provides:
  - "session_state.py fully registry-sourced (_init_coverage first loop reads SALES_AREA_SET.keys(); custom_areas overlay loop D-04 byte-unchanged)"
  - "structured_context.py fully registry-sourced (_EXTRACTOR_SYSTEM block-enum line built via SALES_AREA_SET.keys(), concatenation not f-string)"
  - "Repo-wide grep proof: the 8-key area literal and the coverage status enum exist in exactly one file (coverage_areas.py) — DISC-04 Success Criterion #2 met"
affects: [02-discovery-area-set]

# Actuals (#2632)
actuals:
  tokens: 1870
  tasks: 2
  commits: 2

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "String-concatenation splice (static prefix + dynamic join + static suffix) as the safe way to interpolate a registry-derived value into a triple-quoted constant that also contains literal JSON braces — avoids the f-string-escaping trap"

key-files:
  created:
    - backend/tests/test_session_state_custom_areas.py
  modified:
    - backend/app/services/session_state.py
    - backend/app/services/structured_context.py
    - backend/tests/test_coverage_areas_golden.py

key-decisions:
  - "session_state.py's import of AREAS_BY_PROJECT_TYPE re-pointed directly at coverage_areas (no longer re-exported through prompt_builder) — this was the deferred half of plan 02's D-02 relocation, completed here per plan 02's Next Phase Readiness note"
  - "structured_context.py's _EXTRACTOR_SYSTEM split into _EXTRACTOR_SYSTEM_PREFIX/_SUFFIX static halves plus a dynamically-built middle line, rather than converting to an f-string, to avoid escaping the literal JSON example braces (RESEARCH.md Open Question 1 recommendation, adopted as-is)"
  - "pipeline.py's block=q_data.get('block', 'negocio') default (RESEARCH.md/PATTERNS.md 'touch only if planner decides') left untouched — registered as an explicit out-of-scope decision in the plan's own 7-section change document, not a silent omission"

requirements-completed: [DISC-04]

coverage:
  - id: D1
    description: "session_state._init_coverage sources its standard 8 keys from SALES_AREA_SET.keys() (first loop); the custom_areas overlay loop (D-04) is byte-unchanged, proven by a dedicated regression test covering standard init, custom merge, same-key overwrite, and empty/None input"
    requirement: DISC-04
    verification:
      - kind: unit
        ref: "backend/tests/test_session_state_custom_areas.py#test_init_coverage_standard_set_bi"
        status: pass
      - kind: unit
        ref: "backend/tests/test_session_state_custom_areas.py#test_init_coverage_merges_custom_area"
        status: pass
      - kind: unit
        ref: "backend/tests/test_session_state_custom_areas.py#test_init_coverage_custom_area_overwrites_standard_key"
        status: pass
      - kind: unit
        ref: "backend/tests/test_session_state_custom_areas.py#test_init_coverage_empty_or_none_custom_areas_are_equivalent"
        status: pass
      - kind: other
        ref: "grep -q 'for area in custom_areas or \\[\\]:' app/services/session_state.py (plan verify gate)"
        status: pass
    human_judgment: false
  - id: D2
    description: "structured_context._EXTRACTOR_SYSTEM's block-enum line is built via \" | \".join(SALES_AREA_SET.keys()) through string concatenation (not an f-string); the literal JSON braces elsewhere in the constant are unchanged; byte-identical to the pre-refactor literal"
    requirement: DISC-04
    verification:
      - kind: unit
        ref: "backend/tests/test_coverage_areas_golden.py#test_structured_context_block_line_unchanged"
        status: pass
    human_judgment: false
  - id: D3
    description: "Repo-wide grep proves the joined 8-key area literal and the coverage schema status enum exist in exactly one file (coverage_areas.py) under backend/app — DISC-04 single source of truth complete for all four backend consumers (llm, prompt_builder, session_state, structured_context)"
    requirement: DISC-04
    verification:
      - kind: other
        ref: "grep -rn 'negocio|eng_dados|visualizacao' backend/app --include=*.py (empty)"
        status: pass
      - kind: other
        ref: "grep -rln 'covered|partial|uncovered' backend/app/services --include=*.py (only coverage_areas.py)"
        status: pass
      - kind: other
        ref: "python -c \"import app.services.llm, app.services.prompt_builder, app.services.session_state, app.services.structured_context, app.services.coverage_areas\" exits 0"
        status: pass
    human_judgment: false

# Metrics
duration: 9min
completed: 2026-09-20
status: complete
---

# Phase 1 Plan 3: Rewire session_state.py and structured_context.py to the Area-Set Registry Summary

**The last two backend consumers of the 8 hardcoded sales areas — `session_state._init_coverage` and `structured_context._EXTRACTOR_SYSTEM`'s block enum — now read from `coverage_areas.py`, and a repo-wide grep proves the area list and coverage-status enum exist in exactly one file, closing DISC-04 for the backend.**

## Performance

- **Duration:** ~9 min
- **Started:** 2026-09-20T17:59:44Z (approx, immediately following plan 01-02)
- **Completed:** 2026-09-20T18:08:44Z
- **Tasks:** 2
- **Files modified:** 4 (1 created, 3 modified)

## Accomplishments
- `session_state.py`'s module-level `COVERAGE_AREAS` list removed; `_init_coverage`'s first loop now iterates `SALES_AREA_SET.keys()`; the import of `AREAS_BY_PROJECT_TYPE` re-pointed directly at `coverage_areas` (no longer via `prompt_builder`'s re-export)
- The dormant `custom_areas` overlay loop (D-04) proven byte-unchanged both by direct grep of the exact source lines and by a new 4-test regression file covering standard init, custom merge, same-key overwrite, and empty/None input
- `structured_context.py`'s `_EXTRACTOR_SYSTEM` block-enum line rewired to `" | ".join(SALES_AREA_SET.keys())` via string concatenation (NOT an f-string, preserving the constant's literal JSON example braces unescaped) — the 4th backend duplicate of the 8-key list, identified in RESEARCH.md Open Question 1, is now eliminated
- Two repo-wide grep gates prove DISC-04's single-source-of-truth spirit: no file under `backend/app` hardcodes the joined 8-key area literal, and no service file other than `coverage_areas.py` hardcodes the `covered|partial|uncovered` status enum
- Full backend regression suite (excluding the 2 Supabase-dependent tests) grew from 24 to 29 passing tests, all green

## Task Commits

Each task was committed atomically:

1. **Task 1: Rewire session_state._init_coverage to SALES_AREA_SET.keys() + D-04 regression test** - `ef261b1` (refactor)
2. **Task 2: Rewire structured_context._EXTRACTOR_SYSTEM block enum + single-source grep gates** - `b2130e7` (refactor)

**Plan metadata:** (this commit, docs)

_TDD note: Both tasks are `tdd="true"`, but per the plan's own explicit instruction (extending byte-identity/regression coverage over already-defined behavior, not writing net-new failing tests for net-new behavior) and `workflow.tdd_mode` being OFF, each task's test additions were verified green immediately alongside the implementation change and committed as a single atomic commit per task, matching the plan's own "Commit 1" / "Commit 2" framing in its 7-section change plan. This mirrors the precedent set in both prior plans (01-01, 01-02) for the same reason._

## Files Created/Modified
- `backend/app/services/session_state.py` - `COVERAGE_AREAS` removed; `_init_coverage` first loop reads `SALES_AREA_SET.keys()`; import re-pointed to `coverage_areas`
- `backend/app/services/structured_context.py` - `_EXTRACTOR_SYSTEM` split into static prefix/suffix plus a registry-sourced block-enum line, spliced by concatenation
- `backend/tests/test_session_state_custom_areas.py` - NEW: 4 tests, the D-04 regression guard (standard init, custom merge, overwrite, empty/None equivalence)
- `backend/tests/test_coverage_areas_golden.py` - extended with `test_structured_context_block_line_unchanged`

## Decisions Made
- Completed the deferred half of plan 02's D-02 relocation: `session_state.py` now imports `AREAS_BY_PROJECT_TYPE` directly from `coverage_areas` instead of via `prompt_builder`'s re-export chain (plan 02 explicitly deferred this to plan 03)
- Kept `structured_context.py`'s `_EXTRACTOR_SYSTEM` as three concatenated string constants (PREFIX + dynamic line + SUFFIX) rather than an f-string, per RESEARCH.md's explicit warning that the constant's literal JSON `{`/`}` braces would need escaping in an f-string, risking a silent byte-level regression
- `pipeline.py`'s `block=q_data.get("block", "negocio")` default value (a single fallback, not a duplicated area list) confirmed out of scope per the plan's own DECISÃO EM ABERTO registration — not touched

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None. Full regression suite (`pytest --ignore=tests/test_projects.py --ignore=tests/test_schema.py`) is green at 29 passed; the pre-existing Supabase-connectivity gap in the two ignored files (documented in 01-01-SUMMARY.md) is unchanged and out of this plan's scope.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- DISC-04 is fully met for the backend: all four consumers (`llm.py`, `prompt_builder.py`, `session_state.py`, `structured_context.py`) read the 8 sales areas and the coverage schema status enum from `coverage_areas.py`, and two repo-wide grep gates prove no hardcoded duplicate remains under `backend/app`.
- The frontend's own `COVERAGE_AREAS` copy (`frontend/src/lib/useSessionWS.ts:54-57`) remains untouched by design (D-05) — confirmed no `frontend/` file appears in this plan's or any Phase 1 plan's diff. This is documented debt, closed by Phase 5 (UI-03, server-driven rendering).
- Phase 1 (Area-Set Registry) is now complete — all 3 plans executed, roadmap Success Criteria #2, #3, and #4 satisfied. Ready for Phase 2 (discovery area set) to add a new named `AreaSet` alongside `SALES_AREA_SET` without touching any consumer's call-site shape.
- No blockers.

## Self-Check: PASSED
- `backend/app/services/session_state.py` — FOUND, no `COVERAGE_AREAS` definition remains; imports `AREAS_BY_PROJECT_TYPE, SALES_AREA_SET` from `app.services.coverage_areas`
- `backend/app/services/structured_context.py` — FOUND, contains `_EXTRACTOR_SYSTEM_PREFIX`/`_SUFFIX` and `SALES_AREA_SET.keys()`
- `backend/tests/test_session_state_custom_areas.py` — FOUND, 4 tests
- `backend/tests/test_coverage_areas_golden.py` — FOUND, 13 tests
- Commit `ef261b1` — FOUND in git log
- Commit `b2130e7` — FOUND in git log
- `cd backend && python -m pytest tests/test_coverage_areas_golden.py tests/test_session_state_custom_areas.py -q` — 17 passed
- Single-source grep gates (both Task 2 greps) — PASS
- No `frontend/` file in this plan's diff — confirmed (D-05)
- Import sanity (`llm`, `prompt_builder`, `session_state`, `structured_context`, `coverage_areas`) — OK, no circular import
- `cd backend && python -m pytest --ignore=tests/test_projects.py --ignore=tests/test_schema.py -q` — 29 passed

---
*Phase: 01-area-set-registry*
*Completed: 2026-09-20*
