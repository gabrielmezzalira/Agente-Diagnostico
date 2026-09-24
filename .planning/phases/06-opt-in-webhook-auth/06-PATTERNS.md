# Phase 6: Opt-In Webhook Auth (gap-closure G-06-1) - Pattern Map

**Mapped:** 2026-09-24
**Files analyzed:** 3 (2 modified extension files + 1 new pure-helper module + its test)
**Analogs found:** 3 / 3
**Scope note:** Plan 06-01 (backend `verify_extension_key` gate + extension key field) is already
executed and merged in behavior. This run maps patterns ONLY for gap-closure plan 06-02, which fixes
G-06-1: `render()` in `extension/popup.js` clobbers `extensionKeyInput.value` / `backendUrlInput.value`
on every 3s polling tick, wiping in-progress typing before the user clicks "Salvar".

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|--------------------|------|-----------|-----------------|----------------|
| `extension/popup.js` | component (vanilla-JS "controller" of the popup DOM) | event-driven (DOM events + polling) | itself (pre-existing file, edited in place) — no better external analog exists in this repo; nearest sibling pattern is its own `render()`/listener structure | exact (self-edit) |
| `extension/lib/formState.js` *(NEW — pure helper, no I/O)* | utility | transform (pure function, no side effects) | `frontend/src/lib/lens.ts` (pure helpers operating on plain data, no DOM/fetch) | role-match (same role: pure transform utility; different language/runtime, same shape) |
| `extension/lib/formState.test.js` *(NEW — unit test for the helper above)* | test | transform (pure-function assertions) | `frontend/src/lib/lens.test.ts` (vitest, `describe`/`it`/`expect`, pure-function-in/value-out assertions, no DOM mocking) | role-match (same testing shape; different runner — see below) |
| `extension/popup.html` | config/markup (script loading + CSP-relevant tags) | n/a (static markup) | itself — only reference point needed is its existing `<script src="popup.js">` tag and lack of `type="module"` | exact (self-edit, informs how the new helper file must be loaded) |

## Pattern Assignments

### `extension/popup.js` (component, event-driven) — the file to fix

**Analog:** itself, `extension/popup.js` (already read in full this session, lines 1-141)

**Imports pattern** (lines 1-16): no imports/modules at all — plain script, global `document.getElementById(...)` constants at top of file. `extension/` has **no bundler, no ES module usage in `popup.js`** (loaded via classic `<script src="popup.js">`, see `popup.html` line 256 — no `type="module"`). Any new helper file must be loadable the same way: either (a) a second classic `<script src="lib/formState.js">` tag added to `popup.html` **before** `popup.js`, exposing its functions as globals (e.g. `window.FormState = {...}` or plain top-level `function` declarations — no `export`/`import` keywords, since MV3 popup HTML without `type="module"` cannot use ES module syntax), or (b) inlined directly into `popup.js`. Given manifest.json's `content_security_policy` is unset (defaults to MV3's strict extension_pages CSP, which forbids inline scripts but does NOT forbid multiple `<script src>` tags from the extension's own origin), option (a) — a second classic script tag — is the low-risk choice and matches "one file, one responsibility" from CLAUDE.md.

**Root-cause code, the exact block to change** (lines 75-92, `render()`):
```javascript
function render(state) {
  backendUrlInput.value = state.backendUrl || ''
  extensionKeyInput.value = state.extensionKey || ''

  if (state.sessionId) {
    dot.classList.add('active')
    statusText.innerHTML = '<strong>Capturando</strong> — sessão ativa'
    sessionPanel.style.display = 'block'
    noSessionPanel.style.display = 'none'
    sessionIdDisplay.textContent = state.sessionId
    renderQuestions(state.questions || [])
  } else {
    dot.classList.remove('active')
    statusText.innerHTML = '<span>Aguardando sessão</span>'
    sessionPanel.style.display = 'none'
    noSessionPanel.style.display = 'block'
  }
}
```

**Polling call site** (lines 94-100) — the trigger, unchanged in structure but its `render` callback is what needs the guard:
```javascript
// Carrega estado atual ao abrir o popup
chrome.runtime.sendMessage({ type: 'GET_STATE' }, render)

// Atualiza perguntas a cada 3s enquanto o popup estiver aberto
setInterval(() => {
  chrome.runtime.sendMessage({ type: 'GET_STATE' }, render)
}, 3000)
```

**Save-button listeners that read `.value` at click time** (lines 122-140) — these are already correct
(read fresh `.value` only on click, not on poll) and must stay exactly as-is; they are the reference for
"read input value only at the moment of user intent", the same principle the fix must extend to `render()`:
```javascript
saveUrlBtn.addEventListener('click', () => {
  const url = backendUrlInput.value.trim().replace(/\/+$/, '')
  if (!url) return
  chrome.runtime.sendMessage({ type: 'SET_BACKEND_URL', url }, () => {
    saveUrlBtn.textContent = 'Salvo!'
    setTimeout(() => { saveUrlBtn.textContent = 'Salvar' }, 1500)
  })
})

saveKeyBtn.addEventListener('click', () => {
  const key = extensionKeyInput.value.trim()
  chrome.runtime.sendMessage({ type: 'SET_EXTENSION_KEY', key }, () => {
    saveKeyBtn.textContent = 'Salvo!'
    setTimeout(() => { saveKeyBtn.textContent = 'Salvar' }, 1500)
  })
})
```

**No existing "dirty field" / "user is editing" tracking pattern exists anywhere in this repo.** A grep-equivalent
read of the full 141-line `popup.js` (done during the debug session referenced in
`.planning/debug/extension-key-field-clears-while-typing.md`) found zero occurrences of `activeElement`,
`focus`, `blur`, `debounce`, `isEditing`, or any local dirty-flag variable. `frontend/` (React) doesn't
have this problem because its inputs are controlled by React state updated via `onChange`, not by an
external poll overwriting `.value` directly — so there is no React analog to port either; this is a
plain-DOM problem specific to `extension/popup.js` and must be solved locally there.

**Recommended fix shape (for the planner to lock into a plan, not prescriptive code):** guard the two
`.value` assignments in `render()` with `document.activeElement !== <input>` (skip overwriting whichever
input currently has focus), applied to BOTH `backendUrlInput` and `extensionKeyInput` per the debug
session's explicit finding that `backendUrlInput` shares the identical defect (even though only the key
field was reported in UAT). This guard condition itself is a good candidate for the new pure helper
below, since "should this poll-driven value overwrite this field" is a pure decision given (currently-focused-element-id, target-element-id) — testable without any DOM mocking if expressed as a plain
predicate over ids/references rather than over `document` directly.

---

### `extension/lib/formState.js` (NEW, utility, transform) — pure helper for the guard predicate

**Analog:** `frontend/src/lib/lens.ts` (read in full this session)

**Pattern to copy — small, pure, well-documented exported functions, no side effects, no DOM/fetch:**
```typescript
// Source: frontend/src/lib/lens.ts:92-97 — shape to mirror (JSDoc explaining the
// WHY, single-purpose pure function, boolean/plain-value return, no I/O)
export function shouldShowManualReportButton(
  hasReceivedInitialState: boolean,
  coverage: CoverageState
): boolean {
  return hasReceivedInitialState && !isDiscoveryCoverage(coverage)
}
```
Applied to this gap's problem, the equivalent pure predicate (plain JS since `extension/` has no
TypeScript toolchain — confirmed: no `tsconfig.json`, no `.ts` files anywhere under `extension/`) would
be a function like `shouldSkipPollOverwrite(activeElement, targetElement)` returning a boolean, called
from `render()` before each `.value` assignment — same "one function, one decision, no side effects"
shape as `lens.ts`'s exports.

**Module loading caveat (differs from `lens.ts`):** `lens.ts` uses ES `import`/`export` because
`frontend/` is bundled by Vite. `extension/popup.js` is NOT bundled and NOT loaded as `type="module"`
(see `popup.html` line 256). So the new helper file must NOT use `export`/`import` syntax — declare
plain top-level `function` statements (or attach to a small namespace object) and load it via an
additional `<script src="lib/formState.js"></script>` placed in `popup.html` before `<script
src="popup.js">`, so its functions are simply in scope as globals when `popup.js` runs. This is a
structural difference the planner must account for — copying `lens.ts`'s `export function` syntax
verbatim would break the extension (classic scripts throw a `SyntaxError` on `export`).

---

### `extension/lib/formState.test.js` (NEW, test, transform) — unit test for the helper above

**Analog:** `frontend/src/lib/lens.test.ts` (read in full this session)

**Pattern to copy — plain input/output assertions, no rendering, no DOM setup, descriptive Portuguese
test names explaining the "why", one `describe` block per module, one `it` per behavior/edge case:**
```typescript
// Source: frontend/src/lib/lens.test.ts:1-14, 46-51 — shape to mirror
import { describe, expect, it } from 'vitest'
import { isDiscoveryCoverage } from './lens'

describe('lens.ts', () => {
  it('empty (D-46/UI-03): coverage {} não é discovery...', () => {
    const coverage: CoverageState = {}
    expect(isDiscoveryCoverage(coverage)).toBe(false)
  })
})
```

**Test runner caveat — `extension/` has ZERO test infrastructure today.** Confirmed by direct check
this session:
- `git ls-files -- extension/` lists only `background.js`, `content_app.js`, `content_meet.js`,
  `manifest.json`, `popup.html`, `popup.js` — no `package.json`, no `*.test.js`, no config file of any
  kind.
- `frontend/`'s test stack (vitest, imported in `lens.test.ts`) is a `frontend`-local devDependency
  (via `frontend/package.json`) and is NOT available to `extension/`, which has no `package.json` at
  all — installing vitest into `extension/` would be the first npm dependency ever introduced there,
  a disproportionate footprint for one pure predicate function.
- **Zero-install option confirmed available:** local Node version is `v24.12.0` (`node --version`,
  checked this session), which has a stable built-in test runner (`node:test`, stable since Node 18,
  run via `node --test`) plus `node:assert/strict` for assertions — no install, no `package.json`
  required, can run a single `.test.js` file directly: `node --test extension/lib/formState.test.js`.
  This is the right choice for this gap: it gives the phase's "leaves at least one real test" rule
  (CLAUDE.md task-planning rules, §7 Verificação) without adding a build/install step to a folder that
  has deliberately stayed dependency-free (plain unbundled JS + `manifest.json` only, per RESEARCH.md's
  Package Legitimacy Audit).
- Equivalent `node:test` shape for the same assertions:
```javascript
// extension/lib/formState.test.js — no imports needed beyond node: built-ins
const test = require('node:test')
const assert = require('node:assert/strict')
const { shouldSkipPollOverwrite } = require('./formState.js')

test('não pula quando nenhum elemento está focado', () => {
  assert.equal(shouldSkipPollOverwrite(null, 'extension-key'), false)
})

test('pula quando o elemento focado é o alvo da atualização', () => {
  assert.equal(shouldSkipPollOverwrite('extension-key', 'extension-key'), true)
})
```
  (Using `require`/`module.exports` here, matching `extension/`'s existing non-module, non-bundled
  CommonJS-compatible plain-script style — consistent with the no-`export`/no-`import` constraint noted
  above for `formState.js` itself, and directly runnable via `node --test` with no transpile step.)

---

### `extension/popup.html` (config/markup) — script loading + CSP note

**Analog:** itself (read in full this session, lines 1-259)

**Relevant excerpt — how scripts are loaded** (line 256):
```html
  <script src="popup.js"></script>
```
Single classic script tag, no `type="module"`, no bundler manifest, no `nomodule` fallback. `manifest.json`
declares no explicit `content_security_policy` block (checked this session, full file read) — MV3's
default `extension_pages` CSP (`script-src 'self'; object-src 'self'`) applies, which permits additional
`<script src="...">` tags pointing at files packaged inside the extension (same origin), just not inline
`<script>...</script>` blocks or remote script URLs. This confirms the loading strategy recommended above
(a second `<script src="lib/formState.js"></script>` tag, placed before `popup.js`'s tag) is CSP-safe
with no manifest changes required.

## Shared Patterns

### "Read `.value` only at the moment of user intent, never overwrite it from a background poll without a guard"
**Source:** `extension/popup.js` lines 134-140 (`saveKeyBtn` listener — the correct existing pattern)
**Apply to:** The fix in `render()` (lines 75-77) — extend the same principle from "read-only-on-click"
to "write-only-when-not-focused", for both `backendUrlInput` and `extensionKeyInput`.

### Pure helper + colocated unit test, no side effects
**Source:** `frontend/src/lib/lens.ts` + `frontend/src/lib/lens.test.ts`
**Apply to:** New `extension/lib/formState.js` (guard predicate) + `extension/lib/formState.test.js`
(direct input/output assertions) — same shape, adapted to `extension/`'s zero-dependency, non-module
JS runtime via `node:test` instead of vitest.

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| (none) | — | — | All three gap-closure files have usable analogs (self, or `frontend/src/lib/lens.ts`+test); no file in this gap lacks a pattern to copy from. |

## Metadata

**Analog search scope:** `extension/` (full directory, all 6 tracked files), `frontend/src/lib/` (pure
helpers + their vitest tests), `backend/` (checked only to confirm 06-01 scope boundary, no new backend
files in this gap).
**Files scanned:** `extension/popup.js`, `extension/popup.html`, `extension/background.js`,
`extension/manifest.json`, `frontend/src/lib/lens.ts`, `frontend/src/lib/lens.test.ts`.
**Pattern extraction date:** 2026-09-24
