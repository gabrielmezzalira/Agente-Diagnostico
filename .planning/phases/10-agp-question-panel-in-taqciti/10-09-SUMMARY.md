---
phase: 10-agp-question-panel-in-taqciti
plan: 09
subsystem: taqciti-sidepanel (aba AGP: aviso sem vínculo na saída larga, abas acessíveis, espaçamento na grade 4/8/16)
tags: [typescript, react, vitest, chrome-extension, sidepanel, taqciti, ui-spec, acessibilidade, wai-aria]

requires:
  - phase: 10-agp-question-panel-in-taqciti (plano 10-07)
    provides: AgpQuestionsPanel com faixa de status fixa, região rolável e linha de emblemas condicional (M-1, M-2, M-3)
provides:
  - "prop opcional surface ('panel' | 'wide', padrão 'panel') em AgpQuestionsPanel e AgpLiveTabs; na saída larga o aviso sem vínculo ganha a 2ª frase (M-5)"
  - "LiveScreen passa surface=\"wide\"; PanelApp.tsx não muda"
  - "abas Transcrição/AGP no padrão WAI-ARIA: h-8, id e aria-controls (useId), role=tabpanel com aria-labelledby, tabIndex móvel, setas esquerda/direita e aria-label do contador no singular/plural (M-4)"
  - "espaçamento do AGP na grade 4/8/16: p-4, mb-2, px-4, ml-2, em commit mecânico próprio (M-6)"
affects: [10-10, 10-11 (UAT 1 e 7 e /gsd-ui-review 10 conferem o aviso da saída larga, o teclado nas abas e o espaço dos cartões)]

actuals:
  tokens: 4180
  tasks: 3
  commits: 4

commits: 4
plan_head_before: 0ea81cf876161f910e923c0be722a8011920cdca
plan_head_after: 635d1f60897f11c6f1e3ba231b2f13831d454944

tech-stack:
  added: []
  patterns:
    - "Variação por superfície via prop opcional com padrão neutro (surface='panel'), precedente do AgenteEndSlot: o PanelApp não precisa mudar"
    - "Texto escolhido por função pura (unlinkedMessageFor, agpTabLabel, tabAfterArrow), sem condicional dentro do JSX"
    - "Teclado só no tablist e só as setas: qualquer outra tecla passa sem preventDefault"
    - "Testes novos só acrescentados ao fim dos arquivos existentes (zero linhas removidas contra eb3bf01)"

key-files:
  created: []
  modified:
    - taqciti/src/sidepanel/components/AgpQuestionsPanel.tsx
    - taqciti/src/sidepanel/components/AgpLiveTabs.tsx
    - taqciti/src/sidepanel/screens/LiveScreen.tsx
    - taqciti/src/sidepanel/components/AgpQuestionsPanel.test.tsx
    - taqciti/src/sidepanel/components/AgpLiveTabs.test.tsx

key-decisions:
  - "O tipo AgpSurface é exportado do AgpQuestionsPanel.tsx e importado pelo AgpLiveTabs.tsx (um lugar só), em vez de repetir a união inline como o AgenteEndSlot faz"
  - "As duas abas apontam aria-controls para o mesmo tabpanel: o painel é um só e o conteúdo dele troca com a aba selecionada"
  - "As setas são circulares: com duas abas, ArrowRight na AGP volta para Transcrição e ArrowLeft em Transcrição vai para a AGP (padrão WAI-ARIA)"
  - "A seta usa a aba selecionada como ponto de partida, não o alvo do evento, porque com tabIndex móvel o foco do teclado está sempre na selecionada"

patterns-established:
  - "Rótulo falado do contador só quando há contador: sem aria-label em 0, 'AGP, 1 pergunta' em 1, 'AGP, N perguntas' em 2 ou mais; o textContent da aba continua 'AGP' + número"
  - "Ajuste de espaçamento em commit style() separado de qualquer mudança de comportamento, com portão de grep e portão de arquivos do HEAD"

requirements-completed: [TAQ-05]

coverage:
  - id: D1
    description: "M-5: na saída larga (LiveScreen), o aviso sem vínculo mostra as duas frases ('Vincule esta reunião a um cliente para ver aqui as perguntas do Agente. O vínculo é feito no painel do TaqCITi dentro do Meet.'); no painel do Meet (padrão) só a primeira frase, idêntica à de antes"
    requirement: "TAQ-05"
    verification:
      - kind: unit
        ref: "taqciti/src/sidepanel/components/AgpQuestionsPanel.test.tsx#saída larga sem vínculo: as duas frases, a primeira idêntica à de sempre"
        status: pass
      - kind: unit
        ref: "taqciti/src/sidepanel/components/AgpQuestionsPanel.test.tsx#sem surface (padrão) / surface=\"panel\": só a primeira frase, nunca a do vínculo no Meet"
        status: pass
      - kind: unit
        ref: "taqciti/src/sidepanel/components/AgpLiveTabs.test.tsx#surface=\"wide\" sem vínculo: a aba AGP também diz onde vincular"
        status: pass
      - kind: other
        ref: "grep -c 'surface=\"wide\"' taqciti/src/sidepanel/screens/LiveScreen.tsx (1) e git diff --quiet eb3bf01 -- taqciti/src/content/ui/PanelApp.tsx (sem diff)"
        status: pass
    human_judgment: false
  - id: D2
    description: "M-4 (contador): com 0 perguntas a aba AGP não tem aria-label nem contador visível; com 1 o aria-label é 'AGP, 1 pergunta'; com 2 ou mais é 'AGP, {n} perguntas'; o textContent da aba continua 'AGP' + número (ex.: 'AGP2')"
    requirement: "TAQ-05"
    verification:
      - kind: unit
        ref: "taqciti/src/sidepanel/components/AgpLiveTabs.test.tsx#0 perguntas: a aba AGP não tem aria-label e o contador não aparece"
        status: pass
      - kind: unit
        ref: "taqciti/src/sidepanel/components/AgpLiveTabs.test.tsx#1 pergunta: aria-label no singular e o texto visível continua \"AGP1\""
        status: pass
      - kind: unit
        ref: "taqciti/src/sidepanel/components/AgpLiveTabs.test.tsx#2 ou mais perguntas: aria-label no plural e o texto visível continua \"AGP2\""
        status: pass
    human_judgment: false
  - id: D3
    description: "M-4 (padrão de abas): altura h-8 sem py-1, id e aria-controls em cada aba, corpo em role=tabpanel com aria-labelledby apontando para a aba selecionada e o mesmo layout flex, tabIndex móvel, setas esquerda/direita alternam as abas e movem o foco sem roubar outras teclas, ids sem colisão entre instâncias"
    requirement: "TAQ-05"
    verification:
      - kind: unit
        ref: "taqciti/src/sidepanel/components/AgpLiveTabs.test.tsx#cada aba tem id e aria-controls; o tabpanel é rotulado pela aba selecionada"
        status: pass
      - kind: unit
        ref: "taqciti/src/sidepanel/components/AgpLiveTabs.test.tsx#ArrowRight no foco em Transcrição seleciona AGP e leva o foco; ArrowLeft volta"
        status: pass
      - kind: unit
        ref: "taqciti/src/sidepanel/components/AgpLiveTabs.test.tsx#só as setas esquerda e direita mexem nas abas; outras teclas passam intactas"
        status: pass
      - kind: unit
        ref: "taqciti/src/sidepanel/components/AgpLiveTabs.test.tsx#tabIndex móvel: 0 na aba selecionada e -1 na outra"
        status: pass
      - kind: unit
        ref: "taqciti/src/sidepanel/components/AgpLiveTabs.test.tsx#as abas têm altura h-8 e não usam py-1"
        status: pass
      - kind: unit
        ref: "taqciti/src/sidepanel/components/AgpLiveTabs.test.tsx#duas instâncias ao mesmo tempo não repetem ids"
        status: pass
    human_judgment: false
  - id: D4
    description: "M-6: as classes de espaçamento do AGP ficam na grade 4/8/16 (p-4 no cartão, mb-2 na linha de emblemas, px-4 na aba, ml-2 no contador), em commit próprio que só tocou os dois arquivos do AGP e não mudou texto nem comportamento"
    requirement: "TAQ-05"
    verification:
      - kind: other
        ref: "grep -cE '(mb|ml)-1\\.5|(^|[\" ])p-3([\" ]|$)|(^|[\" ])px-3([\" ]|$)' nos dois arquivos do AGP (0 e 0) e git show --name-only HEAD do commit 635d1f6 (só os dois arquivos)"
        status: pass
      - kind: unit
        ref: "npx vitest run src/sidepanel (18 arquivos, 225 testes) verde antes e depois do commit mecânico"
        status: pass
    human_judgment: false
  - id: D5
    description: "O resultado visual e de uso real: o aviso de duas frases quebra linha bem na saída larga, o teclado e o leitor de tela se comportam nas abas, e os cartões ficam com o espaço certo (uns 10 px mais altos) no painel do Meet nos degraus compact e regular"
    requirement: "TAQ-05"
    verification: []
    human_judgment: true
    rationale: "Aparência, quebra de linha e uso com leitor de tela em Chrome real não são afirmados por teste de jsdom; ficam para o UAT 1 e 7 do plano 10-11 e para o /gsd-ui-review 10"

duration: 7min
completed: 2026-10-30
status: complete
---

# Phase 10 Plan 09: Polimento de UI da aba AGP (M-4, M-5, M-6) Summary

**Aviso "sem vínculo" que diz onde vincular na saída larga (prop `surface`), abas Transcrição/AGP no padrão WAI-ARIA com setas, `tabpanel` e `aria-label` do contador no singular/plural, e o espaçamento do AGP na grade 4/8/16 em commit mecânico próprio.**

## Performance

- **Duração:** 7 min
- **Início:** 2026-10-30T14:01:28Z
- **Fim:** 2026-10-30T14:09:12Z
- **Tarefas:** 3 (mais o RED da Task 2 em commit próprio)
- **Arquivos modificados:** 5 (3 de código, 2 de teste)
- **Commits de produção:** 4, medidos pelo ledger (`0ea81cf..635d1f6`)

## Accomplishments

- **M-5:** quem abre a Taqciti numa aba larga sem cliente vinculado agora lê "Vincule esta reunião a um cliente para ver aqui as perguntas do Agente. O vínculo é feito no painel do TaqCITi dentro do Meet." O painel do Meet continua só com a primeira frase, que não mudou uma vírgula. O mecanismo é a prop opcional `surface` (padrão `'panel'`), então o `PanelApp.tsx` ficou sem nenhuma alteração.
- **M-4:** as abas deixaram de ser só `role="tab"`. Agora têm `id` e `aria-controls`, o corpo é um `tabpanel` rotulado pela aba selecionada (com o mesmo layout flex, a transcrição continua rolando), `tabIndex` móvel e as setas esquerda/direita trocam de aba levando o foco junto. O contador é anunciado como "AGP, 1 pergunta" ou "AGP, N perguntas", e não há nenhum texto visível novo (o teste antigo `'AGP2'` segue verde sem edição).
- **M-6:** `p-3`→`p-4` e `mb-1.5`→`mb-2` no cartão, `px-3`→`px-4` e `ml-1.5`→`ml-2` na aba. Só classes, em commit separado que levou apenas os dois arquivos do AGP.

## Task Commits

1. **Task 1 (tracer): aviso sem vínculo na saída larga (M-5)** - `64082f3` (feat)
2. **Task 2: abas acessíveis (M-4)**, em ciclo TDD
   - RED: `97b65c7` (test) - 8 casos falhando antes da implementação
   - GREEN: `8abbfe5` (feat)
3. **Task 3: espaçamento na grade 4/8/16 (M-6, mecânico)** - `635d1f6` (style)

**Metadados do plano:** SUMMARY e atualização de STATE/ROADMAP em commits `docs(10-09)` à parte.

### Portão do tracer

A Task 1 é `type="tracer"` sem `<human-check>`; modo interativo, `human_verify_mode` padrão (`end-of-phase`). Os quatro `<automated>` foram rodados no mesmo conteúdo que foi comitado e todos passaram (vitest dos dois arquivos 30/30, `grep -c` = 1, `PanelApp.tsx` sem diff, zero linhas removidas nos testes). Registro: tracer verificado de ponta a ponta, seguiu para a expansão (Tasks 2 e 3).

## TDD Gate Compliance

O plano é `type: execute` e `workflow.tdd_mode` não está ligado; a Task 2 é `tdd="true"` e seguiu o ciclo RED, GREEN.

- **RED (`97b65c7`):** 104 linhas de teste acrescentadas ao fim de `AgpLiveTabs.test.tsx`. Comando real: `npx vitest run src/sidepanel/components/AgpLiveTabs.test.tsx --reporter=tap-flat`, saída 1, 19 testes, 11 passaram e 8 falharam. O classificador `gsd_run check tdd-red-evidence` devolveu `RED_EVIDENCE_OK` (`target_test_failed`), com alvo "tabIndex móvel: 0 na aba selecionada e -1 na outra" (esperado `-1`, recebido `0`).
- **Avaliação semântica do RED:** os 8 casos falharam nas asserções planejadas (aria-label ausente, sem `tabpanel`, sem `id`/`aria-controls`, `tabIndex` sempre 0, setas sem efeito, `h-8` ausente, nenhum `id` no DOM), não por erro de import, sintaxe ou fixture. Três casos já passavam antes e ficaram como guardas contra regressão (0 perguntas sem `aria-label`, Transcrição nunca com `aria-label`, outras teclas sem `preventDefault`).
- **GREEN (`8abbfe5`):** só `AgpLiveTabs.tsx`; 41/41 testes dos dois arquivos de componente verdes, `tsc --noEmit` e `eslint src/sidepanel` limpos.
- **REFACTOR:** não houve (nada a limpar).
- A Task 1 (tracer) não é `tdd="true"`: os testes foram escritos antes da implementação e rodados com 2 falhas esperadas, mas entraram no mesmo commit `feat`, como o plano manda.

## Files Created/Modified

- `taqciti/src/sidepanel/components/AgpQuestionsPanel.tsx` - prop `surface`, tipo `AgpSurface`, `unlinkedMessageFor` (função pura) e classes `p-4`/`mb-2`.
- `taqciti/src/sidepanel/components/AgpLiveTabs.tsx` - `surface` repassada ao painel; `h-8`, `id`/`aria-controls` por `useId`, `tabIndex` móvel, `agpTabLabel`, `tabAfterArrow`, `onKeyDown` no `tablist`, `tabpanel`; `px-4` e `ml-2`.
- `taqciti/src/sidepanel/screens/LiveScreen.tsx` - `<AgpLiveTabs surface="wide">`.
- `taqciti/src/sidepanel/components/AgpQuestionsPanel.test.tsx` - 4 casos acrescentados (saída larga, painel/padrão, outros avisos não mudam).
- `taqciti/src/sidepanel/components/AgpLiveTabs.test.tsx` - 2 casos da superfície e 11 casos de acessibilidade, só no fim do arquivo.

## Decisions Made

- `AgpSurface` fica em um lugar só (exportado do `AgpQuestionsPanel.tsx`) em vez de repetir `'panel' | 'wide'` inline como o `AgenteEndSlot` faz.
- As duas abas apontam `aria-controls` para o mesmo `tabpanel`, já que o painel é um só e o conteúdo dele troca.
- Setas circulares (com duas abas, as duas setas alternam) e o ponto de partida é a aba selecionada, porque com `tabIndex` móvel o foco do teclado está sempre nela.
- O `tabpanel` não ganhou `tabIndex`: a região rolável da AGP já entra na ordem de tabulação (10-07) e a da transcrição é da `TranscriptView`, fora do escopo.

## Deviations from Plan

None - plan executed exactly as written.

Duas observações que não são desvio de regra: (1) a Task 2 virou dois commits (`test` RED e `feat` GREEN) em vez de um, porque a tarefa é `tdd="true"` e o ciclo do executor pede o commit do RED; o texto do commit do GREEN é o que o plano especifica. (2) Os testes ficaram com mais casos que o mínimo (13 novos em `AgpLiveTabs.test.tsx`, 4 em `AgpQuestionsPanel.test.tsx`), cobrindo a fronteira do contador (0, 1, 2) e os riscos 3(c) e 3(d) do plano (outras teclas e ids repetidos).

## Issues Encountered

Nenhum. Um aviso do próprio ambiente: o `AgpQuestionsPanel.tsx` está com fim de linha LF no disco e o git avisa que vai converter para CRLF no próximo checkout; o índice é LF em todos os arquivos, então não há mudança de fim de linha nos commits (conferido com `git diff --stat`: 4 linhas trocadas no commit mecânico, 4 de cada lado).

## Verificação do plano

- `cd taqciti && npx vitest run src/sidepanel` → 18 arquivos, 225 testes, verde.
- `npx tsc --noEmit` e `npx eslint src` → limpos (saída 0).
- `PanelApp.tsx` sem diff contra `eb3bf01`; zero linhas removidas nos dois arquivos de teste contra `eb3bf01`.
- Fica para o UAT 1 e 7 e para o `/gsd-ui-review 10` (planos seguintes): olhar o aviso de duas frases na saída larga, o teclado e o leitor de tela nas abas e o espaço dos cartões em Chrome real.

## Known Stubs

None.

## Threat Flags

None. Só apresentação: os textos novos são fixos do produto (T-10-16, aceito); nenhum endpoint, caminho de autenticação ou acesso a arquivo novo.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- M-4, M-5 e M-6 do UI-SPEC fechadas; a aba AGP está completa nos contratos de UI para o UAT.
- Pendências que continuam do time (já registradas): `GEMINI_API_KEY` no Railway antes de deploy/merge; medir A1/A2/A3/A4 no UAT em Chrome real.

## Self-Check: PASSED

- Arquivos: `AgpQuestionsPanel.tsx`, `AgpLiveTabs.tsx`, `LiveScreen.tsx` e os dois arquivos de teste existem.
- Commits: `64082f3`, `97b65c7`, `8abbfe5` e `635d1f6` estão no histórico da branch `feat/fase-10-agp-integracao`.

---
*Phase: 10-agp-question-panel-in-taqciti*
*Completed: 2026-10-30*
