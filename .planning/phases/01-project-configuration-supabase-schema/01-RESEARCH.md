# Phase 1: Project Configuration + Supabase Schema — Research

**Researched:** 2026-05-24
**Domain:** React/Vite/TypeScript/Tailwind frontend + FastAPI backend + Supabase (schema initialization + Vault)
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Repository Structure**
- React/Vite app lives at top-level `/frontend/` (not inside `/diagnostico/`)
- FastAPI backend lives at top-level `/backend/` (not inside `/diagnostico/`)
- `/diagnostico/` stays untouched as the v1 Python module — no changes to it in Phase 1
- Dev: Vite proxy forwards `/api/*` → `localhost:8000` (configured in `vite.config.ts`)
- Prod: FastAPI serves built React static files from `/frontend/dist` via `StaticFiles` mount

**Design System — LIGHT THEME**
- Light theme (replaces v1 dark GitHub aesthetic)
- Color palette: bg-page `#f5f4f0`, surface `#ffffff`, border-std `#e8e6e0`, accent `#22a267`
- Typography: DM Sans (primary), DM Mono (timer/budget/code); nothing exceeds 14px
- Fonts loaded via Google Fonts CDN `@import` in `index.css`
- No component library — custom components only
- Lucide React for icons

**Project Form UX**
- Layout: single scrollable form with named sections (IDENTIFICAÇÃO, CONFIGURAÇÃO DE IA, REUNIÃO, MATURIDADE)
- Home screen: card grid, 2–3 cards per row, `repeat(auto-fill, minmax(280px, 1fr))`
- Project type selector: icon cards/pills (6 items)
- DMS slider: 1–5 with level labels visible

**API Key Masking UX**
- Create mode: `type="password"` with optional visibility toggle
- Edit mode: disabled field showing "●●●●●●●●●●", "Alterar chave" link re-enables it
- No save-time validation; error surfaces at first Gemini call

**Supabase Schema**
- All 9 tables as defined in CLAUDE.md SDD Section 3
- Tables: projects, sessions, questions, red_flags, coverage_snapshots, reports, question_bank, session_prompts, transcript_chunks
- Gemini API key stored via Supabase Vault (pgsodium); never returned to frontend

### Claude's Discretion

(none captured)

### Deferred Ideas (OUT OF SCOPE)

(none captured)
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PROJ-01 | User can create a project with all 11 fields (name, client, description, project type, Gemini API key, budget USD, DMS 1-5, pre-meeting context, meeting URL, source, TTL) | FastAPI POST /projects + Supabase insert; Vault for API key |
| PROJ-02 | User can edit a project at any time; edits do not affect closed sessions | FastAPI PUT /projects/:id; Supabase update; Vault update_secret for key change |
| PROJ-03 | Project list displays active-session green badge for projects with live sessions | GET /projects → join with sessions where status='active'; React card renders badge conditionally |
| PROJ-04 | Gemini API key stored via Supabase Vault (pgsodium); masked in UI after save; re-entry required to update | vault.create_secret() → store UUID in projects.gemini_api_key_secret_id; never SELECT decrypted_secret in project GET response |
| PROJ-05 | Supabase schema initialized: all 9 tables | supabase/migrations/ SQL file applied via `supabase db push` |
</phase_requirements>

---

## Summary

Phase 1 is a full-stack greenfield scaffold: initialize the React/Vite frontend, FastAPI backend, and all 9 Supabase tables, then implement project CRUD (create/list/edit) as the walking skeleton. The thinnest end-to-end slice is: create project form → POST /api/projects → FastAPI → Supabase insert → project list shows it.

Two technical surprises require special attention. First, **Tailwind v4 (the current major version) uses `@theme` CSS directives instead of `tailwind.config.ts`**. The UI-SPEC references a `tailwind.config.ts` token map — this must be translated to CSS variables in the `@theme` block inside `index.css`. Second, **Supabase Column Encryption (pgsodium) is deprecated and not recommended**. The correct approach for storing the Gemini API key is Supabase Vault: call `vault.create_secret()` at insert time, store the returned UUID in a `gemini_api_key_secret_id uuid` column on `projects`, and never expose the decrypted value through the API. When the frontend needs to confirm a key exists, the API returns a boolean, not the key value.

The backend uses `supabase-py` v2 with a module-level singleton client, FastAPI `APIRouter` per domain, and Pydantic v2 models for request/response validation. The Supabase schema is applied via one migration SQL file (`supabase/migrations/<timestamp>_initial_schema.sql`) using the Supabase CLI.

**Primary recommendation:** Scaffold frontend and backend directories first, apply the migration, then implement project CRUD wave by wave (schema → API → UI). Use Tailwind v4's `@theme` CSS block for all design tokens from the UI-SPEC.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Project CRUD UI (form, card grid) | Browser / React | — | Pure UI state — no SSR needed in this SPA |
| API key masking (show dots, re-enable) | Browser / React | — | Pure UI interaction; key never travels to frontend in plaintext |
| Route navigation (/, /projects/new, /projects/:id) | Browser / React Router | — | SPA routing handled client-side |
| Project persistence (create/read/update) | API / FastAPI | Database / Supabase | Business logic in FastAPI; persistence in Supabase |
| API key encryption | Database / Supabase Vault | API / FastAPI | Vault stores + encrypts; FastAPI calls vault.create_secret() via SQL |
| Schema initialization | Database / Supabase | — | SQL migration applied via CLI; no app logic involved |
| Active session badge data | API / FastAPI | Database / Supabase | JOIN query on sessions table; result sent to frontend as boolean flag |
| Static file serving (prod) | API / FastAPI | — | FastAPI mounts /frontend/dist via StaticFiles |

---

## Standard Stack

### Core — Frontend

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `react` | 19.2.6 | UI component tree | Project spec; latest stable |
| `react-dom` | 19.2.6 | DOM renderer | Required React companion |
| `react-router-dom` | 7.15.1 | Client-side routing | Project spec; v7 is current major |
| `@supabase/supabase-js` | 2.106.1 | Supabase client for browser | Official Supabase JS SDK |
| `tailwindcss` | 4.3.0 | Utility CSS; custom design tokens via @theme | Project spec; v4 is current |
| `@tailwindcss/vite` | 4.3.0 | Vite plugin for Tailwind v4 | Required for Tailwind v4 + Vite integration |
| `lucide-react` | 1.16.0 | Icon set; tree-shakeable | UI-SPEC specified; MIT license |
| `vite` | 8.0.14 | Build tool + dev server | Project spec |
| `@vitejs/plugin-react` | 6.0.2 | React HMR support for Vite | Standard Vite+React integration |
| `typescript` | 6.0.3 | Static typing | Project spec |

[VERIFIED: npm registry — confirmed via `npm view <pkg> version` + official GitHub repos]

### Core — Backend

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `fastapi` | 0.136.3 | REST API framework | Project spec |
| `uvicorn` | 0.48.0 | ASGI server | Standard FastAPI companion |
| `supabase` | 2.30.0 | Supabase Python client | Official supabase-py |
| `pydantic` | 2.13.4 | Request/response validation | FastAPI native; v2 is current |
| `python-dotenv` | already in v1 | Load .env for SUPABASE_URL / SUPABASE_KEY | Matches v1 pattern |

[VERIFIED: PyPI — confirmed via `pip3 index versions <pkg>`; all passed slopcheck [OK]]

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@types/react` | 19.2.15 | TypeScript types for React | Always with React + TS |
| `@types/react-dom` | 19.2.x | TypeScript types for ReactDOM | Always with ReactDOM + TS |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `@tailwindcss/vite` plugin | PostCSS plugin | PostCSS works but Tailwind docs recommend the Vite plugin for better performance in v4 |
| supabase-py singleton | Per-request client | Singleton is fine for this single-user local deployment; per-request adds overhead for no benefit |
| react-router-dom v7 | TanStack Router | TanStack has more features but adds complexity; RRD v7 sufficient for 4 routes |

**Installation — Frontend:**
```bash
cd frontend
npm create vite@latest . -- --template react-ts
npm install react-router-dom @supabase/supabase-js lucide-react
npm install -D tailwindcss @tailwindcss/vite
```

**Installation — Backend:**
```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install fastapi uvicorn supabase pydantic python-dotenv
```

**Version verification:** Versions above confirmed against PyPI (2026-05-24) and npm registry (2026-05-24).

---

## Package Legitimacy Audit

> slopcheck run: Python packages checked against PyPI; npm packages verified against npm registry + GitHub repos (slopcheck does not support npm ecosystem — manual verification performed per package legitimacy protocol).

### npm Packages (Frontend)

| Package | Registry | Repo | Postinstall script | Disposition |
|---------|----------|------|--------------------|-------------|
| `react` | npm | github.com/facebook/react | none | Approved |
| `react-dom` | npm | github.com/facebook/react | none | Approved |
| `react-router-dom` | npm | github.com/remix-run/react-router | none | Approved |
| `@supabase/supabase-js` | npm | github.com/supabase/supabase-js | none | Approved |
| `lucide-react` | npm | github.com/lucide-icons/lucide | none | Approved |
| `tailwindcss` | npm | github.com/tailwindlabs/tailwindcss | none | Approved |
| `@tailwindcss/vite` | npm | github.com/tailwindlabs/tailwindcss | none | Approved |
| `vite` | npm | github.com/vitejs/vite | none | Approved |
| `@vitejs/plugin-react` | npm | github.com/vitejs/vite-plugin-react | none | Approved |
| `typescript` | npm | github.com/microsoft/TypeScript | none | Approved |

### Python Packages (Backend)

| Package | Registry | slopcheck | Disposition |
|---------|----------|-----------|-------------|
| `fastapi` | PyPI | [OK] | Approved |
| `uvicorn` | PyPI | [OK] | Approved |
| `supabase` | PyPI | [OK] | Approved |
| `pydantic` | PyPI | [OK] | Approved |
| `python-dotenv` | PyPI | [OK] (flagged as "python-" prefix pattern, established package) | Approved |

**Packages removed due to [SLOP] verdict:** none
**Packages flagged [SUS]:** none

---

## Architecture Patterns

### System Architecture Diagram

```
Browser (React SPA)
  │
  ├─ GET /api/projects       ─┐
  ├─ POST /api/projects        ├── Vite dev proxy (/api/* → localhost:8000, strip prefix)
  ├─ PUT /api/projects/:id    ─┘
  │
  ↓
FastAPI (localhost:8000)
  │  backend/app/main.py
  │  backend/app/routers/projects.py
  │
  ├─ ProjectCreate (Pydantic) → validate
  ├─ vault.create_secret(gemini_api_key) → returns UUID
  ├─ supabase.table("projects").insert({...gemini_api_key_secret_id: uuid})
  │
  ↓
Supabase (PostgreSQL + Vault)
  ├─ public.projects (gemini_api_key_secret_id uuid)
  ├─ vault.secrets (encrypted key)
  └─ 8 other tables (initialized, not yet populated in Phase 1)

Production (--ui web):
  Browser → FastAPI StaticFiles /frontend/dist → index.html (SPA)
           FastAPI routes handle /api/* normally
```

### Recommended Project Structure

```
/
├── frontend/                    # React/Vite app
│   ├── index.html
│   ├── vite.config.ts           # Tailwind v4 plugin + /api proxy
│   ├── src/
│   │   ├── main.tsx             # ReactDOM.createRoot + BrowserRouter
│   │   ├── App.tsx              # Routes definition
│   │   ├── index.css            # @import "tailwindcss"; @theme { ... }
│   │   ├── lib/
│   │   │   └── supabase.ts      # Supabase client (NOT used directly — goes through API)
│   │   ├── pages/
│   │   │   ├── HomePage.tsx
│   │   │   ├── ProjectFormPage.tsx   # Reused for create + edit
│   │   │   └── ProjectDetailPage.tsx # Placeholder in Phase 1
│   │   ├── components/
│   │   │   ├── ProjectCard.tsx
│   │   │   ├── ProjectTypeSelector.tsx
│   │   │   └── DmsSlider.tsx
│   │   └── api/
│   │       └── projects.ts      # fetch() wrappers for /api/projects
│   └── package.json
│
├── backend/                     # FastAPI app
│   ├── app/
│   │   ├── main.py              # FastAPI app, include_router, StaticFiles
│   │   ├── config.py            # load_config() → frozen dataclass (extends v1 pattern)
│   │   ├── database.py          # supabase singleton: create_client(url, key)
│   │   ├── models/
│   │   │   └── project.py       # Pydantic ProjectCreate, ProjectUpdate, ProjectResponse
│   │   └── routers/
│   │       └── projects.py      # GET /projects, POST /projects, GET /projects/:id, PUT, DELETE
│   └── requirements.txt
│
├── supabase/
│   └── migrations/
│       └── 20260524000000_initial_schema.sql   # All 9 tables + Vault setup
│
└── diagnostico/                 # v1 — UNTOUCHED in Phase 1
```

### Pattern 1: Supabase Vault — Per-Row API Key Storage

**What:** Store each project's Gemini API key as a Vault secret; keep only the UUID in the projects table.

**When to use:** Any time sensitive credentials must be stored per row without exposing them through application queries.

**SQL at insert time (called via FastAPI → supabase.rpc or raw SQL):**
```sql
-- Source: https://supabase.com/docs/guides/database/vault
-- Create secret, get back UUID
SELECT vault.create_secret(
  $1,                              -- the actual API key value
  'gemini_key_project_' || $2,    -- unique name (project id)
  'Gemini API key for project'
) AS secret_id;

-- Store UUID in projects table
INSERT INTO projects (name, client, ..., gemini_api_key_secret_id)
VALUES (..., $secret_id);
```

**SQL at update time (key change):**
```sql
-- Source: https://supabase.com/docs/guides/database/vault
SELECT vault.update_secret(
  $existing_secret_id,
  $new_key_value
);
-- No change to projects table — UUID stays the same
```

**IMPORTANT: Never expose decrypted key in API responses.**
```python
# Source: [CITED: supabase.com/docs/guides/database/vault]
# The backend NEVER does:
#   SELECT ds.decrypted_secret FROM vault.decrypted_secrets ds
#   JOIN projects p ON p.gemini_api_key_secret_id = ds.id
#   WHERE p.id = $project_id
# ...in any endpoint the frontend can call.
# The key is only read internally by the realtime pipeline (Phase 5+).

# ProjectResponse Pydantic model includes:
#   has_api_key: bool  (True if gemini_api_key_secret_id IS NOT NULL)
# NOT the key value itself.
```

**Schema implication:** The `projects` table column is `gemini_api_key_secret_id uuid` (not `gemini_api_key text`). The CLAUDE.md SDD shows `gemini_api_key text (encrypted)` — the actual implementation uses a UUID column that references Vault. This is the correct Supabase Vault pattern.

[CITED: supabase.com/docs/guides/database/vault]

### Pattern 2: Tailwind v4 Design Tokens via `@theme`

**What:** Tailwind v4 uses CSS `@theme` block instead of `tailwind.config.ts` for custom tokens. The `tailwind.config.ts` in the UI-SPEC must be translated to CSS variables.

**When to use:** Always in Tailwind v4 projects. The `tailwind.config.ts` is still read if explicitly loaded via `@config`, but auto-detection is gone.

```css
/* Source: https://tailwindcss.com/docs/theme */
/* frontend/src/index.css */
@import "tailwindcss";

@theme {
  /* Colors — translated from UI-SPEC tailwind.config.ts */
  --color-bg-page:        #f5f4f0;
  --color-surface:        #ffffff;
  --color-border-std:     #e8e6e0;
  --color-border-hover:   #cccccc;
  --color-text-primary:   #1a1a1a;
  --color-text-secondary: #888888;
  --color-accent:         #22a267;
  --color-accent-hover:   #1a8a56;
  --color-green-bg-light: #f0faf5;
  --color-green-bg-tag:   #edfaf3;
  --color-border-green:   #a8dfc2;
  --color-red:            #d43a3a;
  --color-yellow:         #e8a020;
  --color-red-bg:         #fff5f5;
  --color-yellow-bg:      #fff8f0;
  --color-border-red:     #f0b8b8;
  --color-border-yellow:  #f0d8b0;
  --color-muted:          #f0ede6;

  /* Fonts */
  --font-sans: 'DM Sans', sans-serif;
  --font-mono: 'DM Mono', monospace;
}

/* Usage generates utilities: bg-bg-page, text-text-primary, font-sans, etc. */
```

[CITED: tailwindcss.com/docs/theme — v4 @theme directive]

### Pattern 3: Vite Proxy + FastAPI Routes

**What:** In dev, Vite proxies `/api/*` to FastAPI at `:8000`, stripping the `/api` prefix. FastAPI routes are defined WITHOUT the `/api` prefix.

```typescript
// Source: https://vite.dev/config/server-options.html
// frontend/vite.config.ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
})
```

```python
# backend/app/routers/projects.py
# Source: https://fastapi.tiangolo.com/tutorial/bigger-applications/
from fastapi import APIRouter
router = APIRouter(prefix="/projects", tags=["projects"])

@router.get("/")           # → /projects  (Vite sees /api/projects)
@router.post("/")          # → /projects
@router.get("/{id}")       # → /projects/{id}
@router.put("/{id}")       # → /projects/{id}
@router.delete("/{id}")    # → /projects/{id}
```

[CITED: vite.dev/config/server-options.html, fastapi.tiangolo.com/tutorial/bigger-applications/]

### Pattern 4: React Router v7 — 4 Routes

```tsx
// Source: https://reactrouter.com/start/library/routing
// frontend/src/main.tsx
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import HomePage from './pages/HomePage'
import ProjectFormPage from './pages/ProjectFormPage'
import ProjectDetailPage from './pages/ProjectDetailPage'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <BrowserRouter>
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/projects/new" element={<ProjectFormPage />} />
      <Route path="/projects/:id/edit" element={<ProjectFormPage />} />
      <Route path="/projects/:id" element={<ProjectDetailPage />} />
    </Routes>
  </BrowserRouter>
)

// In ProjectFormPage — detect create vs edit mode:
import { useParams } from 'react-router-dom'
const { id } = useParams()
const isEdit = Boolean(id)
```

[CITED: reactrouter.com/start/library/routing]

### Pattern 5: Supabase Singleton Client in FastAPI

```python
# backend/app/database.py
# Source: https://supabase.com/docs/reference/python/initializing
import os
from supabase import create_client, Client

_supabase: Client | None = None

def get_supabase() -> Client:
    global _supabase
    if _supabase is None:
        url = os.environ.get("SUPABASE_URL")
        key = os.environ.get("SUPABASE_KEY")
        if not url or not key:
            raise RuntimeError("SUPABASE_URL and SUPABASE_KEY must be set")
        _supabase = create_client(url, key)
    return _supabase
```

```python
# backend/app/routers/projects.py
from fastapi import APIRouter, Depends
from ..database import get_supabase

@router.get("/")
async def list_projects(db=Depends(get_supabase)):
    result = db.table("projects").select("*").execute()
    return result.data
```

[CITED: supabase.com/docs/reference/python/initializing]

### Pattern 6: backend/app/config.py — Extending v1 Pattern

```python
# backend/app/config.py
# Extends the frozen dataclass pattern from diagnostico/config.py
import os
from dataclasses import dataclass
from dotenv import load_dotenv

load_dotenv()

@dataclass(frozen=True)
class AppConfig:
    supabase_url: str
    supabase_key: str

def load_config() -> AppConfig:
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_KEY")
    if not url:
        raise ValueError("SUPABASE_URL not set")
    if not key:
        raise ValueError("SUPABASE_KEY not set")
    return AppConfig(supabase_url=url, supabase_key=key)
```

[ASSUMED — pattern derived from diagnostico/config.py, adapted for new env vars]

### Pattern 7: FastAPI Prod Static File Serving (SPA)

```python
# backend/app/main.py
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from pathlib import Path

app = FastAPI()

# Include API routers first
app.include_router(projects_router)

# Serve React SPA last (catch-all) — prod only
dist_dir = Path(__file__).parent.parent.parent / "frontend" / "dist"
if dist_dir.exists():
    app.mount("/", StaticFiles(directory=str(dist_dir), html=True), name="spa")
```

[CITED: fastapi.tiangolo.com/tutorial/static-files/]

### Anti-Patterns to Avoid

- **Calling `vault.decrypted_secrets` from any GET /projects endpoint:** The decrypted key must NEVER be returned to the frontend. Return `has_api_key: bool` instead.
- **Using `tailwind.config.ts` as the primary config in Tailwind v4:** v4 no longer auto-detects the JS config file. Use `@theme` in CSS.
- **Storing the Gemini API key in the `projects` table as plaintext:** Even `text` with a note "(encrypted)" in the SDD is the wrong pattern — use the UUID reference to Vault.
- **Putting `/api` prefix in FastAPI route decorators:** The Vite proxy strips the prefix; FastAPI routes must not include it to avoid double-stripping.
- **Calling supabase-py from async context without `asyncio.to_thread()`:** supabase-py 2.x is synchronous; blocking calls in async FastAPI handlers will block the event loop. Use `asyncio.to_thread(lambda: db.table(...).execute())`.
- **Using pgsodium Column Encryption (Transparent Column Encryption):** Supabase has deprecated this feature and recommends Vault instead.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| API key encryption at rest | Custom AES wrapper, base64 encoding | Supabase Vault | Vault handles key management, rotation, authenticated encryption. Custom crypto is error-prone |
| Form state management | Manual useState chains | React `useState` with controlled inputs (no library) | Simple enough for this form size; Pydantic validates on server |
| Type-safe route params | Manual URL parsing | `useParams()` from react-router-dom | Race conditions and edge cases in manual parsing |
| HTTP client in frontend | `XMLHttpRequest` or raw fetch with no helpers | Typed `fetch()` wrappers in `src/api/projects.ts` | Centralizes error handling; easy to swap later |
| DB connection pooling | Custom connection pool | supabase-py handles this via PostgREST | PostgREST manages connection pooling transparently |

**Key insight:** Supabase Vault's complexity is in key management infrastructure — replacing it with a hand-rolled solution would require the same infrastructure without the security review.

---

## Common Pitfalls

### Pitfall 1: Tailwind v4 Token Names Differ from v3

**What goes wrong:** UI-SPEC documents Tailwind tokens like `bg-bg-page`, `text-text-primary`. In Tailwind v4, custom color `--color-bg-page` generates the class `bg-bg-page`, which works. However, if you try to use `bg-[#f5f4f0]` inline everywhere instead of setting up `@theme`, subsequent phases cannot rely on semantic tokens.

**Why it happens:** The UI-SPEC was written for a v3-style `tailwind.config.ts`, but the installed version (4.3.0) uses CSS `@theme`. The `tailwind.config.ts` format is still supported in v4 if explicitly loaded via `@config "..."` in CSS, but is not recommended.

**How to avoid:** Set up `@theme` block in `frontend/src/index.css` in Wave 0 with ALL tokens from the UI-SPEC. Verify generated classes work before building components.

**Warning signs:** `bg-bg-page` class has no effect / renders transparent.

### Pitfall 2: supabase-py is Synchronous in an Async FastAPI App

**What goes wrong:** FastAPI handlers are async (`async def`). Calling `supabase.table("projects").select().execute()` directly blocks the event loop for the duration of the HTTP request to Supabase's PostgREST.

**Why it happens:** supabase-py v2 uses synchronous `httpx` under the hood. It's not an asyncio-native client.

**How to avoid:** Wrap supabase-py calls in `asyncio.to_thread()`:
```python
import asyncio
result = await asyncio.to_thread(
    lambda: supabase.table("projects").select("*").execute()
)
```
This is consistent with the v1 codebase's `asyncio.to_thread()` pattern for LLM calls (from `intel/decisions.md`).

**Warning signs:** FastAPI responds slowly under any concurrent load; event loop logs show blocking.

### Pitfall 3: Vault UUID Column vs. Text Column

**What goes wrong:** Developer follows the SDD's `gemini_api_key text (encrypted)` literally and creates a `text` column, then tries to use pgsodium functions directly — which Supabase now discourages.

**Why it happens:** The SDD notation "(encrypted)" is implementation intent, not a SQL type. The actual implementation requires a UUID column pointing to Vault, not a text column.

**How to avoid:** In the migration SQL, define:
```sql
gemini_api_key_secret_id uuid  -- references vault.secrets(id), nullable
```
Not `gemini_api_key text`. The ProjectResponse Pydantic model exposes `has_api_key: bool`.

**Warning signs:** Migration succeeds but `vault.create_secret()` return value has nowhere to be stored.

### Pitfall 4: Supabase CLI Not Installed — Migration Approach

**What goes wrong:** The plan assumes `supabase db push` is available, but `supabase` CLI is not installed on the machine.

**Why it happens:** supabase CLI is not installed (`command -v supabase` returns nothing — confirmed in environment audit).

**How to avoid:** The migration SQL can be applied directly via the Supabase Dashboard SQL editor as a fallback, or the CLI can be installed via `npm install -g supabase@latest`. The plan should include a CLI install step OR a dashboard fallback instruction. The migration file (`supabase/migrations/<timestamp>_initial_schema.sql`) should be written regardless — it serves as the source of truth even if applied via dashboard.

**Warning signs:** `supabase db push` fails with "command not found".

### Pitfall 5: `@supabase/supabase-js` in the Frontend — Security Boundary

**What goes wrong:** Developers reach for `@supabase/supabase-js` in React components to query Supabase directly, bypassing FastAPI. This would expose the Supabase service key to the browser.

**Why it happens:** It's tempting to cut out the API layer for simple reads.

**How to avoid:** Frontend ALWAYS goes through FastAPI (`/api/*`). The `@supabase/supabase-js` package listed in dependencies is a placeholder for potential future needs (real-time subscriptions if needed) — in Phase 1, all Supabase access is server-side only.

**Warning signs:** `SUPABASE_KEY` appearing in browser network requests or browser console.

### Pitfall 6: React Router v7 Import Path Changed

**What goes wrong:** Importing from `'react-router-dom'` works in v6. In v7, the canonical import is `'react-router'` (the dom package re-exports from the core package). However, `'react-router-dom'` still works in v7 for backwards compatibility.

**Why it happens:** React Router v7 merged the packages. Both `'react-router'` and `'react-router-dom'` export the same symbols.

**How to avoid:** Use `'react-router-dom'` consistently for backwards compatibility. Both work but mixing them in one project is confusing.

**Warning signs:** TypeScript complaints about duplicate module declarations.

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `tailwind.config.ts` for tokens | `@theme {}` CSS block in `index.css` | Tailwind v4 (2024–2025) | Must translate UI-SPEC's `tailwind.config.ts` table to CSS variables |
| `google-generativeai` SDK | `google.genai` SDK | Google deprecated old SDK | Phase 1 doesn't touch this yet — relevant from Phase 5+ |
| Transparent Column Encryption (pgsodium) | Supabase Vault (`vault.create_secret`) | Supabase deprecated TCE | Vault is the correct approach for `gemini_api_key` |
| PostCSS plugin for Tailwind | `@tailwindcss/vite` Vite plugin | Tailwind v4 | Better performance; required for v4 with Vite |

**Deprecated/outdated:**
- `pgsodium` Column Encryption: deprecated by Supabase; do not use `pgsodium.crypto_aead_det_encrypt` directly
- `google-generativeai` pip package: deprecated by Google; migration to `google.genai` required (Phase 5)
- `tailwind.config.ts` as auto-detected config: no longer auto-detected in Tailwind v4 without `@config` directive

---

## Runtime State Inventory

> This is a greenfield phase — no renames or migrations of existing state. `/diagnostico/` remains untouched.

| Category | Items Found | Action Required |
|----------|-------------|-----------------|
| Stored data | None — Supabase project has no tables yet | Run migration to create 9 tables |
| Live service config | None — no sessions, no tunnel, no active pipeline | — |
| OS-registered state | None | — |
| Secrets/env vars | `diagnostico/.env` contains `GEMINI_API_KEY`, `GEMINI_MODEL`, `RECALL_WEBHOOK_SECRET` — unrelated to v2 backend | backend/.env will need `SUPABASE_URL`, `SUPABASE_KEY`; no conflict |
| Build artifacts | None — no frontend build exists yet | — |

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Frontend build | ✓ | v24.11.1 | — |
| npm | Package management | ✓ | 11.6.2 | — |
| Python 3 | Backend runtime | ✓ | 3.13.7 | — |
| pip3 | Python packages | ✓ | 25.2 | — |
| supabase CLI | Migration deployment | ✗ | — | Apply SQL via Supabase Dashboard SQL editor, or `npm install -g supabase` |
| ngrok | Tunnel (Phase 3, not Phase 1) | ✓ | 3.39.1 | — |
| cloudflared | Tunnel preferred (Phase 3) | ✗ | — | ngrok available as fallback |
| pytest | Backend tests | ✓ | 9.0.3 | — |
| Vite/vitest | Frontend tests | ✗ | — | Install as devDependency in Phase 1 scaffold |

**Missing dependencies with no fallback:**
- None blocking Phase 1.

**Missing dependencies with fallback:**
- `supabase CLI`: not installed. Plan must include either `npm install -g supabase` step OR a "apply via Supabase Dashboard" instruction. Migration SQL file written regardless.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Backend framework | pytest 9.0.3 |
| Frontend framework | vitest (to be installed as devDependency) |
| Backend config | `backend/pytest.ini` or `pyproject.toml [tool.pytest.ini_options]` — to be created in Wave 0 |
| Frontend config | `frontend/vitest.config.ts` (if separated from vite.config.ts) — Wave 0 |
| Backend quick run | `pytest backend/tests/ -x -q` |
| Frontend quick run | `cd frontend && npm run test -- --run` |
| Full suite | `pytest backend/tests/ && cd frontend && npm run test -- --run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PROJ-01 | POST /projects creates row in Supabase, stores Vault secret UUID | integration | `pytest backend/tests/test_projects.py::test_create_project -x` | ❌ Wave 0 |
| PROJ-02 | PUT /projects/:id updates project; closed sessions unaffected | integration | `pytest backend/tests/test_projects.py::test_edit_project -x` | ❌ Wave 0 |
| PROJ-03 | GET /projects returns has_active_session=True for projects with active sessions | integration | `pytest backend/tests/test_projects.py::test_active_session_badge -x` | ❌ Wave 0 |
| PROJ-04 | GET /projects/:id response never contains gemini_api_key plaintext; contains has_api_key bool | unit | `pytest backend/tests/test_projects.py::test_api_key_not_exposed -x` | ❌ Wave 0 |
| PROJ-05 | All 9 tables exist in Supabase after migration | integration (manual/smoke) | `pytest backend/tests/test_schema.py::test_tables_exist -x` | ❌ Wave 0 |

**Note:** Integration tests require a Supabase test project or a local Supabase instance. For Phase 1, a smoke test that calls the live Supabase project is acceptable since this is a local deployment with a single developer.

### Sampling Rate

- **Per task commit:** `pytest backend/tests/ -x -q`
- **Per wave merge:** `pytest backend/tests/ && cd frontend && npm run test -- --run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `backend/tests/__init__.py` — test package init
- [ ] `backend/tests/test_projects.py` — covers PROJ-01 through PROJ-04
- [ ] `backend/tests/test_schema.py` — covers PROJ-05 (table existence check)
- [ ] `backend/tests/conftest.py` — Supabase client fixture, test project cleanup
- [ ] `backend/pytest.ini` — test discovery config
- [ ] `frontend/vitest.config.ts` — vitest setup
- [ ] Frontend install: `npm install -D vitest @testing-library/react @testing-library/user-event`

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | Single-user local app; no login in Phase 1 |
| V3 Session Management | no | No user sessions in Phase 1 |
| V4 Access Control | no | Single-user; no multi-tenancy |
| V5 Input Validation | yes | Pydantic v2 models validate all API inputs |
| V6 Cryptography | yes | Supabase Vault (pgsodium AES-256-GCM) for API key at rest — never hand-roll |
| V7 Error Handling | partial | FastAPI exception handlers; never return raw Supabase errors to frontend |

### Known Threat Patterns for This Stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| API key leaked in GET /projects response | Information Disclosure | `has_api_key: bool` in ProjectResponse; never select from `vault.decrypted_secrets` in public endpoints |
| SQL injection via project name/description | Tampering | supabase-py uses parameterized queries through PostgREST — inputs are never string-concatenated into SQL |
| SUPABASE_KEY exposed in browser | Information Disclosure | All Supabase access is server-side (FastAPI); frontend never holds the service key |
| Cross-origin requests in dev | Tampering | Vite proxy handles CORS in dev; FastAPI CORS middleware needed for prod |

---

## Project Constraints (from CLAUDE.md)

| Directive | Type | Phase 1 Impact |
|-----------|------|----------------|
| Stack: React + Vite + TS + Tailwind (frontend) | Required | No deviations |
| Stack: Python + FastAPI + Uvicorn (backend) | Required | No deviations |
| Stack: Supabase PostgreSQL + Vault | Required | Schema + Vault pattern applied |
| Gemini API key in Supabase Vault; never in frontend | Security — mandatory | `gemini_api_key_secret_id uuid` column; `has_api_key: bool` in responses |
| No LangChain/LangGraph | Banned dependency | Not applicable in Phase 1 (no LLM calls) |
| v1 `/diagnostico/` untouched in Phase 1 | Compatibility | Backend lives in `/backend/`, not modifying any file in `/diagnostico/` |
| `asyncio.to_thread()` for all blocking calls | Architecture | Apply to all supabase-py calls in async FastAPI handlers |
| google.genai SDK (not google-generativeai) | Required from Phase 5 | Not applicable in Phase 1 |
| Tunnel: cloudflared preferred over ngrok | Infrastructure (Phase 3) | Not applicable in Phase 1 |
| main.py CLI entry point preserved | Compatibility | backend/app/main.py is a separate file; `/diagnostico/main.py` untouched |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `frontend/src/lib/supabase.ts` browser client is not used in Phase 1 — all Supabase access is server-side | Architecture | Low risk; if frontend-direct queries are needed later, add RLS policies |
| A2 | Supabase project already exists and credentials (SUPABASE_URL, SUPABASE_KEY) are available to be added to `.env` | Environment | Blocks all Phase 1 if Supabase project doesn't exist yet — user must create it at supabase.com |
| A3 | Vault extension is already enabled on the Supabase project (it is enabled by default on all new projects) | Standard Stack | If disabled, `vault.create_secret()` will fail; re-enable via Supabase Dashboard Extensions |
| A4 | The `transcript_chunks` table (9th table, not in CLAUDE.md Section 3 but mentioned in CONTEXT.md and REQUIREMENTS.md) — schema inferred from usage | Standard Stack | If schema is wrong, Phase 9 will need a corrective migration |
| A5 | supabase-py v2 requires `asyncio.to_thread()` for all calls (synchronous client) | Architecture Patterns | If supabase-py adds async support before execution, pattern is valid but unnecessary overhead |

---

## Open Questions

1. **Supabase project credentials**
   - What we know: SUPABASE_URL and SUPABASE_KEY are required env vars for the backend
   - What's unclear: Does the Supabase project already exist? Has it been linked?
   - Recommendation: Plan must include a "create Supabase project at supabase.com" step or verify it exists. Add `SUPABASE_URL` and `SUPABASE_KEY` to `backend/.env` as Wave 0 setup.

2. **`transcript_chunks` table schema**
   - What we know: Referenced in REQUIREMENTS.md (PROJ-05) and CONTEXT.md as one of 9 tables; not defined in CLAUDE.md Section 3
   - What's unclear: Exact column schema
   - Recommendation: Define minimal schema: `id uuid PK, session_id uuid FK, speaker text, text text NOT NULL, timestamp timestamptz`. Phase 9 can add columns if needed.

3. **Vault extension default availability**
   - What we know: Vault is documented as a Supabase extension; officially available on all Supabase projects
   - What's unclear: Whether it needs explicit enablement via Dashboard > Extensions
   - Recommendation: Plan includes a verification step: `SELECT * FROM vault.secrets LIMIT 1;` to confirm Vault is active before writing migration.

---

## Sources

### Primary (HIGH confidence)

- [CITED: supabase.com/docs/guides/database/vault] — Vault create_secret, update_secret, decrypted_secrets view
- [CITED: tailwindcss.com/docs/theme] — @theme directive, CSS variable namespaces in Tailwind v4
- [CITED: tailwindcss.com/docs/upgrade-guide] — tailwind.config.ts deprecation in v4, @tailwindcss/vite recommendation
- [CITED: tailwindcss.com/docs/installation/using-vite] — Tailwind v4 Vite installation steps
- [CITED: fastapi.tiangolo.com/tutorial/bigger-applications/] — APIRouter pattern, project structure
- [CITED: fastapi.tiangolo.com/tutorial/static-files/] — StaticFiles mount, html=True for SPA
- [CITED: supabase.com/docs/reference/python/initializing] — create_client signature, ClientOptions
- [CITED: reactrouter.com/start/library/routing] — BrowserRouter, Routes, Route, useParams, useNavigate
- [CITED: vite.dev/config/server-options.html] — server.proxy configuration

### Secondary (MEDIUM confidence)

- [CITED: supabase.com/docs/guides/database/column-encryption] — confirmed pgsodium TCE is deprecated; Vault recommended
- [CITED: supabase.com/docs/guides/cli/managing-environments] — supabase db push, migration file naming

### Tertiary (LOW confidence)

- `transcript_chunks` table schema — inferred from usage context; not in official schema definition

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all packages verified on npm registry + PyPI with official GitHub repos; no suspicious postinstall scripts
- Architecture: HIGH — patterns verified from official FastAPI, Supabase, Vite, React Router docs
- Tailwind v4 token approach: HIGH — verified from official upgrade guide; breaking change from v3 is confirmed
- Vault pattern: HIGH — confirmed from official Supabase Vault docs; pgsodium TCE deprecation confirmed
- Pitfalls: HIGH — derived from verified docs + reading v1 codebase patterns
- `transcript_chunks` schema: LOW — inferred

**Research date:** 2026-05-24
**Valid until:** 2026-06-24 (30 days — stable stack; Tailwind/Supabase APIs are stable)
