---
phase: 10-agp-question-panel-in-taqciti
plan: 06
subsystem: taqciti-background (meet/ended com a mesma reunião em duas abas)
tags: [typescript, vitest, chrome-extension, service-worker, state-machine, taqciti]

requires:
  - phase: 10-agp-question-panel-in-taqciti (plano 10-02)
    provides: handOffMeetingOrFinish, MEETING_TAB_CHANGED, meetingRoomTabs.ts (markTabLeftCall, findOtherRoomTab)
provides:
  - "onMeetingEndedInTab (meetingEndedInTab.ts): regra pura do D-16 com portas injetadas; meet/ended de aba que não é a dona não encerra; o da dona segue a regra do D-03; consulta que falha encerra (D-17)"
  - "case 'meet/ended' do index.ts chama a regra, marca a aba como fora da call e devolve getState()"
  - "meetingEndedTwoTabs.test.ts: 13 testes (6 casos da regra com portas falsas + 3 sequências de duas saídas com o adaptador e a máquina reais)"
affects: [10-10, 10-11 (teste 9 do 10-UAT.md no Meet real)]

actuals:
  tokens: 6800
  tasks: 2
  commits: 2

commits: 2
plan_head_before: 52b71b9e2c1cc06abccf7b40bb878328b1ffa170
plan_head_after: 4e6f9ced1f8783330e276ad26888a41cb956284f

tech-stack:
  added: []
  patterns:
    - "Regra pura com portas opcionais (otherRoomTabId?, markLeftCall?) reusando handOffMeetingOrFinish do 10-02, sem duplicar o encerramento"
    - "Teste de sequência com módulo recém-acordado (vi.resetModules + import dinâmico) e contagem exata de MEETING_FINISHED por dispatch espião sobre a máquina real"

key-files:
  created:
    - taqciti/src/background/meetingEndedInTab.ts
    - taqciti/src/background/meetingEndedTwoTabs.test.ts
  modified:
    - taqciti/src/background/index.ts

key-decisions:
  - "A aba que manda meet/ended é marcada como fora da call ANTES de decidir, reaproveitando a memória em RAM do 10-02 (Claude's Discretion já registrado no plano): uma aba parada na tela 'Você saiu da reunião' não segura a reunião ao vivo (T-10-12)"
  - "Sessão sem aba dona conhecida (tabId nulo) ou aviso sem sender.tab: encerra como hoje; só ignora quando os dois ids são números e diferentes"

requirements-completed: [TAQ-05]

coverage:
  - id: D1
    description: "meet/ended vindo de uma aba que não é a dona (os dois ids conhecidos) não encerra a reunião ao vivo e marca a aba como fora da call, sem consultar outras abas"
    requirement: "TAQ-05"
    verification:
      - kind: unit
        ref: "taqciti/src/background/meetingEndedTwoTabs.test.ts#aviso de uma aba que NÃO é a dona: nenhum despacho, a reunião continua ao vivo e a aba é marcada como fora da call"
        status: pass
    human_judgment: false
  - id: D2
    description: "meet/ended da dona: outra aba na call e na sala reaponta (MEETING_TAB_CHANGED, também em pausa); sem outra aba encerra com um único MEETING_FINISHED; consulta que rejeita ou ausente encerra (D-17)"
    requirement: "TAQ-05"
    verification:
      - kind: unit
        ref: "taqciti/src/background/meetingEndedTwoTabs.test.ts#onMeetingEndedInTab (D-16, D-17) — reaponta, encerra sem outra aba, D-17 rejeita, porta ausente, pausa"
        status: pass
    human_judgment: false
  - id: D3
    description: "Comportamento de hoje preservado: aba desconhecida (sem sender.tab ou sessão sem tabId) em reunião ao vivo e fase idle/ended despacham MEETING_FINISHED sem consultar abas; a resposta ao content script é getState()"
    requirement: "TAQ-05"
    verification:
      - kind: unit
        ref: "taqciti/src/background/meetingEndedTwoTabs.test.ts#aba desconhecida / tabId nulo / fase idle e ended"
        status: pass
      - kind: other
        ref: "grep -A2 \"case 'meet/ended'\" taqciti/src/background/index.ts | grep -c MEETING_FINISHED (= 0); grep -c \"onMeetingEndedInTab(sender.tab?.id ?? null\" (= 1)"
        status: pass
    human_judgment: false
  - id: D4
    description: "T-10-12: com as duas abas saindo da call (mesmo paradas na URL da sala) a reunião encerra exatamente 1 vez; a aba que volta para a call volta a contar"
    requirement: "TAQ-05"
    verification:
      - kind: integration
        ref: "taqciti/src/background/meetingEndedTwoTabs.test.ts#duas saídas da call com o adaptador real (T-10-12) — 3 sequências"
        status: pass
    human_judgment: false
  - id: D5
    description: "Comportamento real no Chrome: sair da call na 2ª aba não encerra a reunião da 1ª (suposições A3/A4 do 10-02 e o sender.tab do meet/ended)"
    requirement: "TAQ-05"
    verification: []
    human_judgment: true
    rationale: "Os testes simulam chrome.tabs.query e a máquina; só o teste 9 do 10-UAT.md (planos 10-10/10-11, Meet real em duas abas) confirma no navegador"

duration: 8min
completed: 2026-10-30
status: complete
---

# Phase 10 Plan 06: D-16 — meet/ended de uma aba que não é a dona não encerra a reunião Summary

**Regra pura `onMeetingEndedInTab` ligada ao `case 'meet/ended'`: o aviso de saída da call só encerra a reunião se vier da aba dona e não houver outra aba ainda na call (senão reaponta, D-03); a aba que saiu deixa de contar como "na call" e consulta que falha encerra (D-17).**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-10-30T04:10Z (aprox.) — **Completed:** 2026-10-30T04:18Z
- **Tasks:** 2 (1 tracer + 1 teste)
- **Files:** 3 (2 novos, 1 modificado)

## Accomplishments

- **D-16:** `meet/ended` de aba que não é a dona (os dois ids conhecidos e diferentes) não despacha nada; a segunda aba saindo da call não derruba mais a reunião da primeira (critério 4 do ROADMAP).
- **D-16 + D-03:** `meet/ended` da dona reusa `handOffMeetingOrFinish` do 10-02: outra aba na call e na sala reaponta (`MEETING_TAB_CHANGED`, em gravação e em pausa); senão `MEETING_FINISHED`; consulta que rejeita ou ausente encerra (D-17).
- **T-10-12 (reunião presa gastando IA):** a regra chama `markLeftCall` antes de decidir, então uma aba parada na tela "Você saiu da reunião" não segura a reunião. Provado com o adaptador real em 3 sequências, contando `MEETING_FINISHED` (exatamente 1 / 0 / 0 conforme o caso).
- **Sem regressão:** aba desconhecida, sessão sem `tabId` e fases `idle`/`ended` seguem despachando `MEETING_FINISHED` como hoje; o content script continua recebendo `getState()`. O diff do `index.ts` ficou restrito ao import e ao `case 'meet/ended'`.
- **Prova por mutação:** retirar a linha `markLeftCall` da regra derruba 4 dos 13 testes (2 de unidade e as 2 primeiras sequências).

## Task Commits

1. **Task 1 (tracer): meet/ended de aba que não é a dona não encerra; o da dona segue a regra do D-03** — `f978182` (fix)
2. **Task 2: duas saídas da call e volta para a call (adaptador real)** — `4e6f9ce` (test)

Tracer verificado de ponta a ponta antes da expansão: `vitest` dos dois arquivos 50/50, `tsc --noEmit` e `eslint src` limpos, greps do roteador conferidos.

## Files Created/Modified

- `taqciti/src/background/meetingEndedInTab.ts` — novo (62 linhas): `MeetingEndedInTabDeps` e `onMeetingEndedInTab`; sem `chrome`, sem logger.
- `taqciti/src/background/index.ts` — import e `case 'meet/ended'` (de 312 para 322 linhas). Nenhum outro `case` alterado.
- `taqciti/src/background/meetingEndedTwoTabs.test.ts` — novo (254 linhas, 13 testes).

## Decisions Made

- Marcar a aba como fora da call no `meet/ended` reaproveita a memória em RAM do 10-02 (já registrada como Claude's Discretion no 10-02-PLAN); nada novo persistido.
- Só ignora o aviso quando os dois ids são números e diferentes; com `tabId` nulo na sessão ou sem `sender.tab`, mantém o comportamento de hoje (encerra).

## Deviations from Plan

None - plan executed exactly as written.

Observações de execução, sem desvio de regra:

- O tsc acusou um erro de tipo no próprio teste novo (spread de `{ ...detected, tabId }` sobre uma constante tipada como a união `MeetingEvent`). Corrigido na mesma Task 2 tipando `detected` como `Extract<MeetingEvent, { type: 'MEETING_DETECTED' }>`; só teste, nenhum código de produção afetado.
- O plano pedia "menos de 9 testes passados no arquivo = falha": o arquivo tem 13.

## Issues Encountered

None. `npx vitest run src/background` completo: 32 arquivos passaram (552 testes, 3 pulados do `agpBackendSmoke`, que depende de backend externo).

## User Setup Required

None - no external service configuration required.

## Threat Flags

None. T-10-12 mitigado (marca de saída + adaptador só considera abas na call + sequências com contagem exata + D-17); T-10-13 aceito conforme o plano (`sender.tab` é preenchido pelo Chrome).

## Known Stubs

None.

## Next Phase Readiness

- **Pendência de validação real:** o teste 9 do `10-UAT.md` (sair da call na 2ª aba não encerra a da 1ª) só pode ser confirmado no Meet real, nos planos 10-10/10-11.
- **Rollback:** `git revert f978182` devolve o encerramento incondicional de hoje no `meet/ended` (o D-03 do 10-02 continua valendo para fechar/navegar); `git revert 4e6f9ce` remove só testes (reverter primeiro este, depois o `f978182`).
- TAQ-05 NÃO foi marcado como completo: outros planos da fase 10 ainda restam.

## Self-Check: PASSED

- Arquivos: `meetingEndedInTab.ts`, `meetingEndedTwoTabs.test.ts`, `index.ts` — FOUND.
- Commits: `f978182` e `4e6f9ce` — ancestrais de HEAD; `commits: 2` medido pelo ledger (base `52b71b9`).
- Critérios de aceitação re-rodados: `onMeetingEndedInTab(sender.tab?.id ?? null` = 1 no `index.ts`; `MEETING_FINISHED` nas 2 linhas depois de `case 'meet/ended'` = 0; `chrome|logger` em `meetingEndedInTab.ts` = 0; `meetingEndedTwoTabs.test.ts` 13/13; `src/background` 552 passados; `tsc --noEmit` e `eslint src` exit 0.

---
*Phase: 10-agp-question-panel-in-taqciti*
*Completed: 2026-10-30*
