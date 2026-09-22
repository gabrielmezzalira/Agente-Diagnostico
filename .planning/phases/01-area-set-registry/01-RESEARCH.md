# Phase 1: Area-Set Registry - Research

**Researched:** 2026-09-20
**Domain:** Internal backend refactor (Python/FastAPI) — no external library, no new dependency
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Registry model / shape (Decision \"Modelo do registro\" → 1A)**
- **D-01:** The registry is designed around **named area sets** from the start (e.g., a
  `SALES_AREA_SET`), each area carrying key + human label + order. The registry is what
  **generates the coverage JSON schema string**. This directly satisfies roadmap Success
  Criterion #4 (\"adding a new area set requires editing only the registry file\"), making
  Phase 2's discovery set a trivial addition. — **Reversibility:** costly — the shape
  becomes the contract Phase 2's DiscoveryPromptBuilder and Phase 3's lens tagging build
  on; changing it later means reworking those consumers.
- **D-02:** The registry **absorbs** the two area-related concerns that are currently
  spread out: the human labels (`area_labels` in `llm.py` `generate_report`) and the
  per-project-type active/inactive rules (`AREAS_BY_PROJECT_TYPE` in `prompt_builder.py`).
  After this phase these live only in the registry, not in the consuming modules.

**Fidelity bar for \"zero change\" (Decision \"Régua de zero mudança\" → 2A)**
- **D-03:** The prompt/schema text produced by the registry MUST be **byte-for-byte
  identical** to today's hand-written text. Prove it with a **golden snapshot test**:
  capture the current output as a fixture **before** the refactor, then assert the
  generated output matches it character-for-character. Rationale: the area list is
  embedded in the LLM prompt string; any character difference can change the Gemini
  response, which would violate Success Criterion #1. — **Reversibility:** reversible
  (test-only decision).

**Dormant custom areas (Decision \"Custom areas dormentes\" → 3A)**
- **D-04:** Leave the dormant `generate_custom_areas` / `custom_areas` path **untouched**.
  The registry only needs to **coexist** with it — full wire-up is DISCF-02 (future
  milestone). **Attention point for planner:** when the registry starts generating the
  area list, it must NOT break the existing \"merge custom_areas with the standard areas\"
  logic in `session_state.py` (`_init_coverage`, lines 22-29/76/91). Do not remove the
  `custom_areas` hook.

**Frontend boundary (Decision \"Fronteira do frontend\")**
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

### Deferred Ideas (OUT OF SCOPE)
- **Discovery-only (delete sales / CITI_PORTFOLIO framing):** discussed as a strategic
  option — should the product drop sales entirely and become discovery-only? Kept
  deferred. It contradicts the current locked decision (\"keep sales behind a `mode` flag
  until discovery is validated\" — irreversible if deleted, discovery not yet proven on a
  real Meet call). **This is a TEAM/ROADMAP decision, not a sprint decision** — revisit
  only after Phases 1-5 + Taqciti validate discovery end-to-end. Do NOT fold into Phase 1.
- **Frontend area registry removal:** Phase 5 (UI-03, server-driven rendering).
- **Discovery area set (11 areas, Produto + Dados lenses):** Phase 2.
- **Lens tags on areas/red flags/questions:** Phase 3.
- **Wiring up `generate_custom_areas` (dynamic per-client areas):** DISCF-02, future
  milestone.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DISC-04 | Coverage areas live in a single registry — no hardcoded area lists duplicated across backend and frontend. | This research maps every backend hardcoded occurrence of the 8 sales-area keys (Standard Stack / Architecture sections below) and defines a registry API (`coverage_areas.py`) that all backend consumers must read from. Frontend copy is explicitly out of scope per D-05 (Phase 5 closes the loop). |

</phase_requirements>

## Summary

This phase is a pure internal refactor with **zero new dependencies** — there is no
"standard stack" to select; the work is extracting duplicated Python literals into one
module and rewiring three files (plus one more discovered during this research,
`structured_context.py`) to read from it. The 8 sales area keys
(`negocio, eng_dados, visualizacao, ciencia_dados, automacao, integracao, consumo,
parceria`) and their derived artifacts (JSON schema strings embedded in LLM prompts,
human labels, per-project-type active/inactive rules, and a `|`-joined block enum) are
currently duplicated across five backend files in two *non-identical* shapes (with and
without a `not_applicable` status option) and one *coincidentally similar but unrelated*
sixth file that belongs to a different subsystem (the Precificador's pricing-block
labels) and must **not** be touched.

The critical constraint is D-03: the registry's generated strings must be byte-for-byte
identical to what is hand-written today, because these strings are LLM prompt content —
any character shift can change Gemini's response and silently violate Success Criterion
#1. This research quotes every relevant literal verbatim, with exact line numbers, so the
planner can write a golden-snapshot test *before* touching any consumer, and the
executor can diff-check byte identity after.

**Primary recommendation:** Build `backend/app/services/coverage_areas.py` around a
frozen-dataclass `AreaSet` (ordered tuple of `CoverageArea(key, label, order)`) exposing
`.keys()`, `.labels()`, `.schema_json(include_not_applicable: bool)`, and
`.block_enum()`. Define `SALES_AREA_SET` with the 8 areas in their current order, and
relocate `AREAS_BY_PROJECT_TYPE` into the same module unchanged (D-02). Rewire
`llm.py`, `prompt_builder.py`, and `session_state.py` to call these methods instead of
holding their own literals; leave `generate_custom_areas` and the `custom_areas` merge
untouched (D-04). Keep the registry a leaf module with zero imports of the three
consumers, to avoid introducing a circular import.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Coverage area definition (keys, labels, order) | API/Backend (domain module) | — | Pure data, no I/O; owned by a dedicated `services/coverage_areas.py` module, not a router or repository — it has no HTTP or DB concern of its own. |
| LLM prompt/schema text generation | API/Backend (`llm.py`, `prompt_builder.py`) | Registry (data source) | Prompt assembly is a service-layer concern; the registry only supplies the area data the prompt text is built from — it does not build prompts itself. |
| Coverage state initialization (`_init_coverage`) | API/Backend (`session_state.py`) | Registry (key source) | Session state owns the mutable per-session `CoverageArea` dataclass; the registry only supplies the static ordered key list to seed it. |
| Frontend coverage area list rendering | Browser/Client (`frontend/src/lib/useSessionWS.ts`) | — (out of scope this phase, D-05) | TypeScript cannot import a Python module; server-driven rendering is Phase 5 (UI-03). Left as documented debt. |

## Standard Stack

Not applicable — this phase introduces **no new library or framework**. It uses only
Python's standard-library `dataclasses` module, already used throughout `session_state.py`
(`CoverageArea`, `RedFlag`, `Question`, `SessionState` are all `@dataclass`,
`session_state.py:36-86` [VERIFIED: backend/app/services/session_state.py:36-86]).

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Frozen `@dataclass` for `CoverageArea`/`AreaSet` | Plain `dict`/`NamedTuple` | Dicts don't self-document the key+label+order shape D-01 requires and invite silent key typos. `NamedTuple` is close but frozen dataclasses read more idiomatically next to the existing `CoverageArea` dataclass in `session_state.py` and support methods (`.schema_json()`) directly on the type. |
| A single flat module-level list + dict (current style) | `enum.Enum` for area keys | An `Enum` would force every consumer (JSON serialization to Supabase, WS payloads, LLM-returned JSON keys) through `.value`/coercion boilerplate — the current code treats area keys as plain strings everywhere downstream (`coverage_json` jsonb column, WS `coverage_update` payload); switching to `Enum` is a larger and riskier change than this phase's "zero observable change" goal allows. Not recommended for this phase. |

## Package Legitimacy Audit

Not applicable — no external package is installed or upgraded in this phase. It is a
pure internal refactor using only the Python standard library (`dataclasses`) already in
use in this codebase.

## Architecture Patterns

### System Architecture Diagram

```
                     ┌─────────────────────────────┐
                     │  coverage_areas.py (NEW)     │
                     │  SALES_AREA_SET               │
                     │  AREAS_BY_PROJECT_TYPE        │
                     │  .keys() .labels()            │
                     │  .schema_json() .block_enum() │
                     └───────────┬───────────────────┘
                 (leaf module — no imports of the 3 consumers below)
        ┌────────────────────────┼────────────────────────┐
        ▼                        ▼                         ▼
┌───────────────────┐  ┌──────────────────────┐  ┌────────────────────┐
│ session_state.py    │  │ prompt_builder.py      │  │ llm.py               │
│ _init_coverage()     │  │ _area_hint()            │  │ classify_coverage()   │
│ COVERAGE_AREAS→keys  │  │ build_coverage_        │  │  fallback schema      │
│ (custom_areas merge  │  │   classifier()→schema  │  │ generate_report()     │
│  UNTOUCHED, D-04)    │  │ build_question_        │  │  area_labels→labels() │
│                      │  │   planner()→block_enum │  │ generate_questions()  │
│                      │  │                        │  │  fallback block_enum  │
└───────────┬──────────┘  └──────────┬─────────────┘  └──────────┬───────────┘
            │                        │                             │
            ▼                        ▼                             ▼
   SessionState.coverage    system_prompt string          system prompt string
   (persisted per session)  → session_state.prompts        → sent to Gemini
                                → used as system_prompt
                                   in llm.py calls
```
Both paths converge on the same Gemini API call (`_call()` in `llm.py:34-57`
[VERIFIED: backend/app/services/llm.py:34-57]) — whichever `system_prompt` string wins
(the `PromptBuilder`-built one, normally present; the `llm.py` inline literal, only used
when `system_prompt` is `None`) must still render the identical schema text, which is why
both code paths need the registry and both need golden-snapshot coverage.

### Recommended Project Structure
```
backend/app/services/
├── coverage_areas.py     # NEW — single source of truth (this phase)
├── llm.py                # rewired: 3 call sites read from coverage_areas
├── prompt_builder.py     # rewired: AREAS_BY_PROJECT_TYPE relocated; 2 call sites read from coverage_areas
├── session_state.py      # rewired: COVERAGE_AREAS list replaced by registry keys
└── structured_context.py # OPTIONAL (see Open Questions) — 1 prompt literal, same 8 keys
```

### Pattern 1: Frozen dataclass area set with derived-view methods
**What:** `CoverageArea(key, label, order)` + `AreaSet(name, areas: tuple[CoverageArea, ...])`
with `.keys()`, `.labels()`, `.schema_json(include_not_applicable)`, `.block_enum()`
methods that derive every currently-hand-written string from the same ordered tuple.
**When to use:** Whenever a consumer needs the area list in a different *shape* (ordered
keys for iteration, key→label dict for report tables, JSON-schema text for an LLM prompt,
`|`-joined enum text for a different LLM prompt) — one canonical order, many projections.
**Example (recommended, not yet in codebase):**
```python
# backend/app/services/coverage_areas.py — proposed shape
from dataclasses import dataclass


@dataclass(frozen=True)
class CoverageArea:
    key: str
    label: str
    order: int


@dataclass(frozen=True)
class AreaSet:
    name: str
    areas: tuple[CoverageArea, ...]

    def _ordered(self) -> tuple[CoverageArea, ...]:
        return tuple(sorted(self.areas, key=lambda a: a.order))

    def keys(self) -> list[str]:
        return [a.key for a in self._ordered()]

    def labels(self) -> dict[str, str]:
        return {a.key: a.label for a in self._ordered()}

    def schema_json(self, *, include_not_applicable: bool = False) -> str:
        status = "covered|partial|uncovered" + ("|not_applicable" if include_not_applicable else "")
        body = ",".join(
            f'"{a.key}":{{"status":"{status}","score":0-100,"notes":""}}'
            for a in self._ordered()
        )
        return '{"areas":{' + body + "}}"

    def block_enum(self) -> str:
        return "|".join(self.keys())


SALES_AREA_SET = AreaSet(
    name="sales",
    areas=(
        CoverageArea("negocio", "Negócio", 0),
        CoverageArea("eng_dados", "Eng. de Dados", 1),
        CoverageArea("visualizacao", "Visualização", 2),
        CoverageArea("ciencia_dados", "Ciência de Dados", 3),
        CoverageArea("automacao", "Automação", 4),
        CoverageArea("integracao", "Integração", 5),
        CoverageArea("consumo", "Consumo", 6),
        CoverageArea("parceria", "Parceria", 7),
    ),
)

# D-02: relocated verbatim from prompt_builder.py:36-67 — semantics unchanged.
AREAS_BY_PROJECT_TYPE: dict[str, dict[str, list[str]]] = {
    "bi": {
        "critical": ["negocio", "visualizacao", "eng_dados", "parceria"],
        "optional": ["integracao", "consumo"],
        "inactive": ["ciencia_dados", "automacao"],
    },
    # ... remaining 5 project types, copied verbatim — see prompt_builder.py:36-67
}
```
This must be verified to produce **exactly**:
`{"areas":{"negocio":{"status":"covered|partial|uncovered","score":0-100,"notes":""},"eng_dados":{"status":"covered|partial|uncovered","score":0-100,"notes":""},"visualizacao":{"status":"covered|partial|uncovered","score":0-100,"notes":""},"ciencia_dados":{"status":"covered|partial|uncovered","score":0-100,"notes":""},"automacao":{"status":"covered|partial|uncovered","score":0-100,"notes":""},"integracao":{"status":"covered|partial|uncovered","score":0-100,"notes":""},"consumo":{"status":"covered|partial|uncovered","score":0-100,"notes":""},"parceria":{"status":"covered|partial|uncovered","score":0-100,"notes":""}}}`
when `include_not_applicable=False` (matches `llm.py:70-77` concatenated
[VERIFIED: backend/app/services/llm.py:70-77]), and the same string with
`|not_applicable` appended to every `status` enum when `include_not_applicable=True`
(matches `prompt_builder.py:367-374` concatenated
[VERIFIED: backend/app/services/prompt_builder.py:367-374]). **The planner must have the
executor run a literal string-equality assertion against both quoted forms above — do not
trust visual inspection of the generator code.**

### Anti-Patterns to Avoid
- **Using `json.dumps` to "clean up" the schema string:** the current strings are
  hand-written text with placeholder value expressions like `"score":0-100` — this is
  **not valid JSON** (it's prompt text describing a JSON shape to the LLM, not a real
  JSON document). Do not attempt to generate it via `json.dumps` on a Python dict; that
  would produce `"score": "0-100"` or fail entirely, changing the byte content the LLM
  sees. Build it as a string template, exactly as today.
- **Normalizing whitespace/quote style "for consistency":** any change of quoting style,
  spacing, or key order changes the bytes sent to Gemini and is an explicit D-03
  violation, not a cleanup.
- **Introducing an `Enum` for area keys in this phase:** every current consumer (Supabase
  `coverage_json` jsonb, WS payloads, LLM-returned JSON) treats area keys as plain
  strings; switching now widens the diff far beyond "extract a registry" and risks
  observable behavior change. Defer to a future phase if ever needed.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Ordered, labeled, per-type-filterable area metadata | A second ad-hoc dict/list per consumer (the current state) | One frozen `AreaSet` dataclass with derived-view methods | This is precisely the problem this phase exists to eliminate — every "just add one more dict" instinct recreates the bug being fixed. |
| Byte-identical output proof | Manual before/after diffing by eye | A golden-snapshot pytest fixture (see Validation Architecture) | Manual diffing of ~500-character concatenated prompt strings is exactly where a single missing comma slips through un-noticed and silently changes LLM behavior. |

**Key insight:** there is no "expert library" question in this phase — the domain risk is
entirely in fidelity (D-03) and completeness (finding every hardcoded copy, not just the
three files named in the roadmap). Both risks are addressed by grep-verified inventory
(below) plus an automated literal-equality test, not by tooling choice.

## Runtime State Inventory

> Included because this phase is a refactor (extracting duplicated code). All 5
> categories were checked explicitly.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | **None.** The actual area-key *strings* written to Supabase (`questions.block`, `coverage_snapshots.coverage_json` keys, per the migration comment at `supabase/migrations/20260524000000_initial_schema.sql:80` [VERIFIED: supabase/migrations/20260524000000_initial_schema.sql:80], quoted verbatim: `block text, -- enum: negocio, eng_dados, visualizacao, ciencia_dados, automacao, integracao, consumo, parceria`) do not change — D-03 requires the registry to emit the exact same key strings in the exact same order. No existing row's `block` or `coverage_json` key needs migration. | None. |
| Live service config | **None.** No n8n workflow, Datadog config, or other externally-configured service references these area keys — they only appear in Python source and one SQL comment. | None. |
| OS-registered state | **None.** No OS-level task/process registration embeds these keys. | None. |
| Secrets/env vars | **None.** No secret or env var name references `negocio`/`eng_dados`/etc. | None. |
| Build artifacts | **None.** `coverage_areas.py` is a brand-new file, not a rename of an existing importable path; no installed package or `.egg-info` references the old duplicated-dict locations. | None. |

**Canonical-question answer:** after every duplicated dict/list in the 5 relevant backend
files is replaced by a `coverage_areas` import, no runtime system still has the old
strings "cached" anywhere else — because the strings themselves are not being renamed,
only their *source location* is being consolidated. This is what makes "zero observable
change" achievable as a pure code move rather than a data migration.

## Common Pitfalls

### Pitfall 1: Treating the two schema-string call sites as one
**What goes wrong:** `llm.py`'s inline fallback schema (no `not_applicable`,
`llm.py:70-77` [VERIFIED: backend/app/services/llm.py:70-77]) and
`prompt_builder.py`'s `build_coverage_classifier()` schema (**with**
`not_applicable`, `prompt_builder.py:367-374`
[VERIFIED: backend/app/services/prompt_builder.py:367-374]) are subtly different
literals. A registry method with no toggle for this difference will either break the
`prompt_builder` path (missing `not_applicable`, which `session_state`'s
`_init_coverage` actually assigns to inactive areas per project type — see
`session_state.py:24-28` [VERIFIED: backend/app/services/session_state.py:24-28]) or
introduce `not_applicable` into the `llm.py` fallback path that never had it.
**Why it happens:** both strings describe "the coverage JSON schema" so it's tempting to
treat them as one duplicate to collapse into one string — they are not byte-identical
today and never were.
**How to avoid:** `AreaSet.schema_json(include_not_applicable: bool)` with the boolean
explicit at each of the two call sites, verified against both quoted literals above.
**Warning signs:** a golden-snapshot test failing only for the `build_coverage_classifier`
path (or only for the `classify_coverage` fallback path) after refactor — that is exactly
this bug.

### Pitfall 2: Missing the `custom_areas` merge order dependency
**What goes wrong:** `_init_coverage` (`session_state.py:21-33`
[VERIFIED: backend/app/services/session_state.py:21-33]) builds the dict from
`COVERAGE_AREAS` first, **then** overlays `custom_areas` in a second loop
(`session_state.py:29-32`). If the registry-based rewrite accidentally merges
custom areas into the *ordered key list itself* (e.g. by appending custom keys into
`SALES_AREA_SET.keys()` before building the coverage dict), the dict construction order
changes and any test/consumer relying on dict iteration order (Python 3.7+ dicts are
insertion-ordered; `coverage_to_dict()` at `session_state.py:133-137`
[VERIFIED: backend/app/services/session_state.py:133-137] iterates `self.coverage.items()`
directly) would see custom areas interleaved differently than today.
**Why it happens:** it looks natural to "let the registry handle all area sources," but
D-04 explicitly scopes the registry to the **standard** 8-area set only; custom areas
must keep flowing through the existing untouched second loop.
**How to avoid:** keep `_init_coverage`'s two-loop shape exactly as-is; only change the
first loop's source from the module-level `COVERAGE_AREAS` list to
`SALES_AREA_SET.keys()`. Do not touch lines 29-32.
**Warning signs:** any diff that touches `session_state.py` lines 29-32 in this phase's
plan should be treated as a scope violation.

### Pitfall 3: Circular import between the registry and its consumers
**What goes wrong:** `session_state.py` currently imports `AREAS_BY_PROJECT_TYPE` from
`prompt_builder.py` (`session_state.py:10`
[VERIFIED: backend/app/services/session_state.py:10], quoted verbatim:
`from app.services.prompt_builder import AREAS_BY_PROJECT_TYPE`). If the registry module
imports anything from `session_state.py`, `prompt_builder.py`, or `llm.py` (even for type
hints), a cycle is created the moment those three try to import the registry.
**Why it happens:** it's tempting to add a helper on the registry that formats data using
a type defined in `session_state.py` (e.g. reusing `CoverageArea` the session dataclass —
note the **name collision**: `session_state.py:37` already defines a runtime dataclass
called `CoverageArea` [VERIFIED: backend/app/services/session_state.py:36-41] distinct
from the registry's proposed static `CoverageArea(key, label, order)`. Two different
classes with the same name in different modules is a real naming pitfall for this phase.
**How to avoid:** keep `coverage_areas.py` a leaf module — it imports nothing from
`app.services.*`. If a name collision with `session_state.CoverageArea` is undesirable,
rename the registry's per-area dataclass (e.g. `AreaDefinition`) to avoid confusion,
even though there is no functional collision (different modules, different purpose).
**Warning signs:** `ImportError: cannot import name ... from partially initialized
module` at backend startup.

### Pitfall 4: Missing consumers not named in the roadmap/CONTEXT
**What goes wrong:** CONTEXT.md's canonical file list names exactly 3 files
(`llm.py`, `prompt_builder.py`, `session_state.py`). A `grep` for the 8 area keys across
`backend/` surfaces **two more** hits: `pipeline.py` (a default-value fallback, not a
list) and `structured_context.py` (a full duplicate of the 8-key enum inside a different
LLM prompt). A plan that only touches the 3 named files leaves `structured_context.py`'s
duplicate in place, technically still satisfying DISC-04's *observable-output* success
criteria (that agent's output isn't covered by the phase's success criteria) but not its
"single source of truth" spirit.
**Why it happens:** the roadmap and CONTEXT.md's file list was written from memory/prior
audit, not from a fresh grep at planning time.
**How to avoid:** planner should explicitly decide (see Open Questions below) whether
`structured_context.py:221` is in scope for this phase or deferred; either way, state the
decision explicitly in the plan rather than silently omitting it.
**Warning signs:** a future phase's own grep for the 8 keys turning up
`structured_context.py` again as "still not registry-sourced."

### Pitfall 5: Mistaking `pricing_export_service.py` for a sixth consumer
**What goes wrong:** `pricing_export_service.py:22-33`
[VERIFIED: backend/app/services/pricing_export_service.py:22-33] defines
`_BLOCO_LABELS` with several of the same Portuguese words (`visualizacao`,
`ciencia_dados`, `automacao`, `integracao`, `consumo`, `negocio`, `parceria`) **plus**
keys that don't exist in the sales area set (`governanca`, `infra`) and a differently
spelled key (`engenharia_dados`, not `eng_dados`). This is the Precificador module's own
pricing-block taxonomy (a different subsystem — see `CLAUDE.md` §"Regra de frameworks de
IA por módulo", which explicitly treats Agente Diagnóstico and Agente Precificador as
separate modules), not a copy of the Diagnóstico's 8 sales coverage areas.
**Why it happens:** naive keyword grep across the whole repo (rather than scoped to
`backend/app/services/` files actually consumed by the Diagnóstico pipeline) returns a
false positive here.
**How to avoid:** exclude `pricing_export_service.py` from this phase's scope entirely —
touching it would conflate two unrelated subsystems' taxonomies and violates the
CLAUDE.md module-separation rule.
**Warning signs:** a diff touching `pricing_export_service.py` in this phase's plan is a
scope violation — flag immediately.

## Code Examples

### Exact literals to preserve byte-for-byte (captured this session, pre-refactor)

**`classify_coverage` inline fallback schema** — used only when `system_prompt` is
`None` (`llm.py:65-78` [VERIFIED: backend/app/services/llm.py:65-78]):
```python
# backend/app/services/llm.py:69-77 — concatenated string, quoted verbatim
'{"areas":{"negocio":{"status":"covered|partial|uncovered","score":0-100,"notes":""},'
'"eng_dados":{"status":"covered|partial|uncovered","score":0-100,"notes":""},'
'"visualizacao":{"status":"covered|partial|uncovered","score":0-100,"notes":""},'
'"ciencia_dados":{"status":"covered|partial|uncovered","score":0-100,"notes":""},'
'"automacao":{"status":"covered|partial|uncovered","score":0-100,"notes":""},'
'"integracao":{"status":"covered|partial|uncovered","score":0-100,"notes":""},'
'"consumo":{"status":"covered|partial|uncovered","score":0-100,"notes":""},'
'"parceria":{"status":"covered|partial|uncovered","score":0-100,"notes":""}}}'
```

**`build_coverage_classifier` schema (with `not_applicable`)**
(`prompt_builder.py:367-374` [VERIFIED: backend/app/services/prompt_builder.py:367-374]):
```python
'{"areas":{"negocio":{"status":"covered|partial|uncovered|not_applicable","score":0-100,"notes":""},'
'"eng_dados":{"status":"covered|partial|uncovered|not_applicable","score":0-100,"notes":""},'
'"visualizacao":{"status":"covered|partial|uncovered|not_applicable","score":0-100,"notes":""},'
'"ciencia_dados":{"status":"covered|partial|uncovered|not_applicable","score":0-100,"notes":""},'
'"automacao":{"status":"covered|partial|uncovered|not_applicable","score":0-100,"notes":""},'
'"integracao":{"status":"covered|partial|uncovered|not_applicable","score":0-100,"notes":""},'
'"consumo":{"status":"covered|partial|uncovered|not_applicable","score":0-100,"notes":""},'
'"parceria":{"status":"covered|partial|uncovered|not_applicable","score":0-100,"notes":""}}}'
```

**`area_labels` dict** (`llm.py:125-129` [VERIFIED: backend/app/services/llm.py:125-129]):
```python
area_labels = {
    "negocio": "Negócio", "eng_dados": "Eng. de Dados", "visualizacao": "Visualização",
    "ciencia_dados": "Ciência de Dados", "automacao": "Automação", "integracao": "Integração",
    "consumo": "Consumo", "parceria": "Parceria",
}
```

**`AREAS_BY_PROJECT_TYPE`** (`prompt_builder.py:36-67`
[VERIFIED: backend/app/services/prompt_builder.py:36-67]) — full dict, 6 project types
(`bi`, `ml`, `data_engineering`, `automation`, `integration`, `science`), each with
`critical`/`optional`/`inactive` key lists; e.g. verbatim first entry:
```python
"bi": {
    "critical": ["negocio", "visualizacao", "eng_dados", "parceria"],
    "optional": ["integracao", "consumo"],
    "inactive": ["ciencia_dados", "automacao"],
},
```

**`COVERAGE_AREAS`** (`session_state.py:15-18`
[VERIFIED: backend/app/services/session_state.py:15-18]):
```python
COVERAGE_AREAS = [
    "negocio", "eng_dados", "visualizacao", "ciencia_dados",
    "automacao", "integracao", "consumo", "parceria",
]
```

**Block enum in `generate_questions` fallback** (`llm.py:304`
[VERIFIED: backend/app/services/llm.py:304]) and in `build_question_planner`
(`prompt_builder.py:493` [VERIFIED: backend/app/services/prompt_builder.py:493]) —
identical in both places:
```python
'{"questions":[{"text":"...","block":"negocio|eng_dados|visualizacao|ciencia_dados|automacao|integracao|consumo|parceria"}]}'
```

**`structured_context.py` extractor prompt** (`structured_context.py:220-221`
[VERIFIED: backend/app/services/structured_context.py:220-221]) — space-`|`-separated,
different formatting from the two block-enum strings above:
```
Para "recommended_questions", use apenas os blocos:
  negocio | eng_dados | visualizacao | ciencia_dados | automacao | integracao | consumo | parceria
```

**`_init_coverage`** (`session_state.py:21-33`
[VERIFIED: backend/app/services/session_state.py:21-33]) — the exact two-loop shape that
must be preserved (first loop from the standard list, second loop merges `custom_areas`,
D-04):
```python
def _init_coverage(
    project_type: str, custom_areas: "Optional[List[dict]]" = None
) -> "Dict[str, CoverageArea]":
    inactive = set(AREAS_BY_PROJECT_TYPE.get(project_type, {}).get("inactive", []))
    coverage = {
        a: CoverageArea(status="not_applicable") if a in inactive else CoverageArea()
        for a in COVERAGE_AREAS
    }
    for area in custom_areas or []:
        key = area.get("key")
        if key:
            coverage[key] = CoverageArea(name=area.get("name", ""))
    return coverage
```

## State of the Art

Not applicable — no framework/library version drift is relevant to this phase (pure
internal refactor, stdlib only).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `structured_context.py:221`'s block-enum text should ideally also read from the registry, even though CONTEXT.md's canonical file list names only 3 files | Common Pitfalls #4, Open Questions | Low — if the planner defers this file, DISC-04's letter (backend/frontend area lists collapsed) is still satisfied for the 3 named consumer files; only the "single source of truth" spirit is partially unmet. Reversible in a later phase. |
| A2 | Running `pytest` from the `backend/` directory resolves the `app` package correctly for new tests, following the pattern of existing tests (`test_report_cost.py`, `test_expire_questions.py`) that already import `from app.services...` without a `pyproject.toml`/`setup.cfg`/`pythonpath` config present | Validation Architecture | Low — this is the same import pattern all 5 existing test files already rely on; if it were broken, the existing suite would already be failing, not something this phase introduces. |

**If this table is empty:** N/A — two low-risk assumptions logged above; both concern
scope/tooling conventions, not domain facts, and neither touches DISC-04's core
compliance bar.

## Open Questions

1. **Is `structured_context.py:220-221` in scope for this phase?**
   - What we know: it hardcodes the identical 8 area keys (space-`|`-separated) inside a
     *different* agent's system prompt (the pre-meeting context extractor, not
     `CoverageClassifier`/`QuestionPlanner`). CONTEXT.md's canonical file list names only
     `llm.py`, `prompt_builder.py`, `session_state.py`, but the phase's `<domain>` section
     says "(and any other backend consumer)."
   - What's unclear: whether rewiring it counts as within D-03's byte-identical fidelity
     bar (this prompt is not covered by Success Criterion #1, which only speaks to
     sales-mode *coverage classification* output) or whether it's simply out of the named
     scope and safe to leave for a later cleanup.
   - Recommendation: treat as in-scope-but-low-risk. Since this string only needs the
     ordered key list (not the JSON-schema shape), wire it to
     `" | ".join(SALES_AREA_SET.keys())` and add a direct equality assertion against the
     frozen literal quoted above — cheap to include, and removes the 4th backend
     duplicate rather than the "~6 files" claim silently remaining true after the phase
     closes. If time-boxed out, explicitly log it as deferred debt (distinct from D-05's
     frontend debt), not silently dropped.

2. **Should the registry validate that `AREAS_BY_PROJECT_TYPE`'s keys are a subset of
   `SALES_AREA_SET.keys()`?**
   - What we know: today nothing validates this — a typo'd key in
     `AREAS_BY_PROJECT_TYPE` would silently produce a wrong "not applicable" area with no
     error (as seen with the current dict, which has no test coverage over it).
   - What's unclear: whether adding this guard (e.g., an assertion at module import
     time, or a unit test) counts as a "behavior change" (CLAUDE.md: "Refator ≠ mudança
     de comportamento") since a currently-silent typo would newly raise at import time.
   - Recommendation: prefer a **unit test** (not a runtime assertion) that checks
     `set().union(*[v for cfg in AREAS_BY_PROJECT_TYPE.values() for v in cfg.values()]) <= set(SALES_AREA_SET.keys())`.
     A test-only guard adds safety without changing runtime behavior, keeping this in the
     "refactor" bucket per CLAUDE.md's rule, and gives the phase a second real test
     (CLAUDE.md §7 requires ≥1 seed test; the golden snapshot is the primary one).

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | pytest ≥8.0.0 with pytest-asyncio ≥0.23.0 [VERIFIED: backend/requirements.txt:6-7] |
| Config file | `backend/pytest.ini` — `testpaths = tests`, `asyncio_mode = auto` [VERIFIED: backend/pytest.ini:1-3] |
| Quick run command | `cd backend && pytest tests/test_coverage_areas_golden.py -v` (new file, see Wave 0 Gaps) |
| Full suite command | `cd backend && pytest` (existing suite: `test_projects.py`, `test_schema.py`, `test_report_cost.py`, `test_expire_questions.py`, `test_finish_stops_pipeline.py` [VERIFIED: directory listing of backend/tests/] — note `test_projects.py`/`test_schema.py` require a live Supabase connection via `backend/.env`, per `conftest.py:1-27` [VERIFIED: backend/tests/conftest.py:1-27]; the new golden test and the unit tests recommended here follow the network-free pattern of `test_report_cost.py`/`test_expire_questions.py` instead.) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DISC-04 (schema fidelity, D-03) | `classify_coverage`'s default schema and `build_coverage_classifier`'s schema each still produce their exact pre-refactor literal | unit (pure, no network) | `pytest tests/test_coverage_areas_golden.py::test_classify_coverage_default_schema_unchanged -x` | ❌ Wave 0 |
| DISC-04 (labels fidelity, D-02/D-03) | `generate_report`'s coverage table still renders with the exact pre-refactor `area_labels` mapping | unit (monkeypatch `_call`, no network) | `pytest tests/test_coverage_areas_golden.py::test_generate_report_area_labels_unchanged -x` | ❌ Wave 0 |
| DISC-04 (block-enum fidelity, D-03) | `generate_questions`'s default block enum and `build_question_planner`'s block enum each still produce the exact pre-refactor literal | unit (pure) | `pytest tests/test_coverage_areas_golden.py::test_question_block_enum_unchanged -x` | ❌ Wave 0 |
| DISC-04 (single source, D-01/D-02) | `AREAS_BY_PROJECT_TYPE` keys are all valid `SALES_AREA_SET` keys (guards against the historically-untested typo risk, Open Question 2) | unit (pure) | `pytest tests/test_coverage_areas_golden.py::test_areas_by_project_type_keys_are_valid -x` | ❌ Wave 0 |
| DISC-04 (custom-areas coexistence, D-04) | `_init_coverage` still merges `custom_areas` on top of the standard set, in the same two-loop order | unit (pure — extend existing pattern) | `pytest tests/test_session_state_custom_areas.py -x` | ❌ Wave 0 (or extend `test_expire_questions.py`'s style in a new file) |
| Success Criterion #1 (sales-mode output unchanged) | End-to-end: a fixed `PromptBuilder(dms=None, project_type="bi")` call produces the identical full prompt string for `build_coverage_classifier()` and `build_question_planner()` before vs. after refactor | unit (golden fixture, pure) | `pytest tests/test_coverage_areas_golden.py::test_prompt_builder_golden_snapshot -x` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `cd backend && pytest tests/test_coverage_areas_golden.py -v` (fast, network-free — must be run and green after every commit that touches `coverage_areas.py`, `llm.py`, `prompt_builder.py`, or `session_state.py`)
- **Per wave merge:** `cd backend && pytest` (full suite; note the 2 Supabase-dependent tests require `backend/.env` — if unavailable in CI, run `pytest --ignore=tests/test_projects.py --ignore=tests/test_schema.py` and flag the gap)
- **Phase gate:** Full suite green (or explicitly-flagged Supabase-dependent skips) before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `tests/test_coverage_areas_golden.py` — **must be written and committed against the CURRENT (pre-refactor) code first**, in its own commit, before any consumer file is touched (per D-03: "capture the current output as a fixture before the refactor"). Concretely:
  1. Add literal-equality assertions comparing `llm.py`'s and `prompt_builder.py`'s *current* hardcoded strings against the exact quotes captured in this document's Code Examples section (this proves the quotes are accurate and gives an executable fixture).
  2. Add a `PromptBuilder(dms=None, project_type="bi", pre_meeting_context="", custom_areas=[]).build_coverage_classifier()` call, captured to a `tests/fixtures/coverage_classifier_bi_dms_none.txt` file (write-once, by hand-running the current code and saving stdout/return value), then assert equality against that file. Repeat for `build_question_planner()`.
  3. For `classify_coverage`'s and `generate_questions`'s inline fallback strings (only reachable through an async function that calls Gemini), follow the `monkeypatch` pattern already used in `test_expire_questions.py` (`_install_fake_db` style) — monkeypatch `llm._call` to capture the `system` argument instead of hitting the network, then assert it equals the frozen literal.
  4. Commit this test file green against **pre-refactor** code as its own commit (per CLAUDE.md: never mix a correctness/test-seed commit with the refactor commit that follows).
- [ ] `tests/test_session_state_custom_areas.py` (or extend an existing file) — a small pure unit test asserting `_init_coverage("bi", custom_areas=[{"key": "custom_x", "name": "X"}])` still contains both the 8 standard keys (with `ciencia_dados`/`automacao` marked `not_applicable` for `bi`, matching `AREAS_BY_PROJECT_TYPE["bi"]["inactive"]`) **and** the merged `custom_x` key — this is the regression guard for D-04.
- [ ] No new framework install needed — `pytest`/`pytest-asyncio` already present in `backend/requirements.txt`.

## Security Domain

This phase touches no authentication, session, or input-validation surface — it moves
literal string constants between Python modules with no new external input, no new
endpoint, and no change to what data reaches Supabase or the Gemini API. ASVS review is
not meaningfully applicable; noted here for completeness rather than skipped silently.

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | Unaffected — no auth code touched |
| V3 Session Management | No | Unaffected — `SessionState` dataclass shape unchanged except its area-key source |
| V4 Access Control | No | Unaffected |
| V5 Input Validation | No | The area keys are internal constants, not user/external input |
| V6 Cryptography | No | Unaffected |

### Known Threat Patterns for this stack
None specific to this phase — no new attack surface introduced.

## Sources

### Primary (HIGH confidence — read directly this session)
- `backend/app/services/llm.py` — full file read; `classify_coverage`, `generate_report`,
  `generate_custom_areas`, `generate_questions` schema/label/enum literals.
- `backend/app/services/prompt_builder.py` — full file read; `AREAS_BY_PROJECT_TYPE`,
  `_area_hint`, `build_coverage_classifier`, `build_question_planner`.
- `backend/app/services/session_state.py` — full file read; `COVERAGE_AREAS`,
  `_init_coverage`, `CoverageArea` dataclass, `coverage_to_dict`.
- `backend/app/services/structured_context.py` (lines 190-238) — extractor prompt block
  enum.
- `backend/app/services/pipeline.py` (lines 300-360) — `block=q_data.get("block",
  "negocio")` default fallback usage.
- `backend/app/services/pricing_export_service.py` (lines 1-42) — confirmed unrelated
  Precificador taxonomy, excluded from scope.
- `backend/tests/*.py`, `backend/pytest.ini`, `backend/tests/conftest.py`,
  `backend/requirements.txt` — test infrastructure and conventions.
- `frontend/src/lib/useSessionWS.ts` (lines 40-69) — confirmed D-05 frontend copy
  location/content.
- `supabase/migrations/20260524000000_initial_schema.sql` (line 80) — confirmed no DB
  `CHECK` constraint on the `block` column, only a descriptive comment.
- `.planning/phases/01-area-set-registry/01-CONTEXT.md`,
  `.planning/REQUIREMENTS.md`, `.planning/STATE.md` — upstream decisions and scope.

### Secondary (MEDIUM confidence)
None — this research required no external documentation lookup (no new library/framework
involved).

### Tertiary (LOW confidence)
None.

## Metadata

**Confidence breakdown:**
- Standard stack: N/A — no external stack; internal refactor only
- Architecture: HIGH — every file, line range, and literal quoted was read directly this
  session (`Read`/`Grep` tool calls), not inferred from training data
- Pitfalls: HIGH — derived directly from reading the actual two divergent schema strings,
  the actual two-loop `_init_coverage`, and the actual false-positive file
  (`pricing_export_service.py`), not from generic refactor-risk training knowledge

**Research date:** 2026-09-20
**Valid until:** Until this phase executes — this research is a snapshot of the exact
current source; if any of the quoted files change before the plan is executed, re-grep
before planning.
