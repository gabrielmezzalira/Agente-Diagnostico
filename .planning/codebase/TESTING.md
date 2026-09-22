---
last_mapped_commit: dd6d5da918c8145005ced2b3c76ba98fa6d32aa2
last_mapped_at: 2026-09-19
---
# Testing Patterns

<!-- refreshed: 2026-09-19 -->

**Analysis Date:** 2026-09-19

## Test Framework

**Runner (Python backend):**

- `pytest>=8.0.0` — configured in `backend/pytest.ini`
- `pytest-asyncio>=0.23.0` — async test support
- Config: `backend/pytest.ini` with `asyncio_mode = auto`
- Test directory: `backend/tests/`

**Assertion library:**

- Pytest's built-in `assert` statements
- `pytest.approx()` for floating-point comparisons (seen in `test_report_cost.py`)

**Run commands:**

```bash

# From backend/ directory:

pytest                    # Run all tests in backend/tests/
pytest tests/test_schema.py -v    # Run specific file with verbose output
pytest -k "test_estimate"         # Run tests matching name pattern
pytest --tb=short                 # Show short traceback format
```

**Frontend:**

- `vitest>=4.1.7` configured in `package.json` but no test files present
- Testing libraries installed: `@testing-library/react`, `@testing-library/jest-dom`, `@testing-library/user-event`
- No test scripts configured in package.json
- **Coverage gap:** No frontend tests found in codebase

**Extension:**

- No test framework configured
- **Coverage gap:** No extension tests found

## Test File Organization

**Location (Python):**

- Co-located in `backend/tests/` directory separate from source
- Pattern: `test_<feature>.py` maps to feature or requirements doc
- Examples:
  - `test_projects.py` — Project CRUD (stubs from PROJ-01 to PROJ-04)
  - `test_schema.py` — Supabase schema validation
  - `test_report_cost.py` — Budget calculation precision
  - `test_expire_questions.py` — Question TTL expiration
  - `test_finish_stops_pipeline.py` — Session lifecycle

**Naming:**

- Test functions: `test_<behavior_description>` (snake_case)
- Example: `test_tables_exist`, `test_estimated_report_cost_reflects_report_max_tokens`
- Each test name is a descriptive statement of what is verified

**Structure:**

```
backend/
├── app/                    # Source code
├── tests/
│   ├── __init__.py
│   ├── conftest.py        # Shared fixtures
│   ├── test_projects.py
│   ├── test_schema.py
│   ├── test_report_cost.py
│   └── test_expire_questions.py
└── pytest.ini              # Configuration
```

## Test Structure

**Suite organization (Python):**

- No `class`-based test suites; all tests are module-level functions
- Grouping done by filename and comments
- Example from `test_expire_questions.py`:
  ```python
  def _install_fake_db(monkeypatch) -> dict:
      """Helper to set up fake database for isolation."""
      calls: dict = {}
      monkeypatch.setattr(pipeline_mod, "get_supabase", lambda: _FakeDB(calls))
      return calls
  
  def test_expires_only_due_queued_questions(monkeypatch):
      """Test description as docstring."""
      # Setup
      calls = _install_fake_db(monkeypatch)
      state = SessionState(session_id="s")
      state.questions = [...]
      
      # Execute
      pipe = SessionPipeline(state)
      expired = pipe._expire_due_questions(_NOW)
      
      # Assert
      assert expired == ["q1"]
  ```

**Patterns:**

- **Setup:** Fixtures provided via function parameters (pytest dependency injection)
- **Teardown:** Fixture cleanup via `yield` in conftest (see `cleanup_test_project` fixture)
- **Assertion:** Direct `assert` statements with comparison operators

**Example assertion patterns:**

```python

# Exact match

assert found_tables == EXPECTED_TABLES

# Approximate floating-point

assert cost == pytest.approx(expected)

# Membership

assert set(expired) == {"q1", "q2"}

# Negation

assert "executed" not in calls  # Verify no DB write occurred

# Multiple assertions in one test

assert state.questions[0].status == "dismissed"
assert state.questions[1].status == "queued"
assert state.questions[2].status == "pinned"
```

## Mocking

**Framework:** 

- `monkeypatch` fixture from pytest (not `unittest.mock`)
- Custom fake objects for database isolation

**Patterns:**

**Dependency injection via monkeypatch:**

```python
def _FakeDB:
    def table(self, name):
        self._calls["table"] = name
        return _FakeQuery(self._calls)

def _install_fake_db(monkeypatch) -> dict:
    calls: dict = {}
    monkeypatch.setattr(pipeline_mod, "get_supabase", lambda: _FakeDB(calls))
    return calls
```

Example test (from `test_expire_questions.py`):

```python
def test_persists_expiration_in_batch(monkeypatch):
    calls = _install_fake_db(monkeypatch)
    state = SessionState(session_id="s")
    state.questions = [_q("q1", "queued", _PAST), _q("q2", "queued", _PAST)]
    pipe = SessionPipeline(state)
    
    expired = pipe._expire_due_questions(_NOW)
    
    # Verify in-memory state changed
    assert set(expired) == {"q1", "q2"}
    # Verify database call was made with correct parameters
    assert calls["table"] == "questions"
    assert calls["payload"] == {"status": "dismissed"}
    assert calls["in_"] == ("id", ["q1", "q2"])
    assert calls["executed"] is True
```

**What to mock:**

- External dependencies: database client, LLM API client, Supabase connection
- File I/O: if testing report generation
- Time-sensitive logic: use fixed datetime for reproducibility

**What NOT to mock:**

- Core business logic (pricing calculator, question planner)
- Pydantic schema validation (test the actual schema)
- Pure functions (hash, format, etc.)

## Fixtures and Factories

**Test data setup (Python):**

**Shared fixture from conftest.py:**

```python
@pytest.fixture(scope="session")
def supabase_client():
    """Retorna o cliente Supabase singleton para os testes.
    
    Scope 'session' significa que o cliente é criado uma vez por run de testes.
    """
    from app.database import get_supabase
    return get_supabase()

@pytest.fixture
def cleanup_test_project(supabase_client):
    """Fixture que limpa projetos criados durante os testes.
    
    Uso:
        def test_algo(cleanup_test_project):
            project_id = criar_projeto(...)
            cleanup_test_project(project_id)
    """
    created_ids: list[str] = []
    
    def register(project_id: str) -> None:
        created_ids.append(project_id)
    
    yield register
    
    # Teardown: deleta todos os projetos registrados
    for pid in created_ids:
        try:
            supabase_client.table("projects").delete().eq("id", pid).execute()
        except Exception:
            pass  # Best-effort cleanup
```

**Test-local helpers (inline):**

```python
_PAST = "2000-01-01T00:00:00+00:00"
_FUTURE = "2999-01-01T00:00:00+00:00"
_NOW = datetime(2025, 1, 1, tzinfo=timezone.utc)

def _q(qid: str, status: str, expires_at: str) -> Question:
    return Question(
        id=qid, text="", block="", source="auto",
        status=status, generated_at="", expires_at=expires_at,
    )
```

**Location:**

- Shared fixtures in `backend/tests/conftest.py`
- Test-local factories defined inline in test module (prefixed with `_`)
- No factory library (factory_boy) used; tests prefer explicit setup

## Coverage

**Requirements:** 

- No explicit coverage target enforced
- CLAUDE.md tasks mandate leaving "at least 1 test real as seed" after refactoring

**View coverage:**

```bash

# Generate HTML report (requires pytest-cov plugin — not in requirements.txt)

pytest --cov=app --cov-report=html

# View in browser: htmlcov/index.html

```

**Current status:**

- Backend: 5 test files covering core features (projects, schema, budget, expiration, pipeline)
- Frontend: No tests found (coverage gap — packages installed but unused)
- Extension: No tests found (coverage gap)

## Test Types

**Unit tests:**

- Scope: Single function or class method in isolation
- Dependencies: Mocked (database, time, random)
- Example: `test_estimated_report_cost_reflects_report_max_tokens` — pure calculation with fixed inputs
- Fast execution (<100ms per test)
- Techniques:
  - Monkeypatch for dependency injection
  - Inline mock objects (Fake*) for stateful dependencies
  - Fixed datetime for reproducibility

**Integration tests:**

- Scope: Multiple components together + real Supabase connection
- Dependencies: Require `.env` with `SUPABASE_URL` and `SUPABASE_KEY`
- Example: `test_tables_exist` — verifies schema in actual database
- Slower execution (1-5s per test due to network)
- Cleanup via fixtures (`cleanup_test_project`)
- Note: These tests may fail in CI if Supabase not available; tagged with comments indicating environment requirements

**E2E tests:**

- Framework: Not present in codebase
- Coverage gap: No end-to-end tests for HTTP endpoints or WebSocket flows

## Common Patterns

**Async testing (Python):**

```python

# pytest-asyncio handles async tests automatically (asyncio_mode = auto in pytest.ini)

# Just mark with pytest.mark.asyncio if needed (implicit with current config)

# Example (if present):

@pytest.mark.asyncio
async def test_async_operation():
    result = await some_async_function()
    assert result == expected
```

**Error testing:**

From `test_api_key_not_exposed`:

```python
def test_api_key_not_exposed():
    """Verifica que gemini_api_key nunca aparece em texto plano na resposta."""
    # Setup
    response = api.projects.get(project_id)
    
    # Assert presence of boolean flag, absence of key
    assert "has_api_key" in response
    assert "gemini_api_key" not in response
    assert "gemini_api_key_secret_id" not in response
```

From `test_db_failure_does_not_raise` (robustness):

```python
def test_db_failure_does_not_raise(monkeypatch):
    """Falha de persistência é logada, não propagada."""
    class _BoomDB:
        def table(self, name):
            raise RuntimeError("supabase down")
    
    monkeypatch.setattr(pipeline_mod, "get_supabase", lambda: _BoomDB())
    state = SessionState(session_id="s")
    state.questions = [_q("q1", "queued", _PAST)]
    pipe = SessionPipeline(state)
    
    # Não deve levantar; a transição em memória já aconteceu.
    expired = pipe._expire_due_questions(_NOW)
    assert expired == ["q1"]
    assert state.questions[0].status == "dismissed"
```

**Regression guards:**

From `test_estimated_report_cost_is_higher_than_old_flawed_estimate`:

```python
def test_estimated_report_cost_is_higher_than_old_flawed_estimate():
    """Guarda de regressão: a nova estimativa é bem maior que a antiga."""
    state = SessionState(session_id="t")
    
    old_flawed = (
        (2000 / 1000) * INPUT_COST_PER_1K + (2500 / 1000) * OUTPUT_COST_PER_1K
    )
    # Exigir ao menos 2x evita que alguém reintroduza um valor pequeno sem quebrar o teste
    assert state.estimated_report_cost() > old_flawed * 2
```

## Testing Recommendations

**What needs coverage:**

| Area | Status | Priority |
|------|--------|----------|
| Backend unit tests | 5 files, core features covered | Maintain + extend |
| Backend integration tests | Basic schema test | Add HTTP endpoint tests |
| Frontend component tests | None | High — components exist but untested |
| Frontend hook tests | None | High — state management untested |
| Extension unit tests | None | Medium — popup/background logic untestable without Chrome runtime |
| E2E tests | None | Medium — WebSocket + session flow untested |

**Coverage gaps to address:**

1. **Frontend (HIGH):** Add tests for `usePricing`, `usePricingChat`, `useSessionWS` hooks using Vitest + Testing Library
2. **Backend API (MEDIUM):** Add integration tests for HTTP endpoints (POST /projects, POST /sessions, etc.)
3. **Backend services (MEDIUM):** Add tests for `PricingService.get_pricing()`, `LLMService` methods
4. **Regression suite (LOW):** Build test for "question TTL expiration does not affect pinned questions" across full pipeline

**Test-first pattern from CLAUDE.md:**

- Each task should "leave at least 1 test real as seed" — implies tests should be written alongside features
- Stubs in `test_projects.py` (PROJ-01 through PROJ-04) indicate planned testing for future phases

---

*Testing analysis: 2026-09-19*
