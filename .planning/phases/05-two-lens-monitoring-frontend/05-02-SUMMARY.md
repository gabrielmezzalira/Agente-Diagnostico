---
phase: 05-two-lens-monitoring-frontend
plan: 02
subsystem: ui
tags: [react, typescript, vitest, frontend]

# Dependency graph
requires:
  - phase: 05-two-lens-monitoring-frontend
    plan: 01
    provides: "lens.ts (isDiscoveryCoverage/groupCoverageByLens), CoverageArea/RedFlag/WSQuestion.lens tipados em useSessionWS.ts, CoveragePanel agrupado por lente"
provides:
  - "lens.ts::BLOCK_LABELS (18 discovery + 8 sales) + blockLabel/lensLabel/lensBadgeVariant (helpers puros)"
  - "QuestionCard com badge de lente principal + bloco como sub-label (discovery) / chip atual preservado (sales)"
  - "TranscriptPanel com badge de lente na linha de red flag (sem sub-label)"
  - "Topbar da sessão ativa sem botão 'Relatório' quando isDiscoveryCoverage(ws.coverage) é true"
affects: [05-03, 05-04, handoff de PRD]

# Actuals (#2632)
actuals:
  tokens: 2675
  tasks: 2
  commits: 2
plan_head_before: 5163860de555dbb53c2a1862cc08fa77050d2967

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "LensBadge: componente local único (SessionActivePage.tsx) reusado por QuestionCard e TranscriptPanel — evita duplicar as classes de cor por variante em dois lugares"
    - "BLOCK_LABELS unificado em lens.ts (18 discovery + 8 sales), substituindo o mapa local que existia dentro de QuestionCard"

key-files:
  created: []
  modified:
    - frontend/src/lib/lens.ts
    - frontend/src/lib/lens.test.ts
    - frontend/src/pages/SessionActivePage.tsx

key-decisions:
  - "LensBadge extraído como componente compartilhado (não helper de string) — QuestionCard e TranscriptPanel importam o mesmo componente, garantindo que a cor/variante da badge Produto/Dados nunca diverge entre os dois pontos de uso (decisão de implementação, dentro do Claude's Discretion do CONTEXT.md sobre cores/estilo exatos)"

patterns-established:
  - "lensBadgeVariant restringe a variante ao enum produto/dados/none — qualquer valor fora disso cai em 'none' (sem badge), nunca deriva uma classe CSS arbitrária (mitigação de T-05-02-01)"

requirements-completed: [UI-02]

coverage:
  - id: D1
    description: "blockLabel devolve os 18 labels discovery verbatim (não o vocabulário de 12 blocos do Precificador) + as 8 chaves sales preservadas, com fallback para a própria chave quando desconhecida"
    requirement: "UI-02"
    verification:
      - kind: unit
        ref: "frontend/src/lib/lens.test.ts#blockLabel: devolve labels discovery verbatim"
        status: pass
    human_judgment: false
  - id: D2
    description: "lensBadgeVariant(null) === 'none' (base do gate sem-badge-no-sales) e lensLabel/lensBadgeVariant cobrem produto/dados corretamente"
    requirement: "UI-02"
    verification:
      - kind: unit
        ref: "frontend/src/lib/lens.test.ts#lensBadgeVariant/lensLabel: decide a variante/tag da badge de lente"
        status: pass
    human_judgment: false
  - id: D3
    description: "QuestionCard renderiza a badge de lente como tag principal + bloco como sub-label quando question.lens != null; quando null, mantém o chip de bloco atual (sem badge) — sales byte-idêntico"
    requirement: "UI-02"
    verification:
      - kind: unit
        ref: "npx tsc -b --noEmit (0 erros) + grep BADGE_WIRED_OK (lensBadgeVariant/isDiscoveryCoverage ligados no componente)"
        status: pass
    human_judgment: true
    rationale: "A regra de gate (lens != null) está no código e compila, mas o render visual real (badge verde vs neutra, layout do sub-label) não tem teste de render automatizado (sem @testing-library configurado) — precisa confirmação visual humana abrindo uma sessão discovery e uma sales."
  - id: D4
    description: "Linha de red flag em discovery exibe a badge de lente (sem sub-label de bloco, já que RedFlag não tem block); sales sem badge"
    requirement: "UI-02"
    verification:
      - kind: unit
        ref: "npx tsc -b --noEmit (0 erros) — tipo RedFlag.lens propagado ao prop inline de TranscriptPanel sem erro"
        status: pass
    human_judgment: true
    rationale: "Mesma limitação de D3 — gate por rf.lens != null está no código, mas o render visual da linha de alerta precisa inspeção humana (nenhuma sessão discovery real rodou este código ainda)."
  - id: D5
    description: "Botão 'Relatório' da topbar não é renderizado quando isDiscoveryCoverage(ws.coverage) é true; sales mantém o botão exatamente como antes"
    requirement: "UI-02"
    verification:
      - kind: unit
        ref: "npx tsc -b --noEmit (0 erros) + grep BADGE_WIRED_OK (isDiscoveryCoverage usado na topbar)"
        status: pass
    human_judgment: true
    rationale: "O gate condicional foi adicionado e compila, mas a ausência visual do botão em uma sessão discovery real (e a presença byte-idêntica em sales) não tem teste de render — precisa confirmação visual humana antes do ship."

duration: ~10min
completed: 2026-09-24
status: complete
---

# Phase 5 Plan 2: Badges de lente (Produto/Dados) + oculta Relatório em discovery Summary

**Cards de pergunta e linhas de red flag em discovery ganham a badge de lente (Produto verde / Dados neutro) como tag principal, com o bloco temático virando sub-label só na pergunta; no sales nada muda. Como consequência, a topbar da sessão ativa em discovery deixa de mostrar o botão "Relatório" (a geração migra para a página do projeto na 05-04).**

## Performance

- **Duration:** ~10min
- **Completed:** 2026-09-24T22:08:00Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- `lens.ts` ganhou `BLOCK_LABELS` (18 chaves discovery verbatim de `DISCOVERY_AREA_SET` + as 8 chaves sales já existentes) e os helpers puros `blockLabel`/`lensLabel`/`lensBadgeVariant`, com 2 novos casos de teste (6 no total, todos verdes).
- `QuestionCard` teve o mapa de bloco local removido em favor do helper importado; o card agora mostra a badge de lente como tag principal + bloco como sub-label em discovery, preservando o chip de bloco atual quando não há lente (sales).
- `TranscriptPanel` ganhou a mesma badge de lente em cada linha de red flag (sem sub-label, já que o `RedFlag` do backend não tem campo `block`).
- Extraído um componente `LensBadge` compartilhado (classes de cor por variante centralizadas em um só lugar) usado tanto pelo `QuestionCard` quanto pelo `TranscriptPanel`.
- Topbar da sessão ativa oculta o botão "Relatório" quando `isDiscoveryCoverage(ws.coverage)` é `true`; sales mantém o botão idêntico ao de hoje.

## Task Commits

Cada task foi commitada atomicamente:

1. **Task 1: helpers de blockLabel (18+8) e lensLabel/lensBadgeVariant + testes** - `410ed4a` (feat)
2. **Task 2: badge de lente em QuestionCard/TranscriptPanel + oculta Relatório em discovery** - `d76c654` (feat)

**Plan metadata:** commit final (docs) — ver `git log` após esta etapa.

## Files Created/Modified
- `frontend/src/lib/lens.ts` - `BLOCK_LABELS` (18+8), `blockLabel`, `lensLabel`, `lensBadgeVariant`
- `frontend/src/lib/lens.test.ts` - 2 novos casos (blockLabel verbatim + variante de badge)
- `frontend/src/pages/SessionActivePage.tsx` - `LensBadge` (novo, compartilhado); `QuestionCard` restructurado (badge principal + sub-label vs chip atual); `TranscriptPanel` com badge na linha de red flag; topbar com botão "Relatório" gated por `!isDiscoveryCoverage(ws.coverage)`

## Decisions Made
- `LensBadge` extraído como componente único reusado por `QuestionCard` e `TranscriptPanel`, em vez de duplicar o par de classes de cor em cada um — reduz risco de a badge Produto/Dados divergir visualmente entre pergunta e red flag (dentro do "Claude's Discretion" do CONTEXT.md sobre estilo exato das badges).

## Deviations from Plan

None - plano executado exatamente como escrito. Nenhum dos 3 auto-fix rules foi acionado; a Task 1 (05-01) já havia corrigido o bug de tipo `not_applicable` em `CoverageArea.status`, então esta plan não encontrou pendências herdadas.

## Issues Encountered
None.

## User Setup Required
None - nenhuma configuração externa necessária.

## Next Phase Readiness
- `blockLabel`/`lensLabel`/`lensBadgeVariant`/`LensBadge` prontos para reuso na 05-04 (handoff de PRD), caso precise de badges de lente em outro lugar da UI.
- Ainda falta verificação visual humana ponta-a-ponta (D3/D4/D5 marcados `human_judgment: true`): abrir uma sessão discovery real e uma sales para confirmar que a badge/sub-label renderizam como esperado e que o botão "Relatório" some/permanece corretamente. Recomendado antes do ship da fase.
- Nenhum bloqueio identificado para a 05-04.

## Self-Check: PASSED

Arquivos declarados (`frontend/src/lib/lens.ts`, `frontend/src/lib/lens.test.ts`, `frontend/src/pages/SessionActivePage.tsx`) e os 2 commits (`410ed4a`, `d76c654`) confirmados no disco/histórico do git.

---
*Phase: 05-two-lens-monitoring-frontend*
*Completed: 2026-09-24*
