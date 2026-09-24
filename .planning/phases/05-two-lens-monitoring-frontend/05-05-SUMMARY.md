---
phase: 05-two-lens-monitoring-frontend
plan: 05
subsystem: ui
tags: [react, typescript, vitest, websocket, frontend]

# Dependency graph
requires:
  - phase: 05-two-lens-monitoring-frontend (plans 01-04)
    provides: lens.ts helpers (isDiscoveryCoverage, groupCoverageByLens), useSessionWS hook, bloco "Gerar PRD" no ProjectDetailPage (D-47)
provides:
  - "shouldShowManualReportButton(hasReceivedInitialState, coverage): helper puro fail-closed que gateia o botão Relatório da topbar"
  - "hasReceivedInitialState no estado de useSessionWS — fonte síncrona de 'já sei o modo desta sessão'"
  - "prdError separado de readinessError no ProjectDetailPage — retry do Gerar PRD após falha transitória"
affects: [05-VERIFICATION, 05-REVIEW]

# Actuals (#2632)
actuals:
  tokens: 1998
  tasks: 2
  commits: 2

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Gate de visibilidade de botão que dispara efeito colateral (POST) extraído para helper puro testável, nunca inline no JSX sobre estado assíncrono do WebSocket"
    - "Erro de GET (fail-closed, desabilita) sempre em estado separado do erro de POST (não desabilita, permite retry)"

key-files:
  created: []
  modified:
    - frontend/src/lib/useSessionWS.ts
    - frontend/src/lib/lens.ts
    - frontend/src/lib/lens.test.ts
    - frontend/src/pages/SessionActivePage.tsx
    - frontend/src/pages/ProjectDetailPage.tsx

key-decisions:
  - "shouldShowManualReportButton vive em lens.ts (não inline em SessionActivePage) — mesma convenção dos outros helpers puros de lens (isDiscoveryCoverage, groupCoverageByLens), testável isoladamente (SOLID: regra de negócio fora do JSX)"
  - "hasReceivedInitialState é um campo novo no estado do hook, não um ref — precisa disparar re-render para o gate reagir assim que o initial_state chega"
  - "prdError é resetado no início de handleGeneratePrd (antes do try), não só no catch — evita mensagem de erro anterior sobreviver visualmente numa nova tentativa que ainda está em andamento"

patterns-established:
  - "GET-error vs POST-error como estados React distintos quando o mesmo componente expõe um botão de ação sobre um recurso que também é carregado (fail-closed no load, retry na ação)"

requirements-completed: [UI-01, UI-02, UI-03, REP-02]

coverage:
  - id: D1
    description: "Botão Relatório da topbar fica oculto em discovery inclusive antes do primeiro initial_state (fail-closed) — fecha CR-01"
    requirement: "REP-02"
    verification:
      - kind: unit
        ref: "frontend/src/lib/lens.test.ts#shouldShowManualReportButton (CR-01) > antes do initial_state, coverage vazio -> oculto"
        status: pass
      - kind: unit
        ref: "frontend/src/lib/lens.test.ts#shouldShowManualReportButton (CR-01) > antes do initial_state, mesmo com áreas sales em cache -> oculto"
        status: pass
      - kind: unit
        ref: "frontend/src/lib/lens.test.ts#shouldShowManualReportButton (CR-01) > discovery pós-initial_state -> permanece oculto"
        status: pass
    human_judgment: false
  - id: D2
    description: "Botão Relatório continua aparecendo no sales pós-initial_state, byte-idêntico ao comportamento anterior"
    requirement: "UI-01"
    verification:
      - kind: unit
        ref: "frontend/src/lib/lens.test.ts#shouldShowManualReportButton (CR-01) > sales pós-initial_state -> aparece (byte-idêntico ao sales)"
        status: pass
      - kind: unit
        ref: "frontend/src/lib/lens.test.ts#lens.ts > sales byte-idêntico: coverage com lens todo null não vira discovery e preserva conjunto/ordem"
        status: pass
    human_judgment: false
  - id: D3
    description: "Botão Gerar PRD permanece clicável (retry) após falha transitória de geração, exibindo a mensagem real do erro, separada da barra/erro de readiness"
    requirement: "REP-02"
    verification:
      - kind: other
        ref: "grep -Fc \"disabled={!readiness?.ready || readinessLoading || !!readinessError || generatingPrd}\" src/pages/ProjectDetailPage.tsx (condição disabled inalterada, sem prdError)"
        status: pass
      - kind: other
        ref: "grep -F \"setPrdError(e instanceof Error\" src/pages/ProjectDetailPage.tsx (catch roteia para prdError, não readinessError)"
        status: pass
    human_judgment: true
    rationale: "Comportamento de retry após falha de rede/API real (não simulável por unit test puro sem mock de api.sessions.generateReport); verificação por grep prova a estrutura do código, mas o fluxo de retry ponta a ponta no navegador é melhor confirmado por UAT humano."
  - id: D4
    description: "Falha ao carregar readiness (GET) continua desabilitando o botão Gerar PRD (fail-closed) e mostrando 'Erro ao carregar readiness' — comportamento preservado, não regredido"
    requirement: "UI-02"
    verification:
      - kind: other
        ref: "Read do effect de fetch readiness (~118-127) e do ramo readinessError no JSX — nenhuma linha alterada nesta plan"
        status: pass
    human_judgment: false

duration: ~10min
completed: 2026-09-24
status: complete
---

# Phase 05 Plan 05: Gap-closure CR-01/CR-02 Summary

**Gate fail-closed do botão "Relatório" por `hasReceivedInitialState` (não mais por `ws.coverage` assíncrono) + `prdError` separado de `readinessError` para permitir retry do "Gerar PRD"**

## Performance

- **Duration:** ~10min
- **Completed:** 2026-09-24T02:10:34Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- Fechado CR-01: o botão manual "Relatório" da topbar da sessão ativa (que dispara `POST /sessions/{id}/report` sem gate de readiness no backend) agora só aparece depois que o primeiro `initial_state` do WebSocket chegou E quando a cobertura indica sales — nunca mais decide a partir de um `coverage` vazio (`{}`) na janela de montagem/reconexão.
- A decisão de visibilidade virou um helper puro testado (`shouldShowManualReportButton`) em `lens.ts`, com 4 testes novos cobrindo os 4 quadrantes (antes/depois do `initial_state` × discovery/sales).
- Fechado CR-02: uma falha transitória na geração do PRD (POST) não trava mais o botão "Gerar PRD" para sempre — `prdError` é um estado dedicado, separado de `readinessError` (GET), e fica fora da condição `disabled`, permitindo retry e mostrando a mensagem real do erro.
- O fail-closed do GET de readiness foi preservado intacto — nenhuma linha do effect de fetch nem do ramo de renderização de `readinessError` foi tocada.

## Task Commits

Each task was committed atomically:

1. **Task 1 (Gap 1 / CR-01): gate do botão "Relatório" por hasReceivedInitialState** - `2aa01a6` (fix)
2. **Task 2 (Gap 2 / CR-02): separar prdError de readinessError** - `9aa7183` (fix)

_TDD: Task 1 seguiu RED (4 testes novos falhando com "is not a function") → GREEN (helper implementado, 10/10 testes verdes) dentro do mesmo commit — plano não pediu commits RED/GREEN separados._

## Files Created/Modified
- `frontend/src/lib/useSessionWS.ts` - campo `hasReceivedInitialState: boolean` no `SessionWSState`, `false` inicial, `true` no handler de `initial_state`
- `frontend/src/lib/lens.ts` - novo helper puro `shouldShowManualReportButton(hasReceivedInitialState, coverage)`
- `frontend/src/lib/lens.test.ts` - 4 novos testes cobrindo o gate do botão Relatório
- `frontend/src/pages/SessionActivePage.tsx` - gate do botão "Relatório" trocado de `!isDiscoveryCoverage(ws.coverage)` para `shouldShowManualReportButton(ws.hasReceivedInitialState, ws.coverage)`
- `frontend/src/pages/ProjectDetailPage.tsx` - estado `prdError`/`setPrdError` dedicado, `handleGeneratePrd` roteia o catch para `prdError` (zerado no início da chamada), JSX renderiza `{prdError}` abaixo do botão "Gerar PRD"

## Decisions Made
- `shouldShowManualReportButton` vive em `lens.ts` ao lado dos outros helpers puros de inferência de modo (mesma convenção de `isDiscoveryCoverage`/`groupCoverageByLens`), não inline no JSX — mantém a regra de negócio fora do componente (SOLID).
- `hasReceivedInitialState` é campo de estado (não `useRef`) porque precisa disparar re-render assim que o `initial_state` chega, para o gate reagir na mesma renderização.
- `prdError` é resetado (`setPrdError(null)`) no início de `handleGeneratePrd`, antes do `try` — evita que a mensagem de uma tentativa anterior sobreviva visualmente durante uma nova tentativa em andamento.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## Known Stubs

None.

## Threat Flags

None — este plano é uma correção do gate existente (T-05-01 e T-05-03 no `threat_model` do próprio 05-05-PLAN.md), sem superfície nova.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

As duas verdades que a 05-VERIFICATION.md marcou como falhas (CR-01, CR-02) agora passam:
- `npm test` — 10/10 testes verdes (regressão sales de `lens.ts` intacta + 4 testes novos do gate).
- `npx tsc -b --noEmit` — sem erros.
- Greps-âncora dos 3 arquivos de superfície confirmados.

Decisões em aberto registradas no `05-05-PLAN.md` (fora da fronteira `frontend/src/` deste gap closure, ficam para o time decidir):
- Gate de readiness server-side em `POST /sessions/{id}/report` (T-05-02, `accept`).
- WR-01 (redirect pós-geração pode cair numa sessão ainda ativa).
- WR-02 (vitest não cobre `.tsx`/jsdom — exigiria devDependency `jsdom` em `frontend/vite.config.ts`).

---
*Phase: 05-two-lens-monitoring-frontend*
*Completed: 2026-09-24*

## Self-Check: PASSED

All 5 modified source files and the SUMMARY.md itself confirmed present on disk; both task commits (`2aa01a6`, `9aa7183`) confirmed present in git log.
