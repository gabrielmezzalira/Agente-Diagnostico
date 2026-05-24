# Walking Skeleton — Phase 1: Project Configuration + Supabase Schema

**Phase:** 01
**Created:** 2026-05-24
**Walking skeleton goal:** Prove the full stack is wired end-to-end before building features.

---

## What the Skeleton Proves

After Plan 01 completes (and the schema is applied), a developer can:

1. Start the FastAPI backend: `cd backend && uvicorn app.main:app --reload`
2. Start the Vite frontend: `cd frontend && npm run dev`
3. Open `http://localhost:5173` and see a page with the "Agente Diagnóstico" topbar.
4. Navigate to `/projects` — the backend responds via the Vite proxy (`GET /api/projects` → 200 `[]`).
5. Submit the create-project form — FastAPI inserts a row in Supabase `projects`, stores the Gemini API key in Vault, returns the new project as JSON.
6. The home screen re-renders and shows the new project card.

That single round-trip (form → POST /api/projects → Supabase insert → card rendered) is the skeleton. Every subsequent plan adds vertical slices on top of this proven path.

---

## Minimal Deliverable per Layer

| Layer | Deliverable | Verified by |
|-------|-------------|-------------|
| **Database** | 9 tables created in Supabase; Vault stores first secret UUID | `pytest backend/tests/test_schema.py::test_tables_exist` + Supabase Dashboard |
| **Backend** | `GET /projects` → `[]`, `POST /projects` → project JSON with `has_api_key: true` | `pytest backend/tests/test_projects.py -x` |
| **Frontend** | HomePage renders card grid, ProjectFormPage submits to `/api/projects`, new card appears | `http://localhost:5173` manual smoke |

---

## Architectural Decisions Established in This Skeleton

These decisions are locked for all subsequent phases. Do not renegotiate without a phase insert.

| Decision | Value |
|----------|-------|
| Frontend root | `/frontend/` (Vite + React 19 + TypeScript) |
| Backend root | `/backend/` (FastAPI + uvicorn) |
| v1 module | `/diagnostico/` — UNTOUCHED |
| Dev API proxy | Vite `/api/*` → `http://localhost:8000` (prefix stripped) |
| Prod static serving | FastAPI `StaticFiles("/frontend/dist", html=True)` |
| DB client | supabase-py v2 singleton (`get_supabase()` in `database.py`) |
| Async pattern | `asyncio.to_thread(lambda: db.table(...).execute())` for all supabase-py calls |
| API key storage | Supabase Vault — UUID in `projects.gemini_api_key_secret_id`; never plaintext |
| API key exposure | `ProjectResponse.has_api_key: bool` only — never decrypted value |
| CSS framework | Tailwind v4 with `@theme {}` block in `index.css` (no `tailwind.config.ts`) |
| Icon library | Lucide React |
| Fonts | DM Sans + DM Mono via Google Fonts CDN `@import` in `index.css` |
| Routing | React Router v7 (`BrowserRouter`, `Routes`, `Route`) |
| Migration tool | `supabase/migrations/20260524000000_initial_schema.sql` applied via CLI or Dashboard |

---

## How to Run and Verify the Skeleton

### Prerequisites (one-time)

```bash
# 1. Create a Supabase project at https://supabase.com
#    Copy the Project URL and anon/service_role key.

# 2. Create backend/.env
#    SUPABASE_URL=https://your-project.supabase.co
#    SUPABASE_KEY=your-service-role-key

# 3. Apply migration (choose one):
#    Option A (CLI): npm install -g supabase && supabase db push
#    Option B (Dashboard): open Supabase Dashboard → SQL Editor → paste migration SQL → Run
```

### Start Backend

```bash
cd /path/to/project/backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
# Confirm: http://localhost:8000/docs opens FastAPI Swagger UI
```

### Start Frontend

```bash
cd /path/to/project/frontend
npm install
npm run dev
# Confirm: http://localhost:5173 opens, topbar shows "Agente Diagnóstico"
```

### Smoke Test the Round-Trip

```bash
# 1. Open http://localhost:5173/projects/new
# 2. Fill in all required fields (name, client, project type, Gemini API key)
# 3. Submit form
# Expected: redirects to /, new project card appears
# Expected network: POST http://localhost:5173/api/projects → 201

# Automated backend tests:
cd backend && pytest tests/ -x -q
```

---

## What Is Deliberately NOT in the Skeleton

The skeleton proves connectivity only. These are deferred to Plans 02 and 03 of this phase, and to later phases:

| Feature | Deferred to |
|---------|-------------|
| Full project CRUD (edit, delete) | Plan 02 (Phase 1) |
| Full UI with all form validations | Plan 03 (Phase 1) |
| Active session badge data (JOIN query) | Plan 02 (Phase 1) |
| Session creation and management | Phase 2 |
| Tunnel URL exposure | Phase 3 |
| Question bank seeding | Phase 4 |
| Dynamic prompt generation | Phase 5 |
| Monitoring screen (3-column layout) | Phase 6 |
| Question queue (TTL, pin/dismiss) | Phase 7 |
| Budget control (TokenCounter) | Phase 8 |
| Session persistence + history screen | Phase 9 |
| DMS calibration of agents | Phase 10 |
