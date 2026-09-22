# Phase 1: Area-Set Registry - Context

**Gathered:** 2026-09-20
**Status:** Ready for planning

<domain>
## Phase Boundary

Create a single source of truth (`backend/app/services/coverage_areas.py`) that holds
the coverage areas and generates the coverage JSON schema, eliminating the 8 hardcoded
sales areas (`negocio, eng_dados, visualizacao, ciencia_dados, automacao, integracao,
consumo, parceria`) currently duplicated across ~6 files.

**Pure refactor — ZERO observable change to sales-mode output.** No `mode` flag, no
discovery areas, no lens tags in this phase (those are Phases 2/3). The only deliverable
is the registry seam plus rewiring the consuming modules to read from it.

**In scope:** the backend registry + rewiring `prompt_builder.py`, `llm.py`,
`session_state.py` (and any other backend consumer) to read the area list from the
registry.

**Out of scope (this phase):** the frontend `COVERAGE_AREAS` copy (deferred to Phase 5,
UI-03 server-driven rendering); adding the discovery area set (Phase 2); wiring up the
dormant `generate_custom_areas`.
</domain>

<decisions>
## Implementation Decisions

### Registry model / shape (Decision "Modelo do registro" → 1A)
- **D-01:** The registry is designed around **named area sets** from the start (e.g., a
  `SALES_AREA_SET`), each area carrying key + human label + order. The registry is what
  **generates the coverage JSON schema string**. This directly satisfies roadmap Success
  Criterion #4 ("adding a new area set requires editing only the registry file"), making
  Phase 2's discovery set a trivial addition. — **Reversibility:** costly — the shape
  becomes the contract Phase 2's DiscoveryPromptBuilder and Phase 3's lens tagging build
  on; changing it later means reworking those consumers.
- **D-02:** The registry **absorbs** the two area-related concerns that are currently
  spread out: the human labels (`area_labels` in `llm.py` `generate_report`) and the
  per-project-type active/inactive rules (`AREAS_BY_PROJECT_TYPE` in `prompt_builder.py`).
  After this phase these live only in the registry, not in the consuming modules.

### Fidelity bar for "zero change" (Decision "Régua de zero mudança" → 2A)
- **D-03:** The prompt/schema text produced by the registry MUST be **byte-for-byte
  identical** to today's hand-written text. Prove it with a **golden snapshot test**:
  capture the current output as a fixture **before** the refactor, then assert the
  generated output matches it character-for-character. Rationale: the area list is
  embedded in the LLM prompt string; any character difference can change the Gemini
  response, which would violate Success Criterion #1. — **Reversibility:** reversible
  (test-only decision).

### Dormant custom areas (Decision "Custom areas dormentes" → 3A)
- **D-04:** Leave the dormant `generate_custom_areas` / `custom_areas` path **untouched**.
  The registry only needs to **coexist** with it — full wire-up is DISCF-02 (future
  milestone). **Attention point for planner:** when the registry starts generating the
  area list, it must NOT break the existing "merge custom_areas with the standard areas"
  logic in `session_state.py` (`_init_coverage`, lines 22-29/76/91). Do not remove the
  `custom_areas` hook.

### Frontend boundary (Decision "Fronteira do frontend")
- **D-05:** The registry is **backend-only** for this phase. The frontend's own
  `COVERAGE_AREAS` copy (`frontend/src/lib/useSessionWS.ts:54-57`) is **left in place**
  and removed only in Phase 5 (UI-03, server-driven area rendering) — a Python module
  cannot be imported by TypeScript, and server-driven rendering is Phase 5's job. This is
  recorded as **known debt**: after this phase the backend has a single source, but the
  frontend still carries a synced copy until Phase 5. — **Reversibility:** reversible
  (resolved by Phase 5 as planned).

### Claude's Discretion
- Exact file location/module name of the registry (`coverage_areas.py` per roadmap;
  `services/` vs `core/` placement left to the planner, following SOLID conventions).
- Internal data structures (dataclass vs dict vs enum) for representing area sets, as long
  as D-01/D-02/D-03 hold.
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase definition & requirements
- `.planning/ROADMAP.md` §"Phase 1: Area-Set Registry" — goal + 4 success criteria (the
  authority on scope and the "zero change" guarantee).
- `.planning/REQUIREMENTS.md` → **DISC-04** — single registry, no duplicated area lists
  across backend and frontend.

### Project decisions & rules
- `.planning/PROJECT.md` §"Key Decisions" — "Single coverage-area registry (kill 8
  hardcoded areas)" and "Pivot sales → discovery, keep sales behind `mode` flag" (the
  latter is why discovery-only is out of scope; see Deferred Ideas).
- `CLAUDE.md` §"Princípios de Arquitetura de Código" (SOLID) and §"Regras de Planejamento
  de Tasks" (the 7 mandatory task-plan sections; never mix refactor with behavior change
  in one commit).

### Code the phase touches
- `backend/app/services/llm.py` — `classify_coverage` (JSON schema string, lines ~65-78)
  and `generate_report` (`area_labels`, lines ~125-129).
- `backend/app/services/prompt_builder.py` — `AREAS_BY_PROJECT_TYPE` (line 36),
  `_area_hint` (277), `build_coverage_classifier` (306).
- `backend/app/services/session_state.py` — `COVERAGE_AREAS` (15-18), `_init_coverage`
  (22-29), `custom_areas` merge (76, 91).
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `AREAS_BY_PROJECT_TYPE` (`prompt_builder.py:36`): the per-type active/critical/optional/
  inactive rules — fold into the registry (D-02), don't rewrite the semantics.
- `area_labels` dict (`llm.py:125`): the key→human-label mapping — fold into the registry
  (D-02).
- The area-key list is duplicated verbatim in `session_state.py:15-18` and
  `frontend/src/lib/useSessionWS.ts:54-57` — backend copy is replaced by the registry;
  frontend copy stays until Phase 5 (D-05).

### Established Patterns
- Two clean layers: a **mode-agnostic machine** (pipeline, session_state, WebSocket,
  webhook, LLM call mechanics, budget) and **sales-flavored content** (prompt text + area
  names). The refactor only touches how the area names/labels/schema are sourced; the
  machine stays untouched. This layering is what makes the "zero change" guarantee
  achievable.
- Prompts are Portuguese; identifiers/keys are `snake_case` English.

### Integration Points
- The registry feeds: the `classify_coverage` prompt schema (`llm.py`), the report
  `area_labels` (`llm.py`), coverage initialization (`session_state._init_coverage`), and
  the area hints in `prompt_builder`. All must read from the registry after this phase.
- `custom_areas` hook in `session_state` must keep working (D-04).
</code_context>

<specifics>
## Specific Ideas

- Golden-snapshot test as the acceptance seed for "zero change" (D-03): freeze the current
  sales-mode coverage schema/prompt as a fixture, assert byte-identical output post-refactor.
  This is the ≥1 real test the phase must leave behind (per CLAUDE.md planning rules).
</specifics>

<deferred>
## Deferred Ideas

- **Discovery-only (delete sales / CITI_PORTFOLIO framing):** discussed as a strategic
  option — should the product drop sales entirely and become discovery-only? Kept
  deferred. It contradicts the current locked decision ("keep sales behind a `mode` flag
  until discovery is validated" — irreversible if deleted, discovery not yet proven on a
  real Meet call). **This is a TEAM/ROADMAP decision, not a sprint decision** — revisit
  only after Phases 1-5 + Taqciti validate discovery end-to-end. Do NOT fold into Phase 1.
- **Frontend area registry removal:** Phase 5 (UI-03, server-driven rendering).
- **Discovery area set (11 areas, Produto + Dados lenses):** Phase 2.
- **Lens tags on areas/red flags/questions:** Phase 3.
- **Wiring up `generate_custom_areas` (dynamic per-client areas):** DISCF-02, future
  milestone.

</deferred>

---

*Phase: 1-area-set-registry*
*Context gathered: 2026-09-20*
