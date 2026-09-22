# Phase 1: Area-Set Registry - Pattern Map

**Mapped:** 2026-09-20
**Files analyzed:** 7 (1 new registry, 1 new test, 5 modified)
**Analogs found:** 7 / 7

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `backend/app/services/coverage_areas.py` (NEW) | config/registry (leaf domain module) | transform (pure — data in, derived-string views out) | `backend/app/services/session_state.py` (`CoverageArea`/`RedFlag`/`Question` dataclasses, no I/O) | role-match (closest pure-dataclass leaf module in `services/`) |
| `backend/tests/test_coverage_areas_golden.py` (NEW) | test (golden-snapshot + unit) | transform (pure, no network) | `backend/tests/test_report_cost.py` + `backend/tests/test_expire_questions.py` | exact (both are network-free pure unit tests importing directly from `app.services.*`) |
| `backend/app/services/llm.py` (MODIFIED) | service (LLM call orchestration) | request-response | itself (pre-refactor version is its own analog for the 3 literals being replaced) | exact |
| `backend/app/services/prompt_builder.py` (MODIFIED) | service (prompt assembly) | transform | itself | exact |
| `backend/app/services/session_state.py` (MODIFIED) | model/state (in-memory session dataclass) | CRUD (in-memory init) | itself | exact |
| `backend/app/services/structured_context.py` (MODIFIED, in-scope per Open Question 1) | service (LLM prompt fragment builder) | transform | `prompt_builder.py`'s block-enum usage (same literal, different formatting) | role-match |
| `backend/app/services/pipeline.py` (touch-if-needed, default fallback only) | service (orchestrator) | event-driven | itself — `block=q_data.get("block", "negocio")` at lines 325 and 452 | exact (trivial, single default-string swap, NOT a duplicated area list) |

**Excluded (false positive, do NOT touch):** `backend/app/services/pricing_export_service.py` — belongs to the unrelated Precificador subsystem (different keys: `governanca`, `infra`, `engenharia_dados`). Confirmed by RESEARCH.md Pitfall 5.

## Pattern Assignments

### `backend/app/services/coverage_areas.py` (NEW — config/registry, transform)

**Analog:** `backend/app/services/session_state.py` (dataclass style) + `backend/app/services/prompt_builder.py` (module-level constant-dict style, e.g. `AREAS_BY_PROJECT_TYPE` at line 36, `DMS_LABEL`/`DMS_DESCRIPTION` at lines 7-21)

**Dataclass style to copy** (`session_state.py:36-41`):
```python
@dataclass
class CoverageArea:
    status: str = "uncovered"  # uncovered | partial | covered
    score: int = 0
    notes: str = ""
    name: str = ""  # nome legível (preenchido só para áreas específicas do projeto)
```
Note the naming collision flagged in RESEARCH.md Pitfall 3: `session_state.CoverageArea` already exists with different fields/purpose (a live per-session record). The new registry's static per-area dataclass MUST use a different name (e.g. `AreaDefinition`) — do not reuse `CoverageArea` for the registry's `(key, label, order)` shape.

**Module-level constant-dict style to copy** (`prompt_builder.py:36-67`, this is the exact dict to relocate per D-02 — copy verbatim, do not rewrite semantics):
```python
AREAS_BY_PROJECT_TYPE: dict[str, dict[str, list[str]]] = {
    "bi": {
        "critical": ["negocio", "visualizacao", "eng_dados", "parceria"],
        "optional": ["integracao", "consumo"],
        "inactive": ["ciencia_dados", "automacao"],
    },
    # ... 5 more project types, verbatim — see prompt_builder.py:36-67
}
```

**No imports pattern needed** — RESEARCH.md's Pitfall 3 requires `coverage_areas.py` to be a **leaf module**: it must import nothing from `app.services.*` (avoids circular import with the 3 consumers). Only `from dataclasses import dataclass` (stdlib), matching the top-of-file style already used in `session_state.py:1-3`:
```python
import asyncio
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional
```

**Byte-for-byte literals the registry's `.schema_json()`/`.block_enum()`/`.labels()` methods must reproduce exactly** — see RESEARCH.md "Code Examples" section for the full quoted strings (llm.py:69-77, prompt_builder.py:367-374, llm.py:125-129, llm.py:304 / prompt_builder.py:493). Do not re-derive these here — copy the exact literals RESEARCH.md already extracted verbatim into the new module's constants/methods.

---

### `backend/tests/test_coverage_areas_golden.py` (NEW — test, transform)

**Analog:** `backend/tests/test_report_cost.py` (pure unit, direct import, `pytest.approx`) + `backend/tests/test_expire_questions.py` (monkeypatch pattern for network-adjacent code)

**Imports pattern** (`test_report_cost.py:11-18`):
```python
import pytest

from app.services.llm import (
    INPUT_COST_PER_1K,
    OUTPUT_COST_PER_1K,
    REPORT_MAX_OUTPUT_TOKENS,
)
from app.services.session_state import REPORT_COST_MARGIN, SessionState
```
For the golden test, mirror this exactly but import `SALES_AREA_SET`, `AREAS_BY_PROJECT_TYPE` from the new `app.services.coverage_areas`, plus `PromptBuilder` from `app.services.prompt_builder`.

**No-network direct-call pattern** (`test_report_cost.py:21-32`):
```python
def test_estimated_report_cost_reflects_report_max_tokens():
    """A estimativa usa REPORT_MAX_OUTPUT_TOKENS + margem, não o 2500 antigo."""
    state = SessionState(session_id="t")  # transcript vazio

    cost = state.estimated_report_cost()

    expected = (
        (2000 / 1000) * INPUT_COST_PER_1K
        + (REPORT_MAX_OUTPUT_TOKENS / 1000) * OUTPUT_COST_PER_1K
    ) * REPORT_COST_MARGIN
    assert cost == pytest.approx(expected)
```
Use this shape for the pure golden-literal assertions: build the expected string from the Code Examples quotes in RESEARCH.md, call the registry method, assert exact string equality (not `pytest.approx` — strings need `==`).

**Monkeypatch pattern for LLM-call-adjacent code** (`test_expire_questions.py:31-64`, fake object substituted via `monkeypatch.setattr`):
```python
class _FakeQuery:
    def __init__(self, calls: dict):
        self._calls = calls
    def update(self, payload):
        self._calls["payload"] = payload
        return self
    # ... eq/in_/execute chain

def _install_fake_db(monkeypatch) -> dict:
    calls: dict = {}
    monkeypatch.setattr(pipeline_mod, "get_supabase", lambda: _FakeDB(calls))
    return calls

def test_persists_expiration_in_batch(monkeypatch):
    calls = _install_fake_db(monkeypatch)
    state = SessionState(session_id="s")
    state.questions = [_q("q1", "queued", _PAST), _q("q2", "queued", _PAST)]
    pipe = SessionPipeline(state)
    expired = pipe._expire_due_questions(_NOW)
    assert calls["payload"] == {"status": "dismissed"}
```
Apply this exact shape to capture `llm._call`'s `system` argument instead of hitting Gemini — per RESEARCH.md Wave 0 Gaps step 3: `monkeypatch.setattr(llm, "_call", <fake async fn that records `system` and returns a canned tuple>)`, then assert the captured `system` string equals the frozen literal.

**File header comment convention** (both analogs use a top-of-file banner explaining the *why*, e.g. `test_report_cost.py:1-9`):
```python
# =============================================================================
# test_report_cost.py
#
# Task 4b (PLANO_AJUSTES.md) — a estimativa de custo do relatório deve refletir
# o teto real de tokens de saída (REPORT_MAX_OUTPUT_TOKENS), não o valor fixo
# antigo (2500) que subestimava o custo e cegava a parada automática (F7).
#
# Teste unitário puro: sem rede, sem Supabase.
# =============================================================================
```
Mirror this for `test_coverage_areas_golden.py`, referencing Phase 1 / D-03 instead of Task 4b.

---

### `backend/app/services/llm.py` (MODIFIED — service, request-response)

**Current construct being replaced #1** — `classify_coverage` inline fallback schema (lines 69-77, only reached when `system_prompt is None`):
```python
'{"areas":{"negocio":{"status":"covered|partial|uncovered","score":0-100,"notes":""},'
'"eng_dados":{"status":"covered|partial|uncovered","score":0-100,"notes":""},'
# ... (see RESEARCH.md Code Examples for full 8-area literal)
'"parceria":{"status":"covered|partial|uncovered","score":0-100,"notes":""}}}'
```
Replace with a call to the registry, e.g. `SALES_AREA_SET.schema_json(include_not_applicable=False)` — must produce byte-identical output (no `not_applicable` option here, per Pitfall 1).

**Current construct being replaced #2** — `generate_report`'s `area_labels` dict (lines 125-129):
```python
area_labels = {
    "negocio": "Negócio", "eng_dados": "Eng. de Dados", "visualizacao": "Visualização",
    "ciencia_dados": "Ciência de Dados", "automacao": "Automação", "integracao": "Integração",
    "consumo": "Consumo", "parceria": "Parceria",
}
```
Replace with `SALES_AREA_SET.labels()`.

**Current construct being replaced #3** — `generate_questions` fallback block enum (line 304):
```python
'{"questions":[{"text":"...","block":"negocio|eng_dados|visualizacao|ciencia_dados|automacao|integracao|consumo|parceria"}]}'
```
Replace the embedded enum with `SALES_AREA_SET.block_enum()` interpolated into the f-string/literal — the surrounding JSON-shape text stays hand-written; only the `negocio|...|parceria` segment is registry-sourced.

**Import pattern to add** — follow the existing local-import-inside-function convention already used in this exact file (`llm.py:119`, deferred import to avoid module-load-order issues):
```python
from app.services.prompt_builder import CITI_PORTFOLIO, CITI_SERVICE_CATALOG, CITI_TECH_REFERENCE
```
Mirror this style for `from app.services.coverage_areas import SALES_AREA_SET` if a top-level import would risk a cycle; otherwise prefer a top-level `import` at the top of the file (registry is a leaf module, so top-level import is safe and preferred — only use the deferred-import style if consistency with the existing `CITI_PORTFOLIO` import is judged more valuable).

---

### `backend/app/services/prompt_builder.py` (MODIFIED — service, transform)

**Current construct being replaced #1** — module-level `AREAS_BY_PROJECT_TYPE` (lines 36-67): relocate verbatim into `coverage_areas.py` (D-02); this file then imports it back:
```python
from app.services.coverage_areas import AREAS_BY_PROJECT_TYPE, SALES_AREA_SET
```

**Current construct being replaced #2** — `_area_hint` (line 277-295) iterates `AREAS_BY_PROJECT_TYPE.get(self.project_type, {})` — only the import source changes, the method body (critical/optional/inactive iteration) is untouched:
```python
def _area_hint(self) -> str:
    config = AREAS_BY_PROJECT_TYPE.get(self.project_type, {})
    if not config:
        return ""
    critical = config.get("critical", [])
    optional = config.get("optional", [])
    inactive = config.get("inactive", [])
    # ... unchanged
```

**Current construct being replaced #3** — `build_coverage_classifier`'s schema literal WITH `not_applicable` (lines 367-374):
```python
'{"areas":{"negocio":{"status":"covered|partial|uncovered|not_applicable","score":0-100,"notes":""},'
# ... 8 areas
```
Replace with `SALES_AREA_SET.schema_json(include_not_applicable=True)` — the `True` flag here is the critical difference from `llm.py`'s call site (Pitfall 1).

**Current construct being replaced #4** — `build_question_planner`'s block enum (line 493), identical string to `llm.py:304`:
```python
'{"questions":[{"text":"...","block":"negocio|eng_dados|visualizacao|ciencia_dados|automacao|integracao|consumo|parceria"}]}'
```
Replace the enum segment with `SALES_AREA_SET.block_enum()`, same as in `llm.py`.

---

### `backend/app/services/session_state.py` (MODIFIED — model/state, CRUD-init)

**Current construct being replaced** — module-level `COVERAGE_AREAS` list (lines 15-18):
```python
COVERAGE_AREAS = [
    "negocio", "eng_dados", "visualizacao", "ciencia_dados",
    "automacao", "integracao", "consumo", "parceria",
]
```
Replace with `from app.services.coverage_areas import SALES_AREA_SET` and use `SALES_AREA_SET.keys()` wherever `COVERAGE_AREAS` was referenced.

**Import to change** (line 10) — also update per D-02 relocation:
```python
from app.services.prompt_builder import AREAS_BY_PROJECT_TYPE
```
becomes:
```python
from app.services.coverage_areas import AREAS_BY_PROJECT_TYPE, SALES_AREA_SET
```

**Two-loop shape that MUST be preserved exactly (D-04 / Pitfall 2)** — only the source of the first loop's iterable changes; lines 29-32 (the `custom_areas` merge loop) must not be touched at all:
```python
def _init_coverage(
    project_type: str, custom_areas: "Optional[List[dict]]" = None
) -> "Dict[str, CoverageArea]":
    inactive = set(AREAS_BY_PROJECT_TYPE.get(project_type, {}).get("inactive", []))
    coverage = {
        a: CoverageArea(status="not_applicable") if a in inactive else CoverageArea()
        for a in COVERAGE_AREAS          # <-- ONLY this becomes SALES_AREA_SET.keys()
    }
    for area in custom_areas or []:      # <-- DO NOT TOUCH (D-04)
        key = area.get("key")
        if key:
            coverage[key] = CoverageArea(name=area.get("name", ""))
    return coverage
```

---

### `backend/app/services/structured_context.py` (MODIFIED — in-scope per RESEARCH.md Open Question 1 recommendation)

**Current construct being replaced** — space-`|`-separated block list embedded in the extractor system prompt (lines 220-221):
```python
"Para \"recommended_questions\", use apenas os blocos:\n"
"  negocio | eng_dados | visualizacao | ciencia_dados | automacao | integracao | consumo | parceria\n"
```
Per RESEARCH.md's recommendation, wire to `" | ".join(SALES_AREA_SET.keys())` and add a direct equality assertion in the golden test against the frozen literal above. If time-boxed out of this phase, the plan must explicitly log this as deferred debt (distinct from D-05's frontend debt) rather than silently skip it — do not remove this file from PATTERNS.md's classification either way.

---

### `backend/app/services/pipeline.py` (touch only if planner decides the default fallback should also read from the registry)

**Current construct** (lines 325, 452) — a hardcoded default string, not a duplicated list:
```python
block=q_data.get("block", "negocio"),
```
This is a single literal `"negocio"` used as a dict-lookup default, not an enumeration of all 8 areas — RESEARCH.md classifies this as a "default-value fallback, not a list" (Open Questions / Common Pitfall 4 context). Optional low-risk change: `SALES_AREA_SET.keys()[0]` if the planner wants full consistency, but this is NOT required by D-01/D-02/D-03 and is not one of the 3 canonical files — treat as out-of-scope unless the planner explicitly decides otherwise.

## Shared Patterns

### Byte-identical literal reproduction (D-03 — applies to `coverage_areas.py`, `llm.py`, `prompt_builder.py`, `structured_context.py`)
**Source:** RESEARCH.md "Code Examples" section (already extracted verbatim with line numbers)
**Apply to:** every call site that currently hand-writes the JSON-schema string, `area_labels` dict, or block-enum string
```python
# Anti-pattern (DO NOT DO): 
# json.dumps({"areas": {...}})  -> produces "score": "0-100" or fails; not valid JSON, it's prompt text.
# Correct: string-template concatenation, exactly as today, driven by SALES_AREA_SET's ordered tuple.
```

### Leaf-module import discipline (Pitfall 3 — applies to `coverage_areas.py` only)
**Source:** `session_state.py:10` (`from app.services.prompt_builder import AREAS_BY_PROJECT_TYPE` — the existing import chain that must not become circular)
**Apply to:** `coverage_areas.py` must have zero imports from `app.services.session_state`, `app.services.prompt_builder`, or `app.services.llm` — stdlib (`dataclasses`) only.

### Two-loop coverage-init shape (D-04 — applies to `session_state.py` only)
**Source:** `session_state.py:21-33` (`_init_coverage`)
**Apply to:** the single line changing the standard-key source; the `custom_areas` overlay loop is frozen and must appear unchanged in every diff touching this function.

### Pure network-free unit test structure (applies to the new golden test file)
**Source:** `backend/tests/test_report_cost.py` (direct-call, `pytest.approx`) + `backend/tests/test_expire_questions.py` (monkeypatch fake for network-adjacent paths)
**Apply to:** `test_coverage_areas_golden.py` — direct calls for `AreaSet` methods and `PromptBuilder.build_*()`, monkeypatch pattern only for the two functions (`classify_coverage`, `generate_questions`) whose fallback literals are only reachable via an async Gemini call.

## No Analog Found

None — every file in this phase's scope has a strong (exact or role-match) analog already read and quoted above.

## Metadata

**Analog search scope:** `backend/app/services/`, `backend/tests/`
**Files scanned:** `llm.py`, `prompt_builder.py`, `session_state.py`, `structured_context.py`, `pipeline.py`, `pricing_export_service.py` (excluded, confirmed false positive), `test_report_cost.py`, `test_expire_questions.py`, `conftest.py`, `pytest.ini`
**All analog paths verified git-tracked** via `git ls-files` (see tracked-source gate) — no gitignored mirrors involved; this is a pure internal backend refactor with no plugin/capability sync surface.
**Pattern extraction date:** 2026-09-20
