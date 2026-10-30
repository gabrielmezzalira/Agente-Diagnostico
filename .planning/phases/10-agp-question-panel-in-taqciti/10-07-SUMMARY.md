---
phase: 10-agp-question-panel-in-taqciti
plan: 07
subsystem: taqciti-sidepanel (aba AGP: estado "Pausado", faixa de status fixa, rolagem e emblemas)
tags: [typescript, react, vitest, chrome-extension, sidepanel, taqciti, ui-spec]

requires:
  - phase: 10-agp-question-panel-in-taqciti (plano 10-03)
    provides: feed.connection === 'paused' publicado pelo agpQuestionsStore (D-11)
provides:
  - "AgpQuestionsPanel com o estado 7 'Pausado': faixa role=status com ícone pause, title de dica e aviso de vazio próprio (M-1)"
  - "Faixa de status (connecting, reconnecting, paused) irmã da região rolável, fixa acima da lista (M-2)"
  - "Região rolável com scroll-region + tabIndex 0 + outline-none, texto com break-words, cartão com animate-fade-in motion-reduce:animate-none e linha de emblemas condicional (M-3)"
  - "statusBannerFor(connection): função pura que escolhe o texto da faixa, sem lógica no JSX"
affects: [10-09 (M-6, espaçamento da grade 4/8/16 sobre este arquivo), 10-10, 10-11 (UAT 7 e /gsd-ui-review 10)]

actuals:
  tokens: 1698
  tasks: 2
  commits: 2

commits: 2
plan_head_before: 8c05e98cfdf85aaaa9cfd2abd18d1b4012a6339c
plan_head_after: 74b66b71756b43fe784492183f789e112c51a7f9

tech-stack:
  added: []
  patterns:
    - "Faixa de status como irmã (não filha) da região rolável, em contêiner flex min-h-0 flex-1 flex-col"
    - "Escolha do texto da faixa em função pura (statusBannerFor), sem condicional dentro do JSX"
    - "Testes novos só acrescentados ao fim do arquivo existente (zero linhas removidas)"

key-files:
  created: []
  modified:
    - taqciti/src/sidepanel/components/AgpQuestionsPanel.tsx
    - taqciti/src/sidepanel/components/AgpQuestionsPanel.test.tsx

key-decisions:
  - "Os dois retornos iniciais (sem vínculo; idle) ficaram exatamente como estavam; só os demais estados passaram pelo novo contêiner"
  - "A linha de emblemas só renderiza com lens !== null ou status 'pinned'; o conteúdo dela não mudou"
  - "Sem aria-live na lista e sem texto novo dentro do li (decisões do UI-SPEC aprovado, D-14)"

requirements-completed: [TAQ-05]

coverage:
  - id: D1
    description: "M-1: com connection 'paused' a faixa role=status mostra o ícone pause, 'Pausado · mostrando as últimas perguntas' e o title de dica, e a lista recebida continua visível; 'paused' sem perguntas mostra 'Nenhuma pergunta foi recebida antes da pausa.' em vez da frase do ao vivo"
    requirement: "TAQ-05"
    verification:
      - kind: unit
        ref: "taqciti/src/sidepanel/components/AgpQuestionsPanel.test.tsx#paused com perguntas: faixa com ícone e dica, e a lista recebida continua visível"
        status: pass
      - kind: unit
        ref: "taqciti/src/sidepanel/components/AgpQuestionsPanel.test.tsx#paused sem perguntas: aviso próprio, sem a frase do ao vivo"
        status: pass
    human_judgment: false
  - id: D2
    description: "M-2: a faixa de status (connecting, reconnecting, paused) fica fora da região que rola, irmã dela; ao vivo não há faixa; só o pausado tem ícone"
    requirement: "TAQ-05"
    verification:
      - kind: unit
        ref: "taqciti/src/sidepanel/components/AgpQuestionsPanel.test.tsx#(it.each connecting, reconnecting, paused) faixa fora do contêiner rolável"
        status: pass
      - kind: unit
        ref: "taqciti/src/sidepanel/components/AgpQuestionsPanel.test.tsx#ao vivo: nenhuma faixa de status"
        status: pass
      - kind: unit
        ref: "taqciti/src/sidepanel/components/AgpQuestionsPanel.test.tsx#reconnecting: a faixa não tem ícone (só o pausado tem)"
        status: pass
    human_judgment: false
  - id: D3
    description: "M-3: região rolável com scroll-region, tabIndex 0 e outline-none (rola pelo teclado), texto com break-words e cartão com animate-fade-in motion-reduce:animate-none"
    requirement: "TAQ-05"
    verification:
      - kind: unit
        ref: "taqciti/src/sidepanel/components/AgpQuestionsPanel.test.tsx#a região rolável usa scroll-region e entra na ordem de tabulação"
        status: pass
      - kind: unit
        ref: "taqciti/src/sidepanel/components/AgpQuestionsPanel.test.tsx#o texto quebra (break-words) e o cartão anima a entrada respeitando movimento reduzido"
        status: pass
      - kind: other
        ref: "grep -c overflow-y-auto taqciti/src/sidepanel/components/AgpQuestionsPanel.tsx (= 0)"
        status: pass
    human_judgment: false
  - id: D4
    description: "M-3 (parcial): pergunta sem lente e não fixada não renderiza a linha de emblemas; com lente a linha existe (textContent dos cartões antigos preservado)"
    requirement: "TAQ-05"
    verification:
      - kind: unit
        ref: "taqciti/src/sidepanel/components/AgpQuestionsPanel.test.tsx#pergunta sem lente e não fixada: o cartão só tem o parágrafo do texto"
        status: pass
      - kind: unit
        ref: "taqciti/src/sidepanel/components/AgpQuestionsPanel.test.tsx#pergunta com lente: a linha de emblemas existe"
        status: pass
    human_judgment: false
  - id: D5
    description: "Invariantes do UI-SPEC: a lista não tem aria-live, nenhum dangerouslySetInnerHTML (T-10-14), testes antigos do painel e AgpLiveTabs.test.tsx intactos"
    requirement: "TAQ-05"
    verification:
      - kind: unit
        ref: "taqciti/src/sidepanel/components/AgpQuestionsPanel.test.tsx#a lista não é aria-live"
        status: pass
      - kind: other
        ref: "grep -c aria-live (= 0); grep -c dangerouslySetInnerHTML (= 0); git diff --numstat eb3bf01 no teste do painel = 82 acrescentadas, 0 removidas; git diff --quiet eb3bf01 em AgpLiveTabs.test.tsx (exit 0)"
        status: pass
    human_judgment: false
  - id: D6
    description: "Comportamento real no Chrome: nos degraus compact (320 px) e regular a lista rola dentro do scroll-region com a faixa visível acima; um trecho longo sem espaços (ex.: URL) quebra dentro dos 396 px do painel sem rolagem horizontal"
    requirement: "TAQ-05"
    verification: []
    human_judgment: true
    rationale: "Layout, rolagem e quebra de linha dependem da renderização real no painel do Meet; o jsdom não mede largura nem rolagem. O plano marca como backstop e a prova é o UAT 7 e o /gsd-ui-review 10"

duration: 4min
completed: 2026-10-30
status: complete
---

# Phase 10 Plan 07: Estado "Pausado" e faixa fixa na aba AGP Summary

**A aba AGP passa a dizer "Pausado · mostrando as últimas perguntas" (com ícone de pausa) quando a captura está parada, a faixa de status fica presa acima da lista em vez de rolar junto, e a lista rola pelo teclado, quebra texto longo e só desenha a linha de emblemas quando há emblema.**

## Performance

- **Duration:** ~4 min (estimado pelos horários dos dois commits, 04:21Z e 04:22Z)
- **Tasks:** 2 (1 tracer + 1 com TDD)
- **Files:** 2 modificados, 0 criados

## Accomplishments

- **M-1 (estado 7):** `connection: 'paused'` deixa de aparecer como "Reconectando ao Agente…". A faixa traz o ícone `pause` (11 px), o texto "Pausado · mostrando as últimas perguntas" e o `title` com a dica de que a atualização volta sozinha. As perguntas já recebidas continuam na tela; sem nenhuma, o corpo mostra "Nenhuma pergunta foi recebida antes da pausa.".
- **M-2:** a faixa (`connecting`, `reconnecting`, `paused`) é irmã da região rolável, com `shrink-0`, e não some mais ao rolar. O texto dela vem da função pura `statusBannerFor`.
- **M-3:** a região rolável usa `scroll-region` com `tabIndex={0}` e `outline-none` (rola pelo teclado sem vazar a rolagem para o Meet); o texto da pergunta tem `break-words`; o cartão entra com `animate-fade-in motion-reduce:animate-none`; a linha de emblemas só existe quando há lente ou a pergunta está fixada.
- **Sem regressão:** os dois retornos iniciais (sem vínculo e `idle`) ficaram idênticos; as frases travadas dos estados 1 a 6 não mudaram; os 6 testes de `AgpLiveTabs.test.tsx` seguem verdes sem edição.

## Task Commits

1. **Task 1 (tracer): estado "Pausado" na aba AGP e faixa de status fixa acima da lista (M-1, M-2)** — `3532686` (feat)
2. **Task 2: rolagem da lista pelo teclado, quebra de texto longo e linha de emblemas condicional (M-3)** — `74b66b7` (feat)

## Files Created/Modified

- `taqciti/src/sidepanel/components/AgpQuestionsPanel.tsx` — reorganizado em faixa + região rolável (94 linhas); `statusBannerFor`; estado `paused`; classes do M-3. Sem `aria-live` e sem `dangerouslySetInnerHTML`.
- `taqciti/src/sidepanel/components/AgpQuestionsPanel.test.tsx` — 82 linhas acrescentadas ao fim, 0 removidas (152 linhas, 18 testes no arquivo).

## Decisions Made

Nenhuma decisão nova: textos, ícone, `title`, faixa fixa, ausência de `aria-live` e sumiço imediato no `question_expired` já estavam travados no UI-SPEC aprovado (D-14). O espaçamento da grade 4/8/16 (`p-3`, `mb-1.5`) ficou intocado de propósito: é o M-6, commit mecânico próprio do plano 10-09.

## Deviations from Plan

None no código: as duas tarefas foram executadas como o plano descreve (um commit por tarefa, mensagens iguais às previstas).

**Fechamento administrativo manual (não é desvio de código):** o executor foi interrompido depois do segundo commit e antes de escrever este SUMMARY. O `safe_resume_gate` do `/gsd-execute-phase 10` encontrou os 2 commits `feat(10-07)` sem SUMMARY e sem manifesto de job assíncrono, parou e pediu decisão; o time escolheu **fechar manualmente**. Este arquivo foi escrito pelo orquestrador a partir dos commits e de uma nova rodada das verificações do plano (ver Self-Check). Por isso `duration` e `actuals.tokens` são estimativas (horários dos commits; caracteres adicionados ÷ 4), não medições do executor.

## Issues Encountered

None. Nenhuma falha de verificação; nenhum arquivo fora do escopo `files_modified` do plano foi tocado.

## User Setup Required

None - no external service configuration required.

## Threat Flags

None. T-10-14 (injeção de HTML no texto da pergunta) mitigado: o texto entra só como nó de texto do React e `grep -c dangerouslySetInnerHTML` no painel é 0.

## Known Stubs

None.

## Next Phase Readiness

- **Pendência de validação real:** os backstops de Overflow (E1) e Long-text (E2) só se provam no Chrome real, nos degraus compact (320 px) e regular, no UAT 7 e no `/gsd-ui-review 10`.
- **10-09** (depende deste plano) aplica o espaçamento da grade 4/8/16 (M-6) em cima deste arquivo.
- **Rollback:** reverter primeiro `git revert 74b66b7` (só M-3: classes e condição da linha de emblemas) e depois `git revert 3532686` (volta `paused` a aparecer como "Reconectando…" e a faixa a rolar junto com a lista). Nenhum dado é perdido.
- TAQ-05 NÃO foi marcado como completo: outros planos da fase 10 ainda restam.

## Self-Check: PASSED

Rodado pelo orquestrador no fechamento manual (2026-10-30):

- Arquivos: `AgpQuestionsPanel.tsx` e `AgpQuestionsPanel.test.tsx` — FOUND.
- Commits: `3532686` e `74b66b7` — ancestrais de HEAD; `check evaluation-scope` do plano 10-07 devolve exatamente esses 2.
- `cd taqciti && npx vitest run src/sidepanel/components/AgpQuestionsPanel.test.tsx src/sidepanel/components/AgpLiveTabs.test.tsx` — 2 arquivos, 24 testes passados (18 + 6).
- `npx tsc --noEmit` e `npx eslint src/sidepanel` — exit 0, sem saída.
- Greps do plano: "Pausado · mostrando as últimas perguntas" = 1, "Nenhuma pergunta foi recebida antes da pausa." = 1, `scroll-region` = 1, `tabIndex={0}` = 1, `outline-none` = 1, `break-words` = 1, `animate-fade-in` = 1, `motion-reduce:animate-none` = 1, `name="pause"` = 1; `overflow-y-auto` = 0, `aria-live` = 0, `dangerouslySetInnerHTML` = 0.
- `git diff --numstat eb3bf01` no teste do painel: 82 acrescentadas, 0 removidas; `AgpLiveTabs.test.tsx` sem diferença contra `eb3bf01`.

---
*Phase: 10-agp-question-panel-in-taqciti*
*Completed: 2026-10-30*
