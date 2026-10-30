---
phase: 10-agp-question-panel-in-taqciti
plan: 05
subsystem: web-app-ajuda-e-docs-de-planejamento
tags: [react, vitest, docs, d-06, d-09, taq-05]

requires:
  - phase: 09-cutover-retire-custom-extension
    provides: "Página /extension (ExtensionPage.tsx, taqcitiInstall.ts) criada no 09-04"
provides:
  - "TAQCITI_AGP_TAB_NOTES: cinco textos sobre a aba AGP (lente Produto/Dados, aviso sem vínculo, só mostra, divergência de fixar/descartar, estado Pausado)"
  - "Cartão 'Aba AGP (perguntas do Agente na call)' na página /extension do web app"
  - "Aviso 'SUPERADO (2026-10-28)' no topo de RETOMAR-AQUI, PENDENCIAS-FASE-08 e PENDENCIAS-FASE-10 (sem apagar nada)"
  - "D-09 (10-CONTEXT.md) e A-4 (10-UI-SPEC.md) corrigidos: pergunta fixada ou descartada no site continua na Taqciti até reconectar"
affects: [10-10, UAT teste da divergência D-09]

actuals:
  tokens: 1800
  tasks: 3
  commits: 3
commits: 3
plan_head_before: 0274d8d79b7280510ce3060917ead437b0d0429a
plan_head_after: 005dacc30e2ddbe9617b7c843ba90681fab9c6e8

tech-stack:
  added: []
  patterns:
    - "Textos de página de ajuda como constantes puras em lib/ (sem React) varridas por allPageTexts() no teste de palavras proibidas"

key-files:
  created: []
  modified:
    - frontend/src/lib/taqcitiInstall.ts
    - frontend/src/lib/taqcitiInstall.test.ts
    - frontend/src/pages/ExtensionPage.tsx
    - .planning/RETOMAR-AQUI.md
    - .planning/PENDENCIAS-FASE-08.md
    - .planning/PENDENCIAS-FASE-10.md
    - .planning/phases/10-agp-question-panel-in-taqciti/10-CONTEXT.md
    - .planning/phases/10-agp-question-panel-in-taqciti/10-UI-SPEC.md

key-decisions:
  - "Interpretação registrada (Claude's Discretion): a 'página de ajuda' do D-09 é a /extension do web app, a única página de ajuda da Taqciti"
  - "Nenhum arquivo de taqciti/ mudou: a Taqciti não ganha aviso na tela (D-09)"

patterns-established:
  - "Inserção de aviso em arquivo CRLF feita em bytes, preservando os finais de linha, para o git diff --numstat mostrar 0 linhas removidas"

requirements-completed: [TAQ-05]

coverage:
  - id: D1
    description: "A página /extension explica a aba AGP e que fixar/descartar no site só some da Taqciti ao reconectar (D-09)"
    requirement: "TAQ-05"
    verification:
      - kind: unit
        ref: "frontend/src/lib/taqcitiInstall.test.ts#as notas da aba AGP explicam a lente, que a aba só mostra e a divergência de fixar/descartar (D-09)"
        status: pass
      - kind: other
        ref: "npm --prefix frontend run build"
        status: pass
    human_judgment: false
  - id: D2
    description: "Os três documentos antigos ficam marcados como superados, sem perder nenhuma linha original (D-06)"
    requirement: "TAQ-05"
    verification:
      - kind: other
        ref: "git diff --numstat eb3bf01 nos três arquivos: 2 adicionadas, 0 removidas em cada"
        status: pass
    human_judgment: false
  - id: D3
    description: "D-09 e A-4 descrevem o comportamento real do backend (Armadilha 7)"
    requirement: "TAQ-05"
    verification:
      - kind: other
        ref: "grep das frases novas (1) e das frases erradas (0) em 10-CONTEXT.md e 10-UI-SPEC.md"
        status: pass
    human_judgment: false

duration: 6min
completed: 2026-10-30
status: complete
---

# Phase 10 Plan 05: Texto da aba AGP, documentos superados e correção do D-09 Summary

**Página /extension do web app ganha o cartão "Aba AGP" explicando a lente Produto/Dados e a divergência aceita (fixar/descartar no site só some da Taqciti ao reconectar); três documentos antigos marcados como superados; D-09 e A-4 corrigidos conforme a Armadilha 7.**

## Performance

- **Duration:** 6 min
- **Started:** 2026-10-30T04:07:42Z
- **Tasks:** 3 (1 tracer + 2 auto)
- **Files modified:** 8

## Accomplishments

- `TAQCITI_AGP_TAB_NOTES` (5 itens) em `taqcitiInstall.ts` e um terceiro `Card` em `ExtensionPage.tsx`, renderizado com `StepList`. As notas entram em `allPageTexts()`, então o teste de palavras proibidas (chave, x-agente-key, localhost, URL do backend) também as varre (mitigação T-10-11). Teste do arquivo: 8/8 verde; build do frontend ok.
- Aviso "SUPERADO (2026-10-28)" apontando para `10-CONTEXT.md` e `ROADMAP.md` nos três documentos antigos. `git diff --numstat eb3bf01` mostra 2 linhas adicionadas e 0 removidas em cada um.
- D-09 do `10-CONTEXT.md` e A-4 do `10-UI-SPEC.md` agora dizem que pergunta fixada ou descartada no site continua na Taqciti até reconectar; só a pergunta `queued` some pelo TTL. O `status: approved` do UI-SPEC e as demais decisões ficaram intactos.

## Task Commits

1. **Task 1 (tracer): cartão "Aba AGP" + constante + teste** - `8d5ec3d` (feat)
2. **Task 2: marcar 3 documentos como superados (D-06)** - `995a9b3` (docs)
3. **Task 3: corrigir D-09 e A-4** - `005dacc` (docs)

Tracer verificado de ponta a ponta antes da expansão (teste + build verdes).

## Deviations from Plan

None - plan executed exactly as written.

Observação de execução (não é desvio): `RETOMAR-AQUI.md`, `PENDENCIAS-FASE-08.md`, `PENDENCIAS-FASE-10.md` e `10-UI-SPEC.md` usam finais de linha CRLF; as edições foram feitas em bytes para preservá-los e não gerar linhas "removidas" no diff.

## Issues Encountered

None.

## Known Stubs

None. Os textos novos são conteúdo final; nenhum dado mockado.

## Threat Flags

None. A mudança é só texto estático, sem endpoint, autenticação ou acesso a arquivo novos.

## Next Phase Readiness

O texto do UAT (teste da divergência D-09) ainda precisa ser corrigido no `10-UAT.md`; isso é do plano 10-10, como previsto no objetivo.

## Self-Check: PASSED

- FOUND: `8d5ec3d`, `995a9b3`, `005dacc` (ancestrais de HEAD)
- FOUND: todos os arquivos de `key-files.modified`
- `git show --name-only HEAD~2` lista só os 3 arquivos do `<files>` da Task 1
- `grep -c "TAQCITI_AGP_TAB_NOTES" frontend/src/pages/ExtensionPage.tsx` = 2
