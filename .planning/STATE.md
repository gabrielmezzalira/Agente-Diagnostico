---
gsd_state_version: "1.0"
milestone: v3.0
milestone_name: Pivot Discovery
current_phase: 2
current_phase_name: Discovery Mode + DiscoveryPromptBuilder
status: planning
stopped_at: Phase 2 context gathered
last_updated: "2026-09-20T20:09:04.799Z"
last_activity: 2026-09-20
last_activity_desc: Phase 01 complete, transitioned to Phase 2
state_head: c0237eaf9d3d09f6178fb03e8f482f4bda640e89
progress:
  total_phases: 9
  completed_phases: 1
  total_plans: 3
  completed_plans: 3
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-09-19)

**Core value:** Discovery teams map the bottleneck and its solution completely during the call, so nothing unmapped surprises delivery — and the discovery output feeds pricing directly
**Current focus:** Phase 01 — Area-Set Registry

## Current Position

Phase: 2 — Discovery Mode + DiscoveryPromptBuilder
Plan: Not started
Status: Ready to plan
Last activity: 2026-09-20 — Phase 01 complete, transitioned to Phase 2

Progress: [█░░░░░░░░░] 11%

## Performance Metrics

**Velocity:**

- Total plans completed: 3
- Average duration: -
- Total execution time: 0 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01 | 3 | - | - |

**Recent Trend:**

- Last 5 plans: -
- Trend: -

*Updated after each plan completion*
**Per-Plan Metrics:**

| Plan | Duration | Tasks | Files |
|------|----------|-------|-------|
| Phase 01 P01 | 25min | 2 tasks | 5 files |
| Phase 01 P02 | 8min | 2 tasks | 3 files |
| Phase 01 P03 | 9min | 2 tasks | 4 files |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- Pivot sales → discovery, keep sales behind `mode` flag until discovery is validated
- Single coverage-area registry (kill 8 hardcoded areas duplicated across ~6 files) — Phase 1 enabling refactor
- Two agents only at the question stage (coverage + red-flags stay 1×) — bounds LLM cost near 1× while honoring "dois agentes"
- Adopt Taqciti capture engine + add live streaming; retire the custom extension after cutover is validated (Phase 9)
- [Phase 01]: Registry per-area dataclass named AreaDefinition (not CoverageArea) to avoid name collision with session_state.CoverageArea — session_state.py already has an unrelated runtime CoverageArea dataclass; reusing the name would be confusing even without an import cycle
- [Phase 01]: Only llm.classify_coverage rewired to the registry in plan 01-01; area_labels and block-enum call sites deferred to later plans — Plan 01-01 scope is the tracer slice (one consumer, proven end-to-end); remaining consumers are plan 02/03 work
- [Phase 01]: [Phase 01-02]: AREAS_BY_PROJECT_TYPE re-exported through prompt_builder.py's top-level import rather than repointing session_state.py directly, keeping this plan's diff scoped to its two named files — plan 03 is the one that repoints session_state's import directly to the registry
- [Phase 01]: [Phase 01-03]: session_state.py re-pointed directly to coverage_areas (import no longer via prompt_builder re-export); structured_context.py's _EXTRACTOR_SYSTEM split into static PREFIX/SUFFIX plus a registry-sourced middle line (concatenation, not f-string) to avoid escaping literal JSON braces

### Pending Todos

None yet.

### Blockers/Concerns

- Phases 1-3 touch backend files shared with sales mode (`prompt_builder.py`, `llm.py`, `session_state.py`) — every change needs a sales-mode regression check, not just a discovery-mode happy path
- Phases 2 and 3 need additive-only Supabase migrations (`projects.mode`, `questions.lens`) — confirm migration approach before Phase 2 execution
- Phases 7-8 live in the separate Taqciti repo — coordinate access/branch strategy before starting Phase 7
- Phase 9 (cutover) should not start until a real Meet call has validated Phases 6-8 end-to-end

## Deferred Items

Items acknowledged and deferred at milestone close, most recent first:

| Category | Item | Status | Deferred At | Milestone |
|----------|------|--------|-------------|-----------|
| Discovery depth | Report template refined against a real discovery document sample (DISCF-01) | Deferred | v3.0 requirements | v3.1+ |
| Discovery depth | Dynamic/AI-generated discovery areas per client context — wire up `generate_custom_areas` (DISCF-02) | Deferred | v3.0 requirements | v3.1+ |
| Transcription | Multi-provider capture beyond Google Meet — Zoom/Teams (TAQF-01) | Deferred | v3.0 requirements | v3.1+ |
| Transcription | Real per-user auth (JWT/RLS) for the transcription webhook (TAQF-02) | Deferred | v3.0 requirements | v3.1+ |
| v2 req | Dynamic report cost estimation (data-driven, after 10 sessions) | Deferred | v2.0 init | v2.1+ |
| v2 req | A/B test framework for dynamic vs v1 prompts | Deferred | v2.0 init | v2.1+ |
| v2 req | Multi-user / team access | Deferred | v2.0 init | v2.1+ |

## Session Continuity

Last session: 2026-09-20T20:09:04.740Z
Stopped at: Phase 2 context gathered
Resume file: .planning/phases/02-discovery-mode-discoverypromptbuilder/02-CONTEXT.md
