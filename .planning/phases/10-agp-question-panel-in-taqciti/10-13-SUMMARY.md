---
phase: 10-agp-question-panel-in-taqciti
plan: 13
subsystem: taqciti-sidepanel (aba AGP: faixa de status na linha das abas e corte do transbordo, G-10-7)
tags: [typescript, react, vitest, chrome-extension, sidepanel, taqciti, gap-closure, layout]

requires:
  - phase: 10-agp-question-panel-in-taqciti (plano 10-07 e 10-09)
    provides: AgpQuestionsPanel com faixa de status, AgpLiveTabs com tablist/tabpanel acessíveis
provides:
  - "AgpStatusBanner.tsx: statusBannerFor (função pura) e o componente AgpStatusBanner, movidos do AgpQuestionsPanel"
  - "faixa Conectando/Reconectando/Pausado na mesma linha das abas, à direita, só com a aba AGP aberta; irmã do tablist e fora do tabpanel"
  - "corte do transbordo: raiz do AgpLiveTabs com overflow-clip + [overflow-clip-margin:4px], tabpanel e raiz do painel com overflow-hidden"
affects: [10-14, 10-16 (reteste do UAT 7 parte B no Chrome real), 10-17]

actuals:
  tokens: 5500
  tasks: 2
  commits: 5

commits: 5
plan_head_before: 05326019cb1bfc1277f416f372142cb69988f84a
plan_head_after: 356ab2fb6aafe622166f008ce95723d38b8353b2

tech-stack:
  added: []
  patterns:
    - "Extração mecânica em commit próprio (refactor) antes da mudança visual (fix), regra do CLAUDE.md"
    - "Faixa como irmã do tablist dentro de uma linha flex, nunca dentro do role=tablist (ARIA válido)"
    - "overflow-clip com overflow-clip-margin para cortar sem esconder o anel de foco"

key-files:
  created:
    - taqciti/src/sidepanel/components/AgpStatusBanner.tsx
  modified:
    - taqciti/src/sidepanel/components/AgpLiveTabs.tsx
    - taqciti/src/sidepanel/components/AgpQuestionsPanel.tsx
    - taqciti/src/sidepanel/components/AgpLiveTabs.test.tsx
    - taqciti/src/sidepanel/components/AgpQuestionsPanel.test.tsx

key-decisions:
  - "Faixa só renderiza com tab === 'agp' dentro do AgpLiveTabs; o AgpQuestionsPanel não desenha mais nenhuma faixa"
  - "Corte da raiz com overflow-clip + folga de 4px (e não overflow-hidden puro) para preservar o anel de foco das abas"
  - "Testes da faixa (posição, texto, ícone, ausência na Transcrição) migraram do painel para AgpLiveTabs.test.tsx; o painel ganhou a prova de que não desenha faixa"

requirements-completed: [TAQ-05]

coverage:
  - id: D1
    description: "Com a aba AGP aberta, a faixa (Conectando/Reconectando/Pausado, com ícone e dica no pausado) aparece na linha das abas, irmã do tablist e fora do tabpanel; a lista continua visível"
    requirement: "TAQ-05"
    verification:
      - kind: unit
        ref: "taqciti/src/sidepanel/components/AgpLiveTabs.test.tsx#paused com a aba AGP aberta: uma faixa com texto, dica e ícone, irmã do tablist e fora do tabpanel"
        status: pass
      - kind: unit
        ref: "taqciti/src/sidepanel/components/AgpLiveTabs.test.tsx#connecting / reconnecting: a faixa diz o texto certo, sem ícone, e a lista continua visível"
        status: pass
    human_judgment: false
  - id: D2
    description: "Sem faixa na aba Transcrição, sem vínculo, em idle e ao vivo; o AgpQuestionsPanel sozinho nunca desenha [role=status]"
    requirement: "TAQ-05"
    verification:
      - kind: unit
        ref: "taqciti/src/sidepanel/components/AgpLiveTabs.test.tsx#describe G-10-7 (transcrição, sem vínculo, idle, ao vivo, voltar para Transcrição)"
        status: pass
      - kind: unit
        ref: "taqciti/src/sidepanel/components/AgpQuestionsPanel.test.tsx#connecting / reconnecting / paused com perguntas: sem faixa própria"
        status: pass
    human_judgment: false
  - id: D3
    description: "Classes de corte: raiz do AgpLiveTabs com overflow-clip e [overflow-clip-margin:4px], tabpanel e contêiner da lista com overflow-hidden, região rolável intacta"
    requirement: "TAQ-05"
    verification:
      - kind: unit
        ref: "taqciti/src/sidepanel/components/AgpLiveTabs.test.tsx#AgpLiveTabs — corte do transbordo (10-13, G-10-7)"
        status: pass
      - kind: unit
        ref: "taqciti/src/sidepanel/components/AgpQuestionsPanel.test.tsx#o contêiner da lista corta o excesso (overflow-hidden) e só a região rolável rola"
        status: pass
    human_judgment: false
  - id: D4
    description: "No Chrome real (painel compacto, captura pausada) a faixa 'Pausado' fica na linha das abas, nada cobre a linha 'N falas · N pessoas · N palavras', o anel de foco das abas aparece inteiro e o botão 'Novas falas' da transcrição não é cortado"
    requirement: "TAQ-05"
    verification: []
    human_judgment: true
    rationale: "jsdom não mede altura nem pinta; a prova visual é o reteste do UAT 7 parte B no plano 10-16 (backstop)"

duration: 14min
completed: 2026-10-31
status: complete
---

# Phase 10 Plan 13: Faixa de status na linha das abas e corte do transbordo (G-10-7) Summary

**A faixa Conectando/Reconectando/Pausado da aba AGP sai da linha própria acima da lista e vai para a linha das abas (à direita, só com a AGP aberta), e a aba passa a cortar o que transborda (raiz com `overflow-clip` e folga de 4 px para o anel de foco, `tabpanel` e painel com `overflow-hidden`).**

## Performance

- **Duração:** ~14 min
- **Tarefas:** 2 (Task 1 tracer em dois commits, Task 2 em RED/GREEN)
- **Arquivos:** 1 criado, 4 modificados

## Accomplishments

- Extração mecânica da faixa para `AgpStatusBanner.tsx` (`refactor`, só 2 arquivos tocados, 41 testes antigos verdes sem editar nenhum).
- Faixa na linha das abas: `AgpLiveTabs` ganhou uma linha flex com o `tablist` à esquerda e `AgpStatusBanner` à direita, só com `tab === 'agp'`. O texto quebra linha em vez de truncar (UI-SPEC E4). Frases travadas e `textContent` ('AGP2', 'ProdutoPergunta a?') preservados.
- Corte do transbordo para nada da aba AGP ser desenhado sobre a linha de estatísticas.
- Testes: 41 para 48 nos dois arquivos; `src/sidepanel` inteiro com 232 testes verdes.

## Task Commits

1. Task 1a (mecânico): `c8bfb5e` refactor(10-13): extrai a faixa de status para AgpStatusBanner (sem mudar posição)
2. Task 1b RED: `752d7a2` test(10-13): testes da faixa de status na linha das abas
3. Task 1b GREEN: `53de3e0` fix(10-13): faixa de status da aba AGP na linha das abas (G-10-7)
4. Task 2 RED: `505febb` test(10-13): testes do corte do transbordo da aba AGP
5. Task 2 GREEN: `356ab2f` fix(10-13): aba AGP corta o transbordo e não pinta sobre o rodapé (G-10-7)

## TDD

- RED da Task 1b: falhou em `expected true to be false` na asserção `tabpanel().contains(banner)` (faixa ainda dentro do tabpanel) e nos 3 testes reescritos do painel (painel ainda desenhava a faixa). Avaliação semântica: o alvo executou e falhou pela razão planejada (posição da faixa), não por erro de import ou sintaxe.
- RED da Task 2: 3 falhas por ausência das classes `overflow-clip`, `[overflow-clip-margin:4px]` e `overflow-hidden`, todas `expected false to be true`.
- GREEN confirmado nas duas tasks. Sem commit de REFACTOR (nenhum necessário).
- Ordem dos commits difere do plano em um ponto: o plano previa 1b como commit único com testes junto; foi separado em RED (`test`) e GREEN (`fix`) por exigência do fluxo TDD do orquestrador, o mesmo vale para a Task 2.

## Deviations from Plan

### Auto-fixed Issues

**1. [Processo] Commits de teste separados da implementação**
- **Found during:** Task 1b e Task 2
- **Issue:** o plano descrevia um commit por task; o orquestrador exigiu RED antes de cada commit que adiciona comportamento.
- **Fix:** commits `test(10-13)` antes de cada `fix(10-13)`.
- **Files modified:** os mesmos arquivos planejados.

Fora isso, o plano foi executado como escrito. As remoções de teste no painel (3 casos do `it.each` "fora da região que rola" e o "sem ícone") foram recriadas no teste das abas, como previsto; nenhuma linha do `AgpLiveTabs.test.tsx` existente foi removida (0 linhas removidas contra 0989f74).

**Total deviations:** 1 (processo). **Impact:** nenhum no código final.

## Verificações

- `npx vitest run src/sidepanel`: 18 arquivos, 232 testes verdes; dois arquivos-alvo: 48 testes (linha de base 41).
- `npx tsc --noEmit` e `npx eslint src/sidepanel`: limpos.
- Commit mecânico `refactor(10-13)` tocou só `AgpStatusBanner.tsx` e `AgpQuestionsPanel.tsx` (contagem de outros arquivos = 0).
- `dangerouslySetInnerHTML`: 0 em `AgpStatusBanner.tsx` e `AgpQuestionsPanel.tsx` (T-10-22 mitigado).

## Known Stubs

Nenhum.

## Threat Flags

Nenhum. Nenhuma superfície nova de rede, autenticação ou arquivo.

## Issues Encountered

Nenhum. A prova visual no Chrome real (D4) fica para o reteste do plano 10-16: build da Taqciti e ↻ em `chrome://extensions`.

## Next Phase Readiness

Pronto para 10-14 e demais planos da onda de G-10-7. O plano 10-17 (esconder nome da reunião no compacto e estatísticas na linha dos botões) segue pendente e é o que garante o espaço para pelo menos um cartão.

## Self-Check: PASSED

- Arquivos criados/modificados existem; `AgpStatusBanner.tsx` exporta `AgpStatusBanner` e `statusBannerFor`.
- Commits `c8bfb5e`, `752d7a2`, `53de3e0`, `505febb`, `356ab2f` presentes no histórico da branch `feat/fase-10-agp-integracao`.
