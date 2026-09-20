---
phase: 01-area-set-registry
reviewed: 2026-09-20T18:16:42Z
depth: standard
files_reviewed: 9
files_reviewed_list:
  - backend/app/services/coverage_areas.py
  - backend/app/services/llm.py
  - backend/app/services/prompt_builder.py
  - backend/app/services/session_state.py
  - backend/app/services/structured_context.py
  - backend/tests/fixtures/coverage_classifier_bi_dms_none.txt
  - backend/tests/fixtures/question_planner_bi_dms_none.txt
  - backend/tests/test_coverage_areas_golden.py
  - backend/tests/test_session_state_custom_areas.py
findings:
  critical: 0
  warning: 2
  info: 3
  total: 5
status: issues_found
---

# Phase 01: Code Review Report

**Reviewed:** 2026-09-20T18:16:42Z
**Depth:** standard
**Files Reviewed:** 9
**Status:** issues_found

## Summary

Reviewed the Area-Set Registry refactor (`coverage_areas.py`) and its four rewired
consumers (`llm.py`, `prompt_builder.py`, `session_state.py`, `structured_context.py`),
plus the golden-fixture tests that pin the "byte-identical prompt output" invariant.

Verification performed beyond reading:
- Ran `pytest tests/test_coverage_areas_golden.py tests/test_session_state_custom_areas.py`
  — 17/17 pass, confirming `schema_json(include_not_applicable=…)` for both the
  `False` (classify_coverage) and `True` (build_coverage_classifier) cases, `block_enum()`,
  `labels()`, `keys()` order, and the non-f-string `_EXTRACTOR_SYSTEM` concatenation all
  reproduce the pre-refactor literals exactly.
- Ran the full backend suite (`pytest tests/`) — 29 passed / 4 skipped, 1 failed
  (`test_schema.py::test_tables_exist`, a live-Supabase connectivity test unrelated to
  this phase's files — pre-existing, not caused by this diff).
- Imported all five touched modules directly to confirm no circular-import regression
  from the new `app.services.coverage_areas` leaf module.
- Grepped the whole backend for lingering references to the removed
  `prompt_builder.AREAS_BY_PROJECT_TYPE` definition site and the removed
  `session_state.COVERAGE_AREAS` list — none found; all consumers correctly import
  from `coverage_areas.py` now.
- Smoke-ran `PromptBuilder.build_all()` across every `project_type` × `dms` combination
  (including unmapped/empty `project_type`) — no exceptions.

The refactor holds up as advertised: it is a genuine zero-behavior-change extraction, the
byte-identical invariant is enforced by tests (not just asserted in comments), and no
consumer was left dangling. The issues below are real but scoped to (a) one spot where the
stated goal of the phase — eliminating duplicated area lists — was not fully achieved, and
(b) a couple of pre-existing robustness gaps that are now more visible because this phase
made the "single source of truth" claim explicit.

## Warnings

### WR-01: `generate_custom_areas` still hardcodes the 8 area names in prose, defeating the registry's purpose

**File:** `backend/app/services/llm.py:218-222`
**Issue:** The phase's stated goal (per `coverage_areas.py`'s own docstring) is that the 8
sales areas are duplicated "em varios arquivos (llm.py, prompt_builder.py,
session_state.py)" and should now have one source of truth. That goal was achieved for the
JSON schema, block enum, and label dict — but `generate_custom_areas`'s system prompt
still spells the same 8 areas out as free Portuguese text, independent of
`SALES_AREA_SET`:
```python
system = (
    "Você define áreas de risco/cobertura ESPECÍFICAS para um projeto de dados/tecnologia, "
    "que serão monitoradas durante a reunião de diagnóstico.\n"
    "As áreas PADRÃO (negócio, eng. de dados, visualização, ciência de dados, automação, "
    "integração, consumo, parceria) JÁ existem — NÃO as repita.\n"
    ...
```
If a label is ever renamed, or a 9th standard area is added to `SALES_AREA_SET`, this
prompt silently falls out of sync — the LLM would no longer know the new/renamed area is
"already standard" and could regenerate it as a spurious `custom_*` duplicate. No golden
test covers this string (the golden suite only pins `classify_coverage`, `build_coverage_classifier`,
`generate_questions`/`build_question_planner`, and `_EXTRACTOR_SYSTEM`), so this drift would
ship silently.
**Fix:**
```python
_standard_areas_prose = ", ".join(SALES_AREA_SET.labels().values()).lower()
system = (
    "Você define áreas de risco/cobertura ESPECÍFICAS para um projeto de dados/tecnologia, "
    "que serão monitoradas durante a reunião de diagnóstico.\n"
    f"As áreas PADRÃO ({_standard_areas_prose}) JÁ existem — NÃO as repita.\n"
    ...
```

### WR-02: `_init_coverage`'s custom-area loop can silently erase a `not_applicable` marking with no guard

**File:** `backend/app/services/session_state.py:16-28`
**Issue:** The function builds the base coverage dict (marking inactive areas as
`not_applicable` per `AREAS_BY_PROJECT_TYPE`), then does an unguarded full overwrite for
each `custom_areas` entry:
```python
coverage = {
    a: CoverageArea(status="not_applicable") if a in inactive else CoverageArea()
    for a in SALES_AREA_SET.keys()
}
for area in custom_areas or []:
    key = area.get("key")
    if key:
        coverage[key] = CoverageArea(name=area.get("name", ""))
```
`test_init_coverage_custom_area_overwrites_standard_key` confirms this is intentional,
pre-existing, dormant behavior that this phase correctly preserved byte-for-byte — so this
is not a regression introduced here. But it is a real latent correctness gap that this
phase's own docstring/tests now make explicit and worth flagging: the only thing currently
preventing a `custom_areas` entry from colliding with (and silently re-activating) a
standard area that was deliberately marked `not_applicable` for that `project_type` is a
convention enforced two call-levels away, in `llm.generate_custom_areas`, which prefixes
generated keys with `custom_`:
```python
areas.append({"key": f"custom_{key}"[:40], "name": name[:60]})
```
`_init_coverage` itself has no defense if `custom_areas` is ever populated by any other
path (a future admin-authored custom area, a different LLM call, a data-migration script)
without that prefix convention. A colliding key would silently discard the
`not_applicable` status and the area would be evaluated by the classifier as if it were
newly reactivated, with no error or log to signal it.
**Fix:** Guard the merge instead of a blind overwrite — either reject/namespace collisions
explicitly, or merge fields onto the existing entry instead of replacing it wholesale:
```python
for area in custom_areas or []:
    key = area.get("key")
    if not key:
        continue
    if key in SALES_AREA_SET.keys():
        raise ValueError(f"custom_areas key '{key}' collides with a standard area key")
    coverage[key] = CoverageArea(name=area.get("name", ""))
```

## Info

### IN-01: `AreaSet`/`AreaDefinition` have no invariant checks against duplicate `key`/`order`

**File:** `backend/app/services/coverage_areas.py:23-53`
**Issue:** Nothing prevents two `AreaDefinition`s in the same `AreaSet` from sharing a
`key` (which would make `labels()` silently drop one) or an `order` (which would make
`_ordered()` fall back to insertion order via Python's stable sort, silently). Since
`SALES_AREA_SET` is 8 lines of hand-written literal data, a future copy-paste edit (e.g.
duplicating a line and forgetting to bump `order`) would not raise — it would just quietly
shift ordering or drop a label, only caught if someone happens to update the golden
fixtures in lockstep (and even then only if the specific broken area is exercised).
**Fix:** Add a cheap `__post_init__` assertion on `AreaSet`:
```python
def __post_init__(self) -> None:
    keys = [a.key for a in self.areas]
    if len(keys) != len(set(keys)):
        raise ValueError(f"duplicate area key in AreaSet '{self.name}': {keys}")
    orders = [a.order for a in self.areas]
    if len(orders) != len(set(orders)):
        raise ValueError(f"duplicate order value in AreaSet '{self.name}': {orders}")
```

### IN-02: `AreaSet.name` is defined but never read anywhere

**File:** `backend/app/services/coverage_areas.py:31-33`
**Issue:** `AreaSet.name` (`"sales"`) is set on `SALES_AREA_SET` but no consumer reads it
(`grep -rn "\.name" app/services/coverage_areas.py` and its call sites confirm only
`.keys()`, `.labels()`, `.schema_json()`, `.block_enum()` are ever called). It's harmless
today but is unused surface area in a module whose own docstring emphasizes being a
minimal "leaf" — worth either using it (e.g. in error messages, per IN-01's suggested
fix) or dropping it until a second `AreaSet` instance actually needs to be distinguished
by name.
**Fix:** Either wire it into error/debug messages (see IN-01) or remove it until a second
`AreaSet` is introduced.

### IN-03: `SALES_AREA_SET._ordered()` re-sorts on every call, with no caching on an already-frozen/immutable object

**File:** `backend/app/services/coverage_areas.py:35-36`
**Issue:** `keys()`, `labels()`, `schema_json()`, and `block_enum()` each independently
call `self._ordered()`, which re-sorts the 8-tuple from scratch every time. This is called
freshly for essentially every prompt build in every session tick. Not flagged as a
performance BLOCKER (out of scope per review policy and the tuple is tiny), but noting it
because the type is `@dataclass(frozen=True)` — the sorted order is invariant for the
object's lifetime, so this is a natural candidate for `functools.cached_property` or a
precomputed field, purely for maintainability/clarity rather than speed.
**Fix (optional, low priority):**
```python
@dataclass(frozen=True)
class AreaSet:
    name: str
    areas: tuple[AreaDefinition, ...]
    _ordered_cache: tuple[AreaDefinition, ...] = field(init=False, repr=False)

    def __post_init__(self) -> None:
        object.__setattr__(self, "_ordered_cache", tuple(sorted(self.areas, key=lambda a: a.order)))

    def _ordered(self) -> tuple[AreaDefinition, ...]:
        return self._ordered_cache
```

---

_Reviewed: 2026-09-20T18:16:42Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
