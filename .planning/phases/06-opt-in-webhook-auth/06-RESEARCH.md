# Phase 6: Opt-In Webhook Auth - Research

**Researched:** 2026-09-24
**Domain:** FastAPI header-based auth dependency (opt-in) + Chrome MV3 extension optional-secret storage
**Confidence:** HIGH

## Summary

This phase is small and entirely additive: a shared-secret header check on one FastAPI route
(`POST /webhook/extension`), and a matching optional key field in the Chrome extension popup that
sends that header when configured. Nothing in the required reading or in the surrounding codebase
requires a new library — `fastapi.Header` + a plain dependency function covers the backend side,
and `secrets.compare_digest` (Python stdlib) covers the timing-safe comparison. The extension side
reuses the exact "URL do backend" input/save/`chrome.storage.local` pattern already in
`popup.html`/`popup.js`/`background.js` verbatim.

Two findings change what the planner would otherwise assume from CONTEXT.md's canonical refs:
(1) `AppConfig`/`load_config()` in `backend/app/config.py` is **dead code** — never imported
anywhere in the running app (verified by grep across `backend/app`) — so following its "pattern"
literally would add a new call site nobody else exercises; the actual live convention for optional
env vars is a direct `os.environ.get("VAR", "")` read at the point of use, exactly like
`sessions.py::_get_recall()` reads `RECALL_API_KEY`. (2) CORS is already wide open
(`allow_headers=["*"]`, `allow_credentials=False`) and the manifest's `host_permissions` already
covers the Railway/localhost hosts the extension talks to — adding the `x-agente-key` header needs
**no CORS or manifest change**.

**Primary recommendation:** Add a small `verify_extension_key` dependency function directly in
`backend/app/routers/webhook.py` (same file, same "local dependency" idiom already used elsewhere
in the codebase as `_get_service`/`_get_recall`), reading `EXTENSION_SHARED_KEY` fresh from
`os.environ` on every call (not cached at import time — this is what makes it testable via
`monkeypatch.setenv`/`delenv` and keeps behavior consistent with `_get_recall()`). Wire it with
`Depends(verify_extension_key)` on the `extension_webhook` route only — never at router level,
since `recall_webhook` shares the same `APIRouter` instance and must stay untouched (D-01).

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Shared-secret verification (header vs env var) | API / Backend | — | Auth is a backend concern; the extension only *sends* the header, it never validates it |
| Optional key input + persistence | Browser / Client (extension popup) | — | `chrome.storage.local` is the extension's own client-side config store, same tier as the existing "URL do backend" field |
| Conditional header injection on fetch | Browser / Client (extension background service worker) | — | `background.js` already owns the `fetch()` call to `/webhook/extension`; header construction belongs where the request is built |
| Env var configuration (`EXTENSION_SHARED_KEY`) | API / Backend (deploy-time config) | — | Read via `os.environ`, no new config subsystem; activation in Railway is explicitly out of scope (D-03) |

## Standard Stack

### Core

No new dependencies. Everything needed is already in `backend/requirements.txt` (`fastapi>=0.111.0`,
installed version verified locally as `0.138.0` [VERIFIED: backend/requirements.txt + local `python -c "import fastapi"` output `0.138.0`]) and Python's own standard library (`secrets`, `os`).

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `fastapi` (already installed) | 0.138.0 installed / `>=0.111.0` pinned | `Header`, `Depends`, `HTTPException` | Already the app's web framework; `Header()` param auto-conversion of `x_agente_key` → `x-agente-key` has been stable since FastAPI 0.95 [CITED: fastapi.tiangolo.com — Header parameters, "convert_underscores"], well below the installed 0.138.0 |
| `secrets` (stdlib) | Python 3.10+ (repo already uses `str \| None` union syntax, confirming 3.10+) | `secrets.compare_digest(a, b)` for constant-time key comparison | Purpose-built stdlib function for exactly this; no reason to hand-roll `==` or pull in a crypto library [CITED: docs.python.org/3/library/secrets.html#secrets.compare_digest] |

### Supporting

None needed — `os.environ.get` (stdlib) for reading the optional env var, matching the repo's existing convention.

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Plain `Header(default=None)` param + manual check | `fastapi.security.APIKeyHeader(name="x-agente-key", auto_error=False)` | `APIKeyHeader` is the more "official" FastAPI security-scheme idiom and would show up in OpenAPI docs as a named security scheme; but nothing in this codebase imports `fastapi.security` anywhere today, and the plain-`Header`-param approach is one line shorter and matches the router's existing "local dependency function" idiom (`_get_service`, `_get_recall`). Either works; plain `Header` param is the lower-diff choice. |
| `secrets.compare_digest` | `hmac.compare_digest` | Both are constant-time and equally safe [CITED: docs.python.org/3/library/hmac.html#hmac.compare_digest — "the two functions are equivalent"]; `secrets` is more discoverable/idiomatic for "is this credential correct" checks per its own docs, `hmac` is more idiomatic when you're already doing HMAC signing (not the case here). Pick one, document the choice — no functional difference. |

**Installation:** None — no new packages.

**Version verification:** `fastapi` version confirmed installed locally via `python -c "import fastapi; print(fastapi.__version__)"` → `0.138.0`. `secrets`/`os`/`hmac` are stdlib, no registry lookup applicable.

## Package Legitimacy Audit

Not applicable — this phase installs zero external packages (backend uses only stdlib `secrets`/`os`
plus already-installed `fastapi`; extension uses only already-declared `chrome.storage`/`fetch` web
platform APIs, no npm packages exist in `extension/` at all — it's plain unbundled JS with a
`manifest.json`, no `package.json`).

## Architecture Patterns

### System Architecture Diagram

```
Chrome extension (background.js, service worker)
    │
    │  chrome.storage.local.get(['extensionKey', ...])   ← new field, same read as backendUrl
    ▼
TRANSCRIPT_CHUNK handler
    │
    │  fetch(`${backendUrl}/webhook/extension`, {
    │    headers: {
    │      'Content-Type': 'application/json',
    │      ...(state.extensionKey ? { 'x-agente-key': state.extensionKey } : {})   ← new, conditional
    │    },
    │    body: JSON.stringify({ session_id, text, speaker })
    │  })
    ▼
FastAPI POST /webhook/extension  (backend/app/routers/webhook.py)
    │
    ├─► Depends(verify_extension_key)     ← NEW gate, this route only
    │       reads EXTENSION_SHARED_KEY from os.environ (fresh, not cached)
    │       ├─ unset/empty  → return immediately (no-op, current behavior)
    │       └─ set          → header missing/mismatched → HTTPException(401)
    │                          header matches (secrets.compare_digest) → pass through
    │
    ├─► existing extension_webhook() body — UNCHANGED
    │       db.table("transcript_chunks").insert(...)
    │       pipeline_manager.push_chunk(...)  (asyncio.create_task, non-blocking)
    ▼
202 {"accepted": true}

(POST /webhook/recall stays completely outside this gate — same router,
 same file, no Depends() added to its route — D-01)
```

### Recommended Project Structure

No new files/folders — this phase edits four existing files in place:

```
backend/app/routers/webhook.py   # add verify_extension_key() dependency + wire into extension_webhook()
extension/background.js          # read extensionKey from state, add conditional header in fetch()
extension/popup.html             # add "Chave de autenticação (opcional)" input, mirrors backend-url block
extension/popup.js               # wire input -> SET_EXTENSION_KEY message -> chrome.storage.local
backend/tests/test_webhook_auth.py   # new test file (Wave 0 gap, see Validation Architecture)
```

### Pattern 1: Opt-in header dependency, local to the router file

**What:** A plain function (not a class, not `fastapi.security`) that FastAPI resolves via
`Depends()`. It takes the header as a typed parameter with a default of `None`, and returns `None`
on success (nothing to inject into the route handler — this is a "gate", not a value provider).

**When to use:** Exactly this case — a route-scoped, opt-in credential check with no user identity
to carry forward (unlike JWT/session auth, there's no principal to inject into the handler).

**Example (repo-idiomatic, not copy-paste from docs):**
```python
# Source: pattern synthesized from FastAPI Header-params docs
# (https://fastapi.tiangolo.com/tutorial/header-params/) applied to this repo's
# existing local-dependency idiom, e.g. backend/app/routers/sessions.py:130-133
# `_get_recall()` (os.environ.get read fresh, at point of use) — read via Read tool.
import os
import secrets

from fastapi import Header, HTTPException


def verify_extension_key(x_agente_key: str | None = Header(default=None)) -> None:
    """Gate opcional por shared-secret. Sem EXTENSION_SHARED_KEY configurada,
    a rota se comporta exatamente como hoje (TAQ-03 / D-01)."""
    expected = os.environ.get("EXTENSION_SHARED_KEY", "")
    if not expected:
        return  # opt-in: gate desativado até a env var existir
    if not x_agente_key or not secrets.compare_digest(x_agente_key, expected):
        raise HTTPException(status_code=401, detail="Missing or invalid x-agente-key header")
```

Wired only on the target route (never at `APIRouter(dependencies=[...])` level, which would also
gate `/webhook/recall`):
```python
@router.post("/extension", status_code=202)
async def extension_webhook(
    payload: ExtensionChunk,
    db: Client = Depends(get_supabase),
    _: None = Depends(verify_extension_key),
):
    ...  # body unchanged
```

### Anti-Patterns to Avoid

- **Reading `EXTENSION_SHARED_KEY` once into a module-level constant at import time:** breaks
  testability (can't `monkeypatch.setenv`/`delenv` per-test without reloading the module) and
  diverges from the repo's own convention — `database.py::get_supabase()` and
  `sessions.py::_get_recall()` both read `os.environ.get(...)` fresh at call time, not at import.
- **Router-level `dependencies=[Depends(verify_extension_key)]`:** both `/webhook/extension` and
  `/webhook/recall` share one `APIRouter(prefix="/webhook", ...)` instance in the same file — a
  router-level dependency gates both, violating D-01.
- **Using `fastapi.security.APIKeyHeader`/`HTTPBearer` just because it's "the FastAPI way":**
  pulls in an unused-elsewhere import path for zero behavioral benefit here (no OpenAPI
  security-scheme consumer in this project); the plain `Header()` param is the smaller diff and
  matches the file's existing style.
- **`if x_agente_key == expected:`** — plain `==` on strings is not constant-time; for a
  security-relevant header comparison, prefer `secrets.compare_digest` even though the practical
  timing signal here is small (header comparison, not a hashed secret) — cheap to do right.
- **Masking/encrypting the extension's stored key in `chrome.storage.local`:** out of proportion —
  the existing "URL do backend" field (arguably higher-value target, since it's the whole endpoint)
  is stored in plaintext in the same store; D-02 explicitly says to mirror that pattern.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Constant-time string comparison | A manual loop-based comparator | `secrets.compare_digest` (stdlib) | Purpose-built, reviewed, zero-dependency [CITED: docs.python.org/3/library/secrets.html] |
| Header name → snake_case param mapping | Manual `request.headers.get("x-agente-key")` via raw `Request` | FastAPI's `Header()` parameter with auto `convert_underscores` | Already how the codebase expresses typed inputs (Pydantic models for the body); consistent, gets FastAPI's validation/OpenAPI docs generation for free |

**Key insight:** this phase has no genuinely hard problem in it — the entire risk surface is
"don't accidentally gate the wrong route" (D-01) and "don't regress the unset-env-var path"
(success criterion 1). Both are covered by keeping the dependency route-scoped and by the two
required tests below, not by any library choice.

## Common Pitfalls

### Pitfall 1: Gating the wrong route (or both) via router-level dependencies

**What goes wrong:** `POST /webhook/recall` starts requiring `x-agente-key` too, breaking
Recall.ai's real, already-authenticated (by its own API key) traffic — explicitly out of scope
per D-01.
**Why it happens:** `extension_webhook` and `recall_webhook` are declared on the same
`APIRouter(prefix="/webhook")` instance in `webhook.py`; adding `dependencies=[...]` to the
`APIRouter(...)` constructor (instead of to the individual `@router.post("/extension", ...)`
route) silently applies to every route registered on it, present and future.
**How to avoid:** Add `Depends(verify_extension_key)` as a parameter on `extension_webhook` only.
**Warning signs:** A code review diff that touches the `APIRouter(...)` line, or a plan that
describes the dependency as "router auth" instead of "route auth".

### Pitfall 2: Caching the env var at import/module-load time

**What goes wrong:** Success criterion 1 (unset key → unaffected) and criterion 2/3 (set key →
gated) become impossible to test in the same pytest process, because `python-dotenv`'s
`load_dotenv()` and any module-level `EXTENSION_SHARED_KEY = os.environ.get(...)` constant is
evaluated once, at first import, and pytest imports the module once per test session.
**Why it happens:** Copying the `AppConfig` dataclass pattern literally (`config.py` loads once at
`load_config()` call time and is meant to be constructed once) rather than the pattern actually
used at call sites for optional env-derived behavior (`_get_recall()`'s fresh
`os.environ.get(...)` per call, verified in `backend/app/routers/sessions.py:130-133`).
**How to avoid:** Read `os.environ.get("EXTENSION_SHARED_KEY", "")` inside the dependency function
body, not at module scope.
**Warning signs:** A test needs `importlib.reload()` to see an env var change — that's the tell
that the value was cached too early.

### Pitfall 3: Chrome extension sends an empty-string header instead of omitting it

**What goes wrong:** If the popup's key field is empty, `background.js` naively does
`headers: { 'x-agente-key': state.extensionKey }` — this sends the header with value `""` rather
than omitting it. Once `EXTENSION_SHARED_KEY` is eventually set in production, a user who never
configured the extension key would send `x-agente-key: ""`, which the backend correctly rejects
(good), but the failure mode is silent (fetch still resolves, extension shows no error) unless the
existing `.then(r => sendResponse({ ok: r.ok, status: r.status }))` path in `background.js:118` is
actually surfaced somewhere. Not a functional bug for *this* phase's own success criteria (since
`EXTENSION_SHARED_KEY` stays unset here — D-03), but worth building the conditional-header logic
correctly now so it doesn't need revisiting when the key is activated later.
**Why it happens:** Object spread/conditional patterns are easy to get subtly wrong in vanilla JS
(`{ 'x-agente-key': state.extensionKey || undefined }` still adds the *key* to the object with
value `undefined`, which most `fetch()` implementations then serialize as the string `"undefined"`
— worse than an empty string).
**How to avoid:** Build headers via conditional spread: `{ 'Content-Type': 'application/json', ...(state.extensionKey ? { 'x-agente-key': state.extensionKey } : {}) }` — this is the only form that
truly omits the key (not just empties its value) when unset.
**Warning signs:** `fetch()` DevTools network tab shows an `x-agente-key` header present (even if
empty/`"undefined"`) when the popup field was left blank.

### Pitfall 4: Testing the dependency through `TestClient`/httpx when the repo doesn't use one

**What goes wrong:** A plan/task that assumes `from fastapi.testclient import TestClient` and
spins up the whole app for this test diverges from every existing test in `backend/tests/`, adds
setup cost (needs `SUPABASE_URL`/`SUPABASE_KEY` env or extensive mocking of `get_supabase`), and
is slower/flakier than necessary.
**Why it happens:** `TestClient` is the FastAPI-docs-canonical way to test routes, but this repo's
own tests (verified: `test_readiness_route.py`, `test_finish_stops_pipeline.py`) call router
handler functions directly (`await sessions_mod.finish_session(UUID(_SID), db=_FakeDB(row))`),
bypassing FastAPI's request/response cycle entirely.
**How to avoid:** Test `verify_extension_key(...)` as a plain function — call it directly with a
string or `None` argument, no `Depends()`/`Request` machinery involved, since it's just a Python
function under the hood. Use `monkeypatch.setenv`/`delenv` for the env var, matching repo
conventions (`pytest.ini`: `asyncio_mode = auto`, no `TestClient` used anywhere in `backend/tests/`
— confirmed by grep).
**Warning signs:** A new test importing `httpx` or `fastapi.testclient` when no other test in
the directory does.

## Code Examples

### Extension: conditional header construction (background.js)

```javascript
// Source: pattern derived from the existing TRANSCRIPT_CHUNK handler,
// extension/background.js:103-121 (read via Read tool this session) —
// the only change is building `headers` conditionally before the fetch call.
if (msg.type === 'TRANSCRIPT_CHUNK') {
  if (!state.sessionId) {
    sendResponse({ ok: false, reason: 'no session' })
    return
  }
  const url = `${normalizeUrl(state.backendUrl)}/webhook/extension`
  const headers = { 'Content-Type': 'application/json' }
  if (state.extensionKey) headers['x-agente-key'] = state.extensionKey
  fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      session_id: state.sessionId,
      text: msg.text,
      speaker: msg.speaker || null
    })
  })
  .then(r => sendResponse({ ok: r.ok, status: r.status }))
  .catch(e => sendResponse({ ok: false, error: e.message }))
  return
}
```

### Extension: state load/save, mirroring `backendUrl` exactly

```javascript
// Source: extension/background.js:20-30 (loadState) and :95-101
// (SET_BACKEND_URL handler) — read via Read tool this session.
// New key follows the identical shape: chrome.storage.local key `extensionKey`,
// a new message type `SET_EXTENSION_KEY`, included in loadState()'s get() list.
function loadState() {
  return new Promise((resolve) => {
    chrome.storage.local.get(
      ['sessionId', 'backendUrl', 'questions', 'extensionKey'],  // extensionKey added
      (data) => {
        if (data.sessionId) state.sessionId = data.sessionId
        if (data.backendUrl) state.backendUrl = data.backendUrl
        if (data.questions) state.questions = data.questions
        if (data.extensionKey) state.extensionKey = data.extensionKey
        stateLoaded = true
        resolve()
      }
    )
  })
}
```

### Backend test: no-op when unset vs. reject when set (direct function call, no TestClient)

```python
# Source: pattern synthesized from backend/tests/test_readiness_route.py
# (direct router/dependency function calls, monkeypatch, no TestClient — read
# via Read tool this session) applied to the new verify_extension_key function.
import pytest
from fastapi import HTTPException

from app.routers.webhook import verify_extension_key


def test_verify_extension_key_noop_when_unset(monkeypatch):
    monkeypatch.delenv("EXTENSION_SHARED_KEY", raising=False)
    # No exception, regardless of header value (even None/missing).
    assert verify_extension_key(x_agente_key=None) is None
    assert verify_extension_key(x_agente_key="anything") is None


def test_verify_extension_key_rejects_missing_header_when_set(monkeypatch):
    monkeypatch.setenv("EXTENSION_SHARED_KEY", "s3cr3t")
    with pytest.raises(HTTPException) as exc:
        verify_extension_key(x_agente_key=None)
    assert exc.value.status_code == 401


def test_verify_extension_key_rejects_wrong_value_when_set(monkeypatch):
    monkeypatch.setenv("EXTENSION_SHARED_KEY", "s3cr3t")
    with pytest.raises(HTTPException) as exc:
        verify_extension_key(x_agente_key="wrong")
    assert exc.value.status_code == 401


def test_verify_extension_key_accepts_correct_value_when_set(monkeypatch):
    monkeypatch.setenv("EXTENSION_SHARED_KEY", "s3cr3t")
    assert verify_extension_key(x_agente_key="s3cr3t") is None
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| `fastapi.security.APIKeyHeader` boilerplate for simple shared-secret checks | Plain typed `Header()` function param + manual compare, when there's no OpenAPI security-scheme/OAuth2 story to expose | Not a version change — a style preference confirmed by this repo's own precedent (no `fastapi.security` import anywhere) | Smaller diff, no new import surface, same runtime behavior |

**Deprecated/outdated:** Nothing in this phase touches deprecated APIs. Note (unrelated but
adjacent): `webhook.py` imports `Request` for the `/recall` route's raw-body handling — untouched,
out of scope per D-01.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `secrets.compare_digest` is the preferred stdlib choice over `hmac.compare_digest` for this use case (both are equally safe per Python docs; preference is idiomatic, not functional) | Standard Stack / Alternatives Considered | None — purely stylistic; planner/executor could pick `hmac.compare_digest` instead with zero behavior change |
| A2 | 401 Unauthorized (not 403 Forbidden) is the better status code for "missing or wrong shared secret" | Pattern 1 / Common Pitfalls | Low — CONTEXT.md's Claude's Discretion explicitly allows either "401/403 com mensagem clara"; if the team prefers 403 semantics (key is never a login credential, more like an allow-list check), a one-line change |
| A3 | The extension's new key field should NOT be a `type="password"` masked input, mirroring D-02's "mesmo padrão" of the plaintext "URL do backend" field | Anti-Patterns to Avoid | Low-medium — if the team considers the shared secret more sensitive than a backend URL, this should be a `password` input instead; worth a quick confirm before implementing since CONTEXT.md doesn't say explicitly either way (only "mesmo padrão" for the input+button+storage mechanics, not necessarily the input `type`) |

## Open Questions (RESOLVED)

1. **Exact field/message naming for the new extension key (UI label, `chrome.storage.local` key
   name, background.js message type)**
   - What we know: CONTEXT.md D-02 leaves "nome exato do campo" to Claude's Discretion; this
     research proposes `extensionKey` (storage key), `SET_EXTENSION_KEY` (message type), "Chave de
     autenticação (opcional)" (UI label) for consistency with `backendUrl`/`SET_BACKEND_URL`.
   - What's unclear: Whether the team has a house style for this (none found in the two existing
     analogous fields beyond the pattern itself).
   - Recommendation: Planner can lock these names; low-risk, purely cosmetic, trivially renamable.
   - RESOLVED: 06-01 shipped exactly the recommended names — storage key `extensionKey` and message
     type `SET_EXTENSION_KEY` (`extension/background.js`), UI label "Chave de autenticação
     (opcional)" on `input#extension-key` (`extension/popup.html`).

2. **Should the 401 response body be silently uninformative (generic "invalid key") or should it
   avoid confirming whether a key was configured at all?**
   - What we know: This is an internal/team tool (shared secret protects against opportunistic
     scraping of a semi-public webhook, not a high-value target); CONTEXT.md's threat model
     description (D-01) treats this as much lower stakes than the Recall.ai path.
   - What's unclear: Whether a generic message is required for security hygiene, or whether a
     clear "Missing or invalid x-agente-key header" (as drafted in Pattern 1) is fine given the
     low threat model.
   - Recommendation: Use the clear message — this repo's existing `HTTPException` `detail` strings
     are consistently specific/debuggable (e.g. `"RECALL_API_KEY not configured"`), not generic;
     matches established convention and the low threat model justifies it.
   - RESOLVED: 06-01 shipped the clear message — `HTTPException(status_code=401, detail="Missing or
     invalid x-agente-key header")` in `backend/app/routers/webhook.py` (`verify_extension_key`).

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| TAQ-03 | The transcription webhook is protected by an opt-in shared-secret header (does not break current production when unset) | Pattern 1 (`verify_extension_key` dependency, fresh `os.environ.get` read, no-op on empty/unset) + Pitfall 1 (route-scoped, not router-scoped, to keep `/webhook/recall` untouched per D-01) + the 4-case test suite in Code Examples covering all 3 success criteria (unset→pass, set+missing/wrong→401, set+correct→pass) |

</phase_requirements>

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | pytest 8.x + pytest-asyncio (`asyncio_mode = auto` in `backend/pytest.ini`) [VERIFIED: backend/pytest.ini:3 — "asyncio_mode = auto"] |
| Config file | `backend/pytest.ini` |
| Quick run command | `cd backend && python -m pytest tests/test_webhook_auth.py -x` |
| Full suite command | `cd backend && python -m pytest tests/ -x` |

No test framework/runner exists for `extension/` (plain unbundled JS, no `package.json`,
no `*.test.js` files found — confirmed via glob). The three extension-side changes
(`background.js`, `popup.html`, `popup.js`) are manual-only for this phase; see Wave 0 Gaps.

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| TAQ-03 (SC1) | `EXTENSION_SHARED_KEY` unset → route behaves exactly as today | unit | `pytest tests/test_webhook_auth.py::test_verify_extension_key_noop_when_unset -x` | ❌ Wave 0 |
| TAQ-03 (SC2) | `EXTENSION_SHARED_KEY` set + missing/wrong header → rejected | unit | `pytest tests/test_webhook_auth.py::test_verify_extension_key_rejects_missing_header_when_set -x` and `::test_verify_extension_key_rejects_wrong_value_when_set -x` | ❌ Wave 0 |
| TAQ-03 (SC3) | `EXTENSION_SHARED_KEY` set + correct header → accepted, processed normally | unit | `pytest tests/test_webhook_auth.py::test_verify_extension_key_accepts_correct_value_when_set -x` | ❌ Wave 0 |
| TAQ-03 (extension side, D-02) | Popup key field saves/loads via `chrome.storage.local`; `background.js` sends header only when key is set | manual-only (no JS test harness in this repo) | Load unpacked extension in Chrome, fill/clear the key field, inspect DevTools Network tab on a `POST /webhook/extension` request for header presence/absence | n/a — manual |

### Sampling Rate

- **Per task commit:** `cd backend && python -m pytest tests/test_webhook_auth.py -x`
- **Per wave merge:** `cd backend && python -m pytest tests/ -x`
- **Phase gate:** Full suite green before `/gsd-verify-work`; manual extension check (DevTools
  Network tab, unpacked-extension reload) recorded as part of UAT since no automated harness exists.

### Wave 0 Gaps

- [ ] `backend/tests/test_webhook_auth.py` — new file, covers TAQ-03 (all 3 success criteria); no
      existing file covers `webhook.py` today (confirmed: no `test_webhook*.py` in
      `backend/tests/` prior to this phase).
- [ ] No fixture/conftest changes needed — `monkeypatch` is a built-in pytest fixture, no new
      shared fixture required.
- [ ] No framework install needed — pytest/pytest-asyncio already installed and configured.

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-------------------|
| V2 Authentication | Partial — this is a shared-secret (pre-shared key) check, not user authentication; ASVS V2 controls around credential strength/rotation are the team's operational concern (D-03, out of scope), not this phase's code | `secrets.compare_digest` for constant-time comparison; no credential storage in the backend beyond the existing `os.environ` pattern already used for `RECALL_API_KEY` |
| V3 Session Management | No | N/A — no session/token issuance; stateless per-request header check |
| V4 Access Control | Yes | Route-scoped `Depends()` gate, fail-closed when the key is *configured but wrong/missing* (401), fail-open (no-op) only when the operator has deliberately left `EXTENSION_SHARED_KEY` unset — this fail-open-by-design behavior is the explicit product requirement (TAQ-03), not a bug, and is bounded to exactly one low-value route (`/webhook/extension` ingesting transcript text) |
| V5 Input Validation | Yes (pre-existing, unchanged) | Pydantic `ExtensionChunk` model already validates the body shape; this phase adds a header check ahead of it, doesn't touch body validation |
| V6 Cryptography | Minimal | `secrets.compare_digest` (stdlib, not hand-rolled); no hashing/encryption needed since the secret is compared directly (pre-shared key model, not a stored-hash-verify model) |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|-----------------------|
| Timing attack on key comparison (attacker infers correct key byte-by-byte from response latency) | Information Disclosure | `secrets.compare_digest` instead of `==` — implemented in Pattern 1 |
| Unauthenticated write to `transcript_chunks` / pipeline injection by anyone who discovers the public webhook URL | Spoofing / Tampering | This phase's entire purpose — opt-in shared secret; note the "opt-in" framing means the mitigation is **inactive by default** until the team completes D-03 (production activation), which is explicitly deferred and tracked as a separate decision, not a gap in this phase's own code |
| Secret leakage via extension `chrome.storage.local` (unencrypted, readable by any code with `storage` permission granted to this extension) | Information Disclosure | Accepted risk, consistent with the existing `backendUrl` field's storage (same store, same exposure level); `chrome.storage.local` is not synced to Google's cloud (unlike `chrome.storage.sync`), which is the right choice already implicitly made by reusing the existing pattern — worth confirming the new field also uses `.local` (not `.sync`) explicitly in the plan, since a shared secret sync'ing across the user's Chrome profiles would silently widen its exposure |
| CORS misconfiguration blocking or over-permitting the new header | Tampering / (non-)Denial of Service | No action needed — `allow_headers=["*"]` and `allow_credentials=False` already permit any custom header from any origin without credential exposure risk [VERIFIED: backend/app/main.py:46-52 — `app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=False, allow_methods=["*"], allow_headers=["*"])`] |

## Sources

### Primary (HIGH confidence)
- `backend/app/routers/webhook.py` (read in full this session) — exact current route bodies, line numbers for D-01's untouched `recall_webhook`
- `backend/app/config.py` (read in full this session) — `AppConfig`/`load_config()` shape, confirmed dead code via grep
- `backend/app/database.py` (read in full this session) — confirms the "fresh `os.environ.get()` at point of use" convention
- `backend/app/routers/sessions.py:130-133` (read this session) — `_get_recall()`, the closest existing analog to the new dependency
- `backend/app/main.py:46-52` (read this session) — CORS middleware config
- `extension/background.js`, `extension/popup.html`, `extension/popup.js`, `extension/manifest.json` (read in full this session)
- `backend/tests/conftest.py`, `backend/tests/test_readiness_route.py`, `backend/tests/test_finish_stops_pipeline.py` (read this session) — test idioms (no `TestClient`, direct function calls, `monkeypatch`)
- `backend/pytest.ini` (grepped this session) — `asyncio_mode = auto`
- `backend/requirements.txt` (read this session) — `fastapi>=0.111.0`; local install verified as `0.138.0` via `python -c "import fastapi; print(fastapi.__version__)"`

### Secondary (MEDIUM confidence)
- FastAPI official docs on Header parameters (`fastapi.tiangolo.com/tutorial/header-params/`) — `convert_underscores` behavior for `x_agente_key` → `x-agente-key` [CITED]
- Python stdlib docs, `secrets.compare_digest` and `hmac.compare_digest` — constant-time comparison, equivalence of the two functions [CITED: docs.python.org]

### Tertiary (LOW confidence)
- None used as load-bearing for this research — all backend claims were either verified by reading the actual files this session or cited from official docs.

## Metadata

**Confidence breakdown:**
- Standard Stack: HIGH — no new dependencies; both stdlib functions and FastAPI's `Header()` behavior confirmed against the installed version and official docs
- Architecture: HIGH — every integration point (route, CORS, manifest, popup/background pattern) was read directly this session, not inferred
- Pitfalls: HIGH — derived from direct comparison of this repo's actual conventions (verified by reading `config.py`, `database.py`, `sessions.py`, `webhook.py`, and the test files) against the naive/docs-idiomatic approach, not from generic best-practice lists

**Research date:** 2026-09-24
**Valid until:** No expiry concern — this is a small, self-contained stdlib+FastAPI-core pattern with no fast-moving dependency; safe to treat as valid through the rest of the v3.0 milestone (estimate 90 days, well beyond the usual 30 for stable stacks, since zero new packages are involved)
