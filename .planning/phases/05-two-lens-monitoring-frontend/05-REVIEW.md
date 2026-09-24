---
phase: 05-two-lens-monitoring-frontend
reviewed: 2026-09-23T00:00:00Z
depth: standard
files_reviewed: 5
files_reviewed_list:
  - frontend/src/lib/lens.test.ts
  - frontend/src/lib/lens.ts
  - frontend/src/lib/useSessionWS.ts
  - frontend/src/pages/ProjectDetailPage.tsx
  - frontend/src/pages/SessionActivePage.tsx
findings:
  critical: 0
  warning: 3
  info: 0
  total: 3
status: issues_found
---

# Phase 05: Code Review Report (Incremental — Gap Closure 05-05)

**Reviewed:** 2026-09-23T00:00:00Z
**Depth:** standard
**Files Reviewed:** 5
**Status:** issues_found

## Summary

This is an incremental review of the 05-05 gap-closure diff (`git diff ddce96b..HEAD` on the 5 listed
files) against the two Critical defects it claims to close: CR-01 (manual "Relatório" button visible
before `initial_state` / in discovery) and CR-02 ("Gerar PRD" button gets stuck disabled after a
transient generation failure).

**Both Critical fixes were verified correct and complete:**

- **CR-01** — `shouldShowManualReportButton(hasReceivedInitialState, coverage)` correctly ANDs a new
  synchronous `hasReceivedInitialState` flag (set only on the WS `initial_state` event, `useSessionWS.ts:127`)
  with `!isDiscoveryCoverage(coverage)`. I traced the backend contract that this depends on:
  `_init_coverage(mode="discovery")` (`backend/app/services/session_state.py:45-46`) eagerly populates
  all 18 discovery areas at session construction, and `coverage_to_dict()` derives `lens` from the
  static `DISCOVERY_AREA_SET` registry (not from a runtime-only field), so a discovery session's very
  first `initial_state` payload is guaranteed to already carry non-null `lens` on at least one area.
  This means there is no window, even at t=0, where a discovery session's `coverage` looks sales-shaped
  after `hasReceivedInitialState` flips true. `coverage_update` also always sends the full area dict
  (`pipeline.py:248`, `self.state.coverage_to_dict()`), so no partial-merge could make a discovery
  session transiently register as sales. The 4 new unit tests in `lens.test.ts` correctly cover the
  pre-initial_state/discovery/sales matrix. Sales flat-list rendering path in
  `SessionActivePage.tsx` (`CoveragePanel`, lines 140-164) and `groupCoverageByLens`/`isDiscoveryCoverage`
  in `lens.ts` are untouched by this diff — confirmed via `git diff`, byte-identical.
- **CR-02** — `prdError` (POST failure) is now split from `readinessError` (GET failure) in
  `ProjectDetailPage.tsx`. The button's `disabled` expression (`!readiness?.ready || readinessLoading
  || !!readinessError || generatingPrd`, line 411) correctly excludes `prdError`, so a transient
  generation failure no longer permanently disables the retry path. The real `e.message` is surfaced
  (line 141) instead of a generic string. Fail-closed behavior on the readiness GET error path is
  unchanged and preserved (`readinessError` truthy still disables the button and replaces the
  `ReadinessBar` with an error line).

While both fixes are correct, the diff introduces one behavioral regression and one documentation
defect, and there is a pre-existing (not introduced by this diff, but directly adjacent to the new
`hasReceivedInitialState` fail-closed contract) robustness gap worth flagging. See Warnings below.

## Warnings

### WR-01: `prdError` is not cleared when the selected discovery session changes (regression vs. prior behavior)

**File:** `frontend/src/pages/ProjectDetailPage.tsx:97-131`
**Issue:** Before this fix, a POST-generate failure was written into `readinessError`
(`setReadinessError(e.message)`), which is unconditionally reset to `null` at the top of the
readiness-fetch effect (`setReadinessError(null)` on line 125) every time `discoverySessionId` changes.
That gave the old code an (accidental) reset-on-session-switch behavior for free.

The new `prdError` state has no such reset: it is only ever cleared inside `handleGeneratePrd` right
before a new attempt (line 135). `discoverySessionId` can legitimately change while `ProjectDetailPage`
stays mounted — `pickDiscoverySession(sessions)` (line 34-39) re-picks the most-recent session by
`started_at` whenever `sessions` changes, and `sessions` changes in-place via `handleDeleteSession`
(line 147-157, deletion is allowed for any non-active session, line 377 in the render). Concretely:
generate a PRD for the current (most recent, finished) discovery session, have it fail (`prdError` set),
then delete that session from the history list — `discoverySessionId` now points at the next most
recent session, but the stale `prdError` message from the deleted session's failed attempt remains
displayed under the new session's "Gerar PRD" card, misattributing an unrelated past error to the
newly-selected session.

**Fix:** Clear `prdError` whenever `discoverySessionId` changes, alongside the existing
`readinessError` reset:
```ts
useEffect(() => {
  if (!discoverySessionId) return
  setReadinessLoading(true)
  setReadinessError(null)
  setPrdError(null) // reset stale generation error from a previously-selected session
  api.sessions
    .getReadiness(discoverySessionId)
    .then(setReadiness)
    .catch(() => setReadinessError('Erro ao carregar readiness'))
    .finally(() => setReadinessLoading(false))
}, [discoverySessionId])
```

### WR-02: Orphaned JSDoc comment in `lens.ts` — misdocuments `shouldShowManualReportButton`, leaves `groupCoverageByLens` undocumented

**File:** `frontend/src/lib/lens.ts:75-99`
**Issue:** The new `shouldShowManualReportButton` function (with its own docstring) was inserted
between the pre-existing "Particiona a cobertura por lente..." docstring and the `groupCoverageByLens`
function it was written to describe. The result:
- Lines 75-81 ("Particiona a cobertura por lente (Produto/Dados), preservando a ordem de inserção...")
  now sit directly above `shouldShowManualReportButton` (lines 92-97), reading as if they document that
  function — they don't; they describe partitioning/grouping semantics that belong to
  `groupCoverageByLens`.
- `groupCoverageByLens` (line 99) is now undocumented — it lost its docstring to the misplacement.

This is a pure documentation defect (verified via `git diff`: the new block was inserted immediately
after the pre-existing docstring, not after the function it belongs to) but it will actively mislead
future maintainers reading `shouldShowManualReportButton` (whose real contract, "gate a button on
`hasReceivedInitialState` AND non-discovery", is described correctly by the *second* docstring at lines
82-91, immediately below the misplaced one) and anyone changing `groupCoverageByLens` without doc
guidance.

**Fix:** Move the "Particiona a cobertura por lente..." docblock to sit directly above
`groupCoverageByLens`, after `shouldShowManualReportButton`'s own docblock+function:
```ts
/**
 * Decide a visibilidade do botão manual "Relatório" ...
 */
export function shouldShowManualReportButton(
  hasReceivedInitialState: boolean,
  coverage: CoverageState
): boolean {
  return hasReceivedInitialState && !isDiscoveryCoverage(coverage)
}

/**
 * Particiona a cobertura por lente (Produto/Dados), preservando a ordem de
 * inserção do payload (Object.entries) — nunca reordena. As duas chaves
 * (`produto` e `dados`) estão sempre presentes, mesmo vazias, para que o
 * cabeçalho de uma lente sem áreas ativas ainda possa ser renderizado
 * (backstop zero-one-many).
 */
export function groupCoverageByLens(
  coverage: CoverageState
): { produto: [string, CoverageArea][]; dados: [string, CoverageArea][] } {
  ...
```

### WR-03: `hasReceivedInitialState` fail-closed guarantee does not survive a `sessionId` change without component remount

**File:** `frontend/src/lib/useSessionWS.ts:67-78, 101-174`; `frontend/src/pages/SessionActivePage.tsx:656-672`
**Issue:** `useSessionWS`'s `state` is created once via `useState(...)` with `hasReceivedInitialState:
false` as the *initial* value only. The WebSocket lifecycle effect re-runs when `sessionId` changes
(`[sessionId]` dependency, line 174), correctly tearing down the old socket and opening a new one — but
it does **not** reset `state` back to its pristine shape first. If `SessionActivePage` (mounted at route
`/sessions/:sessionId`, `App.tsx:18`) were ever navigated between two different session IDs without an
intervening unmount (e.g., a future direct session-to-session link, or a router change that reuses the
component instance across a param-only URL change), `hasReceivedInitialState` and `coverage` would carry
over from the previous session until the new session's `initial_state` arrives, defeating exactly the
fail-closed guarantee this diff introduces: the manual "Relatório" button could render immediately using
stale sales-shaped coverage/`hasReceivedInitialState=true` from the previously-viewed session, even
though the newly-loaded session is a discovery session whose real `initial_state` hasn't arrived yet.

Today this is not reachable through any in-app navigation — I checked all `to`/`navigate` call sites
that target `/sessions/:id` (`ProjectDetailPage.tsx:139,330`, `SessionSetupPage.tsx:71,93`) and none of
them link from one `/sessions/:id` route directly to another; every session view is reached via a
different route (`/projects/:id` or `/projects/:id/sessions/new`) first, which forces a full remount.
The existing code comment in `lens.ts:87-88` and `useSessionWS.ts:59-61` explicitly asserts "já que
`useSessionWS` não reconecta sozinho" as the basis for the fix's correctness — that assertion is true
today, but nothing enforces it going forward, and the state-reuse gap is exactly the kind of thing that
would silently reopen CR-01 if a future change (e.g., an in-session "next session" link, or a router
version bump that changes remount semantics) is made without touching this file.

**Fix:** Either reset `state` at the top of the WS effect when `sessionId` changes, or key the hook's
internal identity to `sessionId` explicitly:
```ts
useEffect(() => {
  if (!sessionId) return
  setState({
    connected: false,
    coverage: {},
    redFlags: [],
    questions: [],
    transcript: [],
    budget: { used_usd: 0, limit_usd: null, estimated_report_cost: 0, status: 'ok' },
    reportMarkdown: null,
    wsError: null,
    hasReceivedInitialState: false,
  })
  const ws = new WebSocket(`${WS_BASE}/ws/${sessionId}`)
  ...
}, [sessionId])
```

---

_Reviewed: 2026-09-23T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
