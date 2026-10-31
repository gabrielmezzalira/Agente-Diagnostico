---
phase: 10-agp-question-panel-in-taqciti
plan: 14
subsystem: taqciti-painel (aviso de legendas na faixa do vínculo e margem fantasma do aviso de conta, G-10-7)
tags: [typescript, react, vitest, chrome-extension, taqciti, gap-closure, layout]

requires:
  - phase: 10-agp-question-panel-in-taqciti (planos 10-13 e anteriores)
    provides: AgenteBindingBar, AgenteLiveSlot, LiveBody do PanelApp
provides:
  - "StripNotice.tsx: aviso amarelo de uma faixa só, usado quando não há barra para dividir"
  - "AgenteBindingBar com prop opcional notice: segunda linha amarela dentro da mesma caixa (sem ela, DOM idêntico)"
  - "AgenteLiveSlot com prop opcional stripNotice: aviso dentro da barra, ou sozinho quando não há barra"
  - "PanelApp: constante CAPTURE_STALL_NOTICE ligada ao slot; LiveBody só desenha o aviso como reserva (sem espaço do vínculo)"
  - "wrapper do AccountBoundaryNotice com empty:hidden (fim da margem fantasma de 8 px)"
affects: [10-15, 10-16 (reteste no Chrome real), 10-17]

actuals:
  tokens: 9000
  tasks: 3
  commits: 6

commits: 6
plan_head_before: 8d459ce16c793e16d1936c93fa1d73f780aad4e1
plan_head_after: 5eb0f2459c932c442c4845118d65a9c7d11f89ca

tech-stack:
  added: []
  patterns:
    - "Prop opcional que, ausente, devolve exatamente o DOM anterior (barra sem aviso idêntica)"
    - "Regra de onde o aviso aparece num lugar só (AgenteLiveSlot); LiveBody só guarda a reserva"
    - "Em caixa flex-col, o respiro vem só de gap-1 (nunca gap-1 e gap-3 juntos)"

key-files:
  created:
    - taqciti/src/sidepanel/components/StripNotice.tsx
  modified:
    - taqciti/src/sidepanel/components/AgenteBindingBar.tsx
    - taqciti/src/sidepanel/components/AgenteLiveSlot.tsx
    - taqciti/src/content/ui/PanelApp.tsx
    - taqciti/src/sidepanel/components/AgenteLiveSlot.test.tsx
    - taqciti/src/sidepanel/components/AgenteBindingBar.test.tsx
    - taqciti/src/content/ui/panelLayout.test.ts

key-decisions:
  - "Aviso divide a caixa da barra em qualquer um dos 6 estados; sem barra (cartão, seletor, sem associação, pending) aparece sozinho e nunca some"
  - "Nenhum teste antigo foi editado: só acréscimos (SlotOptions e slot do AgenteLiveSlot.test ganharam o stripNotice opcional)"

requirements-completed: [TAQ-05]

coverage:
  - id: D1
    description: "Com a reunião vinculada, o aviso de legendas aparece 1 vez, dentro da mesma caixa da barra; em offline o [role=status] contém o alerta e o aviso"
    requirement: "TAQ-05"
    verification:
      - kind: unit
        ref: "taqciti/src/sidepanel/components/AgenteLiveSlot.test.tsx#AgenteLiveSlot — aviso de legendas dividindo a faixa (G-10-7)"
        status: pass
      - kind: unit
        ref: "taqciti/src/sidepanel/components/AgenteBindingBar.test.tsx#AgenteBindingBar — aviso dividindo a faixa (10-14, G-10-7)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Sem barra (cartão, seletor, pending, sem associação) o aviso aparece sozinho, uma vez; sem aviso a barra é idêntica à de antes nos 6 estados"
    requirement: "TAQ-05"
    verification:
      - kind: unit
        ref: "taqciti/src/sidepanel/components/AgenteLiveSlot.test.tsx#AgenteLiveSlot — aviso de legendas dividindo a faixa (G-10-7)"
        status: pass
      - kind: unit
        ref: "taqciti/src/sidepanel/components/AgenteBindingBar.test.tsx#sem aviso: continua uma linha (sem flex-col)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Travas de fonte: stripNotice= uma vez, frase do aviso em cópia única, wrapper da conta com empty:hidden mb-2 shrink-0"
    requirement: "TAQ-05"
    verification:
      - kind: unit
        ref: "taqciti/src/content/ui/panelLayout.test.ts#PanelApp — o aviso de legendas divide a faixa do vínculo (10-14, G-10-7)"
        status: pass
      - kind: unit
        ref: "taqciti/src/content/ui/panelLayout.test.ts#PanelApp — o aviso de conta vazio não reserva espaço (10-14, G-10-7)"
        status: pass
    human_judgment: false
  - id: D4
    description: "No Chrome real (painel compacto), com o aviso de legendas e a reunião vinculada, ele divide a faixa 'Enviando ao vivo para <cliente>' e nada cobre a linha 'N falas · N pessoas · N palavras'"
    requirement: "TAQ-05"
    verification: []
    human_judgment: true
    rationale: "jsdom não mede altura nem pinta; o aviso não pode ser provocado sob demanda. Prova visual fica para o reteste do plano 10-16 (backstop)"

duration: 18min
completed: 2026-10-31
status: complete
---

# Phase 10 Plan 14: Aviso de legendas na faixa do vínculo (G-10-7) Summary

**O aviso amarelo "As legendas do Meet pararam de chegar. Religando sozinho." deixa de ser uma caixa própria e vira a segunda linha da mesma caixa da barra "Enviando ao vivo para <cliente>" (qualquer um dos 6 estados da barra); sem barra ele continua aparecendo sozinho, e o aviso de conta vazio não reserva mais 8 px (`empty:hidden`).**

## Performance

- **Duração:** ~18 min
- **Tarefas:** 3 (Task 1 tracer em 3 commits: mecânico, RED, GREEN; Task 2 só testes; Task 3 em RED/GREEN)
- **Arquivos:** 1 criado, 6 modificados

## Accomplishments

- Extração mecânica (`62fde31`, só `StripNotice.tsx` e `PanelApp.tsx`): frase vira `CAPTURE_STALL_NOTICE`, parágrafo vira `StripNotice`, mesma condição e mesmo lugar, nenhum teste editado, suíte inteira verde antes e depois.
- `AgenteBindingBar` aceita `notice`: a caixa vira coluna (`STACK`: `flex-col justify-center gap-1`, sem `gap-3` nem `items-center`), a linha de sempre fica numa `div` `LINE` e o aviso em amarelo vem abaixo. `role="status"`/`aria-live`/`title` ficam na caixa externa dos alertas; nome do cliente continua texto do React. Sem `notice` o DOM é o de antes.
- `AgenteLiveSlot` aceita `stripNotice` e concentra a regra: sem associação, `pending` e barra nula mostram só o aviso; cartão mostra cartão e depois o aviso; seletor mostra o aviso antes do takeover; com barra, o aviso entra nela. Nenhum hook, efeito ou comando mudou.
- `PanelApp` passa `stripNotice={ctx.captureHealthy ? null : CAPTURE_STALL_NOTICE}`; o `LiveBody` só desenha o aviso como reserva (`!liveSlot`, quando nem existe espaço do vínculo).
- Wrapper do `AccountBoundaryNotice` com `empty:hidden`.
- Testes: `AgenteLiveSlot` 23 para 30, `AgenteBindingBar` 14 para 31, `panelLayout` 1 para 4. Suíte inteira da Taqciti: 1770+ testes verdes, `tsc` e `eslint` limpos. Uma mutação manual (`gap-3` de volta em `STACK`) derrubou 6 testes novos, confirmando que a trava funciona.

## Task Commits

1. Task 1a (mecânico): `62fde31` refactor(10-14): extrai o aviso amarelo de legendas para StripNotice (sem mudar posição)
2. Task 1b RED: `ecf72ea` test(10-14): testes do aviso de legendas dividindo a faixa do vínculo (G-10-7) (6 falhas esperadas)
3. Task 1b GREEN: `fe14e45` fix(10-14): aviso de legendas divide a faixa da barra de vínculo (G-10-7)
4. Task 2: `d13fd29` test(10-14): contrato da faixa compartilhada na barra de vínculo e no painel
5. Task 3 RED: `e767bba` test(10-14): trava do empty:hidden no wrapper do aviso de conta (G-10-7)
6. Task 3 GREEN: `5eb0f24` fix(10-14): aviso de conta vazio não deixa margem fantasma no painel (G-10-7)

## TDD

- RED da Task 1b: 6 testes novos falharam porque o `AgenteLiveSlot` ainda ignorava `stripNotice` (aviso ausente), não por erro de sintaxe ou import.
- RED da Task 3: `expected '<div className="mb-2 shrink-0">…' to contain 'empty:hidden'`.
- Task 2: por desenho do plano os testes vêm DEPOIS da implementação (Task 1 já a entregou), então não há RED separado; passaram de primeira e a mutação de `gap-3` provou que não são vazios.
- Sem commit REFACTOR (nenhum necessário).

## Deviations from Plan

### Auto-fixed Issues

**1. [Processo] Commit de teste separado da implementação na Task 1b e na Task 3**
- **Found during:** Task 1 e Task 3
- **Issue:** o plano previa um commit por mudança; o fluxo TDD exigido pelo orquestrador pede RED antes do GREEN.
- **Fix:** `ecf72ea` antes de `fe14e45`, e `e767bba` antes de `5eb0f24`.

**2. [Rule 1 - Bug] Helper `barBox` do meu próprio teste olhava um nível abaixo da caixa**
- **Found during:** Task 1b (GREEN)
- **Issue:** o helper subia só um `parentElement` a partir do texto "Enviando ao vivo para", que com o aviso é a `div` `LINE`, não a caixa externa.
- **Fix:** subir mais um nível. Corrigido no mesmo commit do GREEN (`fe14e45`).

**Total deviations:** 2 (processo e erro de teste próprio). **Impact:** nenhum no código de produção.

## Observações

- Com o seletor de cliente aberto, a regra CSS do painel (`:has(> [data-picker-takeover]) > :not([data-picker-takeover]) { display: none }`) esconde o resto do corpo, inclusive o aviso colocado antes do takeover. É a regra que já existia (o seletor é dono do corpo); o aviso volta quando o seletor fecha. Não mudei essa regra por estar fora do escopo do plano.
- Teste `agenteStreamerAssociation.test.ts` ("o ID salvo na config não envia nada") estourou 5 s uma vez numa rodada completa; passa isolado e nas outras rodadas completas. Arquivo não tocado por este plano; flaky sob carga.

## Verificações

- `npx vitest run` (Taqciti inteira): 104 arquivos verdes; `npx tsc --noEmit` e `npx eslint src` limpos.
- `git diff --numstat 0989f74` nos testes de barra e de layout: 0 linhas removidas (só acréscimo). Commit mecânico tocou só `StripNotice.tsx` e `PanelApp.tsx`.
- `stripNotice=` no `PanelApp.tsx`: 1; `CAPTURE_STALL_NOTICE`: 3; `empty:hidden`: 1; `dangerouslySetInnerHTML` nos dois componentes: 0 (T-10-23 mitigado).

## Known Stubs

Nenhum.

## Threat Flags

Nenhum. Sem superfície nova de rede, autenticação ou arquivo.

## Issues Encountered

Nenhum bloqueante. A prova visual no Chrome real (D4) fica para o reteste do plano 10-16 (build da Taqciti e ↻ em `chrome://extensions`).

## Next Phase Readiness

Pronto para 10-15 (esconder o aviso durante a pausa), 10-16 e 10-17.

## Self-Check: PASSED

- `StripNotice.tsx` existe e exporta `StripNotice`.
- Commits `62fde31`, `ecf72ea`, `fe14e45`, `d13fd29`, `e767bba`, `5eb0f24` presentes na branch `feat/fase-10-agp-integracao`.
