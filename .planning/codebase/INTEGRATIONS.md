---
last_mapped_commit: dd6d5da918c8145005ced2b3c76ba98fa6d32aa2
last_mapped_at: 2026-09-19
---
# External Integrations

**Analysis Date:** 2026-09-19

## APIs & External Services

**Large Language Models (LLM Providers):**

- **Google Gemini** - Primary LLM for diagnostic agent
  - SDK: `google-genai` (v2 backend, recommended) or `google.generativeai` (v1 legacy)
  - Auth: `GEMINI_API_KEY` (per-project, stored in Supabase Vault via `gemini_api_key_secret_id`)
  - Models: `gemini-2.0-flash` (default, fast/cheap), `gemini-2.0-pro` (higher quality)
  - Location: `backend/app/services/llm.py`, `backend/app/core/llm_factory.py`
  - Usage: Diagnostic classification, red flag detection, question generation, report generation

- **OpenAI (via LangChain)** - Configurable for Precificador agent
  - SDK: `langchain-openai`
  - Auth: `OPENAI_API_KEY` (stored per-project in database)
  - Models: `gpt-4o`, `gpt-4-turbo`, `gpt-3.5-turbo` (configurable)
  - Location: `backend/app/core/llm_factory.py`
  - Usage: Precificador chatbot, pricing generation (when selected as provider)

- **Anthropic Claude (via LangChain)** - Configurable for Precificador agent
  - SDK: `langchain-anthropic`
  - Auth: `ANTHROPIC_API_KEY` (stored per-project in database)
  - Models: `claude-3-5-sonnet`, `claude-3-opus`, `claude-3-haiku` (configurable)
  - Location: `backend/app/core/llm_factory.py`
  - Usage: Precificador chatbot, pricing generation (when selected as provider)

**Transcription & Meeting Integration:**

- **Recall.ai** - Cloud bot API for real-time meeting transcription
  - SDK: Manual HTTP client in `backend/app/services/recall.py`
  - Auth: `RECALL_API_KEY` (env var, then per-session override)
  - Endpoints: `https://{region}.recall.ai/api/v1/bot/` (create), `POST /bot/{bot_id}/leave_call/` (stop)
  - Region: `RECALL_REGION` env var (default: `us-west-2`)
  - Webhook: Sends transcript chunks via POST to `{PUBLIC_WEBHOOK_URL}/webhook/recall` with `transcript.data` events
  - Language: Portuguese (`pt`)
  - Location: `backend/app/services/recall.py`, `backend/app/routers/webhook.py`
  - Flow: Session creation → Recall API → bot joins meeting → transcripts pushed to webhook

- **Chrome Extension (Taqtic)** - Local transcript capture from Google Meet
  - SDK: Custom JavaScript in `extension/` (manifest v3)
  - Auth: None (runs in user's browser)
  - Webhook: Sends transcript chunks via POST to `{TUNNEL_URL}/webhook/extension` (local or tunneled)
  - Location: `extension/content_meet.js` (extraction), `extension/background.js` (relay)
  - Flow: Extension detects Google Meet → captures captions → sends to backend webhook

**Internal CITi Integration:**

- **CITi Flow** - Previous diagnostic and pricing history retrieval
  - SDK: Async HTTP client (`httpx`) in `backend/app/services/citiflow_client.py`
  - Auth: None (assumed internal, same network)
  - Base URL: `CITIFLOW_BASE_URL` (env var, default: `http://localhost:4100`)
  - Endpoints:
    - `GET /api/v1/briefings` - Fetch previous briefings by company name
    - `POST /api/v1/diagnostic-pricing` - Send generated pricing for workflow integration
  - Location: `backend/app/services/citiflow_client.py`
  - Error handling: Best-effort (failures logged, no blocking)

## Data Storage

**Databases:**

- **Supabase (PostgreSQL)** - Primary application database
  - Connection: `SUPABASE_URL` (database URL) + `SUPABASE_KEY` (service role key, env var)
  - Client: `supabase` Python library (async httpx underneath)
  - Location: `backend/app` (all routers and services)
  - Tables: `projects`, `sessions`, `questions`, `red_flags`, `coverage_snapshots`, `reports`, `question_bank`, `session_prompts`, `transcript_chunks`, `pricings`, `pricing_features`
  - Migrations: `supabase/migrations/*.sql` (initial schema, tunnel URL, recall bot ID, vault secrets, precificador schema)
  - Vault Extension: Secrets stored via `vault.create_secret()` for API keys (non-plaintext)

**File Storage:**

- **Local filesystem** (development) - Reports saved to disk in `reports/` directory
- **No cloud storage** - PDFs exported from Precificador written to local disk (intended for `~/Downloads`)

**Caching:**

- **None detected** - All data flows through database or LLM API calls; no Redis or in-memory cache configured

## Authentication & Identity

**Auth Provider:**

- **None (custom)** - No centralized auth; system operates in single-tenant mode (one user at a time)
- **Google Meet access** - Chrome extension reads captions from Google Meet DOM (no OAuth needed, extension runs in browser context)
- **Supabase Vault** - Secrets (API keys) encrypted at rest via `pgsodium`, accessed by service role key only

**Session Management:**

- **WebSocket connection** - Real-time updates authenticated by `session_id` query parameter in WebSocket URL
- **Project configuration** - API keys stored per-project in Supabase, fetched by project ID
- **Extension popup** - No authentication; configuration stored in Chrome `storage.local`

## Monitoring & Observability

**Error Tracking:**

- **None detected** - No Sentry, Datadog, or equivalent integrated
- **Logging:** Python `logging` module with `_log = logging.getLogger(__name__)` pattern
  - Backend: Logs to console/stdout (captured by Railway container)
  - Frontend: Browser console (no centralized logging)

**Logs:**

- **Backend:** Standard Python logging to stdout (JSON or structured logging not configured)
  - Locations: `backend/app/services/*.py` (warnings and exceptions logged)
  - Level: INFO for info, WARNING for recoverable failures, ERROR/exception for crashes
- **Frontend:** Browser DevTools console (React warnings, network errors)
- **Extension:** Browser DevTools → Extension tab (background script logs)

**Metrics:**

- **None detected** - No Prometheus, Grafana, or OpenTelemetry
- **Cost tracking:** Manual calculation of LLM token usage per session in `backend/app/models/sessions.py` (tokens_used, cost_usd columns)

## CI/CD & Deployment

**Hosting:**

- **Backend:** Railway.app
  - Builder: Dockerfile (Python 3.11)
  - Health check: `GET /health` (30s timeout)
  - Restart policy: On failure, max 3 retries
  - Port: 8080 (configurable via `PORT` env var)
  - Environment: `SUPABASE_URL`, `SUPABASE_KEY`, and optional vars passed via Railway dashboard

- **Frontend:** Vercel (static redirect only)
  - Config: `vercel.json` redirects all traffic to agente-diagnostico.vercel.app
  - Note: Actual SPA hosted by FastAPI in production (`frontend/dist` mounted at `/`)
  - Purpose: Vanity domain redirect (not primary deployment)

- **Database:** Supabase Cloud (managed PostgreSQL)
  - Migrations applied manually via CLI or Supabase dashboard
  - Backups: Supabase automatic daily backups

**CI Pipeline:**

- **None detected** - No GitHub Actions, GitLab CI, or similar
- **Local testing:** Developers run `pytest` and `npm run lint` manually
- **Deployment:** Railway auto-deploys on git push to main (if connected)

## Environment Configuration

**Required env vars:**

- `SUPABASE_URL` - Supabase project URL (https://xxxxx.supabase.co)
- `SUPABASE_KEY` - Supabase service role key (long string, marked secret)
- `GEMINI_API_KEY` - Google Gemini API key

**Optional env vars:**

- `RECALL_API_KEY` - Recall.ai bot API key (if using Recall for transcription)
- `RECALL_REGION` - Recall.ai region (default: `us-west-2`)
- `PUBLIC_WEBHOOK_URL` - Tunnel URL (auto-set by tunnel manager, override if needed)
- `CITIFLOW_BASE_URL` - CITi Flow base URL (default: `http://localhost:4100`)
- `PORT` - Backend port (default: 8080, set by Railway)
- `OPENAI_API_KEY` - OpenAI API key (only if using Precificador with OpenAI provider)
- `ANTHROPIC_API_KEY` - Anthropic API key (only if using Precificador with Anthropic provider)

**Secrets location:**

- **Local dev:** `backend/.env` file (in .gitignore, not committed)
- **Production:** Railway environment variables (dashboard → Variables)
- **Database secrets:** Supabase Vault via `vault.create_secret()` (API keys never stored as plaintext)

## Webhooks & Callbacks

**Incoming:**

- **POST /webhook/extension** - Chrome extension sends transcript chunks
  - Payload: `TranscriptChunk` (speaker, text, timestamp)
  - Source: Google Meet captions via extension
  - Processing: Adds to `transcript_chunks` table, triggers classification and red flag tasks

- **POST /webhook/recall** - Recall.ai sends transcript events
  - Payload: Recall webhook format with `transcript.data` events
  - Source: Recall.ai bot attending meeting
  - Processing: Parses event, adds to `transcript_chunks` table
  - Auth: Optional `RECALL_WEBHOOK_SECRET` header validation

**Outgoing:**

- **POST /api/v1/briefings** → CITi Flow (fetch, fire-and-forget on error)
  - Purpose: Get previous briefing context for company
  - Reliability: Best-effort, warnings logged

- **POST /api/v1/diagnostic-pricing** → CITi Flow
  - Purpose: Send generated pricing to workflow engine
  - Payload: `{runId, area: "dados", pricing: {...}}`
  - Reliability: Best-effort, errors logged but don't block session

**WebSocket Events (Real-Time):**

- **ws://localhost:8000/ws/{session_id}** - Server-to-client updates
  - Events: `coverage_update`, `red_flag`, `question_new`, `question_expired`, `transcript_chunk`, `budget_update`, `session_status`, `error`
  - Frequency: Coverage ~30s, red flags on detection, transcript chunks immediate, render task 250ms
  - Frontend: React components subscribe and update state

## Summary of Integration Flows

**Diagnostic Session (Real-Time):**

```
Chrome Extension (Google Meet) 
  → POST /webhook/extension 
  → TranscriptBuffer (asyncio.Queue) 
  → Parallel tasks (ingestion, classification, red flags, watchdog, render)
  → LLM (Gemini) for classification/red flags
  → Database (Supabase)
  → WebSocket → Frontend (React)
```

**Transcription via Recall.ai:**

```
Recall.ai bot (in meeting) 
  → POST /webhook/recall 
  → TranscriptBuffer
  → Same parallel pipeline as above
```

**Precificador Agent (Pricing):**

```
User interaction (web or MCP)
  → LangChain (with configurable provider: OpenAI, Anthropic, Google)
  → LangGraph state machine (chatbot, tool calls)
  → Database (Supabase pricings, features)
  → Optional: POST to CITi Flow
  → Export: PDF via fpdf2
```

**Tunnel Exposure (for Taqtic/external webhooks):**

```
cloudflared or ngrok (on localhost:8000)
  → Public URL (e.g., https://xxxxx.trycloudflare.com)
  → Taqtic extension or external webhook source
  → POST /webhook/extension or /webhook/recall
```

---

*Integration audit: 2026-09-19*
