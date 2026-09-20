# Roadmap: Agente Diagnóstico

## Overview

v1.0 (legacy CLI, `diagnostico/`) and v2.0 (web app + Precificador, Phases 1-13) are complete —
full phase detail is archived in `.planning/milestones/v2.0-phases/`. v3.0 pivots the product from
pre-sales technical-risk detection to live discovery: the same realtime pipeline (coverage
classification, red-flag detection, question planning, reporting) is reframed around two
coordinated lenses — Produto (primary) and Dados (auxiliary) — instead of one generic sales-risk
classifier, and the transcription source moves from the custom Chrome extension to Taqciti. The 9
phases split into two ordered tracks: Phases 1-5 do the domain reframe (area registry → discovery
mode → two-agent questions → discovery report → two-lens UI), testable end-to-end with the existing
streaming extension; Phases 6-9 then swap the transcription source to Taqciti (webhook auth → live
streaming → session binding → cutover), so discovery correctness is proven before capture changes.

## Milestones

- ✅ **v1.0 Diagnóstico CLI** - terminal interview + realtime pipeline (legacy, `diagnostico/`)
- ✅ **v2.0 Web + Precificador** - Phases 1-13 (archived in `.planning/milestones/v2.0-phases/`)
- 🚧 **v3.0 Pivot Discovery** - Phases 1-9 (in progress)

## Phases

**Phase Numbering:**

- This milestone (v3.0) restarts numbering at Phase 1 — this project's convention numbers each
  milestone's phases from 1, archiving the prior milestone's phase detail under `.planning/milestones/`.
- Integer phases (1-9): planned v3.0 milestone work.
- Decimal phases (e.g. 1.1): urgent insertions only, via `/gsd-phase --insert`.

- [x] **Phase 1: Area-Set Registry** - Single source of truth for coverage areas; zero behavior change for sales mode (completed 2026-09-20)
- [ ] **Phase 2: Discovery Mode + DiscoveryPromptBuilder** - Projects can run in discovery mode over the 11 discovery areas with discovery framing
- [ ] **Phase 3: Two-Agent Questions + Lens Tagging** - Produto + Dados planners share one question queue; areas/red flags/questions carry a lens tag
- [ ] **Phase 4: Discovery Report + Pricing Handoff** - One discovery document with a pricing-metrics section, feeding import-from-diagnosis
- [ ] **Phase 5: Two-Lens Monitoring (Frontend)** - Coverage grouped by lens, lens badges, server-driven area rendering
- [ ] **Phase 6: Opt-In Webhook Auth** - Non-breaking shared-secret gate on the transcription webhook
- [ ] **Phase 7: Taqciti Config + Background Streamer** - Taqciti streams live captions to the backend during the call
- [ ] **Phase 8: Taqciti Session Association** - A Taqciti stream binds to the correct backend session
- [ ] **Phase 9: Cutover + Retire Custom Extension** - Taqciti becomes the sole transcription source

## Phase Details

### Phase 1: Area-Set Registry

**Goal**: A single source of truth generates the coverage JSON schema, eliminating the 8 hardcoded sales areas duplicated across ~6 files, with zero observable change to sales-mode output
**Depends on**: Nothing (first phase)
**Requirements**: DISC-04
**Success Criteria** (what must be TRUE):

  1. A sales-mode session's coverage classification output (8 areas, same names, order, and schema) is unchanged before and after the refactor
  2. The 8 sales coverage areas are defined in exactly one file (`coverage_areas.py`); no other file in backend or frontend hardcodes the area list
  3. `prompt_builder.py`, `llm.py`, and `session_state.py` all read the area list from the registry instead of embedding their own copy
  4. Adding a new area set (used starting Phase 2) requires editing only the registry file, not the consuming modules

**Plans**: 3/3 plans executed
**Wave 1**

- [x] 01-01-PLAN.md — Freeze golden fixture + create coverage_areas.py registry (leaf) + tracer rewire of llm.classify_coverage schema

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 01-02-PLAN.md — Rewire remaining llm.py (labels + block enum) + prompt_builder.py (relocate AREAS_BY_PROJECT_TYPE, schema not_applicable toggle, block enum)

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 01-03-PLAN.md — Rewire session_state (keys + D-04 custom_areas guard) + structured_context block enum + single-source grep gates

### Phase 2: Discovery Mode + DiscoveryPromptBuilder

**Goal**: A project configured with `mode=discovery` runs the full pipeline over the 11 discovery areas (Produto + Dados lenses) with discovery framing, while sales projects behave exactly as before
**Depends on**: Phase 1
**Requirements**: DISC-01, DISC-02, DISC-03
**Success Criteria** (what must be TRUE):

  1. A project can be created or edited with `mode=discovery` (vs `mode=sales`); existing sales projects keep working with `mode=sales` unaffected by the new column
  2. A discovery-mode session's `coverage_update` events show the 11 discovery areas (Produto + Dados lenses) instead of the 8 sales areas
  3. Discovery-mode prompts sent to the LLM omit the CITI_PORTFOLIO sales framing while still calibrating tone and depth by the project's Data Maturity Score
  4. Re-running a sales-mode session after this change still produces the 8 sales areas and CITI_PORTFOLIO-aware prompts, with no regression

**Plans**: TBD

### Phase 3: Two-Agent Questions + Lens Tagging

**Goal**: Produto (primary) and Dados (auxiliary) planners generate questions into one shared queue, and every coverage area, red flag, and question carries a lens tag, with no duplicate questions across the two agents
**Depends on**: Phase 2
**Requirements**: LENS-01, LENS-02, LENS-03, LENS-04, LENS-05
**Success Criteria** (what must be TRUE):

  1. In a discovery session, questions from the Produto planner (bottleneck, frente de atuação, user impact, process mapping, delivery viability) and the Dados planner (sources, quality, metrics, LGPD/security, solution approach, quick wins) both land in the same question queue, each labeled with its lens
  2. Every coverage area and every red flag shown for a discovery session carries a `lens` tag (`produto` or `dados`)
  3. Across a live session, the Dados planner triggers on a visibly slower cadence than the Produto planner (not on every question-generation cycle)
  4. No two questions in the queue — regardless of which agent produced them — are duplicates of each other; anti-repetition context is shared across both agents

**Plans**: TBD

### Phase 4: Discovery Report + Pricing Handoff

**Goal**: A discovery session produces one report with Produto, Dados, and pricing-metrics sections, and that report feeds the Precificador via the existing import flow, while sales reporting is unaffected
**Depends on**: Phase 2, Phase 3
**Requirements**: REP-01, REP-02, REP-03
**Success Criteria** (what must be TRUE):

  1. Ending a discovery session generates a single Markdown report with distinct Produto and Dados sections plus a "Métricas para Precificação" section
  2. Running "Importar do diagnóstico" against a discovery report extracts at least one feature into the pricing feature table, and the created pricing's `session_id` links back to the discovery session
  3. Ending a sales-mode session still generates the existing sales report format with no regression

**Plans**: TBD

### Phase 5: Two-Lens Monitoring (Frontend)

**Goal**: The monitoring screen visually separates the Produto and Dados lenses in discovery mode, keeps the flat layout in sales mode, and renders whatever area set the backend sends without hardcoding
**Depends on**: Phase 2, Phase 3
**Requirements**: UI-01, UI-02, UI-03
**Success Criteria** (what must be TRUE):

  1. Opening the monitoring screen for a discovery session shows coverage areas grouped into Produto and Dados sections; opening it for a sales session shows the same flat list as before
  2. Every question card and red-flag row displays a lens badge (Produto or Dados) in discovery mode
  3. `useSessionWS` and `SessionActivePage` render whatever coverage-area set the backend sends without a hardcoded area list in the frontend

**Plans**: TBD
**UI hint**: yes

### Phase 6: Opt-In Webhook Auth

**Goal**: The transcription webhook is protected by a shared-secret header that is opt-in — current production traffic is unaffected until the secret is configured
**Depends on**: Nothing new (starts the Taqciti track; independent of Phases 1-5)
**Requirements**: TAQ-03
**Success Criteria** (what must be TRUE):

  1. With `EXTENSION_SHARED_KEY` unset, `POST /webhook/extension` continues to accept chunks exactly as it does today
  2. With `EXTENSION_SHARED_KEY` set, a request missing the `x-agente-key` header (or sending the wrong value) is rejected
  3. With `EXTENSION_SHARED_KEY` set and the correct `x-agente-key` header supplied, the request is accepted and processed normally

**Plans**: TBD

### Phase 7: Taqciti Config + Background Streamer

**Goal**: Taqciti streams merged live caption segments to the backend during a call, reusing the existing `/webhook/extension` endpoint, without disturbing Taqciti's existing batch flow
**Depends on**: Phase 6
**Requirements**: TAQ-01
**Success Criteria** (what must be TRUE):

  1. During a live Google Meet call, Taqciti streams merged caption segments to `/webhook/extension` in near-real-time, not only after the call ends
  2. Taqciti's existing batch `/api/generate` flow continues to work unchanged for calls that don't use live streaming
  3. The Agente backend URL and streaming toggle are configurable in Taqciti (via `agenteConfig.ts`) rather than hardcoded

**Plans**: TBD

### Phase 8: Taqciti Session Association

**Goal**: A Taqciti stream binds to the correct backend discovery session automatically when possible, with a manual fallback when it isn't
**Depends on**: Phase 7
**Requirements**: TAQ-02
**Success Criteria** (what must be TRUE):

  1. When the Agente web app and Taqciti run in the same browser during a call, Taqciti auto-detects the active session id (`localStorage['agente_session_id']`) and streams chunks tagged to that session with no manual step
  2. When auto-detect is unavailable, the user can enter the session id manually in the Taqciti panel and streaming binds to that session
  3. Chunks are only attributed to a session when the binding is explicit (auto-detected or manually entered) — never guessed or defaulted silently

**Plans**: TBD
**UI hint**: yes

### Phase 9: Cutover + Retire Custom Extension

**Goal**: Taqciti is the sole transcription source in production; the custom extension is removed while the backend contract it used remains intact for historical data
**Depends on**: Phase 6, Phase 7, Phase 8
**Requirements**: TAQ-04
**Success Criteria** (what must be TRUE):

  1. A full discovery session — transcript, coverage updates, questions, and final report — completes end-to-end using only Taqciti as the transcription source
  2. The `extension/` directory and its packaged zip are removed from the repository
  3. The `/webhook/extension` endpoint, the `ExtensionChunk` model, and the `extension` source enum value remain intact in the backend, so historical sessions referencing them still resolve

**Plans**: TBD

## Progress

**Execution Order:**
Phases 1-5 (domain reframe) then Phases 6-9 (Taqciti transcription swap): 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Area-Set Registry | 3/3 | Complete    | 2026-09-20 |
| 2. Discovery Mode + DiscoveryPromptBuilder | 0/? | Not started | - |
| 3. Two-Agent Questions + Lens Tagging | 0/? | Not started | - |
| 4. Discovery Report + Pricing Handoff | 0/? | Not started | - |
| 5. Two-Lens Monitoring (Frontend) | 0/? | Not started | - |
| 6. Opt-In Webhook Auth | 0/? | Not started | - |
| 7. Taqciti Config + Background Streamer | 0/? | Not started | - |
| 8. Taqciti Session Association | 0/? | Not started | - |
| 9. Cutover + Retire Custom Extension | 0/? | Not started | - |
