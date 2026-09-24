# Phase 5: Two-Lens Monitoring (Frontend) - Pattern Map

**Mapped:** 2026-09-23
**Files analyzed:** 6 (2 backend, 4 frontend)
**Analogs found:** 6 / 6

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|--------------------|------|-----------|-----------------|----------------|
| `frontend/src/lib/useSessionWS.ts` (extend types + drop hardcode) | hook | event-driven (WebSocket) | itself (existing file, extend in place) | exact |
| `frontend/src/pages/SessionActivePage.tsx` — `CoveragePanel` (lens grouping) | component | request-response (renders WS state) | `CoveragePanel` itself, lines 68-147 | exact (extend in place) |
| `frontend/src/pages/SessionActivePage.tsx` — `QuestionCard`/`TranscriptPanel` (lens badge) | component | request-response | `Row`/badge chips in `ProjectDetailPage.tsx:267,348-356` (neutral-pill badge pattern) + existing tag markup at `SessionActivePage.tsx:348` | role-match |
| `frontend/src/pages/SessionActivePage.tsx` — Report status/approval selector (`!isActive` branch) | component | CRUD (PATCH) | `handleRegenerate`/`handleUploadPdf` mutate-with-disable pattern, `SessionActivePage.tsx:662-692`, 774-797 | exact |
| `frontend/src/pages/ProjectDetailPage.tsx` — `ReadinessBar` + "Gerar PRD" button | component | request-response (GET on mount) | `BudgetBar`, `SessionActivePage.tsx:153-198`, and `TTLBar`, `SessionActivePage.tsx:285-317` | exact (visual reference, new file/section) |
| `frontend/src/lib/api.ts` — `api.sessions.getReadiness` + `updateReportStatus` methods, `Report.status` field | service (API client) | request-response | existing `api.sessions.*` methods, `api.ts:212-243`, e.g. `generateReport`/`getReport` | exact |
| `backend/app/routers/sessions.py` — `GET /{session_id}/readiness` | route (FastAPI router) | request-response | `GET /{session_id}/report`, `sessions.py:310-322`, and `PATCH /{session_id}/report`, `sessions.py:349-379` | exact |
| `backend/app/models/sessions.py` — `ReportResponse.status` field | model (Pydantic schema) | transform (response serialization) | `ReportResponse`/`SessionResponse` classes in same file, lines 22-42 | exact |

## Pattern Assignments

### `frontend/src/lib/useSessionWS.ts` (hook, event-driven)

**Analog:** itself — extend in place, do not restructure.

**Hardcoded list to remove** (lines 54-61):
```typescript
const COVERAGE_AREAS = [
  'negocio', 'eng_dados', 'visualizacao', 'ciencia_dados',
  'automacao', 'integracao', 'consumo', 'parceria',
]

const INITIAL_COVERAGE: CoverageState = Object.fromEntries(
  COVERAGE_AREAS.map(a => [a, { status: 'uncovered' as const, score: 0, notes: '' }])
)
```
Per D-45/D-46, replace `INITIAL_COVERAGE` with `{}` (empty object) so `CoveragePanel` renders the
"aguardando classificação…" placeholder until `initial_state` arrives — do **not** invent a
placeholder area set.

**Types to extend with `lens`** (lines 4-26):
```typescript
export interface CoverageArea {
  status: 'covered' | 'partial' | 'uncovered'
  score: number
  notes: string
}

export interface RedFlag {
  id: string
  text: string
  severity: 'warning' | 'critical'
  evidence: string
  detected_at: string
}

export interface WSQuestion {
  id: string
  text: string
  block: string
  source: 'auto' | 'manual' | 'pre_mapped'
  status: 'queued' | 'pinned' | 'dismissed' | 'used'
  generated_at: string
  expires_at: string
}
```
Add `lens: 'produto' | 'dados' | null` as the **last field** to each (mirrors backend dataclass
convention — `session_state.py:79` and `:94` both append `lens` as the last field with `None`
default, "never null in discovery, always null in sales" per D-24). `CoverageArea` also needs
`name: string` added (backend already emits it, `session_state.py:65`, `coverage_to_dict` at
`:193-202`) since D-45 requires consuming `name` from the payload instead of `AREA_LABELS`.

**`ws.onmessage` handlers — no change needed** (lines 114-159): they already do
`data.coverage as CoverageState` / `data as WSQuestion` / `data as RedFlag`, i.e. spread the raw
payload through untyped casts. Once the interfaces above gain `lens`/`name`, these lines propagate
the new fields for free — this is the reason D-45 calls out that "só faltam os campos nos tipos."

---

### `frontend/src/pages/SessionActivePage.tsx` — `CoveragePanel` (lens grouping, D-43/D-45/D-46)

**Analog:** the function itself, `SessionActivePage.tsx:68-147` — restructure its body, keep its
signature/styling conventions.

**Current flat-list pattern to generalize** (lines 88-129, the `active`/`inactive` split + row
markup):
```typescript
const active = Object.entries(coverage).filter(([, i]) => i.status !== 'not_applicable')
const inactive = Object.entries(coverage).filter(([, i]) => i.status === 'not_applicable')
...
{active.map(([area, info]) => (
  <div key={area} className="px-3 py-2 hover:bg-[var(--color-muted)] rounded-sm transition-colors" title={info.notes || undefined}>
    <div className="flex items-center gap-2 mb-1">
      <span className={`shrink-0 w-2 h-2 rounded-full ${statusDot[info.status] ?? statusDot.uncovered}`} />
      <span className="text-xs text-[var(--color-text-primary)] truncate flex-1">
        {AREA_LABELS[area] ?? area}
      </span>
      <span className="text-xs text-[var(--color-text-secondary)] tabular-nums">{info.score}%</span>
    </div>
    <div className="ml-4 h-1 bg-[var(--color-border-std)] rounded-full overflow-hidden">
      <div className={`h-full rounded-full transition-all duration-500 ${statusColor[info.status] ?? statusColor.uncovered}`} style={{ width: `${info.score}%` }} />
    </div>
  </div>
))}
```
This exact row markup is the unit to reuse per lens group. Replace `AREA_LABELS[area] ?? area`
with `info.name || area` (D-45, server-driven label). Wrap it: if any `coverage` entry has
`lens != null`, render two `<div>` groups (header + row-list, sales-plain-list becomes
discovery-two-sections) using the identical header style already used one line above for the
panel itself:
```typescript
<span className="text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider">
  Cobertura
</span>
```
(reuse verbatim for "Produto"/"Dados" sub-headers per UI-SPEC Typography section — do not invent a
new size). If all entries have `lens == null` (sales), render the existing flat list unchanged —
this is the byte-identical-sales guarantee (D-03/D-24/D-43).

**Empty state (D-46):** when `Object.keys(coverage).length === 0` (before `initial_state`), render
the existing muted-placeholder pattern already used elsewhere in this same file for "no data yet":
```typescript
<p className="text-sm text-[var(--color-text-secondary)] text-center pt-8">
  Aguardando transcrição...
</p>
```
(from `TranscriptPanel`, line 260-262) — same treatment, text swapped to "aguardando
classificação…" per copy contract, smaller `text-xs` per UI-SPEC.

---

### `frontend/src/pages/SessionActivePage.tsx` — Lens badges (`QuestionCard`, `TranscriptPanel`, D-44)

**Analog:** existing tag-chip markup, `QuestionCard`, line 348:
```typescript
<span className="text-xs px-1.5 py-0.5 rounded-[var(--radius-tag)] bg-[var(--color-green-bg-tag)] text-[var(--color-accent)] border border-[var(--color-border-green)]">
  {blockLabel[question.block] ?? question.block}
</span>
```
This is the **Produto** badge shape verbatim (per UI-SPEC Color table: Produto badge uses exactly
`--color-green-bg-tag` / `--color-accent` / `--color-border-green`). For **Dados**, clone the same
`<span>` structure with the neutral-pill classes already used for "encerrada"/"rascunho" badges in
`ProjectDetailPage.tsx`:
```typescript
<span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-[var(--color-muted)] text-[var(--color-text-secondary)]">
  encerrada
</span>
```
(`ProjectDetailPage.tsx:267`, repeated at `:353` for "rascunho") — same fill/text/border triple the
UI-SPEC mandates for the Dados badge (`--color-muted` / `--color-text-secondary` /
`--color-border-std`).

**D-44 badge-vs-sublabel restructuring inside `QuestionCard`:** demote the current block chip
(line 348) to a sub-label under the new primary lens badge; `blockLabel` map (lines 334-343) must
be extended from 8 sales entries to the 18 `DISCOVERY_AREA_SET.label` values (see Implementation
Note 1 in UI-SPEC — **not** the Precificador's 12-block vocabulary). Render no badge at all when
`question.lens == null` (sales, D-44).

**`TranscriptPanel` red-flag rows (lines 226-252):** add the same lens-badge `<span>` next to the
existing `AlertTriangle` icon row; **no sub-label** (backend `RedFlag` dataclass has no `block`
field — UI-SPEC Implementation Note 2). Current row shell to extend:
```typescript
<div key={rf.id} className={`px-4 py-3 flex gap-3 ${rf.severity === 'critical' ? 'bg-[var(--color-red-bg)]' : 'bg-[var(--color-yellow-bg)]'}`}>
  <AlertTriangle size={14} className={...} />
  <div className="min-w-0">
    <p className="text-sm text-[var(--color-text-primary)]">{rf.text}</p>
    ...
  </div>
</div>
```

---

### `frontend/src/pages/SessionActivePage.tsx` — Report status/approval selector (`!isActive` branch, D-48)

**Analog:** the existing mutate-with-disable pattern used for `handleRegenerate`/`handleUploadPdf`
in the same branch.

**State + disable-while-mutating pattern** (lines 662-692, 774-797):
```typescript
async function handleRegenerate() {
  if (!sessionId || regenerating) return
  setRegenerating(true)
  setError(null)
  try {
    const report = await api.sessions.generateReport(sessionId)
    setFinishedReport(report)
    setReportModal(report.markdown_content)
  } catch (e: unknown) {
    setError(e instanceof Error ? e.message : 'Erro ao regenerar relatório')
  } finally {
    setRegenerating(false)
  }
}
```
```typescript
<button
  onClick={handleRegenerate}
  disabled={regenerating || uploadingPdf}
  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[var(--color-text-secondary)] border border-[var(--color-border-std)] rounded-[var(--radius-btn)] hover:bg-[var(--color-muted)] transition-colors disabled:opacity-50"
>
  <RefreshCw size={12} />
  {regenerating ? 'Gerando...' : 'Regenerar'}
</button>
```
Clone this shape for `handleUpdateReportStatus(newStatus)`: new `updatingStatus` boolean state,
call `api.sessions.updateReportStatus(sessionId, newStatus)` (new client method, see api.ts
section below), `setFinishedReport(updated)` on success, revert to `finishedReport.status` (not
the attempted value) on failure per UI-SPEC error-state row — reuse the existing inline `error`
state + banner (already rendered at line 176-180 of `ProjectDetailPage.tsx`-equivalent, and in this
file wherever `error` is shown near the topbar). Render as a 3-option selector (native `<select>`
or 3 buttons) with values exactly `"Rascunho" | "Em revisão" | "Aprovado para build"` (verbatim
match to backend Literal, `sessions.py:346`). Disable while `updatingStatus` — same
`disabled={updatingStatus}` idiom as above.

**Insertion point:** inside the `finishedReport &&` block, lines 831-861, alongside "Ver relatório
completo →".

---

### `frontend/src/pages/ProjectDetailPage.tsx` — `ReadinessBar` + "Gerar PRD" (D-47)

**Analog (visual + structural reference):** `BudgetBar`, `SessionActivePage.tsx:153-198`, and
`TTLBar`, `SessionActivePage.tsx:285-317` — per UI-SPEC Component Inventory, "clone the pattern
into a new `ReadinessBar`," do not modify `BudgetBar` itself.

**Thin-bar-with-threshold-color pattern to clone** (`BudgetBar`, lines 164-185):
```typescript
const pct = limit ? Math.min((used / limit) * 100, 100) : 0
const barColor =
  status === 'insufficient' || status === 'critical'
    ? 'bg-[var(--color-red)]'
    : status === 'warning'
      ? 'bg-[var(--color-yellow)]'
      : 'bg-[var(--color-accent)]'
...
<div className="flex-1 h-1.5 bg-[var(--color-border-std)] rounded-full overflow-hidden">
  <div className={`h-full rounded-full transition-all duration-500 ${barColor}`} style={{ width: `${pct.toFixed(1)}%` }} />
</div>
```
For `ReadinessBar`: `pct = Math.round(readiness.score * 100)`, single-color fill
(`bg-[var(--color-accent)]`, muted until near threshold per UI-SPEC Visual Hierarchy note — bar
must stay visually secondary to the button), `h-1.5` height matches spec.

**Loading-in-flight pattern to reuse** (page's existing `loading` boolean idiom,
`ProjectDetailPage.tsx:56, 114-120`):
```typescript
const [loading, setLoading] = useState(true)
...
if (loading) {
  return (... <span className="text-sm text-[var(--color-text-secondary)]">Carregando...</span> ...)
}
```
Scope an equivalent boolean (e.g. `readinessLoading`) to just the readiness block (UI-SPEC:
"reuses the page's existing `loading` boolean pattern, just scoped to this block").

**CTA button styling to reuse** (existing primary-CTA classes, `ProjectDetailPage.tsx:183-189`):
```typescript
<Link
  to={`/projects/${id}/sessions/new`}
  className="w-full flex items-center justify-center gap-2 py-3 bg-[var(--color-accent)] text-white rounded-lg text-sm font-medium hover:bg-[var(--color-accent-hover)] transition-colors"
>
  <Play size={15} />
  Nova sessão
</Link>
```
"Gerar PRD" reuses this accent-filled button treatment (per UI-SPEC "primary visual anchor is the
button itself"), `disabled` while `!readiness.ready`, `title=` tooltip built from `low_signals` —
tooltip convention already established at `SessionActivePage.tsx:944`:
```typescript
title={ws.budget.status === 'insufficient' ? 'Saldo insuficiente' : 'Gerar relatório (R)'}
```

**Error state to reuse** (page-level error banner, `ProjectDetailPage.tsx:176-180`):
```typescript
{error && (
  <div className="text-sm text-[var(--color-red)] bg-[var(--color-red-bg)] border border-[var(--color-border-red)] rounded-md px-4 py-3">
    {error}
  </div>
)}
```
For the readiness-fetch failure, use the smaller inline variant per UI-SPEC ("Erro ao carregar
readiness" in `text-[var(--color-red)] text-xs`), scoped to the block, not the whole page.

**Insertion point:** per discovery session row inside the "Sessões" list (lines 250-318), or as a
dedicated block before "Precificações" (line 320) — Claude's Discretion per CONTEXT.md, gated to
sessions where `project.mode === 'discovery'`.

---

### `frontend/src/lib/api.ts` — new client methods + `Report.status` (D-48/D-49)

**Analog:** existing `api.sessions.*` methods, lines 212-243 (same object, same `request<T>`
helper).

**Pattern to clone** (`getReport`/`generateReport`, lines 226-229):
```typescript
generateReport: (id: string) =>
  request<Report>(`/sessions/${id}/report`, { method: 'POST' }),
getReport: (id: string) =>
  request<Report>(`/sessions/${id}/report`),
```
Add:
```typescript
getReadiness: (id: string) =>
  request<Readiness>(`/sessions/${id}/readiness`),
updateReportStatus: (id: string, status: Report['status']) =>
  request<Report>(`/sessions/${id}/report`, { method: 'PATCH', body: JSON.stringify({ status }) }),
```
(the `PATCH` variant follows the same shape as `rename`, line 222-223:
`request<Session>(`/sessions/${id}/rename`, { method: 'PATCH', body: JSON.stringify({ name }) })`).

**New `Readiness` type**, mirroring backend `ReadinessScore` dataclass verbatim (per UI-SPEC
Implementation Note 5 — no reshaping):
```typescript
export interface Readiness {
  score: number
  signals: Record<string, number>
  ready: boolean
  low_signals: string[]
}
```

**`Report` interface to extend** (lines 81-87):
```typescript
export interface Report {
  id: string
  session_id: string
  markdown_content: string
  cost_usd: string
  generated_at: string
}
```
Add `status: 'Rascunho' | 'Em revisão' | 'Aprovado para build'` — mirrors the backend fix below.

---

### `backend/app/routers/sessions.py` — `GET /{session_id}/readiness` (D-49)

**Analog:** `GET /{session_id}/report`, lines 310-322, for the "resolve latest row, 404 if none"
shape — but readiness is a **pure function on live `SessionState`**, not a DB row, so the closer
structural analog for *fetching the in-memory pipeline* is `POST /{session_id}/questions/generate`,
lines 300-307:
```python
@router.post("/{session_id}/questions/generate")
async def generate_session_questions(session_id: UUID, db: Client = Depends(get_supabase)):
    from app.services.pipeline import pipeline_manager
    pipeline = await pipeline_manager.get_or_create(str(session_id))
    if not pipeline:
        raise HTTPException(status_code=404, detail="Session not found or not active")
    await pipeline.trigger_questions()
    return {"triggered": True}
```
New route follows the same import-pipeline-manager-lazily + 404-if-missing shape, `allow_finished=True`
(same kwarg `generate_session_report` already uses at line 328, since readiness must be readable
for finished discovery sessions too — the project page reads it post-call, not just live):
```python
@router.get("/{session_id}/readiness")
async def get_session_readiness(session_id: UUID, db: Client = Depends(get_supabase)):
    from app.services.pipeline import pipeline_manager
    pipeline = await pipeline_manager.get_or_create(str(session_id), allow_finished=True)
    if not pipeline:
        raise HTTPException(status_code=404, detail="Session not found")
    return pipeline.state.readiness_score()
```
(exact attribute path — `pipeline.trigger_report()` at line 331 shows the pipeline wraps a
`SessionState`; confirm the attribute name — likely `pipeline.state` — against `pipeline.py` before
wiring, since `readiness_score()` itself is a zero-I/O method on `SessionState`,
`session_state.py:204-260+`).

**Route placement:** insert directly after the report routes (line 380, before
`/transcript/upload`), matching file's existing route-grouping-by-feature convention.

**Response model:** the FastAPI convention in this file is dataclass-or-dict return with an
explicit `response_model=` Pydantic class when the shape is a DB row (e.g. `ReportResponse`) —
since `ReadinessScore` is a plain dataclass with primitive/dict fields, returning it directly (no
`response_model=`) is acceptable and matches the `{"triggered": True}` precedent above (ad-hoc
dict/dataclass return, no schema class needed for an internal-shape passthrough). If a
`response_model` is preferred for OpenAPI-doc parity with the rest of the file, add a small
`ReadinessResponse(BaseModel)` in `app/models/sessions.py` mirroring the 4 `ReadinessScore` fields
verbatim — Claude's Discretion per D-49.

---

### `backend/app/models/sessions.py` — `ReportResponse.status` (Implementation Note 3, additive)

**Analog:** the class itself, lines 22-27, and the sibling `SessionResponse` (lines 30-42) which
already shows the file's convention for adding an `Optional[str]`-style field with a default.

**Current class:**
```python
class ReportResponse(BaseModel):
    id: UUID
    session_id: UUID
    markdown_content: str
    cost_usd: Decimal
    generated_at: datetime
```
Add, using the same `Literal` already imported and used for `ReportStatusUpdate` in
`sessions.py:346` (import `Literal` here too):
```python
class ReportResponse(BaseModel):
    id: UUID
    session_id: UUID
    markdown_content: str
    cost_usd: Decimal
    generated_at: datetime
    status: Literal["Rascunho", "Em revisão", "Aprovado para build"]
```
This is the fix flagged in UI-SPEC Implementation Note 3: today `response_model=ReportResponse`
silently strips `status` from every report JSON response even though the DB row has carried it
since Phase 4 (D-36) — additive, same file `sessions.py` already touches for D-49.

---

## Shared Patterns

### Tooltip via `title` attribute
**Source:** `SessionActivePage.tsx:944` (`title={ws.budget.status === 'insufficient' ? ... : 'Gerar relatório (R)'}`)
**Apply to:** "Gerar PRD" blocked-tooltip (D-47), any other new hover-hint text this phase adds.

### Disable-while-mutating (optimistic-guard) pattern
**Source:** `handleRegenerate`/`handleUploadPdf`, `SessionActivePage.tsx:662-692, 677-692`, and their
button `disabled={regenerating || uploadingPdf}` wiring at lines 774-797.
**Apply to:** report status `PATCH` selector (D-48), readiness fetch + "Gerar PRD" button loading
state (D-47).

### Neutral-pill badge (secondary/auxiliary semantic)
**Source:** `ProjectDetailPage.tsx:267` ("encerrada") and `:353` ("rascunho") —
`bg-[var(--color-muted)] text-[var(--color-text-secondary)]` pill.
**Apply to:** Dados lens badge (D-44) — explicitly the pattern UI-SPEC's Color section calls out
by line number for the neutral treatment.

### Accent tag-chip (primary semantic)
**Source:** `QuestionCard` block-label chip, `SessionActivePage.tsx:348`
(`bg-[var(--color-green-bg-tag)] text-[var(--color-accent)] border-[var(--color-border-green)]`).
**Apply to:** Produto lens badge (D-44), "Gerar PRD" CTA button surface color.

### `request<T>` fetch wrapper + typed `api.*` namespace
**Source:** `frontend/src/lib/api.ts:68-79` (`request`) and the `api.sessions` object, lines 212-243.
**Apply to:** `getReadiness`/`updateReportStatus` new methods — no new fetch abstraction needed.

### Pipeline-lookup-then-404 route shape
**Source:** `generate_session_questions`/`generate_session_report`, `sessions.py:300-307, 325-342`
(`pipeline_manager.get_or_create(str(session_id), allow_finished=...)`, 404 if `None`).
**Apply to:** `GET /{session_id}/readiness` (D-49).

## No Analog Found

None — every file/behavior in scope (per CONTEXT.md canonical_refs and UI-SPEC Component
Inventory) has a direct in-repo analog; this phase is explicitly an extension of a well-understood,
already-implemented design system (UI-SPEC: "extends an established, already-implemented
hand-rolled design system across 4 completed phases").

## Metadata

**Analog search scope:** `frontend/src/lib/`, `frontend/src/pages/`, `backend/app/routers/`,
`backend/app/models/`, `backend/app/services/session_state.py`, `backend/app/services/pipeline.py`
**Files scanned:** 7 (`useSessionWS.ts`, `SessionActivePage.tsx`, `ProjectDetailPage.tsx`, `api.ts`,
`session_state.py`, `sessions.py`, `models/sessions.py`)
**Pattern extraction date:** 2026-09-23
