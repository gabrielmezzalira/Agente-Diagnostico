# Requirements: Agente Diagnóstico — v3.0 Pivot Discovery

**Defined:** 2026-09-19
**Core Value:** Discovery teams map the bottleneck and its solution completely during the call, so nothing unmapped surprises delivery — and the discovery output feeds pricing directly.

## v3.0 Requirements

Requirements for the discovery pivot (MVP vertical slice). Each maps to a roadmap phase.

### Discovery Mode (DISC)

- [x] **DISC-01**: A project can be configured in "discovery" mode (vs "sales") without affecting existing sales projects.
- [x] **DISC-02**: In discovery mode, the agent classifies coverage over the discovery areas (Produto + Dados lenses) instead of the 8 sales areas.
- [x] **DISC-03**: Discovery prompts drop the sales framing (CITI_PORTFOLIO) while keeping the DMS (Data Maturity Score) calibration.
- [x] **DISC-04**: Coverage areas live in a single registry — no hardcoded area lists duplicated across backend and frontend.

### Two Lenses / Two Agents (LENS)

- [x] **LENS-01**: A "Produto" agent (primary) generates discovery questions covering the bottleneck, frente de atuação, user impact, process mapping, and delivery viability.
- [x] **LENS-02**: A "Dados" agent (auxiliary) generates data-focused questions (sources, quality, metrics, LGPD/security, solution approach, quick wins), triggered less often / on demand.
- [x] **LENS-03**: Questions from both agents appear in one shared queue, each tagged with its lens (produto/dados).
- [x] **LENS-04**: Coverage areas and red flags carry a lens tag.
- [x] **LENS-05**: No duplicate questions across the two agents (shared anti-repetition).

### Report + Pricing (REP)

- [x] **REP-01**: A discovery session produces a single report with Produto + Dados sections and a "Métricas para Precificação" section.
- [x] **REP-02**: The discovery report feeds the Precificador via `import-from-diagnosis` (≥1 feature extracted; session linked in `pricings.session_id`).
- [x] **REP-03**: Sales report generation continues to work unchanged.

### Frontend (UI)

- [x] **UI-01**: The monitoring screen groups coverage by lens (Produto/Dados) in discovery mode, and shows a flat list in sales mode.
- [x] **UI-02**: Question cards and red-flag rows show a lens badge.
- [x] **UI-03**: The monitoring screen renders any coverage-area set server-driven (no hardcoded area list in the frontend).

### Taqciti Transcription (TAQ)

- [ ] **TAQ-01**: Taqciti streams live captions (merged segments) to the backend during the call.
- [ ] **TAQ-02**: A Taqciti stream binds to the correct backend discovery session (auto-detect from the web app + manual fallback).
- [ ] **TAQ-03**: The transcription webhook is protected by an opt-in shared-secret header (does not break current production when unset).
- [ ] **TAQ-04**: The old custom extension is retired after Taqciti is validated (cutover).
- [ ] **TAQ-05**: During a live call, backend-generated discovery questions (each with its produto/dados lens) appear in near-real-time inside a dedicated "AGP" tab in the Taqciti extension, scoped to the bound session.

## Future Requirements

Deferred to a later milestone. Tracked but not in this roadmap.

### Discovery depth (DISCF)

- **DISCF-01**: Report template refined against a real discovery document sample (section names/order, exact Produto metrics feeding pricing).
- **DISCF-02**: Dynamic / AI-generated discovery areas per client context (wire up the dormant `generate_custom_areas`).

### Transcription (TAQF)

- **TAQF-01**: Multi-provider capture (Zoom/Teams) beyond Google Meet.
- **TAQF-02**: Real per-user authentication (JWT/RLS) for the transcription webhook.

## Out of Scope

Explicitly excluded from this milestone. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Deleting sales mode / CITI_PORTFOLIO | Irreversible; kept behind the `mode` flag until discovery is validated |
| Real per-user auth on the webhook | MVP uses an opt-in shared secret; full auth is a separate backlog decision (PLANO_AJUSTES Task 2) |
| Multi-provider transcription (Zoom/Teams) | Recall.ai remains the optional fallback; not in this milestone |
| Dynamic report cost learning | Static estimation first |
| Two full pipelines (2× coverage + red-flags) | Two agents only at the question stage; coverage/red-flags stay 1× to bound cost |

## Traceability

Which phases cover which requirements. Filled during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| DISC-04 | Phase 1 | Complete |
| DISC-01 | Phase 2 | Complete |
| DISC-02 | Phase 2 | Complete |
| DISC-03 | Phase 2 | Complete |
| LENS-01 | Phase 3 | Complete |
| LENS-02 | Phase 3 | Complete |
| LENS-03 | Phase 3 | Complete |
| LENS-04 | Phase 3 | Complete |
| LENS-05 | Phase 3 | Complete |
| REP-01 | Phase 4 | Complete |
| REP-02 | Phase 4 | Complete |
| REP-03 | Phase 4 | Complete |
| UI-01 | Phase 5 | Complete |
| UI-02 | Phase 5 | Complete |
| UI-03 | Phase 5 | Complete |
| TAQ-03 | Phase 6 | Pending |
| TAQ-01 | Phase 7 | Pending |
| TAQ-02 | Phase 8 | Pending |
| TAQ-04 | Phase 9 | Pending |
| TAQ-05 | Phase 10 | Pending |

**Coverage:**

- v3.0 requirements: 20 total
- Mapped to phases: 20
- Unmapped: 0 ✓

---
*Requirements defined: 2026-09-19*
*Last updated: 2026-09-19 after milestone v3.0 initiation*
