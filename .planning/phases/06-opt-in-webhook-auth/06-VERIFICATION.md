---
phase: 06-opt-in-webhook-auth
verified: 2026-09-24T18:30:00Z
status: human_needed
score: 7/7 must-haves verified (code-level)
covered_files: [".planning/REQUIREMENTS.md", ".planning/phases/06-opt-in-webhook-auth/06-01-PLAN.md", ".planning/phases/06-opt-in-webhook-auth/06-01-SUMMARY.md", "backend/app/routers/webhook.py", "backend/tests/test_webhook_auth.py", "extension/background.js", "extension/popup.html", "extension/popup.js"]
covered_digest: "v1:sha256:9e98c111d6288265dbeca736dae307f92621110e56b02760f1d8d8b6fcc61502"
behavior_unverified: 0
overrides_applied: 0
human_verification:
  - test: "Carregar a extensão sem pacote (chrome://extensions → Modo desenvolvedor → 'Carregar sem compactação' → pasta extension/), abrir o popup com uma sessão ativa, preencher e salvar o campo 'Chave de autenticação (opcional)', abrir DevTools → Network, disparar um chunk real de transcrição (legenda do Meet) e confirmar que o POST /webhook/extension inclui o header x-agente-key com o valor salvo."
    expected: "Com o campo preenchido e salvo, toda requisição POST /webhook/extension real carrega o header x-agente-key com o valor exato salvo em chrome.storage.local."
    why_human: "Não existe harness de teste automatizado em extension/ (JS puro, sem package.json, sem test runner — confirmado em 06-RESEARCH.md e 06-VALIDATION.md); requer runtime real do Chrome (chrome.storage.local, service worker, DevTools Network) que não pode ser exercitado por grep/leitura estática. Harvested do <human-check> da Task 2 em 06-01-PLAN.md, onde já está marcado 'pending (UAT)' em 06-VALIDATION.md linha 52."
  - test: "Limpar o campo de chave no popup, salvar de novo, disparar outro chunk real de transcrição e inspecionar o mesmo POST /webhook/extension no DevTools → Network."
    expected: "Com o campo vazio, o header x-agente-key está AUSENTE da requisição (não vazio — ausente), reproduzindo byte-a-byte o comportamento atual sem a mudança desta fase."
    why_human: "Mesma razão acima — comportamento de runtime do Chrome/service worker, sem harness automatizado."
---

# Phase 6: Opt-In Webhook Auth Verification Report

**Phase Goal:** The transcription webhook is protected by a shared-secret header that is opt-in — current production traffic is unaffected until the secret is configured
**Verified:** 2026-09-24T18:30:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Com `EXTENSION_SHARED_KEY` ausente, `POST /webhook/extension` aceita e processa chunks exatamente como hoje (SC1/TAQ-03) | ✓ VERIFIED | `backend/app/routers/webhook.py:23-25` — `expected = os.environ.get("EXTENSION_SHARED_KEY", "")`; if falsy, `return` immediately (no-op). Test `test_verify_extension_key_noop_when_unset` passes (ran live: `4 passed in 0.78s`). |
| 2 | Com `EXTENSION_SHARED_KEY` configurada, requisição sem `x-agente-key` ou com valor incorreto é rejeitada com 401 (SC2/TAQ-03) | ✓ VERIFIED | `webhook.py:26-27` — raises `HTTPException(401, ...)` when header missing/wrong. Tests `test_verify_extension_key_rejects_missing_header_when_set` and `test_verify_extension_key_rejects_wrong_value_when_set` pass (ran live). |
| 3 | Com `EXTENSION_SHARED_KEY` configurada e header correto, requisição é aceita e processada normalmente — insere em `transcript_chunks` e dispara o pipeline (SC3/TAQ-03) | ✓ VERIFIED | `verify_extension_key` returns `None` on match; gate sits as `Depends()` before the existing insert/`pipeline_manager.push_chunk` body (`webhook.py:34-52`), which is untouched. Test `test_verify_extension_key_accepts_correct_value_when_set` passes (ran live). |
| 4 | `POST /webhook/recall` permanece sem qualquer gate — `Depends(verify_extension_key)` nunca aparece em `recall_webhook()` nem no construtor do `APIRouter` (D-01) | ✓ VERIFIED | Live grep: `grep -c "Depends(verify_extension_key)" webhook.py` → `1` (only on `extension_webhook`); `awk` isolating `recall_webhook` body → `grep -c verify_extension_key` → `0`. `APIRouter(prefix="/webhook", tags=["webhook"])` at line 11 unchanged/no dependency. |
| 5 | Comparação da chave usa `secrets.compare_digest` (tempo constante), nunca `==` | ✓ VERIFIED | `webhook.py:26` — `secrets.compare_digest(x_agente_key, expected)`; no `==` comparison against the secret anywhere in the file. `import secrets` present at line 3. |
| 6 | Popup da extensão tem campo opcional de chave (`type=password`); vazio, nenhum header `x-agente-key` é enviado (byte-idêntico ao atual); preenchido, todo `POST /webhook/extension` carrega o header (D-02) | ✓ VERIFIED (code-level) — runtime confirmation pending, see Human Verification | `extension/popup.html:247` — `input type="password" id="extension-key"`. `extension/background.js:118-119` — `const headers = { 'Content-Type': 'application/json' }; if (state.extensionKey) headers['x-agente-key'] = state.extensionKey` (conditional, never empty string). `popup.js:134-140` — save listener sends `SET_EXTENSION_KEY` with trimmed value, no early-return on empty (allows clearing). Static analysis confirms the full path is wired; actual Chrome runtime behavior (chrome.storage.local persistence, real fetch header) has no automated harness in `extension/` and is explicitly marked `⬜ pending (UAT)` in `06-VALIDATION.md` line 52 — harvested as human verification item below. |
| 7 | Chave da extensão é persistida via `chrome.storage.local` (nunca `chrome.storage.sync`) | ✓ VERIFIED | `background.js:23,27,107` use `chrome.storage.local.get`/`.set` exclusively. Live grep `chrome.storage.sync` across `extension/background.js extension/popup.js extension/popup.html` → 0 matches. |

**Score:** 7/7 truths verified at code level (0 present-but-behavior-unverified per the strict state-transition/cancellation definition). 1 truth (#6) has a mandatory human runtime check harvested from the PLAN's `<human-check>` block, still pending per `06-VALIDATION.md`.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `backend/app/routers/webhook.py` | `verify_extension_key()` gate + route-scoped `Depends()` | ✓ VERIFIED | Function defined (lines 20-27), wired only to `extension_webhook` (line 34), `recall_webhook` untouched (lines 55-99). |
| `backend/tests/test_webhook_auth.py` | 4 tests covering the 3 SCs | ✓ VERIFIED | 4 tests present, all pass live (`4 passed in 0.78s`). |
| `extension/popup.html` | Password input + save button | ✓ VERIFIED | Lines 244-250, mirrors "URL do backend" block structure; CSS extended for `input[type="password"]` (lines 94, 105). |
| `extension/popup.js` | Read/render + save listener | ✓ VERIFIED | Lines 15-16 (refs), 77 (render), 134-140 (save listener). |
| `extension/background.js` | State, storage, conditional header | ✓ VERIFIED | Lines 7 (initial state), 23/27 (loadState), 105-110 (`SET_EXTENSION_KEY` handler), 118-119 (conditional header in `TRANSCRIPT_CHUNK`). |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| `Depends(verify_extension_key)` | `extension_webhook()` parameter | Direct dependency injection | ✓ WIRED | `webhook.py:34` — single occurrence in the file, confirmed by live grep count = 1. |
| `background.js: state.extensionKey` | `fetch(...)` to `/webhook/extension` | Conditional header build before `fetch()` | ✓ WIRED | Lines 117-128 — `headers` built conditionally, passed to `fetch(url, { method: 'POST', headers, body })`. |
| `popup.js: saveKeyBtn click` | `background.js: SET_EXTENSION_KEY` handler | `chrome.runtime.sendMessage` | ✓ WIRED | `popup.js:134-140` sends message; `background.js:105-110` receives, persists to `chrome.storage.local`, updates in-memory `state`. |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|---------------------|--------|
| `verify_extension_key` | `expected` | `os.environ.get("EXTENSION_SHARED_KEY", "")` read fresh per call | Yes — no module-level cache, confirmed testable via `monkeypatch.setenv`/`delenv` in the same pytest process | ✓ FLOWING |
| `background.js` `headers['x-agente-key']` | `state.extensionKey` | `chrome.storage.local.get(['extensionKey'])` in `loadState()`, updated by `SET_EXTENSION_KEY` handler | Yes, at code level — no hardcoded/static fallback | ✓ FLOWING (code-level; browser runtime not exercised — see Human Verification) |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| SC1: gate no-op when unset | `cd backend && python -m pytest tests/test_webhook_auth.py -x -q` | `4 passed in 0.78s` | ✓ PASS |
| D-01: gate route-scoped, never on `recall_webhook`/`APIRouter` | `grep -c "Depends(verify_extension_key)" app/routers/webhook.py` → `1`; `awk` over `recall_webhook` body → `grep -c verify_extension_key` → `0` | Both counts match expected | ✓ PASS |
| D-02: no `chrome.storage.sync` anywhere in extension diff | `grep -rn "chrome.storage.sync" extension/background.js extension/popup.js extension/popup.html` | No matches (exit 1) | ✓ PASS |
| Full backend suite: zero regression from this phase | `cd backend && python -m pytest tests/ -q` | `1 failed, 92 passed, 4 skipped` — the 1 failure is `test_schema.py::test_tables_exist` (requires a live Supabase connection; `PGRST205` schema-cache error) | ✓ PASS (pre-existing, unrelated — see Anti-Patterns/Gaps) |
| D-02 runtime: extension actually sends/omits the header in a real browser | — | Not run — no JS harness exists in `extension/` | ? SKIP → routed to Human Verification |

**Pre-existing failure investigation:** `test_schema.py::test_tables_exist` fails identically with and without this phase's change (confirmed via `git stash` isolation per `deferred-items.md`, and independently confirmed here — `git log` shows the file was last touched at `0a12c43`, the Phase 1 backend scaffold commit, entirely unrelated to Phase 6). This is an environmental dependency on a live Supabase connection, not a regression caused by this phase. Documented in `.planning/phases/06-opt-in-webhook-auth/deferred-items.md`. Not counted as a gap.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|--------------|--------|----------|
| TAQ-03 | 06-01-PLAN.md | The transcription webhook is protected by an opt-in shared-secret header (does not break current production when unset) | ✓ SATISFIED | All 3 success criteria (SC1/SC2/SC3) verified via live tests + code inspection; `POST /webhook/recall` confirmed untouched (D-01). |

No orphaned requirements — `REQUIREMENTS.md` traceability table maps only TAQ-03 to Phase 6, and the plan declares `requirements: [TAQ-03]`. Full match.

### Anti-Patterns Found

None in the files modified by this phase (`backend/app/routers/webhook.py`, `backend/tests/test_webhook_auth.py`, `extension/background.js`, `extension/popup.js`, `extension/popup.html`). No `TBD`/`FIXME`/`XXX`/`TODO`/`HACK`/`PLACEHOLDER` markers found via grep. No stub patterns (`return null`, empty handlers, hardcoded empty arrays feeding rendering) in the diff.

### Human Verification Required

### 1. Extension sends the header when the key is configured

**Test:** Carregar a extensão sem pacote (chrome://extensions → Modo desenvolvedor → "Carregar sem compactação" → pasta `extension/`), abrir o popup com uma sessão ativa, preencher e salvar o campo "Chave de autenticação (opcional)", abrir DevTools → Network, disparar um chunk real de transcrição (legenda do Meet) e inspecionar o `POST /webhook/extension`.
**Expected:** O request carrega o header `x-agente-key` com o valor exatamente igual ao salvo.
**Why human:** Não há harness de teste automatizado em `extension/` (JS puro sem `package.json`/test runner); exige runtime real do Chrome (service worker, `chrome.storage.local`, DevTools Network). Este item foi harvested do `<human-check>` da Task 2 em `06-01-PLAN.md` e já está listado como `⬜ pending (UAT)` em `06-VALIDATION.md` (linha 52).

### 2. Extension omits the header when the key is empty

**Test:** Limpar o campo de chave, salvar, disparar outro chunk real e inspecionar o mesmo `POST /webhook/extension`.
**Expected:** O header `x-agente-key` está AUSENTE da requisição (não como string vazia — ausente).
**Why human:** Mesma razão do item 1 — comportamento de runtime que grep/leitura estática não pode provar por si só, apesar do código (`background.js:118-119`) demonstrar a lógica condicional correta.

### Gaps Summary

Nenhum gap bloqueante. Todos os checks automatizados (4 testes novos, greps de route-scoping e de `chrome.storage.sync`, suíte completa do backend) passam. A única pendência é a verificação manual em runtime real do Chrome para o campo da extensão (D-02), que o próprio plano já havia identificado como manual-only (sem harness JS no repo) e marcado como `pending` em `06-VALIDATION.md` — isso não é um gap de implementação, é um passo de UAT explicitamente adiado para depois da execução, conforme o próprio `<human-check>` da Task 2. A falha em `test_schema.py::test_tables_exist` é ambiental (requer Supabase real), pré-existente desde a Fase 1, e documentada em `deferred-items.md` — não é uma regressão desta fase.

---

_Verified: 2026-09-24T18:30:00Z_
_Verifier: Claude (gsd-verifier)_
