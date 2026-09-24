---
phase: 05-two-lens-monitoring-frontend
plan: 01
subsystem: ui
tags: [react, typescript, vitest, websocket, frontend]

# Dependency graph
requires:
  - phase: 03-two-agent-questions-lens-tagging
    provides: "backend já emite name+lens por área em coverage_to_dict (session_state.py:185-202) e lens em RedFlag/Question via broadcast __dict__"
provides:
  - "Tipos server-driven (CoverageArea.name/lens, RedFlag.lens, WSQuestion.lens) em useSessionWS.ts"
  - "Helpers puros isDiscoveryCoverage/groupCoverageByLens (frontend/src/lib/lens.ts)"
  - "CoveragePanel agrupado por lente (Produto/Dados) no discovery, lista plana byte-idêntica no sales, empty state antes do initial_state"
  - "Infra vitest (package.json script test, vite.config.ts bloco test) + primeiro teste real do frontend (lens.test.ts)"
affects: [05-02, 05-03, 05-04, badges de lente, handoff de PRD]

# Actuals (#2632)
actuals:
  tokens: 3616
  tasks: 2
  commits: 2
plan_head_before: 8717809378968aa48b646f0743f515668f78b1e3

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Inferência de modo pelo payload (D-42): isDiscoveryCoverage checa se QUALQUER área tem lens != null, sem fetch extra"
    - "Helpers puros em frontend/src/lib/ (sem import de React), testáveis isoladamente com ambiente vitest 'node'"

key-files:
  created:
    - frontend/src/lib/lens.ts
    - frontend/src/lib/lens.test.ts
  modified:
    - frontend/src/lib/useSessionWS.ts
    - frontend/src/pages/SessionActivePage.tsx
    - frontend/package.json
    - frontend/vite.config.ts

key-decisions:
  - "CoverageArea.status ganhou o literal 'not_applicable' (estava faltando no tipo, mas já era comparado no código pré-existente com strings soltas) — Rule 1, sem isso o tsc rejeitava a comparação ao trocar o tipo da prop coverage para o CoverageState compartilhado"

patterns-established:
  - "CoveragePanel: um único helper renderAreaRow reutilizado nos três ramos (empty/discovery/sales) para não duplicar o markup de linha de área"

requirements-completed: [UI-01, UI-03]

coverage:
  - id: D1
    description: "Sessão discovery mostra a coluna de cobertura em duas seções empilhadas (Produto/Dados) desenhadas a partir do name+lens do payload, na ordem de inserção"
    requirement: "UI-01"
    verification:
      - kind: unit
        ref: "frontend/src/lib/lens.test.ts#discovery agrupa: coverage com áreas produto e dados intercaladas -> isDiscoveryCoverage true e groupCoverageByLens separa por lente na ordem do input"
        status: pass
    human_judgment: false
  - id: D2
    description: "Sessão sales mostra a mesma lista plana de hoje, sem cabeçalho de lente — byte-idêntica ao comportamento atual"
    requirement: "UI-01"
    verification:
      - kind: unit
        ref: "frontend/src/lib/lens.test.ts#sales byte-idêntico: coverage com lens todo null não vira discovery e preserva conjunto/ordem"
        status: pass
    human_judgment: false
  - id: D3
    description: "Frontend não tem mais lista de áreas nem mapa de labels hardcoded; consome name/lens diretamente do payload do WebSocket"
    requirement: "UI-03"
    verification:
      - kind: unit
        ref: "grep -q COVERAGE_AREAS useSessionWS.ts (ausente) + grep -q AREA_LABELS SessionActivePage.tsx (ausente) -> NO_HARDCODE_OK"
        status: pass
    human_judgment: false
  - id: D4
    description: "Antes do initial_state chegar, a coluna mostra o placeholder 'aguardando classificação…', nunca áreas inventadas"
    requirement: "UI-01"
    verification:
      - kind: unit
        ref: "frontend/src/lib/lens.test.ts#empty (D-46/UI-03): coverage {} não é discovery e groupCoverageByLens devolve produto/dados vazios"
        status: pass
    human_judgment: true
    rationale: "O teste prova a lógica pura (isDiscoveryCoverage/groupCoverageByLens) para coverage vazio, mas o texto exato renderizado e o tratamento visual do placeholder no CoveragePanel real (JSX) não têm teste automatizado de render (sem @testing-library configurado neste plano) — precisa confirmação visual humana."
  - id: D5
    description: "Backstop zero-one-many: um grupo de lente com 0 áreas ativas ainda renderiza o cabeçalho, nunca colapsa para lista plana"
    verification:
      - kind: unit
        ref: "frontend/src/lib/lens.test.ts#one-lens-empty (backstop zero-one-many): coverage só com áreas produto ainda devolve a chave dados: []"
        status: pass
    human_judgment: false

duration: ~15min
completed: 2026-09-24
status: complete
---

# Phase 5 Plan 1: Áreas de cobertura server-driven + agrupamento por lente Summary

**CoveragePanel passa a renderizar `name`/`lens` vindos do payload do WebSocket — duas seções Produto/Dados no discovery, lista plana byte-idêntica no sales — zero lista de áreas hardcoded no frontend, com teste de regressão real (vitest).**

## Performance

- **Duration:** ~15min
- **Completed:** 2026-09-24T00:57:17Z
- **Tasks:** 2
- **Files modified:** 6 (2 criados, 4 modificados)

## Accomplishments
- `useSessionWS.ts` ganhou `name`/`lens` nos tipos (`CoverageArea`, `RedFlag`, `WSQuestion`) e removeu `COVERAGE_AREAS`/`INITIAL_COVERAGE` hardcoded — `coverage` inicial vira `{}`.
- Novo módulo puro `frontend/src/lib/lens.ts` com `isDiscoveryCoverage` (inferência de modo pelo payload, D-42) e `groupCoverageByLens` (particiona preservando ordem, chaves `produto`/`dados` sempre presentes).
- `CoveragePanel` reescrito: empty state (D-46) → duas seções por lente no discovery (D-43) → lista plana idêntica no sales (D-03/D-24), tudo usando `info.name` em vez do `AREA_LABELS` removido.
- Infra de teste (vitest) adicionada e primeiro teste real do frontend (`lens.test.ts`, 4 casos) provando a regressão sales byte-idêntico + agrupamento discovery + empty + backstop zero-one-many.

## Task Commits

Cada task foi commitada atomicamente:

1. **Task 1 (TRACER): áreas server-driven + agrupamento por lente** - `98bf6bc` (feat)
2. **Task 2: infra vitest + semente de regressão** - `2930c4d` (test)

**Plan metadata:** commit final (docs) — ver `git log` após esta etapa.

## Files Created/Modified
- `frontend/src/lib/useSessionWS.ts` - tipos ganham `name`/`lens`; remoção de `COVERAGE_AREAS`/`INITIAL_COVERAGE`; `coverage` inicial `{}`
- `frontend/src/lib/lens.ts` (novo) - `isDiscoveryCoverage`, `groupCoverageByLens` (helpers puros)
- `frontend/src/lib/lens.test.ts` (novo) - semente de regressão (4 casos)
- `frontend/src/pages/SessionActivePage.tsx` - `CoveragePanel` reescrito (empty/discovery/sales); remoção de `AREA_LABELS`
- `frontend/package.json` - script `test`
- `frontend/vite.config.ts` - `defineConfig` de `vitest/config` + bloco `test`

## Decisions Made
- `CoverageArea.status` ganhou o literal `'not_applicable'` no tipo compartilhado (Rule 1 — bug de tipo pré-existente: o código já comparava contra essa string antes desta task, mas o tipo não a declarava; ao trocar a prop `coverage` do `CoveragePanel` para o `CoverageState` compartilhado, o `tsc` passou a rejeitar a comparação `i.status !== 'not_applicable'`). Sem isso o `npx tsc -b --noEmit` não compilava.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Tipo `CoverageArea.status` não incluía `'not_applicable'`**
- **Found during:** Task 1 (verificação `npx tsc -b --noEmit`)
- **Issue:** O código do `CoveragePanel` (antes e depois desta task) sempre comparou `status` contra a string `'not_applicable'` para separar áreas ativas/inativas, mas o tipo `CoverageArea.status` só declarava `'covered' | 'partial' | 'uncovered'`. Isso não dava erro antes porque a prop `coverage` do `CoveragePanel` era tipada como um objeto inline solto (`Record<string, { status: string; ... }>`), sem o literal restrito. Ao trocar a prop para o `CoverageState` compartilhado (exigido pelo plano, para carregar `name`/`lens`), o `tsc` passou a inferir o literal e rejeitou a comparação como "sem overlap".
- **Fix:** Adicionado `'not_applicable'` ao union type de `CoverageArea.status` em `useSessionWS.ts`.
- **Files modified:** `frontend/src/lib/useSessionWS.ts`
- **Verification:** `npx tsc -b --noEmit` sai limpo (0 erros) após o ajuste.
- **Committed in:** `98bf6bc` (parte do commit da Task 1)

---

**Total deviations:** 1 auto-fixed (1 bug de tipo)
**Impact on plan:** Correção necessária para a task compilar conforme o próprio critério de aceite do plano (`npx tsc -b --noEmit` sai 0). Sem scope creep — nenhum comportamento visual mudou, só o tipo passou a refletir o que o runtime já fazia.

## Issues Encountered
None além do já documentado em Deviations.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- `useSessionWS`/`lens.ts`/`CoveragePanel` prontos como base para a 05-02 (badges de lente em `QuestionCard`/`TranscriptPanel`, que reusam o campo `lens` já tipado aqui).
- Infra vitest disponível para as próximas plans do phase adicionarem testes sem repetir o setup.
- Nenhum bloqueio identificado.

## Self-Check: PASSED

Todos os arquivos declarados (6 de código + este SUMMARY.md) e os 2 commits (`98bf6bc`, `2930c4d`) foram confirmados no disco/histórico do git.

---
*Phase: 05-two-lens-monitoring-frontend*
*Completed: 2026-09-24*
