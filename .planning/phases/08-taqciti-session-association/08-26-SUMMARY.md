---
phase: 08-taqciti-session-association
plan: 26
subsystem: taqciti-extension-meeting-tab-closed
status: complete
tags: [taqciti, chrome-extension, service-worker, tabs-onRemoved, decision-b4b, da-3, meeting-finished]

requires:
  - phase: 08-taqciti-session-association
    provides: "08-22: ciclo de vida da associação (meeting-ended, ended-unsent, remoção sem falas); 08-24: regra de reentrada (startFresh, shouldStartFreshMeeting) que só vale com a fase ended"
provides:
  - "meetingTabClosed.ts: onMeetingTabRemoved(tabId, { getState, dispatch, now }) com a regra de aba da reunião fechada"
  - "Fechar a aba da reunião AO VIVO (captionsRequired, recording, paused) dispara MEETING_FINISHED, o mesmo evento do meet/ended, sem RESET"
  - "index.ts: chrome.tabs.onRemoved delega ao handler dentro de ready.then"
affects: [08-21, 08-25]

actuals:
  tokens: 9000
  tasks: 2
  commits: 2

plan_head_before: 2a481939fa05fdcbdae6b4022174bf6c07513024
plan_head_after: c063b02455ff2c292f2d45eaaf53198538d38bb6

tech-stack:
  added: []
  patterns:
    - "Refator mecânico em commit separado do commit de comportamento (CLAUDE.md): primeiro mover e caracterizar, depois mudar"
    - "Regra do service worker extraída com dependências injetáveis (getState, dispatch, now), testável sem o Chrome; o index.ts só delega"
    - "Reaproveitar o mesmo evento da máquina (MEETING_FINISHED) em vez de criar caminho novo: idempotência e efeitos colaterais vêm de graça"

key-files:
  created:
    - taqciti/src/background/meetingTabClosed.ts
    - taqciti/src/background/meetingTabClosed.test.ts
    - taqciti/src/background/meetingTabClosedFlow.test.ts
  modified:
    - taqciti/src/background/index.ts

key-decisions:
  - "DA-3 = fechar-aba-encerra aplicada sem nova parada: a aba da reunião ao vivo fechada conta como fim, pelo mesmo MEETING_FINISHED do meet/ended"
  - "Sem RESET no caminho do fim: o estado fica em ended para a regra de reentrada do 08-24 valer"
  - "machine.ts e machine.test.ts intocados: a mudança é só no handler do service worker"

requirements-completed: []

coverage:
  - id: D1
    description: "Fechar a aba da reunião em captionsRequired, recording ou paused dispara MEETING_FINISHED uma vez, com o relógio injetado, e nenhum RESET"
    requirement: TAQ-02
    verification:
      - kind: unit
        ref: "taqciti/src/background/meetingTabClosed.test.ts#aba da reunião fechada no meio da call"
        status: pass
    human_judgment: false
  - id: D2
    description: "Com a máquina real: recording com falas e associação linked termina em ended com endedAt, registro ready no histórico e associação ainda linked; pending com falas vira ended-unsent; pending sem falas é removida; linking continua e o vínculo ainda termina em linked"
    requirement: TAQ-02
    verification:
      - kind: unit
        ref: "taqciti/src/background/meetingTabClosedFlow.test.ts#fechar a aba no meio da call encerra a reunião"
        status: pass
    human_judgment: false
  - id: D3
    description: "paused termina em ended; captionsRequired sem falas termina em ended com a sessão vazia e sem registro novo no histórico"
    requirement: TAQ-02
    verification:
      - kind: unit
        ref: "taqciti/src/background/meetingTabClosedFlow.test.ts#paused -> ended e #captionsRequired sem falas"
        status: pass
    human_judgment: false
  - id: D4
    description: "O comportamento antigo não mudou: aba fechada DEPOIS do fim continua em RESET; outra aba, tabId nulo e fase idle não fazem nada"
    requirement: TAQ-02
    verification:
      - kind: unit
        ref: "taqciti/src/background/meetingTabClosed.test.ts#aba da reunião fechada depois do fim e #aba nula / outra aba"
        status: pass
      - kind: unit
        ref: "taqciti/src/background/meetingTabClosedFlow.test.ts#fechar a aba DEPOIS do fim e #aba de outra reunião"
        status: pass
    human_judgment: false
  - id: D5
    description: "Reabrir a mesma sala depois do fim por aba fechada: sem sessionFinished retoma o mesmo meetingId (08-22); com sessionFinished é reunião nova com outro meetingId (08-24)"
    requirement: TAQ-02
    verification:
      - kind: unit
        ref: "taqciti/src/background/meetingTabClosedFlow.test.ts#reabrir a mesma sala depois do fim por aba fechada"
        status: pass
    human_judgment: false
  - id: D6
    description: "No Chrome real, fechar a aba do Meet no meio da call encerra a sessão no web app em poucos segundos (com o 08-25 ligado) e a volta à sala mostra a bolha '!' de reunião nova"
    requirement: TAQ-02
    human_judgment: true
    rationale: "Ponta a ponta com Chrome, Meet e backend: é o roteiro manual D-20 do 08-21, passo i, depois da fiação do 08-25."
---

# Phase 8 Plan 26: Fechar a aba da reunião ao vivo conta como fim da reunião Summary

Fechar a aba do Meet no meio da call (fases `captionsRequired`, `recording` ou `paused`) agora dispara o mesmo `MEETING_FINISHED` do `meet/ended`: a máquina vai para `ended`, o histórico guarda o registro final, as métricas contam e o ciclo de vida da associação segue o caminho de sempre. Não há RESET nesse caminho, então a regra de reentrada do 08-24 continua valendo (mesma sala logo depois: mesma reunião se a sessão do Agente ainda não foi encerrada; reunião nova se foi).

**Duração:** cerca de 20 min · **Tasks:** 2 · **Arquivos:** 4 (3 novos, 1 alterado)

## Decisão do time (respondida em 2026-10-12)

Registro literal, conforme `08-DECISOES-PENDENTES.md` (confirmado por `grep` antes da Task 2, uma ocorrência):

- **DA-3 = `fechar-aba-encerra`:** fechar a aba da reunião no meio da call conta como fim da reunião e dispara o encerramento. Implementada neste plano (Task 2), sem nova parada.

## O que foi feito

| Task | Commit | O que |
|------|--------|-------|
| 1 (refator mecânico) | `7bceba2` | `refactor(08-26)`: a regra inline do `chrome.tabs.onRemoved` (fase `ended` e mesma aba, RESET) vai para `meetingTabClosed.ts` (`onMeetingTabRemoved(tabId, { getState, dispatch })`); `index.ts` só chama o módulo dentro de `ready.then`, mantendo `forgetPanelTab` antes e o listener no topo do módulo; 7 testes de caracterização do comportamento de antes (incluindo "ao vivo + mesma aba = nada"); nenhum teste existente alterado |
| 2 (comportamento) | `c063b02` | `feat(08-26)`: reunião ao vivo + `session.tabId === tabId` dispara `MEETING_FINISHED` com `at` do relógio injetado (`now`, padrão `Date.now`); `ended` continua em RESET; `index.ts` passa `now: Date.now` (1 linha); teste de fluxo novo com a máquina real, `sessionController`, histórico e store de associações |

Cada commit é reversível sozinho. Para voltar atrás: `git revert c063b02` (aba fechada ao vivo volta a não fazer nada; sessões já encerradas por esse caminho continuam encerradas) e depois `git revert 7bceba2` (a lógica volta ao `index.ts`). Nada toca backend, banco ou produção.

## Verificação

- Testes do plano: `npx vitest run` de `meetingTabClosed.test.ts`, `meetingTabClosedFlow.test.ts`, `machine.test.ts` e `machineStartFresh.test.ts` -> **4 arquivos, 58 testes passando**.
- Portão do plano: `npm test` -> **84 arquivos, 1247 testes passando**; `npm run typecheck` e `npm run lint` sem erros.
- RED confirmado na Task 2: antes da implementação, 3 testes do handler e 7 do fluxo falharam; depois, todos verdes.
- `git show --name-only HEAD -- machine.ts machine.test.ts` vazio no commit da Task 2: a máquina da Fase 7 e o teste dela não foram alterados.
- Tamanhos: `meetingTabClosed.ts` 42 linhas (abaixo de 200); `index.ts` +2/-1 linhas líquidas na Task 2, e menos linhas do que antes da fase de extração. `package.json` e `package-lock.json` sem diff (T-08-SC).

## Deviations from Plan

None - plano executado como escrito. Dois detalhes de implementação dentro do que o plano permite: o handler é `async` e devolve `Promise<void>` (para os testes aguardarem o dispatch), e o teste "idempotente" do plano virou "fechar a aba DEPOIS do fim continua em RESET", porque o segundo fechamento cai no caminho antigo, e não numa repetição do fim.

## Pendências e lembretes para o time

- **DA-4 continua EM ABERTO (não implementada):** a aba que NAVEGA para outro site no meio da call, sem fechar, não gera `tabs.onRemoved` nem `meet/ended`, com o mesmo custo ocioso. Opções: `navegar-encerra` (recomendada) ou `nao-tratar` (só vale se o time aceitar explicitamente). Sem resposta, nada foi feito; o 08-21 lista como PENDÊNCIA DO TIME, nunca como aceito. DA-5 também segue aberta e não afeta este plano.
- **Limite conhecido:** fechar o NAVEGADOR inteiro mata o service worker sem aviso; a varredura do boot do 08-25 cobre a próxima abertura.
- **TEM QUE CRIAR `GEMINI_API_KEY` NO RAILWAY** antes de qualquer deploy, merge na master/main ou junção com o AGM.
- **NÃO distribuir build da Taqciti** antes do teste manual D-20 (08-21, passo i: fechar a aba no meio da call numa reunião vinculada e ver a sessão encerrada no web app em poucos segundos, com o 08-25 ligado).
- TAQ-02 NÃO foi marcado como concluído (a fase tem planos pendentes); `requirements-completed: []`.

## Known Stubs

None.

## Threat Flags

None. T-08-55 (custo ocioso por aba fechada sem aviso) mitigado pela Task 2; T-08-56 (aba errada encerrar a reunião errada) mitigado pelo teste de `session.tabId === tabId` com aba de outra reunião e `tabId` nulo.

## Self-Check: PASSED

- FOUND: taqciti/src/background/meetingTabClosed.ts, meetingTabClosed.test.ts, meetingTabClosedFlow.test.ts
- FOUND commits: 7bceba2, c063b02
