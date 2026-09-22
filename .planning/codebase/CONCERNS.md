---
last_mapped_commit: dd6d5da918c8145005ced2b3c76ba98fa6d32aa2
last_mapped_at: 2026-09-19
---
<!-- refreshed: 2026-09-19 -->

# Codebase Concerns

**Analysis Date:** 2026-09-19

## Tech Debt

### SOLID Violation: Direct Database Access in Services

**Issue:** `pipeline.py` violates "Dependency Inversion" by calling `db.table(...)` directly 19 times instead of delegating to repositories. Line 168-175 (expire logic), 228-236 (coverage snapshot), 254-276 (red flags), 332-340 (questions).

**Files:** `backend/app/services/pipeline.py`

**Impact:** 

- Makes testing difficult (cannot mock database calls)
- Services depend on concrete database implementation, not abstraction
- Changes to database schema require editing the service layer
- Cannot swap Supabase for another database without rewriting services

**Fix approach:** Extract a `SessionRepository` class with methods like `persist_expired_questions()`, `save_coverage_snapshot()`, `save_red_flags()`, `save_question()`. Inject the repository into `SessionPipeline`. This aligns with the SOLID principles stated in `CLAUDE.md` (Dependency Inversion, Single Responsibility).

---

### SOLID Violation: Business Logic in Router Endpoint

**Issue:** `upload_pdf_transcript` endpoint (`backend/app/routers/sessions.py:350-499`, ~150 lines) handles PDF extraction, classification, report generation, cost calculation, and database updates — all in one route handler.

**Files:** `backend/app/routers/sessions.py:350-499`

**Impact:** 

- Endpoint violates "a router only validates input, calls service, and responds"
- Impossible to reuse PDF→report logic from other entry points without duplicating code
- Difficult to test the workflow in isolation
- Any change to report generation path requires editing the route

**Fix approach:** Create `PDFTranscriptService` with method `process_and_generate_report(session_id, pdf_bytes)` → handles PDF extraction, classification, report generation, cost tracking, and persistence. Route becomes: validate file → call service → return result. See `PLANO_AJUSTES.md` Task 6, Part B.

---

### Large Monolithic Frontend Component

**Issue:** `SessionActivePage.tsx` is 1010 lines in a single file, containing 8+ sub-components as internal functions (SessionTimer, CoveragePanel, BudgetBar, TranscriptPanel, QuestionsPanel, ReportModal, TTLBar, QuestionCard).

**Files:** `frontend/src/pages/SessionActivePage.tsx`

**Impact:** 

- Violates Single Responsibility Principle — one file should not contain a page layout, sidebar, central panel, right-side queue, and modal
- Difficult to reason about component relationships
- Hard to reuse smaller components (e.g., QuestionCard) in other pages
- Testing individual sub-components requires testing the entire page
- Line count (1010) makes diffs hard to review

**Fix approach:** Extract each sub-component to its own file in `frontend/src/components/session/`: `SessionTimer.tsx`, `CoveragePanel.tsx`, `BudgetBar.tsx`, `TranscriptPanel.tsx`, `TTLBar.tsx`, `QuestionCard.tsx`, `QuestionsPanel.tsx`, `ReportModal.tsx`. The page becomes a composition of these components. Mechanical refactor — no behavior change. See `PLANO_AJUSTES.md` Task 6, Part A.

---

## Known Bugs

### Question TTL Persistence Fixed (Task 4a)

**Issue (resolved):** `_expire_task` ran every 1s, marked questions as `dismissed` in memory only. On page reload, expired questions would reappear as `queued`.

**Files:** `backend/app/services/pipeline.py:145-190` (fixed)

**Current state:** `_expire_due_questions()` now persists batch updates to `questions` table with `.update({"status": "dismissed"}).in_("id", expired_ids).eq("status", "queued")` (line 170-174). Tested in `test_expire_questions.py`.

**Remaining consideration:** Batch update is only attempted for expired questions; if update fails, exception is logged but doesn't propagate (by design, so expire loop continues). Monitor for Supabase connectivity issues causing silent persistence failures.

---

### Report Cost Estimation Fixed (Task 4b)

**Issue (resolved):** `estimated_report_cost()` assumed 2500 output tokens but `generate_report` passed `max_output_tokens=16384`. Subestimation was ~6× actual cost, breaking F7 (budget auto-pausing).

**Files:** `backend/app/services/session_state.py:116-126` (fixed), `backend/app/services/llm.py:8` (constant defined)

**Current state:** `REPORT_MAX_OUTPUT_TOKENS = 16384` is now the source of truth, used in both `generate_report()` and `estimated_report_cost()`. Margin of 20% applied. Tested in `test_report_cost.py`.

**Remaining risk:** Gemini model pricing and `max_output_tokens` capability can change without notice. The constant was set as of 2026-09-14 for Gemini 2.5 Flash. Plan (per SDD F7): after ~10 real sessions, replace static estimate with observed average cost. Task to add: periodically revalidate Gemini pricing table from public API.

---

## Security Considerations

### Zero Authentication on Critical Endpoints

**Risk:** `POST /webhook/extension` and `POST /webhook/recall` have **no authentication** — anyone with the public Railway URL and a valid `session_id` can inject transcript chunks or manipulate session data.

**Files:** `backend/app/routers/webhook.py:18-36` (extension), `webhook.py:39-83` (recall)

**Current mitigation:** 

- Extension webhook requires a `session_id` from the active session (partial, requires user to know it)
- Recall webhook similarly needs `session_id`
- But `session_id` is UUIDv4, guessable brute-force risk, and could be extracted from open browser tabs

**Recommendations:**

1. Add token-based auth to extension webhook: client sends a secret token in the header; backend validates it
2. For Recall (server-to-server), use a signed webhook secret: Recall sends a signature in the payload; backend verifies with a per-session secret
3. Implement rate-limiting on webhook endpoints to mitigate brute-force attacks on `session_id`
4. Add audit logging to `transcript_chunks` inserts to detect suspicious injection patterns

**Decision pending:** See `PLANO_AJUSTES.md` Task 2 — auth strategy awaits team decision (token-based vs. Supabase Auth vs. minimal CORS).

---

### CORS Configured as Wildcard

**Risk:** `main.py:48` sets `allow_origins=["*"]`, exposing all endpoints to any website making cross-origin requests.

**Files:** `backend/app/main.py:46-52`

**Current mitigation:** 

- `allow_credentials=False` means cookies are not sent with CORS requests (partial mitigation)
- Webhooks are POST endpoints — browser CORS does not block POST from extensions or server-to-server

**Recommendations:**

1. Replace `["*"]` with explicit whitelist: e.g., `["https://yourdomain.com", "http://localhost:5173"]` (Vite dev)
2. Read the whitelist from environment variable `ALLOWED_ORIGINS` to avoid hardcoding
3. For Chrome extension, extensions use `chrome-extension://…` origin — test that restriction does not break the extension's `POST /webhook/extension`

**Status:** Can be implemented before broader auth strategy. Part of `PLANO_AJUSTES.md` Task 2 (2-CORS).

---

### Supabase Service-Role Key History Exposure

**Risk (partially mitigated):** Task 1 of `PLANO_AJUSTES.md` identified that the service-role key was committed to git (in docstring of `mcp_precificador.py` lines 23-26). The key is now removed and reads from env vars, but the old key remains in git history.

**Files:** `mcp_precificador.py` (now using placeholder + env vars)

**Current state:**

- Placeholder text now in source: `"<SUA_SERVICE_ROLE_KEY>"`
- Environment variable `SUPABASE_KEY` is the actual secret (loaded in `_get_db()`)
- Old key remains in git history and must be considered compromised

**Action required (external):** 

- Rotate the Supabase service-role key in the Supabase dashboard (invalidates the old one)
- Update environment variables on Railway, local machines, and Claude Desktop MCP config
- Confirm no other files contain the old key: `grep -r "eyJhbGci\|fzvwtkipzxdnubprvfct" --exclude-dir=.git`

**Prevention for future:** Add pre-commit hook with `gitleaks` or similar to reject commits containing base64-encoded JWT patterns or env var patterns.

---

## Performance Bottlenecks

### Transcript Deduplication Logic Uses Linear Search

**Issue:** `get_transcript_text()` deduplicates chunks by iterating through all chunks and comparing prefixes (lines 99-104 of `session_state.py`). For long sessions (1000+ chunks), this is O(n²) when called repeatedly by background tasks.

**Files:** `backend/app/services/session_state.py:93-109`

**Cause:** Transcript is built from extension chunks that arrive word-by-word, creating overlaps (e.g., "The project" → "The project has" → "The project has risks"). Dedup is correct but inefficient.

**Improvement path:** 

1. Cache the deduplicated transcript on the `SessionState` and invalidate only when new chunks arrive
2. Or: defer dedup to the background tasks that need the full text (coverage, red flags, questions) — don't call it on every push
3. For immediate mitigation: cap the `last_n` parameter used in `_coverage_task` (line 197: already does `last_n=100`, good)

**Impact:** Low — background tasks already limit to last 50–100 chunks, so full-text dedup is rarely called. But worth tracking for long sessions (>2 hours).

---

### Question Planner Can Generate Up To 5 Questions Synchronously

**Issue:** `trigger_questions()` calls `asyncio.create_task(self._run_question_planner())` without awaiting, but the planner runs `llm_service.generate_questions()` which makes a network call. Under load, multiple concurrent planners could exceed rate limits or cause timeouts.

**Files:** `backend/app/services/pipeline.py:94-95`, `281-343`

**Current safeguard:** `queued_count >= 5` breaks the loop (line 319), limiting to 5 questions per call. But multiple manual `trigger_questions()` calls could queue many tasks.

**Improvement path:** Add semaphore or flag to allow only 1 active question-planner task at a time. Use `self._planner_running` flag to gate concurrent planners.

**Impact:** Medium — only happens if user clicks "Gerar Perguntas" multiple times rapidly, or the background queue fills up. Worth documenting as "do not spam the generate button."

---

## Fragile Areas

### Tunnel Process Lifecycle Not Fully Managed

**Issue:** `TunnelManager.start()` spawns a `cloudflared` or `ngrok` process. If the process dies (OOM, SIGKILL, network error), there's no restart logic. The session thinks it has a tunnel URL but the tunnel is dead.

**Files:** `backend/app/services/tunnel.py:24-42`, `60-76`

**Why fragile:** 

- `_procs` dict stores processes, but no heartbeat check
- `get_url()` returns a URL even if the process crashed
- Extension will send chunks to a dead tunnel, causing 502 errors

**Safe modification:** 

1. Add periodic health check: `_verify_tunnel_alive(session_id)` pings the tunnel endpoint
2. If tunnel is dead, log a warning and restart it
3. Or: accept that tunnel is ephemeral and frontend retries on 502

**Test coverage gap:** No test verifies that tunnel stays alive or handles crashes gracefully.

---

### `_resolve_gemini_key()` Can Return Empty String on Failure

**Issue:** `_resolve_gemini_key()` in `pipeline.py:24-48` tries to fetch the key from Vault, but if the RPC call fails (exception at line 42), it silently returns an empty string. The caller (`_coverage_task` at line 113) then checks `if not self._resolve_gemini_key()` — which succeeds on empty string, so the task skips the classifier.

**Files:** `backend/app/services/pipeline.py:24-48`

**Impact:** Silent failure — the session appears to be running, but classification stops without alerting the user.

**Safe modification:** 

1. Log the exception when `vault_get_secret` fails (currently silent `pass` at line 42)
2. In the caller, distinguish between "no key configured" and "key lookup failed" — send a `error` WebSocket event on transient failures

**Test coverage:** No test for exception in vault lookup.

---

### Session State Is Synchronous But Backend Is Async

**Issue:** `SessionState` is a `@dataclass` with no locking. Multiple background tasks (`_coverage_task`, `_red_flag_task`, `_expire_task`) all read and write `self.state.questions`, `self.state.coverage`, `self.state.red_flags` concurrently without synchronization.

**Files:** `backend/app/services/session_state.py` (no locks), `backend/app/services/pipeline.py` (concurrent readers/writers)

**Why fragile:** Race conditions are unlikely but possible in high-concurrency scenarios:

- `_coverage_task` (30s) updates `self.state.coverage[area].score`
- `_expire_task` (1s) reads `self.state.questions` to mark expired
- If both happen simultaneously, state could be partially updated during iteration

**Current protection:** asyncio event loop is single-threaded, so true race conditions do not occur in pure async code. But serialization to JSON for WebSocket broadcast is unguarded.

**Safe modification:** Treat `SessionState` as immutable after pipeline starts, or add explicit locks around reads/writes to critical sections (questions, coverage). This is a code smell for future refactoring.

---

### Duplicate Prompts and Logic Between v1 and v2

**Issue:** `diagnostico/prompts.py` (~23KB, v1) and `backend/app/services/prompt_builder.py` (~34KB, v2) contain parallel prompt engineering. Changes to one are not mirrored to the other, creating divergence risk.

**Files:** `diagnostico/prompts.py`, `backend/app/services/prompt_builder.py`

**Why fragile:** 

- A dev could edit the v1 `prompts.py` thinking they're updating the active system (they're not — v2 web is the active product)
- If both v1 and v2 are in production, users see different agent behavior depending on entry point
- No integration tests comparing the two implementations

**Current status:** Per `PLANO_AJUSTES.md` Task 5, v1 is documented as "legacy CLI mode (v2 was rewritten, not migrated)." The ambiguity remains: is v1 still supported, or is it orphaned?

**Decision pending:** Either (a) remove `diagnostico/` entirely (`git rm -r diagnostico/`), or (b) mark it clearly as "read-only legacy" with a banner in `diagnostico/README.md`. See `PLANO_AJUSTES.md` Task 5.

---

## Scaling Limits

### Budget Tracking Is Session-Specific But Not Project-Wide

**Issue:** Cost is tracked per `sessions` row, but there's no global project budget enforcement. If a project has `budget_usd = 100` and 10 concurrent sessions, each session can independently spend $100, for a total of $1000.

**Files:** `backend/app/services/session_state.py:128-131` (budget_remaining is per-session)

**Impact:** High — concurrent sessions can collectively overspend project budget.

**Scaling path:** 

1. Add `project_budget_used` aggregation: `SELECT SUM(cost_usd) FROM sessions WHERE project_id = ? AND status IN ('active', 'finished')`
2. Before starting a session, check: `project.budget_usd - SUM(cost_usd) >= estimated_session_cost`
3. Deny session start if global budget exceeded

**Note:** This is a product-level decision — it may be intentional to allow per-session budgets independent of project budget.

---

### Webhook Ingestion Rate Not Limited

**Issue:** `POST /webhook/extension` and `/webhook/recall` have no rate limiting. A malicious client could flood the database with millions of `transcript_chunks` rows, causing disk bloat and Supabase quota exhaustion.

**Files:** `backend/app/routers/webhook.py`

**Impact:** Medium — Supabase has query rate limits, but no per-IP or per-session throttling in the backend.

**Scaling path:** 

1. Add rate limiter middleware: e.g., `slowapi` (FastAPI rate limiting library)
2. Limit per `session_id`: e.g., max 100 chunks/minute
3. Limit per IP: e.g., max 1000 requests/minute (optional, for public safety)

---

## Dependencies at Risk

### google-genai Version Pinning

**Issue:** `requirements.txt` specifies `google-genai>=0.8.0` (loose). If Google releases a breaking change in v0.9+ or v1.0, it could break the LLM integration without warning.

**Files:** `backend/requirements.txt:13`

**Impact:** Low (Google usually preserves compatibility), but possible.

**Migration plan:** 

1. Pin to specific version: `google-genai==0.8.0` (test before upgrading)
2. Keep an older fallback: `google-generativeai` (deprecated) available for downgrade if needed
3. Add integration test that calls `google-genai` and verifies it works

---

### Supabase Python Client Stability

**Issue:** `supabase>=2.3.0` is also loose-pinned. RPC call syntax or behavior could change in newer versions.

**Files:** `backend/requirements.txt:3`

**Current usage:** RPC calls like `vault_create_secret`, `vault_delete_secret` are relied upon for secret storage. If Supabase changes the RPC API, the app breaks.

**Migration plan:** Pin version and test RPC calls in CI: `supabase==2.3.0`. Monitor Supabase releases for breaking changes.

---

## Missing Critical Features

### No Observability / Logging in Critical Paths

**Issue:** Pipeline tasks (`_coverage_task`, `_red_flag_task`, `_expire_task`) have broad `except Exception: pass` blocks (e.g., line 119-120 of `pipeline.py`). Errors are swallowed silently.

**Files:** `backend/app/services/pipeline.py:119-120`, `132-133`

**Impact:** Hard to debug production issues — "the coverage classifier stopped working" with no error trace.

**Improvement:** 

1. Replace `except Exception: pass` with `except Exception: _log.exception(...)`
2. Add structured logging (JSON format) for JSON parsing errors, Supabase errors, LLM API errors
3. Set up a log aggregator (e.g., Cloud Logging if on GCP) to surface patterns

---

### No Health Check for Supabase Connectivity

**Issue:** `GET /health` checks only that the FastAPI app is running, not that Supabase is reachable. A database outage is not detected.

**Files:** `backend/app/main.py:85-92`

**Improvement:** Extend `/health` to query Supabase: `db.table("sessions").select("count()").limit(1)`. If it fails, return 503.

---

## Test Coverage Gaps

### Webhook Injection Untested

**Issue:** `POST /webhook/extension` and `/webhook/recall` have no automated tests validating that transcript chunks are properly ingested and broadcast to the frontend.

**Files:** `backend/app/routers/webhook.py` (no corresponding test file `test_webhook.py`)

**Risk:** A change to the webhook handler could silently break the extension's integration without CI catching it.

**Priority:** High — the webhook is the lifeline for the extension; it must not break.

---

### CORS Configuration Untested

**Issue:** No test verifies that a request from an unexpected origin is properly rejected (or accepted, if intended).

**Files:** `backend/app/main.py:46-52` (no CORS test)

**Improvement:** Add test that sends a request with `Origin: https://attacker.com` and verifies the response does NOT include `Access-Control-Allow-Origin: https://attacker.com`.

---

### Tunnel Startup Untested

**Issue:** `TunnelManager.start()` is never called in tests. The implementation could silently fail (e.g., if `cloudflared` is not installed) without any feedback to the user.

**Files:** `backend/app/services/tunnel.py` (no test)

**Improvement:** Add mock test that simulates cloudflared starting and URL being parsed.

---

---

*Concerns audit: 2026-09-19*
