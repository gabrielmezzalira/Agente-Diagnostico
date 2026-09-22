---
last_mapped_commit: dd6d5da918c8145005ced2b3c76ba98fa6d32aa2
last_mapped_at: 2026-09-19
---
<!-- refreshed: 2026-09-19 -->

# Architecture

**Analysis Date:** 2026-09-19

## System Overview

The Agente Diagnóstico system is a multi-layered technical diagnostic platform with a v2 web backend (FastAPI), React frontend, Chrome extension for Google Meet, and a legacy v1 CLI app. The v2 architecture follows SOLID principles with clear separation between routers (HTTP), services (business logic), repositories (data access), and models (contracts).

```text
┌────────────────────────────────────────────────────────────────┐
│                   Chrome Extension (capture)                   │
│        `extension/` — captures Meet transcripts → webhook       │
└────────────────────────────┬─────────────────────────────────┘
                             │ POST /webhook/extension
                             ▼
┌────────────────────────────────────────────────────────────────┐
│                   FastAPI Backend (v2.0)                       │
├─────────────────┬──────────────────┬────────────────────┬──────┤
│  HTTP Routers   │   Services       │   Repositories     │ Core │
│  `routers/`     │   `services/`    │   `repositories/`  │      │
│  • projects     │  • pipeline      │   • pricing        │•llm_ │
│  • sessions     │  • llm           │                    │ factory
│  • questions    │  • prompt_build  │                    │•pricing
│  • webhook      │  • session_state │                    │ calc
│  • ws           │  • llm_pricing   │                    │      │
│  • pricings     │  • pricing_chat  │                    │      │
└────────┬────────┴─────────┬────────┴────────────────────┴──────┘
         │                  │
         │  WebSocket       │  SessionPipeline
         │  (real-time)     │  (async tasks)
         ▼                  ▼
┌────────────────────────────────────────────────────────────────┐
│                    Supabase (PostgreSQL)                       │
│  • projects • sessions • questions • red_flags • coverage      │
│  • transcript_chunks • reports • question_bank • session_prompts
└────────────────────────────────────────────────────────────────┘
         ▲                  ▲
         │                  │
         │  REST/JSON       │  real-time
         │                  │  state push
         │                  │
┌────────┴──────────────────┴──────────────────────────────────┐
│             React Frontend (v2.0) — Vite                      │
├──────────────┬──────────────────┬─────────────────────────────┤
│   Pages      │   Hooks          │   Lib                       │
│  `pages/`    │   `hooks/`       │   `lib/`                    │
│  • Home      │  •usePricing     │   • api.ts (REST client)    │
│  • Project*  │  •usePricing*    │   • useSessionWS.ts (WS)    │
│  • Session*  │  •useLLM*        │   • pricingCalculator.ts    │
│  • Pricing*  │  •useSessionWS   │                             │
└──────────────┴──────────────────┴─────────────────────────────┘

[*] Feature not fully implemented or in progress
```

---

## Component Responsibilities

| Component | Responsibility | File |
|-----------|----------------|------|
| **FastAPI App** | HTTP server, CORS, exception handler, SPA mounting | `backend/app/main.py` |
| **Projects Router** | CRUD projects, vault API key storage | `backend/app/routers/projects.py` |
| **Sessions Router** | Start session, finish session, upload PDF, generate report | `backend/app/routers/sessions.py` |
| **Webhook Router** | Accept Chrome extension + Recall.ai transcript chunks | `backend/app/routers/webhook.py` |
| **WebSocket Router** | Client connection, initial state push, event handlers | `backend/app/routers/ws.py` |
| **SessionPipeline** | In-memory pipeline for active sessions, async tasks | `backend/app/services/pipeline.py` |
| **SessionState** | Session memory (coverage, red_flags, questions, transcript, budget) | `backend/app/services/session_state.py` |
| **LLM Service** | Gemini API calls (classify, detect, generate, report) | `backend/app/services/llm.py` |
| **PromptBuilder** | Generate dynamic prompts per project type and DMS | `backend/app/services/prompt_builder.py` |
| **PricingRepository** | CRUD pricing configs, features, suggestions | `backend/app/repositories/pricing_repository.py` |
| **React App** | SPA router, page composition | `frontend/src/App.tsx` |
| **SessionActivePage** | Real-time monitoring: coverage, red flags, questions, transcript | `frontend/src/pages/SessionActivePage.tsx` |
| **Chrome Extension** | Capture Google Meet transcripts, push to webhook | `extension/content_meet.js`, `extension/background.js` |

---

## Pattern Overview

**Overall:** Layered + Event-Driven + SOLID

**Key Characteristics:**

- **Separation of Concerns:** Routers delegate to services; services orchestrate repositories and LLM clients; repositories own database queries.
- **Dependency Inversion:** Services receive dependencies (DB, API keys) via parameters or injection, never hardcoded clients.
- **Real-time via WebSocket:** Frontend subscribes to `ws://{backend}/ws/{session_id}`; backend pushes events (coverage, red_flags, questions, budget).
- **Async Pipeline:** SessionPipeline runs 4 concurrent tasks (coverage, red_flag, question, render) per active session, bounded by budget.
- **State Persistence:** SessionState (in-memory) is synced with Supabase on each LLM call; allows session recovery after restart.
- **Dynamic Prompts:** PromptBuilder generates system prompts per project type and Data Maturity Score instead of fixed constants.

---

## Layers

### **HTTP Layer (Routers)**

**Purpose:** Validate HTTP input, delegate to services, return responses.

**Location:** `backend/app/routers/`

**Contains:**

- `projects.py` — List, create, get, update, delete projects
- `sessions.py` — Start session (with context), finish session, upload PDF for analysis, generate final report
- `questions.py` — Question CRUD (stub)
- `question_bank.py` — Retrieve question bank by type
- `pricings.py` — Pricing CRUD, AI suggestions
- `pricing_features.py` — Pricing feature definitions
- `webhook.py` — Receive transcript chunks from Chrome extension and Recall.ai
- `ws.py` — WebSocket upgrade, initial state push, event routing

**Depends on:** Services, models, database

**Used by:** Frontend (REST), extension (webhook), clients (WebSocket)

**Pattern:** Router validates, calls service, returns schema. Database queries never in router.

---

### **Service Layer**

**Purpose:** Orchestrate business logic, call LLM, manage session state, calculate pricing.

**Location:** `backend/app/services/`

**Key Services:**

| Service | Responsibility | Key Methods |
|---------|-----------------|------------|
| `pipeline.py` | Manage active sessions, run async tasks | `SessionPipeline.start/stop`, `_coverage_task`, `_red_flag_task`, `_question_planner`, `_report_generator` |
| `session_state.py` | In-memory session state (coverage, questions, red flags, budget) | `get_transcript_text`, `add_token_cost`, `budget_remaining`, `coverage_to_dict` |
| `llm.py` | Gemini API calls, token counting, cost calculation | `classify_coverage`, `detect_red_flags`, `generate_questions`, `generate_report` |
| `prompt_builder.py` | Generate dynamic prompts per project type and DMS | `build_all`, `_build_coverage_classifier`, `_build_red_flag_detector` |
| `llm_pricing_service.py` | Pricing LLM logic (feature extraction, AI suggestions) | `extract_features_from_text`, `generate_ai_suggestions` |
| `pricing_chatbot_service.py` | LangChain-based chatbot (for Precificador feature) | `handle_message` |
| `pricing_service.py` | Pricing domain logic (validation, calculation) | `validate_pricing`, `calculate_totals` |
| `pricing_export_service.py` | Export pricing to external systems (Airtable, etc.) | `export_to_airtable` |
| `citiflow_client.py` | Fetch briefings from CITi Flow API | `fetch_briefings_as_context` |
| `recall.py` | Recall.ai integration | `setup_bot`, `get_status` |
| `tunnel.py` | cloudflared / ngrok tunnel management | `start`, `stop`, `get_public_url` |
| `ws_manager.py` | WebSocket connection registry and broadcast | `connect`, `disconnect`, `broadcast` |
| `structured_context.py` | Extract structured data from pre-meeting context | `extract_structured_context` |

**Depends on:** Database, models, LLM clients, core utilities

**Used by:** Routers, pipeline tasks, other services

**Pattern:** Services are stateless; SessionState holds session data; dependency injection for clients and DB.

---

### **Repository Layer**

**Purpose:** Encapsulate all database queries. One repository per domain.

**Location:** `backend/app/repositories/`

**Repositories:**

| Repo | Domain |
|------|--------|
| `pricing_repository.py` | Pricing configs, features, suggestions, exports |

**Pattern:** Methods take domain objects, return domain objects. No SQL escapes repository boundary.

**Note:** Most other table access happens directly in routers (projects, sessions) or services (pipeline). This violates SOLID; refactoring to add repositories for those is an open concern (see CONCERNS.md).

---

### **Models (Pydantic Schemas)**

**Purpose:** Define request/response contracts.

**Location:** `backend/app/models/`

**Files:**

- `projects.py` — `ProjectCreate`, `ProjectUpdate`, `ProjectResponse`
- `sessions.py` — `SessionCreate`, `SessionRename`, `SessionResponse`, `ReportResponse`
- `questions.py` — `QuestionResponse`
- `pricings.py` — `PricingCreate`, `PricingUpdate`, `PricingResponse`, etc.
- `pricing_features.py` — Feature domain

**Pattern:** Separate create/update/response schemas to enforce input validation and output hiding (e.g., `gemini_api_key_secret_id` never exposed to frontend).

---

### **Core Utilities**

**Purpose:** Shared factories, configuration, helpers.

**Location:** `backend/app/core/`

**Files:**

- `llm_factory.py` — Create LLM clients (Gemini, Anthropic, OpenAI via LangChain for Precificador)
- `pricing_calculator.py` — Pure function: calculate pricing total from features and business logic

**Pattern:** Dependency injection; no singletons; stateless.

---

### **Database Layer**

**Purpose:** Persistent storage and session recovery.

**Location:** `backend/app/database.py`

**Client:** Supabase Python SDK

**Pattern:** `get_supabase()` dependency injection; RPC calls for vault (secret storage).

**Key Tables:**

- `projects` — Project config, API keys (vault ref), budget
- `sessions` — Session state (active/finished), tokens_used, cost_usd
- `transcript_chunks` — Streaming transcript chunks
- `coverage_snapshots` — Timestamped coverage state
- `red_flags` — Detected risk alerts
- `questions` — Generated + user questions, TTL-based expiry
- `reports` — Final diagnostic report (Markdown)
- `question_bank` — Question templates by type and priority
- `session_prompts` — Generated prompts per session (for reproducibility)
- `pricings` — Pricing configs and calculations
- `pricing_features` — Feature catalog

---

### **Frontend Layer (React)**

**Purpose:** Render UI, manage local state, drive API and WebSocket.

**Location:** `frontend/src/`

**Structure:**

| Dir | Purpose |
|-----|---------|
| `pages/` | 7 pages (Home, ProjectForm, ProjectDetail, SessionSetup, SessionActive, PricingList, PricingEditor) |
| `hooks/` | State management: `usePricing`, `usePricingChat`, `useLLMSuggestions`, `useSessionWS` |
| `lib/` | Utilities: `api.ts` (REST), `useSessionWS.ts` (WebSocket), `pricingCalculator.ts` |
| `components/` | Reusable components (currently minimal: CITiLogo) |
| `assets/` | Static assets |

**Pattern:**

- Pages are route endpoints, compose hooks and components.
- Hooks hold state and side effects (fetch, WebSocket).
- Components are presentational (no business logic).
- API calls via `lib/api.ts` (typed Fetch wrapper).

---

### **Chrome Extension**

**Purpose:** Capture Google Meet transcripts and push chunks to backend.

**Location:** `extension/`

**Architecture:**

| File | Role |
|------|------|
| `manifest.json` | Extension permissions, scripts, UI |
| `background.js` | Service worker; receives messages from content scripts, forwards to backend |
| `popup.html` | UI for extension (session ID input, start/stop) |
| `popup.js` | Popup logic (store session ID, send messages) |
| `content_meet.js` | Content script on Google Meet; captures captions, detects speaker, sends via `chrome.runtime.sendMessage` |
| `content_app.js` | Generic content script for fallback (unused in v2) |

**Data Flow:**

1. `content_meet.js` polls DOM for visible captions
2. Detects caption changes (word-by-word growth)
3. Sends `{session_id, text, speaker}` to `background.js`
4. `background.js` POST to `POST /webhook/extension`
5. Backend queues chunk in pipeline and persists to DB

**Pattern:** Chunk-based (word-by-word); deduplication via diff; speaker detection via heuristic.

---

### **Real-Time Pipeline (SessionPipeline)**

**Purpose:** Drive 4 concurrent async tasks for active sessions.

**Location:** `backend/app/services/pipeline.py`

**Lifecycle:**

1. **Initialization** (`get_or_create`):
   - Fetch session from DB (with project and budget)
   - Retrieve Gemini API key from Supabase Vault (or env)
   - Build dynamic prompts via PromptBuilder
   - Create SessionState from project config + session data
   - If session is active: start tasks; if finished: load state only (no background tasks)

2. **Active Session Tasks** (run concurrently):

| Task | Cadence | What it does |
|------|---------|------------|
| `_coverage_task` | Every 30s | Call `classify_coverage` LLM, update coverage state, persist snapshot, broadcast |
| `_red_flag_task` | Every 15s (after 15s delay) | Call `detect_red_flags` LLM, deduplicate, persist, broadcast |
| `_render_task` | Every 1s | Broadcast budget state |
| `_expire_task` | Every 1s | Check question TTL, mark expired as dismissed, broadcast |

3. **Event Handlers** (on WebSocket events):
   - `trigger_questions` → run `_run_question_planner` (async)
   - `trigger_report` → run `_run_report_generator` (check budget, generate, broadcast)
   - Question status changes → persist to DB

4. **Graceful Shutdown**:
   - Cancel all tasks
   - Persist final state to DB
   - Disconnect WebSocket clients

**Budget Control:**

- `budget_remaining()` checked before each task
- If remaining < estimated_report_cost, tasks pause (coverage, red_flag skip; render/expire continue)
- Frontend displays warning, disables report generation

**State Persistence:**

- Every LLM call: `add_token_cost(inp_tokens, out_tokens)` updates `state.tokens_used`, `state.cost_usd`
- Coverage, red_flags, questions written to DB immediately (non-blocking)
- Session record updated with final tokens/cost on finish

---

## Data Flow

### Primary Request Path (Real-time Monitoring)

1. **Extension captures transcript** (`content_meet.js`)
   - Polls DOM for visible captions every ~100ms
   - Detects change (speaker or new words)
   - Sends `{session_id, text, speaker}` to `background.js`

2. **Webhook receives chunk** (`POST /webhook/extension`)
   - Validates `session_id` and text
   - Inserts to `transcript_chunks` table
   - Calls `pipeline_manager.push_chunk(session_id, text, speaker)` (async, non-blocking)

3. **Pipeline ingests chunk** (`SessionPipeline.push_chunk`)
   - Appends to `state.transcript_chunks`
   - Deduplicates (if chunk is extension of prev chunk from same speaker, broadcasts only new part)
   - Broadcasts `transcript_chunk` event to WebSocket clients

4. **Coverage task runs** (every 30s, if transcript has grown)
   - Calls `classify_coverage(transcript_last_100_chunks)`
   - LLM returns `{areas: {negocio: {status, score, notes}, ...}}`
   - Updates state; if changed, inserts `coverage_snapshot`, updates session record
   - Broadcasts `coverage_update` event

5. **Red flag task runs** (every 15s)
   - Calls `detect_red_flags(transcript_last_50_chunks, context, dms)`
   - LLM returns list of flags (max 2 per cycle)
   - Deduplicates (by first 60 chars of text)
   - Inserts to `red_flags` table, appends to state
   - Broadcasts `red_flag` event

6. **Question planner runs** (on manual trigger or timer — timer removed v2, manual only)
   - Checks max 5 queued (hard limit)
   - Calls `generate_questions(transcript_last_80, coverage, recent_questions, ...)`
   - Inserts to `questions` table with `expires_at = now + ttl_seconds`
   - Broadcasts `question_new` event

7. **Frontend receives updates** (`useSessionWS` hook)
   - WebSocket receives `coverage_update` → updates local state
   - Coverage panel re-renders with new status/score
   - Transcript appends to bottom
   - Red flags and questions added to respective panels
   - Budget bar updates every 1s (render task)

8. **Question expiry** (`_expire_task`)
   - Every 1s, checks if any `queued` question has passed `expires_at`
   - Marks as `dismissed` in memory and DB
   - Broadcasts `question_expired` event
   - Frontend removes from queue

### Report Generation Flow

1. **Frontend triggers report** (`SessionActivePage` button click)
   - Sends WebSocket event `{event: "generate_report"}`
   - Backend receives in `ws.py`, calls `pipeline.trigger_report()`

2. **Pipeline generates report** (`SessionPipeline._run_report_generator`)
   - Checks budget: `estimated_report_cost > budget_remaining`?
   - If not enough saldo: return error event, don't call LLM
   - Calls `generate_report(transcript_full, coverage, red_flags, dms)`
   - LLM returns Markdown (~16K tokens max)
   - Inserts to `reports` table with cost_usd
   - Broadcasts `report_ready` event with markdown content

3. **Frontend displays report**
   - Receives `report_ready` event
   - Updates local state: `reportMarkdown`
   - Modal or panel renders Markdown (via `react-markdown`)

### Session Finish Flow

1. **Frontend requests finish** (`SessionActivePage` button)
   - Sends WebSocket event `{event: "finish_session"}`

2. **WebSocket handler** (`ws.py`)
   - Updates session record: `status='finished'`, `finished_at=now`, final tokens/cost
   - Calls `pipeline_manager.stop_session(session_id)`
   - Closes WebSocket

3. **Pipeline stops** (`SessionPipeline.stop`)
   - Cancels all background tasks
   - Awaits tasks completion

4. **Frontend redirects**
   - Receives WebSocket close
   - Navigates to project detail page or session history

---

## Key Abstractions

### **SessionState**

**Purpose:** Encapsulate in-memory session data.

**Location:** `backend/app/services/session_state.py`

**Key Attributes:**

- `session_id`, `project_id`, `project_type`, `data_maturity_score`
- `transcript_chunks` — list of `{text, speaker, timestamp}`
- `coverage` — dict of `CoverageArea {status, score, notes}`
- `red_flags` — list of `RedFlag {id, text, severity, evidence}`
- `questions` — list of `Question {id, text, block, status, expires_at}`
- `tokens_used`, `cost_usd` — cumulative token count and cost
- `budget_usd` — max spend (from project or session config)
- `prompts` — dict of generated system prompts per agent

**Key Methods:**

- `get_transcript_text(last_n)` — Deduplicate and format transcript chunks
- `add_token_cost(inp, out)` — Increment cost_usd based on token count
- `budget_remaining()` — Returns `budget_usd - cost_usd` or None (no limit)
- `estimated_report_cost()` — Estimate LLM cost of final report (used to prevent over-spend)
- `coverage_to_dict()` → broadcast-ready JSON

**Pattern:** Pure dataclass (immutable fields); mutations through explicit methods.

---

### **SessionPipeline**

**Purpose:** Orchestrate 4 concurrent async tasks per session.

**Location:** `backend/app/services/pipeline.py`

**Key Methods:**

- `start()` — Launch tasks
- `stop()` — Cancel tasks gracefully
- `push_chunk(text, speaker)` — Ingest transcript chunk, deduplicate, broadcast
- `trigger_questions()` — Force question generation now
- `trigger_report()` — Force report generation (if budget OK)

**Invariants:**

- Coverage score is monotonic (never decreases)
- Max 5 queued questions at a time (hard limit)
- Budget checked before every task; pauses if insufficient
- All writes to DB are non-blocking (async, errors logged, don't stop pipeline)

---

### **PromptBuilder**

**Purpose:** Generate system prompts per project type and Data Maturity Score instead of fixed constants.

**Location:** `backend/app/services/prompt_builder.py`

**Key Methods:**

- `build_all()` → `{agent_name: prompt_text}`
- `_build_coverage_classifier()` → System prompt for coverage classification
- `_build_red_flag_detector()` → System prompt for red flag detection
- `_build_question_planner()` → System prompt for question generation
- `_build_report_generator()` → System prompt for report generation

**Inputs:**

- `project_type` — Enum (bi, ml, data_engineering, automation, integration, science)
- `data_maturity_score` — 1–5 (affects calibration of agent severity, vocabulary)
- `pre_meeting_context` — Customer background already known
- `structured_context` — Extracted key facts (decision point, pain, budget, etc.)

**Pattern:** Conditional template generation; fallback to base prompt if context missing.

---

## Entry Points

### **HTTP Entry Point**

**Location:** `backend/app/main.py`

**Triggers:** FastAPI startup

**Responsibilities:**

- Create FastAPI app
- Configure CORS (allow `*` for extension + Vite dev + prod)
- Register routers
- Mount SPA (`frontend/dist`)
- Define global exception handler (preserves CORS headers on 500)

**Flow:**

```
GET  /health
POST /projects
GET  /projects/{id}
POST /sessions/start
GET  /sessions/{id}
POST /webhook/extension
ws   /ws/{session_id}
... (more in routers)
```

---

### **WebSocket Entry Point**

**Location:** `backend/app/routers/ws.py`

**Triggers:** Frontend calls `new WebSocket(`ws://backend/ws/{sessionId}`)`

**Flow:**

1. Upgrade HTTP → WebSocket
2. Call `pipeline_manager.get_or_create(session_id)`
   - Load session from DB
   - Build prompts, create SessionState
   - Start pipeline (or load state only if finished)
3. Send `initial_state` event (coverage, red_flags, questions, transcript, budget)
4. Loop: receive client messages
   - `generate_questions` → trigger planner
   - `force_classify` → trigger coverage task
   - `pin_question` / `dismiss_question` / `use_question` → update status
   - `finish_session` → stop pipeline, close
5. On disconnect: cleanup

---

### **Webhook Entry Point**

**Location:** `backend/app/routers/webhook.py`

**Triggers:** Chrome extension POST → `POST /webhook/extension` or Recall.ai → `POST /webhook/recall`

**Flow:**

1. Validate payload
2. Insert chunk to `transcript_chunks` table
3. Call `pipeline_manager.push_chunk(session_id, text, speaker)` (async, fire-and-forget)
4. Return 202 Accepted immediately
5. Backend processes chunk asynchronously (no blocking on client)

---

### **Frontend Entry Point**

**Location:** `frontend/src/main.tsx`

**Triggers:** Vite dev server or SPA load

**Flow:**

1. Render `App` component (React Router)
2. Route to requested page
3. Page component renders, hooks initialize
   - `useSessionWS` connects WebSocket if on SessionActivePage
   - `usePricing` fetches pricing data if on PricingPage
   - etc.
4. User interacts → hook state updates → re-render

---

## Architectural Constraints

- **Threading:** Python asyncio event loop; no threading (GIL concern, but async is fine). SessionPipeline tasks are coroutines, not threads.
- **Global state:** `pipeline_manager` is a global singleton (one per process); `ws_manager` is a global singleton. No session state is global — all in `SessionState` objects keyed by session_id.
- **Circular imports:** Potential in `pipeline.py` (imports `llm_service` which might import `pipeline.py`). Currently avoided.
- **Budget enforcement:** Session-level, not global. Each session has its own budget from project config.
- **Concurrency:** 4 tasks per active session (scalable). WebSocket broadcast is async, non-blocking.
- **Database consistency:** Supabase handles ACID. No explicit transactions in code (should be added for multi-step operations like vault create + project insert).
- **API Key Security:** Gemini keys stored in Supabase Vault (encrypted), not in code or env (except fallback env var). Frontend never sees keys.

---

## Anti-Patterns

### Routers Doing Database Queries

**What happens:** `projects.py` router contains `db.table().insert().execute()` calls directly.

**Why it's wrong:** Violates SOLID (SRP). Routers should delegate to services/repositories. Makes testing hard, couples router to schema.

**Do this instead:** Create `ProjectRepository` with `create(payload)` → `ProjectResponse`. Router calls `repository.create()`.

---

### Direct Database Access in Services

**What happens:** `SessionPipeline` calls `db.table("red_flags").insert({...})` directly.

**Why it's wrong:** Services should use repositories to access DB. Makes mocking hard, couples service to schema.

**Do this instead:** Create `SessionRepository` with `save_red_flag(session_id, flag)` → `RedFlag`. Service calls `repo.save_red_flag()`.

---

### Async/Await in Wrong Layer

**What happens:** Some routers are async (good for WebSocket), but others are sync even though they call async services (bad).

**Why it's wrong:** Blocks event loop. Endpoint handlers should be async if they call async services.

**Do this instead:** Make all router endpoints async. Use `await` for all async calls.

---

## Error Handling

**Strategy:** Try-catch in tasks; log errors; don't stop pipeline.

**Patterns:**

1. **LLM call fails** (rate limit, invalid key, etc.):
   - Caught in `_coverage_task`, `_red_flag_task`, etc.
   - Logged via `_log.exception(...)`
   - Task sleeps and retries next cycle
   - Frontend never notified (doesn't block UX)

2. **Budget exhausted**:
   - Checked before each task
   - Coverage/red_flag tasks skip (continue next cycle)
   - Render/expire continue (non-LLM tasks)
   - Frontend shows warning in budget bar

3. **Vault key not found**:
   - Fallback to env var `GEMINI_API_KEY`
   - If neither, tasks skip silently

4. **HTTP request fails**:
   - Router returns 400/422/500 with JSON detail
   - Frontend displays error toast or modal

---

## Cross-Cutting Concerns

**Logging:** `_log = logging.getLogger(__name__)` per module. Errors logged at exception level.

**Validation:** Pydantic models validate HTTP input. LLM output validated post-parse (try-except JSON).

**Authentication:** None currently (no auth layer). Assumes backend is internal or behind API gateway.

**Cost Tracking:** Every LLM call: `state.add_token_cost(inp, out)`. Tokens summed, cost calculated, persisted.

**Rate Limiting:** None explicitly. Relies on Gemini API rate limits + Supabase quotas.

---

*Architecture analysis: 2026-09-19*
