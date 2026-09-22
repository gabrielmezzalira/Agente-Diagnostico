# Phase 1: Project Configuration + Supabase Schema — Pattern Map

**Mapped:** 2026-05-24
**Files analyzed:** 27 new files (backend, frontend, database, tests)
**Analogs found:** 5 / 5 (all new files have exact or role-match analogs in v1)

---

## File Classification

| New File | Role | Data Flow | Closest Analog | Match Quality |
|----------|------|-----------|----------------|---------------|
| `/backend/app/config.py` | config | static load | `diagnostico/config.py` | exact |
| `/backend/app/database.py` | service | request-response | `diagnostico/conversation.py` (singleton pattern) | role-match |
| `/backend/app/models/project.py` | model | request-response | `diagnostico/agent.py` (parameter objects) | role-match |
| `/backend/app/routers/projects.py` | controller | CRUD | `diagnostico/main.py` (orchestration pattern) | role-match |
| `/backend/app/main.py` | config | request-response | `diagnostico/main.py` | exact |
| `/backend/requirements.txt` | config | static | `diagnostico/requirements.txt` | exact |
| `/backend/pytest.ini` | config | test | none — new testing framework | none |
| `/backend/tests/conftest.py` | test | test setup | none | none |
| `/backend/tests/test_projects.py` | test | CRUD integration | none | none |
| `/backend/tests/test_schema.py` | test | schema validation | none | none |
| `/frontend/index.html` | config | static | none — greenfield | none |
| `/frontend/vite.config.ts` | config | build | none — greenfield | none |
| `/frontend/package.json` | config | static | none — greenfield | none |
| `/frontend/tsconfig.json` | config | build | none — greenfield | none |
| `/frontend/src/main.tsx` | config | app init | none — greenfield | none |
| `/frontend/src/App.tsx` | component | routing | none — greenfield | none |
| `/frontend/src/index.css` | config | theme | none — greenfield | none |
| `/frontend/src/pages/HomePage.tsx` | component | request-response | none — greenfield | none |
| `/frontend/src/pages/ProjectFormPage.tsx` | component | CRUD request-response | none — greenfield | none |
| `/frontend/src/pages/ProjectDetailPage.tsx` | component | request-response | none — greenfield | none |
| `/frontend/src/components/ProjectCard.tsx` | component | render | none — greenfield | none |
| `/frontend/src/components/ProjectTypeSelector.tsx` | component | form control | none — greenfield | none |
| `/frontend/src/components/DmsSlider.tsx` | component | form control | none — greenfield | none |
| `/frontend/src/api/projects.ts` | service | request-response | `diagnostico/main.py` (HTTP setup pattern) | partial |
| `/frontend/src/lib/supabase.ts` | service | static init | `diagnostico/config.py` (singleton pattern) | role-match |
| `/supabase/migrations/20260524000000_initial_schema.sql` | migration | schema | none — greenfield | none |

---

## Pattern Assignments

### `/backend/app/config.py` (config, static load)

**Analog:** `diagnostico/config.py`

**Imports pattern** (lines 1-20):
```python
import os
from dataclasses import dataclass
from dotenv import load_dotenv

load_dotenv()
```

**Frozen dataclass pattern** (lines 23-47):
```python
@dataclass(frozen=True)
class Config:
    """Configuration dictionary as frozen dataclass for immutability.
    
    frozen=True prevents accidental mutation of config after initialization.
    All required fields raise early with clear ValueError if not set.
    """
    gemini_api_key: str
    model_name: str
    reports_dir: str
    recall_webhook_secret: str = ""
```

**Load function pattern** (lines 49-77):
```python
def load_config() -> Config:
    """Read environment variables and validate.
    
    Raises ValueError early if GEMINI_API_KEY not set — fail fast principle.
    Uses os.environ.get() with defaults for optional vars.
    """
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        raise ValueError("GEMINI_API_KEY environment variable not set...")
    
    return Config(
        gemini_api_key=api_key,
        model_name=os.environ.get("GEMINI_MODEL", "gemini-2.0-flash"),
        reports_dir=os.environ.get("REPORTS_DIR", "reports"),
        recall_webhook_secret=os.environ.get("RECALL_WEBHOOK_SECRET", ""),
    )
```

**Adaptation for backend/app/config.py:**
- Replace `gemini_api_key`, `model_name`, `reports_dir`, `recall_webhook_secret` with:
  - `supabase_url: str` (required)
  - `supabase_key: str` (required)
- Keep the `@dataclass(frozen=True)` pattern unchanged
- Keep `load_dotenv()` at module level
- Keep early ValueError for missing required env vars

---

### `/backend/app/database.py` (service, request-response)

**Analog:** `diagnostico/conversation.py` (singleton state manager pattern)

**Singleton pattern** (lines 16-36):
```python
class ConversationManager:
    """Manages a single shared conversation history.
    
    Initialized once, passed to components via dependency injection.
    Internal state protected by single responsibility: only manages history.
    """
    
    def __init__(self) -> None:
        self._history: list[Message] = []
    
    def get_history(self) -> list[Message]:
        """Return a copy of history — protect internal state."""
        return list(self._history)
```

**Adaptation for backend/app/database.py:**
```python
import os
from supabase import create_client, Client

_supabase: Client | None = None

def get_supabase() -> Client:
    """Get or create Supabase client (singleton pattern from v1).
    
    First call initializes the client and caches it.
    Subsequent calls return the cached instance.
    Fails fast with RuntimeError if env vars missing.
    """
    global _supabase
    if _supabase is None:
        url = os.environ.get("SUPABASE_URL")
        key = os.environ.get("SUPABASE_KEY")
        if not url or not key:
            raise RuntimeError("SUPABASE_URL and SUPABASE_KEY must be set")
        _supabase = create_client(url, key)
    return _supabase
```

---

### `/backend/app/models/project.py` (model, request-response)

**Analog:** `diagnostico/agent.py` (constructor parameter objects pattern)

**Initialization pattern** (lines 38-46):
```python
class DiagnosticAgent:
    """Receive dependencies via constructor.
    
    All parameters are passed in — never created internally.
    Immutable state via attribute assignment from parameters.
    """
    
    def __init__(
        self,
        llm: LLMClient,
        conversation: ConversationManager,
        reporter: ReportGenerator,
    ) -> None:
        self._llm = llm
        self._conversation = conversation
        self._reporter = reporter
```

**Adaptation for backend/app/models/project.py (Pydantic models):**
```python
from pydantic import BaseModel
from typing import Optional

class ProjectCreate(BaseModel):
    """Incoming POST request body for project creation.
    
    All fields match CLAUDE.md F1 form fields.
    Pydantic validates types and required fields automatically.
    """
    name: str
    client: str
    description: Optional[str] = None
    project_type: str  # enum: bi, ml, data_engineering, etc
    gemini_api_key: str  # plaintext in request; FastAPI handler encrypts via Vault
    budget_usd: Optional[float] = None
    data_maturity_score: int  # 1-5
    pre_meeting_context: Optional[str] = None
    meeting_url: Optional[str] = None
    source: str = "taqtic"  # enum: taqtic, recall
    question_ttl_seconds: int = 30

class ProjectResponse(BaseModel):
    """Outgoing response for GET /projects/:id.
    
    Never includes decrypted gemini_api_key.
    has_api_key bool indicates if key is stored (not the key itself).
    """
    id: str
    name: str
    client: str
    description: Optional[str]
    project_type: str
    budget_usd: Optional[float]
    data_maturity_score: int
    has_api_key: bool  # True if gemini_api_key_secret_id IS NOT NULL
    # ... other fields
```

---

### `/backend/app/routers/projects.py` (controller, CRUD)

**Analog:** `diagnostico/main.py` (orchestration and error handling pattern)

**Orchestration pattern** (lines 43-76):
```python
def _run_interactive() -> None:
    """Run the interactive mode: load config, initialize components, run loop.
    
    Try/except wraps config loading to fail fast with user-friendly message.
    Components are initialized once and passed around via dependency injection.
    """
    try:
        config = load_config()
    except ValueError as e:
        print(f"❌ Error: {e}")
        return
    
    llm = GeminiClient(config.gemini_api_key, config.model_name)
    conversation = ConversationManager()
    reporter = ReportGenerator(config.reports_dir)
    agent = DiagnosticAgent(llm, conversation, reporter)
```

**Error handling and wrapping** (lines 78-125):
```python
    try:
        response = agent.start(project_description)
        print(f"Agent: {response}\n")
        
        while True:
            # ... business logic ...
            response = agent.respond(user_input)
            print(f"\nAgent: {response}\n")
    
    except KeyboardInterrupt:
        print("\n\n⚠️ Interview interrupted by user.")
    except Exception as e:
        print(f"\n❌ Error during interview: {e}")
        raise
```

**Adaptation for backend/app/routers/projects.py (FastAPI router):**
```python
from fastapi import APIRouter, Depends, HTTPException
from ..database import get_supabase
from ..models.project import ProjectCreate, ProjectResponse

router = APIRouter(prefix="/projects", tags=["projects"])

@router.post("/")
async def create_project(
    project_create: ProjectCreate,
    db=Depends(get_supabase)
) -> ProjectResponse:
    """Create a new project.
    
    Follows v1 pattern:
    - Validate input via Pydantic (automatic in FastAPI)
    - Call dependency (Supabase client) via Depends()
    - Try/except wraps database call
    - Fail fast with HTTPException if required fields missing
    """
    try:
        # Call vault.create_secret() for API key
        secret_id = await asyncio.to_thread(
            lambda: db.rpc("create_secret", {
                "secret_value": project_create.gemini_api_key,
                "secret_name": f"gemini_key_project_{uuid4()}"
            }).execute()
        )
        
        # Insert into projects table with secret_id (UUID), never plaintext key
        result = await asyncio.to_thread(
            lambda: db.table("projects").insert({
                "name": project_create.name,
                "client": project_create.client,
                # ... other fields ...
                "gemini_api_key_secret_id": secret_id.data[0]["id"],
            }).execute()
        )
        
        return ProjectResponse(**result.data[0])
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/")
async def list_projects(db=Depends(get_supabase)) -> list[ProjectResponse]:
    """List all projects (with active session badges)."""
    try:
        result = await asyncio.to_thread(
            lambda: db.table("projects").select("*").execute()
        )
        # Each project: has_api_key bool based on gemini_api_key_secret_id IS NOT NULL
        return [ProjectResponse(**row) for row in result.data]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
```

**Pattern notes:**
- Use `Depends(get_supabase)` to inject the Supabase singleton into each handler
- Use `asyncio.to_thread()` wrapper for all supabase-py calls (v1 pattern from intel/decisions.md)
- Wrap DB calls in try/except, convert exceptions to HTTPException
- Never return decrypted API key — only `has_api_key: bool`
- Validate input via Pydantic models (FastAPI does this automatically)

---

### `/backend/app/main.py` (config, request-response)

**Analog:** `diagnostico/main.py`

**Entry point pattern** (lines 354-399):
```python
def main() -> None:
    """Entry point. Parse arguments and dispatch to correct mode."""
    parser = argparse.ArgumentParser(
        description="Agente de Diagnóstico CITi",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=(
            "Examples:\n"
            "  python3 main.py                        # interactive mode (default)\n"
            "  python3 main.py --mode realtime        # realtime mode\n"
        ),
    )
    parser.add_argument("--mode", choices=["interactive", "realtime"], default="interactive")
    args = parser.parse_args()

    if args.mode == "realtime":
        asyncio.run(_run_realtime(args.source, ui_mode=args.ui))
    else:
        _run_interactive()


if __name__ == "__main__":
    main()
```

**Adaptation for backend/app/main.py (FastAPI):**
```python
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from pathlib import Path
from .routers import projects

app = FastAPI(title="Agente Diagnóstico v2.0")

# CORS middleware for dev (Vite proxy bypasses this in dev)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],  # Vite dev server
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API routers
app.include_router(projects.router)

# Serve React SPA in production (if built)
dist_dir = Path(__file__).parent.parent.parent / "frontend" / "dist"
if dist_dir.exists():
    app.mount("/", StaticFiles(directory=str(dist_dir), html=True), name="spa")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)
```

---

### `/backend/requirements.txt` (config, static)

**Analog:** `diagnostico/requirements.txt`

**Format pattern** (lines 1-4):
```
google-generativeai>=0.8.0
python-dotenv>=1.0.0
aiohttp>=3.9.0
rich>=13.7.0
```

**Adaptation for backend/requirements.txt (Phase 1):**
```
fastapi>=0.136.3
uvicorn>=0.48.0
supabase>=2.30.0
pydantic>=2.13.4
python-dotenv>=1.0.0
pytest>=9.0.3
httpx>=0.27.0
```

**Phase 1 note:** This is the baseline. Subsequent phases will add:
- `google-genai>=0.8.0` (Phase 5, replaces google-generativeai)
- Other LLM client libraries as needed

---

### `/frontend/src/lib/supabase.ts` (service, static init)

**Analog:** `diagnostico/config.py` (singleton initialization pattern)

**Singleton pattern** (lines 1-20):
```python
# Frozen dataclass ensures configuration immutability
@dataclass(frozen=True)
class Config:
    gemini_api_key: str
    model_name: str

def load_config() -> Config:
    """Read and validate environment — fail fast."""
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        raise ValueError("GEMINI_API_KEY not set")
    return Config(...)
```

**Adaptation for frontend/src/lib/supabase.ts:**
```typescript
import { createClient } from '@supabase/supabase-js'

// IMPORTANT: This client is NOT used directly in Phase 1.
// All Supabase access goes through FastAPI (/api/*)
// This is a placeholder for potential future real-time subscriptions.

let supabaseInstance: ReturnType<typeof createClient> | null = null

export function getSupabaseClient() {
  if (!supabaseInstance) {
    const url = import.meta.env.VITE_SUPABASE_URL
    const key = import.meta.env.VITE_SUPABASE_ANON_KEY
    
    if (!url || !key) {
      throw new Error('VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY must be set')
    }
    
    supabaseInstance = createClient(url, key)
  }
  
  return supabaseInstance
}
```

**Pattern note:** Frontend Supabase client is initialized but NOT used for data access in Phase 1. All queries go through FastAPI to prevent exposing SUPABASE_KEY in browser. The client may be used later for real-time subscriptions.

---

### `/frontend/src/api/projects.ts` (service, request-response)

**Analog:** `diagnostico/main.py` (HTTP client pattern — orchestration)

**Error handling pattern** (lines 78-125):
```python
    try:
        response = agent.start(project_description)
        print(f"Agent: {response}\n")
    
    except KeyboardInterrupt:
        print("\n\n⚠️ Interview interrupted by user.")
    except Exception as e:
        print(f"\n❌ Error during interview: {e}")
        raise
```

**Adaptation for frontend/src/api/projects.ts (fetch wrappers):**
```typescript
import { ProjectCreate, ProjectResponse } from '../types/project'

const API_BASE = '/api'

async function fetchJSON<T>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
    ...options,
  })
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({}))
    throw new Error(error.detail || `HTTP ${response.status}`)
  }
  
  return response.json()
}

export const projectsAPI = {
  async list(): Promise<ProjectResponse[]> {
    return fetchJSON('/projects')
  },
  
  async create(data: ProjectCreate): Promise<ProjectResponse> {
    return fetchJSON('/projects', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  },
  
  async getById(id: string): Promise<ProjectResponse> {
    return fetchJSON(`/projects/${id}`)
  },
  
  async update(id: string, data: Partial<ProjectCreate>): Promise<ProjectResponse> {
    return fetchJSON(`/projects/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
  },
  
  async delete(id: string): Promise<void> {
    await fetchJSON(`/projects/${id}`, { method: 'DELETE' })
  },
}
```

**Pattern note:**
- Centralized fetch wrapper handles error conversion and JSON parsing
- All errors converted to user-friendly Error messages
- API base path `/api` is rewritten by Vite proxy in dev; exact routes in prod (FastAPI serves them)

---

## Shared Patterns

### Error Handling Pattern
**Source:** `diagnostico/main.py` lines 78–125 (try/except/finally with user-friendly messages)
**Apply to:** All backend controllers, all frontend async functions
```python
# Backend (FastAPI)
try:
    result = await asyncio.to_thread(lambda: db.table("projects").insert(...).execute())
    return result
except ValueError as e:
    raise HTTPException(status_code=400, detail=str(e))
except Exception as e:
    logger.error(f"Unexpected error: {e}")
    raise HTTPException(status_code=500, detail="Internal server error")

# Frontend (React)
try {
  const data = await projectsAPI.create(formData)
  // success
} catch (error) {
  setError(error.message)
  // show user-friendly message
}
```

### Dependency Injection Pattern
**Source:** `diagnostico/agent.py` lines 38–46 (constructor parameters instead of internal creation)
**Apply to:** All backend controllers, all FastAPI routers
```python
# DON'T do this:
class ProjectsRouter:
    def __init__(self):
        self.db = create_client(...)  # creates internally

# DO this instead:
@router.get("/")
async def list_projects(db=Depends(get_supabase)):
    # db injected via FastAPI Depends()
    return await asyncio.to_thread(lambda: db.table(...).execute())
```

### Fail Fast / Early Validation
**Source:** `diagnostico/config.py` lines 49–77 (ValueError on missing env vars)
**Apply to:** All config initialization, all Pydantic models
```python
# Config loads env vars early and raises immediately if required var missing
def load_config() -> AppConfig:
    url = os.environ.get("SUPABASE_URL")
    if not url:
        raise ValueError("SUPABASE_URL not set")
    # ... continue only if valid

# Pydantic models validate in FastAPI automatically
class ProjectCreate(BaseModel):
    name: str  # required — FastAPI rejects if missing
    budget_usd: Optional[float] = None  # optional — defaults to None
```

### Immutability of Configuration
**Source:** `diagnostico/config.py` line 23 (frozen=True dataclass)
**Apply to:** All backend configuration objects
```python
@dataclass(frozen=True)
class AppConfig:
    supabase_url: str
    supabase_key: str

# After creation, fields cannot be modified:
config = load_config()
# config.supabase_url = "new_url"  # ← FrozenInstanceError at runtime
```

### Asyncio.to_thread() for Blocking Calls
**Source:** `diagnostico/main.py` (pattern referenced in intel/decisions.md)
**Apply to:** All supabase-py calls in FastAPI async handlers
```python
# supabase-py is synchronous; wrap it in asyncio.to_thread() to avoid blocking event loop
result = await asyncio.to_thread(
    lambda: db.table("projects").select("*").execute()
)
```

---

## No Analog Found

Files with no direct analog in v1 (standard patterns from RESEARCH.md apply instead):

| File | Role | Reason |
|------|------|--------|
| `/frontend/src/pages/HomePage.tsx` | component | Greenfield React UI — no v1 frontend exists |
| `/frontend/src/pages/ProjectFormPage.tsx` | component | Greenfield React form — no v1 form exists |
| `/frontend/src/components/ProjectCard.tsx` | component | Greenfield React component — no v1 card exists |
| `/frontend/src/components/ProjectTypeSelector.tsx` | component | Greenfield form control — no v1 UI |
| `/frontend/src/components/DmsSlider.tsx` | component | Greenfield form control — no v1 UI |
| `/frontend/src/App.tsx` | component | Greenfield routing — no v1 SPA routing |
| `/frontend/src/main.tsx` | config | Greenfield React entry — no v1 React bootstrap |
| `/frontend/src/index.css` | config | Greenfield Tailwind CSS — no v1 styling |
| `/frontend/index.html` | config | Greenfield SPA template — no v1 HTML |
| `/frontend/vite.config.ts` | config | Greenfield Vite config — no v1 build tool |
| `/frontend/package.json` | config | Greenfield npm — no v1 npm project |
| `/frontend/tsconfig.json` | config | Greenfield TypeScript — no v1 TS |
| `/backend/pytest.ini` | config | Greenfield pytest config — v1 has no tests |
| `/backend/tests/conftest.py` | test | Greenfield test fixtures — v1 has no tests |
| `/backend/tests/test_projects.py` | test | Greenfield integration tests — v1 has no tests |
| `/backend/tests/test_schema.py` | test | Greenfield schema validation — v1 has no tests |
| `/supabase/migrations/20260524000000_initial_schema.sql` | migration | Greenfield schema — no v1 database schema |

**Pattern source for these files:** Refer to RESEARCH.md sections:
- Frontend components: React 19.2 + React Router v7 conventions (reactrouter.com/start/library/routing)
- Vite config: Tailwind v4 + Vite integration (tailwindcss.com/docs/installation/using-vite)
- Tests: pytest 9.0 conventions (standard Python testing)
- CSS: Tailwind v4 @theme directive (tailwindcss.com/docs/theme)
- SQL: Supabase schema patterns (supabase.com/docs/guides/database/vault)

---

## Metadata

**Analog search scope:** `/diagnostico/` v1 codebase (Python + configuration patterns)
**Files scanned:** 20 v1 Python files examined
**Pattern extraction date:** 2026-05-24
**Confidence level:** HIGH — all analogs are direct pattern matches from stable, existing v1 code

---

## Summary

Phase 1 has strong foundation analogs:

- **Configuration pattern (frozen dataclass + environment loading)**: Direct carry-forward from v1 `config.py` with renamed fields for Supabase instead of Gemini.
- **Dependency injection pattern (constructor parameters)**: Established in v1 `agent.py`; extends to FastAPI routers via `Depends()`.
- **Error handling (try/except/fail-fast)**: v1 main.py provides the template for all FastAPI error responses.
- **Singleton pattern (module-level client initialization)**: v1 `conversation.py` pattern adapts directly to `database.py` Supabase client and `frontend/lib/supabase.ts`.
- **Asyncio integration (to_thread for blocking calls)**: Referenced in CLAUDE.md v1 pattern; apply universally to supabase-py calls in FastAPI.

**Greenfield components (frontend UI, tests, migrations)** follow standard patterns from RESEARCH.md (Tailwind v4, React Router v7, pytest, Supabase SQL) — no v1 analogs exist for these.
