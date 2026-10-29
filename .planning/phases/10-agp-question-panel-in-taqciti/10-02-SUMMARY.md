---
phase: 10-agp-question-panel-in-taqciti
plan: 02
subsystem: taqciti-background (ciclo de vida da reunião com a mesma sala em duas abas)
tags: [typescript, vitest, chrome-extension, service-worker, chrome-tabs, state-machine, taqciti]

# Dependency graph
requires:
  - phase: 08-seletor-de-cliente-por-reuniao
    provides: regras DA-3 (aba fechada encerra) e DA-4 (navegar encerra), isStillInMeetingRoom/meetingCodeFromPath (CR-02) e a máquina de estados da reunião
provides:
  - "Evento MEETING_TAB_CHANGED na máquina: reaponta session.tabId só em fase ao vivo (captionsRequired/recording/paused); em idle/ended devolve o mesmo estado"
  - "meetingRoomTabs.ts (novo): findOtherRoomTab sobre chrome.tabs.query + memória só em RAM das abas na call (markTabJoinedCall, markTabLeftCall com a marca 'saiu da call', noteTabCaptionActivity pela legenda, noteTabUrlChanged)"
  - "handOffMeetingOrFinish (meetingTabClosed.ts): regra pura compartilhada por DA-3 e DA-4 que reaponta ou encerra; consulta ausente ou que rejeita = encerra (D-17)"
  - "Porta opcional otherRoomTabId em MeetingTabClosedDeps e MeetingTabNavigatedDeps, ligada a findOtherRoomTab no index.ts (tabs.onRemoved e tabs.onUpdated)"
  - "meetingTwoTabs.test.ts: 40 testes com a máquina real e chrome.tabs.query simulado"
affects: [10-03 (D-11 fecha o WebSocket da aba AGP na pausa e o worker adormece mais: o reaprendizado pela legenda existe por isso), 10-06 (D-16 meet/ended da outra aba, commit próprio sobre esta base), 10-10 (UAT 9 no Chrome real), 10-11]

# Actuals (#2632) — chars/4 sobre o diff realizado em taqciti/ (linhas adicionadas)
actuals:
  tokens: 7313
  tasks: 2
  commits: 2

# Measured commit ledger (#3968)
commits: 2
plan_head_before: 688bf11261fdac65896420cf64fb3ce5dc9e285e
plan_head_after: d087c597c0b811d1dc9a3b6ec35391ede5e74348

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Porta opcional com padrão neutro (otherRoomTabId?: ausente = sem outra aba = encerra) para os testes antigos de DA-3/DA-4 continuarem sem edição"
    - "Regra única compartilhada (handOffMeetingOrFinish) em vez de duplicar o encerramento em DA-3 e DA-4"
    - "Memória só em RAM do service worker (Map + Set de módulo), sem persistir, sem logger e sem URL; reaprendida por sinal que só existe dentro da call (meet/chunk)"
    - "Teste com módulo 'recém-acordado': vi.resetModules() + import dinâmico é também a simulação do reinício do service worker"

key-files:
  created:
    - taqciti/src/background/meetingRoomTabs.ts
    - taqciti/src/background/meetingTwoTabs.test.ts
  modified:
    - taqciti/src/features/meeting/machine.ts
    - taqciti/src/background/meetingTabClosed.ts
    - taqciti/src/background/meetingTabNavigated.ts
    - taqciti/src/background/index.ts

key-decisions:
  - "Modelo persistido inalterado: continua UMA aba dona (session.tabId); quando ela sai da sala e há outra aba da mesma call, o dono é reapontado por MEETING_TAB_CHANGED. Nenhum conjunto de abas entra no taq:state"
  - "A memória 'quem entrou na call' fica só em RAM (Claude's Discretion do plano, registrado para o time): a URL sozinha não distingue 'na call' de 'pré-entrada', e uma aba parada seguraria a reunião ao vivo gastando IA"
  - "Reaprendizado depois do reinício do worker só por meet/chunk (legenda só existe dentro da call); meet/participants e meet/captions ficam de fora; a marca 'saiu da call' bloqueia legenda atrasada até um novo meet/detected"
  - "markTabLeftCall roda síncrono e fora do ready no tabs.onRemoved, e findOtherRoomTab lê a memória DEPOIS do await da consulta: uma aba que fecha enquanto a consulta corre não é escolhida (travado por teste)"
  - "Consulta ausente, vazia ou rejeitada = encerra, como sempre foi (D-17); a consulta de abas na navegação só roda depois de provado que a aba dona saiu da sala"

patterns-established:
  - "Porta de consulta injetada nas regras de aba (otherRoomTabId) com o adaptador do Chrome em módulo à parte (meetingRoomTabs.ts); as regras continuam testáveis sem o Chrome"
  - "Teste de regra provado por mutação: remover a marca 'saiu da call' e desligar o handoff derrubam 3 testes"

requirements-completed: [TAQ-05]

# Coverage metadata (#1602)
coverage:
  - id: D1
    description: "Fechar a aba dona (DA-3) com a mesma call aberta em outra aba reaponta a reunião (fase continua ao vivo, session.tabId passa para a outra, evento MEETING_TAB_CHANGED, nenhum MEETING_FINISHED); fechar depois a aba que sobrou encerra com um único MEETING_FINISHED; fechar uma aba que não é a dona não faz nada"
    requirement: "TAQ-05"
    verification:
      - kind: integration
        ref: "taqciti/src/background/meetingTwoTabs.test.ts#(a) fecha a dona com a outra aba na call: continua ao vivo na outra, sem MEETING_FINISHED"
        status: pass
      - kind: integration
        ref: "taqciti/src/background/meetingTwoTabs.test.ts#(c) fecha a dona e depois a que sobrou: encerra, com um único MEETING_FINISHED"
        status: pass
      - kind: integration
        ref: "taqciti/src/background/meetingTwoTabs.test.ts#(d) fecha uma aba que NÃO é a dona: nada é despachado"
        status: pass
      - kind: unit
        ref: "taqciti/src/background/meetingTwoTabs.test.ts#MEETING_TAB_CHANGED na máquina (recording, paused, captionsRequired, idle/ended)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Navegar a aba dona para fora da sala (outro site ou chrome://newtab/) com outra aba da mesma call não encerra e reaponta; sem outra aba encerra como hoje; recarregar ou mudar ?query/#hash da mesma sala não despacha nada nem consulta abas"
    requirement: "TAQ-05"
    verification:
      - kind: integration
        ref: "taqciti/src/background/meetingTwoTabs.test.ts#(b) dona vai para outro site com a outra aba na call: continua ao vivo na outra, sem MEETING_FINISHED"
        status: pass
      - kind: integration
        ref: "taqciti/src/background/meetingTwoTabs.test.ts#dona vai para chrome://newtab/ sem outra aba: encerra (DA-4 de uma aba só continua igual)"
        status: pass
      - kind: integration
        ref: "taqciti/src/background/meetingTwoTabs.test.ts#recarregar ou mudar ?query/#hash da mesma sala: nada é despachado e a consulta de abas nem roda"
        status: pass
    human_judgment: false
  - id: D3
    description: "Falha segura e adjacência: consulta que rejeita (D-17), lista vazia, aba só em pré-entrada, outra sala, host parecido (meet.google.com.evil.com), aba sem id/url e aba que saiu da call NÃO seguram a reunião (encerra); com mais de uma candidata vale a primeira na ordem da consulta; o código da sala compara sem diferenciar maiúsculas e aceita /meet/<código>"
    requirement: "TAQ-05"
    verification:
      - kind: integration
        ref: "taqciti/src/background/meetingTwoTabs.test.ts#(g) a consulta rejeita: encerra (D-17, falha segura)"
        status: pass
      - kind: unit
        ref: "taqciti/src/background/meetingTwoTabs.test.ts#findOtherRoomTab (adaptador do chrome.tabs) — devolve null (6 casos), pré-entrada, outra sala, saiu da call, ordem, rejeição propaga"
        status: pass
      - kind: integration
        ref: "taqciti/src/background/meetingTwoTabs.test.ts#(f) a outra aba está em OUTRA sala: encerra"
        status: pass
    human_judgment: false
  - id: D4
    description: "Reaprendizado pela legenda depois do reinício do worker (memória em RAM vazia): um meet/chunk da outra aba volta a contá-la como 'na call' e fechar a dona reaponta; sem nenhuma legenda encerra (fail-safe de hoje); entradas indefinidas não marcam nada; legenda atrasada de aba que saiu não a ressuscita e só um novo meet/detected a faz contar de novo; aba que fecha com a consulta em voo não é escolhida"
    requirement: "TAQ-05"
    verification:
      - kind: integration
        ref: "taqciti/src/background/meetingTwoTabs.test.ts#reaprendizado pela legenda depois do reinício do worker (memória vazia) — 5 casos"
        status: pass
      - kind: unit
        ref: "taqciti/src/background/meetingTwoTabs.test.ts#findOtherRoomTab — uma aba que fecha enquanto a consulta corre não é escolhida"
        status: pass
    human_judgment: false
  - id: D5
    description: "Sem regressão: os 6 arquivos de teste antigos de DA-3/DA-4/máquina passam sem nenhuma edição, tsc e eslint limpos, adaptador sem import de logger/storage (LGPD)"
    requirement: "TAQ-05"
    verification:
      - kind: integration
        ref: "cd taqciti && npx vitest run src/background/meetingTabClosed.test.ts src/background/meetingTabClosedFlow.test.ts src/background/meetingTabNavigated.test.ts src/background/meetingTabNavigatedFlow.test.ts src/features/meeting/machine.test.ts src/features/meeting/machineStartFresh.test.ts (99 testes, git diff --quiet eb3bf01 sai 0)"
        status: pass
      - kind: other
        ref: "cd taqciti && npx tsc --noEmit && npx eslint src (exit 0)"
        status: pass
    human_judgment: false
  - id: D6
    description: "Comportamento real no Chrome: com a mesma sala em duas abas, fechar/navegar a aba dona não derruba a reunião da outra (suposições A3/A4 da pesquisa: tab.url legível e a 2ª aba mandando meet/detected)"
    requirement: "TAQ-05"
    verification: []
    human_judgment: true
    rationale: "Os testes simulam chrome.tabs.query; só o teste 9 do 10-UAT.md (planos 10-10/10-11, Meet real em duas abas) confirma A3/A4 no navegador de verdade"

# Metrics
duration: 14min
completed: 2026-10-29
status: complete
---

# Phase 10 Plan 02: D-03 — a mesma reunião em duas abas não encerra quando a aba dona sai Summary

**Evento `MEETING_TAB_CHANGED`, adaptador `meetingRoomTabs.ts` (memória só em RAM das abas na call, reaprendida pela legenda) e a regra `handOffMeetingOrFinish` compartilhada pelas DA-3 e DA-4: fechar ou navegar a aba dona com a mesma call aberta em outra aba reaponta a reunião em vez de encerrá-la.**

## Performance

- **Duration:** 14 min
- **Started:** 2026-10-29T20:45:51Z
- **Completed:** 2026-10-29T21:00:00Z (aprox.)
- **Tasks:** 2
- **Files modified:** 6 (4 de produção modificados/criados, 1 teste novo; `meetingRoomTabs.ts` e `meetingTwoTabs.test.ts` são novos)

## Accomplishments

- **DA-3 com duas abas (D-03):** com a mesma sala aberta e em call em duas abas, fechar a aba dona mantém a fase ao vivo e passa `session.tabId` para a outra aba (`MEETING_TAB_CHANGED`), sem nenhum `MEETING_FINISHED`. Fechar depois a aba que sobrou encerra uma única vez (Armadilha 3 travada por teste de fluxo com a máquina real).
- **DA-4 com duas abas:** navegar a aba dona para outro site ou `chrome://newtab/` com a outra aba ainda na call reaponta em vez de encerrar; com uma aba só o comportamento de hoje (encerra) não muda; recarregar ou mudar `?query`/`#hash` da mesma sala não despacha nada nem consulta abas.
- **Falha segura (D-17):** consulta que rejeita, lista vazia, aba só na tela de pré-entrada, outra sala, host parecido (`meet.google.com.evil.com`), aba sem `id`/`url` e aba que saiu da call encerram a reunião como sempre.
- **Memória só em RAM que se refaz sozinha:** `markTabJoinedCall` (no `meet/detected`), `markTabLeftCall` (no `tabs.onRemoved`, com a marca "saiu da call"), `noteTabCaptionActivity` (só no `meet/chunk`) e `noteTabUrlChanged` (no `tabs.onUpdated`). Depois do reinício do worker, uma legenda da outra aba volta a contá-la; uma legenda atrasada de aba que saiu não a ressuscita.
- **Corrida da consulta em voo fechada:** `findOtherRoomTab` lê a memória depois do `await` da consulta e `markTabLeftCall` roda síncrono, então uma aba que fecha enquanto a consulta corre não é escolhida (teste dedicado).
- **Testes antigos intactos:** os 6 arquivos de DA-3/DA-4/máquina passam sem edição (`git diff --quiet eb3bf01` sai 0); `tsc --noEmit` e `eslint src` limpos.

## Task Commits

1. **Task 1 (tracer): fechar a aba dona com a mesma call em outra aba passa a reunião para ela (DA-3)** - `da12f0f` (fix)
2. **Task 2: navegar a aba dona para fora da sala com outra aba na call não encerra a reunião (DA-4)** - `d087c59` (fix)

**Plan metadata:** commit docs(10-02) logo após este SUMMARY (STATE/ROADMAP/REQUIREMENTS).

## Files Created/Modified

- `taqciti/src/features/meeting/machine.ts` - membro `MEETING_TAB_CHANGED` na união `MeetingEvent` e o `case` no `transition` (só em fase ao vivo)
- `taqciti/src/background/meetingRoomTabs.ts` - novo (89 linhas): adaptador do `chrome.tabs`; sem import de logger nem storage, não guarda URL
- `taqciti/src/background/meetingTabClosed.ts` - porta `otherRoomTabId?` e `handOffMeetingOrFinish`; a DA-3 passa por ela (75 linhas)
- `taqciti/src/background/meetingTabNavigated.ts` - porta `otherRoomTabId?` e uso de `handOffMeetingOrFinish` depois de `isStillInMeetingRoom` dar falso (62 linhas)
- `taqciti/src/background/index.ts` - liga as cinco funções no `meet/detected`, `meet/chunk`, `tabs.onRemoved` e `tabs.onUpdated` (de 287 para 312 linhas)
- `taqciti/src/background/meetingTwoTabs.test.ts` - novo (454 linhas, 40 testes): máquina, adaptador, DA-3, DA-4, reaprendizado e `noteTabUrlChanged`

## Decisions Made

- Modelo persistido inalterado: continua UMA aba dona, reapontada pelo evento novo; nenhum conjunto de abas entra no `taq:state`.
- Memória das abas na call só em RAM (Claude's Discretion do plano, registrado para o time; dentro do D-03/D-16/D-17): nada persistido, nenhum texto novo de UI, falha da consulta = encerra.
- Reaprendizado só por `meet/chunk`; `meet/participants` e `meet/captions` não entram porque podem sair da tela de pré-entrada e segurariam a reunião.
- `handOffMeetingOrFinish` é uma única regra para DA-3 e DA-4 (sem duplicar o encerramento).

## Deviations from Plan

None - plan executed exactly as written.

Observações de execução, sem desvio de regra:

- **Formato do commit nas tasks com TDD:** a Task 2 é `tdd="true"`, mas o plano define um commit único por task (`fix(10-02)`) para o rollback por `git revert <sha>`; o plano vence. O RED foi rodado localmente antes da implementação e não foi commitado em separado (ver "Notas de TDD").
- **`index.ts` passou de 287 para 312 linhas.** O arquivo já era de roteamento e o plano fixa a ligação nele; não há regra automática de tamanho (eslint sem `max-lines`). Fica o aviso de que os planos seguintes (10-03 em diante) que mexerem em `index.ts` devem preferir mover para módulos próprios.

## Notas de TDD

- **RED (Task 2):** os 9 testes novos de navegação/`noteTabUrlChanged` falharam antes da implementação, todos com `TypeError: worker.roomTabs.noteTabUrlChanged is not a function` (símbolo novo ainda inexistente). Avaliação semântica: é um RED de "símbolo ausente", não de assertiva; o teste (b) só chega à assertiva `recording`/`tabId 9` quando o símbolo existe, e sem o `handOffMeetingOrFinish` ligado na navegação ele cairia em `ended`. Os 31 testes da Task 1 seguiram verdes durante o RED.
- **Prova por mutação (Task 1):** retirar a guarda da marca "saiu da call" em `noteTabCaptionActivity` e desligar o handoff em `handOffMeetingOrFinish` derrubou 3 testes ((a), reaprendizado com legenda e legenda atrasada); os arquivos foram restaurados e o conjunto voltou a 31/31.
- **GREEN:** 40/40 em `meetingTwoTabs.test.ts`; 81/81 junto de `meetingTabNavigated*.test.ts`.
- Plano é `type: execute` (não `tdd`), então não há seção "TDD Gate Compliance".

## Issues Encountered

- **`AgenteConfigScreenPlanB.test.tsx` falhou na suíte completa (9 testes, `flushUntil: predicado não ficou verdadeiro a tempo`) e passa sozinho (10/10).** Não importa nada desta mudança (a tela é do painel lateral, não do background). É um teste de temporização que estoura com a máquina carregada pela suíte inteira (153 s). Fora de escopo; registrado em `deferred-items.md` desta fase. Todos os outros 98 arquivos passaram (1551 testes).

## User Setup Required

None - no external service configuration required.

## Threat Flags

None. A única superfície nova é a leitura de `tab.url` por `chrome.tabs.query`, já coberta pelo T-10-03 do plano (mitigada: sem logger, sem storage, sem URL guardada) e o T-10-04 (reunião que nunca encerra: testes de sequência, falha segura e legenda atrasada).

## Known Stubs

None.

## Next Phase Readiness

- Pronto para o 10-03 em diante. O D-16 (`meet/ended` da outra aba) fica no 10-06, em commit próprio, e deve reaproveitar a mesma memória de abas na call.
- **Pendência de validação real:** as suposições A3 (`tab.url` legível pela consulta) e A4 (a 2ª aba mandar `meet/detected`/legenda) só se confirmam no teste 9 do `10-UAT.md` (Chrome real, planos 10-10/10-11). Limite conhecido: se a outra aba não tiver legenda ligada, ela só volta a contar após um novo `meet/detected` (recarregar a aba) — aí vale o comportamento seguro de hoje (encerra).
- **Rollback:** `git revert d087c59` volta a DA-4 de uma aba só; `git revert da12f0f` volta a DA-3 de uma aba só (e remove o evento novo); sem reverter, tirar `otherRoomTabId: findOtherRoomTab` das duas chamadas no `index.ts` devolve o comportamento de hoje; só o reaprendizado dando problema: remover a linha `noteTabCaptionActivity(...)` do `case 'meet/chunk'`.

## Self-Check: PASSED

- Arquivos: `machine.ts`, `meetingRoomTabs.ts`, `meetingTabClosed.ts`, `meetingTabNavigated.ts`, `index.ts`, `meetingTwoTabs.test.ts` — todos FOUND.
- Commits: `da12f0f` e `d087c59` — ambos ancestrais de HEAD; `evaluation-scope --plan 10-02 --commits-only` devolve os dois (`commits: 2` medido pelo ledger, base `688bf11`).
- Critérios de aceitação re-rodados: `meetingTwoTabs.test.ts` 40/40; 6 testes antigos 99/99 sem edição; `otherRoomTabId: findOtherRoomTab` = 2 ocorrências; `noteTabCaptionActivity(` = 1 chamada (só no `meet/chunk`); `markTabJoinedCall(` = 1; `markTabLeftCall(` = 1; `noteTabUrlChanged(` = 1; imports de logger/storage em `meetingRoomTabs.ts` = 0; `tsc --noEmit` e `eslint src` exit 0.

---
*Phase: 10-agp-question-panel-in-taqciti*
*Completed: 2026-10-29*
