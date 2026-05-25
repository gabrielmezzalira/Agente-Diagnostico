---
phase: "01-project-configuration-supabase-schema"
plan: "01a"
type: execute
wave: 1
depends_on: []
files_modified:
  - backend/app/__init__.py
  - backend/app/main.py
  - backend/app/config.py
  - backend/app/database.py
  - backend/requirements.txt
  - backend/pytest.ini
  - backend/tests/__init__.py
  - backend/tests/conftest.py
  - backend/tests/test_schema.py
  - backend/tests/test_projects.py
  - supabase/migrations/20260524000000_initial_schema.sql
autonomous: false
requirements:
  - PROJ-05

must_haves:
  truths:
    - "Backend starts with `uvicorn app.main:app --reload` and GET /health returns 200"
    - "All 9 Supabase tables exist and accept inserts"
    - "vault.create_secret() works — Vault extension is active on the Supabase project"
  artifacts:
    - path: "supabase/migrations/20260524000000_initial_schema.sql"
      provides: "All 9 table definitions + Vault column"
      contains: "gemini_api_key_secret_id uuid"
    - path: "backend/app/main.py"
      provides: "FastAPI app entry point with CORS"
      exports: ["app"]
    - path: "backend/app/database.py"
      provides: "Supabase singleton client"
      exports: ["get_supabase"]
    - path: "backend/app/config.py"
      provides: "Frozen AppConfig dataclass"
      exports: ["load_config", "AppConfig"]
    - path: "backend/tests/test_schema.py"
      provides: "Table existence smoke test"
      contains: "test_tables_exist"
  key_links:
    - from: "backend/app/database.py"
      to: "supabase.create_client"
      via: "get_supabase() singleton initializer"
      pattern: "create_client"

user_setup:
  - service: supabase
    why: "Database for all project and session data"
    env_vars:
      - name: SUPABASE_URL
        source: "Supabase Dashboard → Project Settings → API → Project URL"
      - name: SUPABASE_KEY
        source: "Supabase Dashboard → Project Settings → API → service_role key (secret)"
    dashboard_config:
      - task: "Create a new Supabase project at https://supabase.com"
        location: "Supabase Dashboard → New Project"
      - task: "Verify Vault extension is enabled"
        location: "Supabase Dashboard → Database → Extensions → search 'supabase_vault' → Enable if not active"
      - task: "Apply migration SQL"
        location: "Option A: run `npm install -g supabase && supabase db push` from project root. Option B: Supabase Dashboard → SQL Editor → paste supabase/migrations/20260524000000_initial_schema.sql → Run"
---

<objective>
Scaffold the backend directory structure (FastAPI app, config, database singleton), test infrastructure (pytest stubs), and the Supabase migration SQL for all 9 tables. A [BLOCKING] human checkpoint gates the schema application before any API tests can run.

Purpose: Establish the backend foundation and live schema. Plan 01b (frontend scaffold) runs in parallel with this plan — both are Wave 1 and touch separate directories. Plans 02 and 03 depend on both being complete.

Output:
- /backend/ with FastAPI app, config, database singleton, requirements.txt, pytest setup, test stubs
- /supabase/migrations/20260524000000_initial_schema.sql with all 9 tables
- [BLOCKING] Migration applied to Supabase — all 9 tables live
</objective>

<execution_context>
@/Users/gabrielmezzalira/Documents/Faculdade/CIti/DataInsight/Agente Diagnotico/.planning/phases/01-project-configuration-supabase-schema/01-RESEARCH.md
@/Users/gabrielmezzalira/Documents/Faculdade/CIti/DataInsight/Agente Diagnotico/.planning/phases/01-project-configuration-supabase-schema/01-PATTERNS.md
@/Users/gabrielmezzalira/Documents/Faculdade/CIti/DataInsight/Agente Diagnotico/.planning/phases/01-project-configuration-supabase-schema/01-UI-SPEC.md
</execution_context>

<context>
@/Users/gabrielmezzalira/Documents/Faculdade/CIti/DataInsight/Agente Diagnotico/.planning/ROADMAP.md
@/Users/gabrielmezzalira/Documents/Faculdade/CIti/DataInsight/Agente Diagnotico/.planning/phases/01-project-configuration-supabase-schema/01-CONTEXT.md

<interfaces>
<!-- Key patterns extracted from v1 codebase for executor reference -->

From diagnostico/config.py:
```python
# Frozen dataclass + load_dotenv + early ValueError pattern
@dataclass(frozen=True)
class Config:
    gemini_api_key: str
    model_name: str

def load_config() -> Config:
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        raise ValueError("GEMINI_API_KEY environment variable not set...")
    return Config(gemini_api_key=api_key, model_name=os.environ.get("GEMINI_MODEL", "gemini-2.0-flash"))
```

New backend/app/config.py must follow same pattern with `supabase_url` and `supabase_key` fields.

Supabase Vault column: The CLAUDE.md SDD says `gemini_api_key text (encrypted)` — the ACTUAL column name is `gemini_api_key_secret_id uuid` (NOT gemini_api_key text). This is non-negotiable per security context.
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Backend scaffold — directory structure, FastAPI app, config, database singleton, requirements, pytest</name>
  <files>
    backend/app/__init__.py,
    backend/app/main.py,
    backend/app/config.py,
    backend/app/database.py,
    backend/requirements.txt,
    backend/pytest.ini,
    backend/tests/__init__.py,
    backend/tests/conftest.py,
    backend/tests/test_schema.py,
    backend/tests/test_projects.py
  </files>
  <read_first>
    - /Users/gabrielmezzalira/Documents/Faculdade/CIti/DataInsight/Agente Diagnotico/.planning/phases/01-project-configuration-supabase-schema/01-PATTERNS.md (all patterns — config, database, main, router, test stubs)
    - /Users/gabrielmezzalira/Documents/Faculdade/CIti/DataInsight/Agente Diagnotico/diagnostico/config.py (v1 frozen dataclass pattern to copy)
    - /Users/gabrielmezzalira/Documents/Faculdade/CIti/DataInsight/Agente Diagnotico/.planning/phases/01-project-configuration-supabase-schema/01-RESEARCH.md (Pattern 5: Supabase singleton, Pattern 6: AppConfig, Pattern 7: StaticFiles)
    - /Users/gabrielmezzalira/Documents/Faculdade/CIti/DataInsight/Agente Diagnotico/.planning/phases/01-project-configuration-supabase-schema/01-VALIDATION.md (test stubs required — Wave 0 gaps section)
  </read_first>
  <behavior>
    - backend/app/config.py: AppConfig frozen dataclass with `supabase_url: str` and `supabase_key: str`; load_config() raises ValueError early if either is missing
    - backend/app/database.py: module-level `_supabase: Client | None = None`; get_supabase() initializes via create_client(url, key) once and caches; raises RuntimeError if env vars missing
    - backend/app/main.py: FastAPI app with CORSMiddleware allowing localhost:5173; StaticFiles mount for /frontend/dist if it exists; GET /health endpoint returning {"status": "ok"}. Does NOT include_router for projects yet — Plan 02 adds it.
    - backend/tests/conftest.py: pytest fixture `supabase_client` that calls get_supabase(); fixture `cleanup_test_project` that deletes rows created during tests
    - backend/tests/test_schema.py: test_tables_exist asserts all 9 table names are present by querying Supabase information_schema.tables
    - backend/tests/test_projects.py: stub functions test_create_project, test_edit_project, test_active_session_badge, test_api_key_not_exposed — each raises pytest.skip("stub — implement in Plan 02") so the suite passes but marks as skipped
  </behavior>
  <action>
    Create the /backend/ directory tree. Use `pip install` commands below to set up the venv. Do NOT modify anything in /diagnostico/.

    Directory structure to create:
    ```
    backend/
      app/
        __init__.py          (empty)
        main.py              (FastAPI app entry)
        config.py            (AppConfig frozen dataclass)
        database.py          (Supabase singleton)
        models/
          __init__.py        (empty)
        routers/
          __init__.py        (empty)
      requirements.txt
      pytest.ini
      tests/
        __init__.py          (empty)
        conftest.py          (fixtures)
        test_schema.py       (9-table smoke test)
        test_projects.py     (stubs for PROJ-01..04)
    ```

    backend/requirements.txt contents (exact versions per RESEARCH.md):
    ```
    fastapi>=0.136.3
    uvicorn>=0.48.0
    supabase>=2.30.0
    pydantic>=2.13.4
    python-dotenv>=1.0.0
    pytest>=9.0.3
    httpx>=0.27.0
    ```

    backend/pytest.ini contents:
    ```
    [pytest]
    testpaths = tests
    asyncio_mode = auto
    ```

    backend/app/config.py: copy frozen dataclass pattern from diagnostico/config.py. New fields: `supabase_url: str`, `supabase_key: str`. load_config() calls load_dotenv() then os.environ.get("SUPABASE_URL") and os.environ.get("SUPABASE_KEY"); raises ValueError with clear message if either is missing.

    backend/app/database.py: module-level `_supabase: Client | None = None`. `get_supabase() -> Client`: if _supabase is None, read SUPABASE_URL and SUPABASE_KEY from os.environ, call `create_client(url, key)`, assign to _supabase. Return _supabase. Raises RuntimeError("SUPABASE_URL and SUPABASE_KEY must be set") if either is absent.

    backend/app/main.py: Create FastAPI(title="Agente Diagnóstico v2.0"). Add CORSMiddleware: allow_origins=["http://localhost:5173"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"]. StaticFiles mount: check if Path(__file__).parent.parent.parent / "frontend" / "dist" exists; if yes, mount at "/". Do NOT include projects router yet (Plan 02 adds it). Include a GET /health endpoint returning {"status": "ok"} so the frontend can verify connectivity.

    backend/tests/test_schema.py: Import get_supabase. test_tables_exist() queries `information_schema.tables` where table_schema='public' and table_name IN ('projects', 'sessions', 'questions', 'red_flags', 'coverage_snapshots', 'reports', 'question_bank', 'session_prompts', 'transcript_chunks'). Assert len(result) == 9.

    backend/tests/test_projects.py: Four stub functions — test_create_project, test_edit_project, test_active_session_badge, test_api_key_not_exposed — each calls `pytest.skip("stub — implement in Plan 02")`.

    After creating files, set up venv and install:
    ```bash
    cd backend
    python3 -m venv .venv
    source .venv/bin/activate
    pip install -r requirements.txt
    ```

    Also add `backend/.env` to the root .gitignore immediately (T-01-key-env mitigation).
  </action>
  <verify>
    <automated>cd /Users/gabrielmezzalira/Documents/Faculdade/CIti/DataInsight/Agente\ Diagnotico/backend && source .venv/bin/activate && python -c "from app.main import app; print('app ok')" && pytest tests/ --collect-only -q 2>&1 | tail -5</automated>
  </verify>
  <acceptance_criteria>
    - backend/app/main.py exists and `from app.main import app` succeeds
    - backend/app/config.py contains `class AppConfig` with `supabase_url: str` and `supabase_key: str`
    - backend/app/database.py contains `def get_supabase()` that returns a `Client`
    - backend/requirements.txt lists fastapi, uvicorn, supabase, pydantic, python-dotenv, pytest, httpx
    - backend/tests/test_projects.py contains `test_create_project`, `test_edit_project`, `test_active_session_badge`, `test_api_key_not_exposed`
    - backend/tests/test_schema.py contains `test_tables_exist`
    - `python -c "from app.main import app"` exits 0
    - `pytest tests/ --collect-only -q` discovers all test stubs without syntax errors
    - /diagnostico/ directory has zero modified files (git diff --name-only shows no /diagnostico/ changes)
    - backend/.env is in root .gitignore
  </acceptance_criteria>
  <done>Backend scaffold exists. FastAPI app imports cleanly. Pytest stubs are discoverable. v1 /diagnostico/ is untouched.</done>
</task>

<task type="auto">
  <name>Task 2: Supabase migration SQL — all 9 tables with Vault column</name>
  <files>
    supabase/migrations/20260524000000_initial_schema.sql
  </files>
  <read_first>
    - /Users/gabrielmezzalira/Documents/Faculdade/CIti/DataInsight/Agente Diagnotico/CLAUDE.md (Section 3 — schema for all 8 named tables)
    - /Users/gabrielmezzalira/Documents/Faculdade/CIti/DataInsight/Agente Diagnotico/.planning/phases/01-project-configuration-supabase-schema/01-RESEARCH.md (Pattern 1: Vault UUID column, Pitfall 3: UUID vs text column, transcript_chunks inferred schema in Assumptions A4)
    - /Users/gabrielmezzalira/Documents/Faculdade/CIti/DataInsight/Agente Diagnotico/.planning/phases/01-project-configuration-supabase-schema/01-CONTEXT.md (Supabase Schema section — confirms 9 tables)
  </read_first>
  <action>
    Create /supabase/migrations/20260524000000_initial_schema.sql with all 9 tables. Source of truth for column names and types is CLAUDE.md Section 3, with ONE critical deviation: `projects.gemini_api_key` becomes `gemini_api_key_secret_id uuid` (Vault reference, not text).

    Table order matters for FK references — create in this order:
    1. projects
    2. sessions (FK → projects)
    3. questions (FK → sessions)
    4. red_flags (FK → sessions)
    5. coverage_snapshots (FK → sessions)
    6. reports (FK → sessions)
    7. question_bank (no FK)
    8. session_prompts (FK → sessions)
    9. transcript_chunks (FK → sessions) — not in CLAUDE.md Section 3; use inferred schema: id uuid PK DEFAULT gen_random_uuid(), session_id uuid REFERENCES sessions(id) ON DELETE CASCADE, speaker text, text text NOT NULL, timestamp timestamptz DEFAULT now()

    projects table: all columns from CLAUDE.md Section 3 EXCEPT:
    - Remove `gemini_api_key text` column
    - Add `gemini_api_key_secret_id uuid` column (nullable — no FK constraint, Vault manages the reference)

    All uuid PK columns use `DEFAULT gen_random_uuid()`.
    All `created_at`/`updated_at`/`started_at`/`finished_at`/`generated_at`/`snapshot_at`/`detected_at`/`expires_at` columns use `timestamptz`.
    `question_bank.project_types` column is `text[]` (PostgreSQL array).
    `coverage_snapshots.coverage_json` is `jsonb`.

    Add at the end of the migration:
    ```sql
    -- Verify Vault is available (this will error if Vault extension is not enabled)
    -- The application uses vault.create_secret() at project creation time.
    -- Ensure the supabase_vault extension is enabled in your project before running this migration.
    -- Dashboard: Project Settings → Extensions → supabase_vault → Enable
    ```

    Do NOT include `vault.create_secret()` in the migration itself — Vault calls happen at application runtime (in the FastAPI router), not at schema init time.
  </action>
  <verify>
    <automated>grep -c "gemini_api_key_secret_id uuid" /Users/gabrielmezzalira/Documents/Faculdade/CIti/DataInsight/Agente\ Diagnotico/supabase/migrations/20260524000000_initial_schema.sql</automated>
  </verify>
  <acceptance_criteria>
    - File exists at supabase/migrations/20260524000000_initial_schema.sql
    - File contains exactly 9 CREATE TABLE statements (grep -c "CREATE TABLE" returns 9)
    - File contains `gemini_api_key_secret_id uuid` (NOT `gemini_api_key text`)
    - File does NOT contain `gemini_api_key text`
    - File contains `transcript_chunks` table with `session_id uuid REFERENCES sessions`
    - File contains `coverage_json jsonb` for coverage_snapshots
    - File contains `project_types text[]` for question_bank
    - All uuid PK columns use `DEFAULT gen_random_uuid()`
  </acceptance_criteria>
  <done>Migration SQL is written with all 9 tables, correct Vault UUID column, and transcript_chunks inferred schema. Ready to apply.</done>
</task>

<task type="checkpoint:human-action" gate="blocking">
  <name>Task 3: [BLOCKING] Human applies Supabase migration and configures environment</name>
  <what-built>
    Task 1 created the backend scaffold with test infrastructure. Task 2 wrote the complete migration SQL for all 9 tables. This task gates execution: the API cannot be tested until the schema is live in Supabase and backend/.env is set.
  </what-built>
  <how-to-verify>
    Perform these steps in order:

    STEP 1 — Create Supabase project (skip if already created):
      1. Go to https://supabase.com → New Project
      2. Note the Project URL and service_role key (Dashboard → Project Settings → API)

    STEP 2 — Enable Vault extension (skip if already enabled):
      1. Supabase Dashboard → Database → Extensions
      2. Search "supabase_vault" → click Enable
      3. Verify: run `SELECT * FROM vault.secrets LIMIT 1;` in Dashboard → SQL Editor. Should return empty set (not an error).

    STEP 3 — Apply migration (choose Option A or B):
      Option A (CLI — preferred):
        ```bash
        npm install -g supabase
        # From project root:
        supabase link --project-ref YOUR_PROJECT_REF
        supabase db push
        ```
      Option B (Dashboard):
        1. Supabase Dashboard → SQL Editor → New query
        2. Open file: supabase/migrations/20260524000000_initial_schema.sql
        3. Paste contents → Run

    STEP 4 — Verify 9 tables exist:
      In Supabase Dashboard → Table Editor, confirm these 9 tables appear:
      projects, sessions, questions, red_flags, coverage_snapshots, reports, question_bank, session_prompts, transcript_chunks

    STEP 5 — Create backend/.env:
      ```
      SUPABASE_URL=https://your-project.supabase.co
      SUPABASE_KEY=your-service-role-key
      ```
      (Put this file at: /project-root/backend/.env)

    STEP 6 — Verify backend can connect:
      ```bash
      cd backend
      source .venv/bin/activate
      pytest tests/test_schema.py::test_tables_exist -x -v
      ```
      Expected: 1 test PASSED (not skipped, not failed)
  </how-to-verify>
  <resume-signal>
    Type "schema applied" after test_tables_exist passes. Or describe any errors encountered.
  </resume-signal>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| env file → backend | SUPABASE_KEY loaded from backend/.env — must not be committed to git |
| backend → Supabase | Service role key in Authorization header; all Supabase access is server-side only |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-01-key-env | Information Disclosure | backend/.env | mitigate | Add `backend/.env` to root .gitignore immediately in Task 1. Service role key must never reach version control. |
| T-01-supabase-browser | Information Disclosure | frontend/src/lib/supabase.ts | mitigate | frontend/src/lib/supabase.ts is a placeholder — it is NOT called in Phase 1. All Supabase access goes through FastAPI. VITE_SUPABASE_ANON_KEY is never put in frontend .env in Phase 1. |
| T-01-cors | Tampering | backend/app/main.py CORSMiddleware | mitigate | CORSMiddleware in main.py allows only localhost:5173 in dev. Phase 1 is local deployment — no public exposure. |
| T-01-migration-sql | Tampering | supabase/migrations SQL | accept | Migration SQL contains no secrets. Applied once by developer. Low risk; local dev only. |
| T-01-SC | Tampering | npm install + pip install | mitigate | All packages verified in RESEARCH.md Package Legitimacy Audit (all Approved). No [ASSUMED] or [SUS] packages — no blocking checkpoint needed. |
</threat_model>

<verification>
After all 3 tasks complete:

1. Backend imports cleanly: `cd backend && source .venv/bin/activate && python -c "from app.main import app; print('ok')"` → "ok"
2. Backend starts: `uvicorn app.main:app --reload` → listening on port 8000
3. Health check: `curl http://localhost:8000/health` → `{"status": "ok"}`
4. Schema test: `pytest tests/test_schema.py::test_tables_exist -x -v` → 1 PASSED
5. Pytest collect: `pytest tests/ --collect-only -q` → all stubs discoverable, no errors
6. Verify no tailwind.config.ts: `test ! -f frontend/tailwind.config.ts && echo "no config.ts — correct"`
7. Verify Vault column: `grep -c "gemini_api_key_secret_id uuid" supabase/migrations/20260524000000_initial_schema.sql` → 1
</verification>

<success_criteria>
- All 9 Supabase tables exist and accept inserts (test_tables_exist PASSED)
- Backend starts without errors; GET /health returns 200
- Pytest discovers all test stubs without syntax errors
- SUPABASE_KEY is NOT in any committed file (backend/.env is gitignored)
- gemini_api_key_secret_id uuid column exists in projects table (never gemini_api_key text)
- /diagnostico/ has zero modified files
</success_criteria>

<output>
Create `.planning/phases/01-project-configuration-supabase-schema/01-01a-SUMMARY.md` when done.
</output>
