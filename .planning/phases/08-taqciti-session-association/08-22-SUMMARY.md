---
phase: 08-taqciti-session-association
plan: 22
subsystem: taqciti-service-worker
tags: [taqciti, chrome-extension, service-worker, vitest, state-machine, association-lifecycle]

requires:
  - phase: 08-taqciti-session-association
    provides: "08-01: reducer e store de associações (created, meeting-ended, meeting-resumed); 08-10: fluxo de vínculo que resolve o fim de um linking"
provides:
  - "syncAssociationLifecycle(prev, next): pending ao detectar (idempotente), ended-unsent ao terminar ou ser preemptada, remoção se a reunião acabou sem falas, meeting-resumed só para a MESMA sala"
  - "recoverAssociationsAfterRestart(state): nenhuma associação fica presa depois de um reinício do service worker"
  - "Fiação mínima: 2 linhas em sessionController.ts e 2 em index.ts"
affects: [08-17, 08-18, 08-20, 08-23]

actuals:
  tokens: 5700
  tasks: 2
  commits: 3

plan_head_before: 3722b565ec2726fab784a7cff8c03f3fa0b4c245
plan_head_after: 136002e39df8a6315b1041b7e534a03335f45a73

tech-stack:
  added: []
  patterns:
    - "O reducer decide, o módulo só dispara eventos: ciclo de vida em funções pequenas (resumeMeeting, closeFinishedMeeting, createForLiveMeeting) e recuperação como tabela pura estado -> eventos (recoveryEvents)"
    - "Fire-and-forget com log no sessionController, igual ao padrão da Fase 7: a associação nunca atrasa nem derruba o dispatch"
    - "Recuperação do boot nunca rejeita: falha de leitura ou de uma associação vai para o log e não quebra a cadeia ready do service worker"

key-files:
  created:
    - taqciti/src/background/agenteAssociationLifecycle.ts
    - taqciti/src/background/agenteAssociationLifecycle.test.ts
  modified:
    - taqciti/src/background/sessionController.ts
    - taqciti/src/background/index.ts
    - taqciti/src/background/agenteStreamer.test.ts

key-decisions:
  - "A chamada de syncAssociationLifecycle fica no INÍCIO de runSideEffects (o plano dizia no fim): é fire-and-forget, não atrasa nada, e assim uma falha em upsertRecord/bumpMetrics mais abaixo não faz a associação perder a transição de fim ou de retomada"
  - "recoverAssociationsAfterRestart captura os próprios erros (leitura e por associação): um throw dela cairia no .catch da cadeia ready e pularia ensurePanelPrefs"
  - "sending sem sessionId numa reunião que está ao vivo (sala retomada com o SW dormindo): send-failed e em seguida meeting-resumed, para não ficar em ended-unsent sem bolha (o erro e o cliente escolhido se perdem; a pessoa escolhe de novo)"
  - "Reunião sem falas tem a associação removida só em pending/choosing/deferred; linking/linked nunca são apagados (Claude's Discretion registrado no plano)"

requirements-completed: []

coverage:
  - id: D1
    description: "Reunião detectada com o envio ligado ganha UMA pending; 5 polls repetidos não criam nem regravam (1 gravação da chave); com o envio desligado nada nasce e ligar no meio cria no próximo dispatch"
    requirement: TAQ-02
    verification:
      - kind: integration
        ref: "taqciti/src/background/agenteAssociationLifecycle.test.ts#criação da associação ao detectar a reunião (D-04)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Fim e preempção: pending/choosing/deferred -> ended-unsent; 0 falas remove; linking e linked não mudam; outra sala preemptando cria m2 pending e deixa m1 ended-unsent"
    requirement: TAQ-02
    verification:
      - kind: integration
        ref: "taqciti/src/background/agenteAssociationLifecycle.test.ts#fim da reunião e preempção (D-09)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Retomada só da MESMA sala: ended-unsent volta a pending sem associação nova; sent volta a linked com a mesma sessão e a semente; sala diferente cria associação nova sem mexer na anterior (T-08-41)"
    requirement: TAQ-02
    verification:
      - kind: integration
        ref: "taqciti/src/background/agenteAssociationLifecycle.test.ts#retomada da mesma sala (D-06, T-08-41)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Falha na gravação da associação não impede o dispatch de devolver o estado novo; o erro vai para o log (T-08-42)"
    requirement: TAQ-02
    verification:
      - kind: integration
        ref: "taqciti/src/background/agenteAssociationLifecycle.test.ts#falha no ciclo de vida nunca derruba o dispatch (T-08-42)"
        status: pass
    human_judgment: false
  - id: D5
    description: "Recuperação no boot: linking/sending com e sem sessionId, pendentes de reunião encerrada, ended-unsent e sent da reunião ao vivo, estados que não mudam"
    requirement: TAQ-02
    verification:
      - kind: integration
        ref: "taqciti/src/background/agenteAssociationLifecycle.test.ts#recuperação no boot do service worker (D-04, Pitfall 10)"
        status: pass
    human_judgment: false
  - id: D6
    description: "Bolha '!' e barra de vínculo aparecendo de verdade numa reunião real do Meet, e o reinício do service worker no meio de um vínculo"
    requirement: TAQ-02
    verification: []
    human_judgment: true
    rationale: "Nenhum teste automático abre o Meet nem reinicia o service worker de verdade; só o teste manual D-20 prova a cadeia com as telas montadas."

duration: ~12min
completed: 2026-10-12
status: complete
---

# Phase 8 Plan 22: Ciclo de vida da associação dirigido pela máquina da reunião Summary

**Agora toda reunião detectada com o envio ligado ganha sozinha a sua associação `pending` (uma só, mesmo com o poll repetindo a cada 1,5 s), vira `ended-unsent` quando termina sem cliente, volta a um estado ao vivo coerente quando a mesma sala é retomada, e o boot do service worker recupera qualquer estado intermediário — tudo sem nunca atrasar a gravação.**

## Performance

- **Duration:** ~12 min
- **Tasks:** 2 (um commit de feature por task, mais 1 commit de ajuste de teste)
- **Files:** 2 criados, 3 alterados (`sessionController.ts` +2 linhas, `index.ts` +2 linhas, `agenteStreamer.test.ts` +2/-1); `package.json` e `package-lock.json` sem diff

## Accomplishments

- **Ciclo de vida (Task 1):** `syncAssociationLifecycle(prev, next)` roda três regras em ordem: retomada (`prev` em `ended`, `next` ao vivo, mesmo `meetingId` -> `meeting-resumed`), fim/preempção (`meeting-ended`, ou remoção se 0 falas e estado pending/choosing/deferred) e criação (ao vivo + envio ligado + sem entrada -> `created`). `sessionController.ts` chama sem esperar, com log de erro.
- **Recuperação (Task 2):** `recoverAssociationsAfterRestart(state)` usa a tabela pura `recoveryEvents`: `linking` sem sessão -> `deferred` com `create-session` (ou `ended-unsent` se a reunião não está ao vivo); `linking`/`sending` com sessão -> `send-failed`; `sending` sem sessão -> `ended-unsent` com erro; pendentes de reunião encerrada -> `ended-unsent`; `ended-unsent`/`sent` da reunião ao vivo -> `meeting-resumed`. Elo único em `index.ts`, depois de `recoverInterruptedMeetings`.
- **Testes:** `agenteAssociationLifecycle.test.ts` com 20 casos (dispatch real da máquina + storage simulado).
- **Gate do plano:** `cd taqciti && npm test` (68 arquivos, 973 testes), `npm run typecheck` e `npm run lint` verdes. Módulo novo com 130 linhas (abaixo de 200); awk da linha 201 não imprime nada.

## Task Commits

1. **Task 1 — syncAssociationLifecycle + chamada no sessionController:** `4fb6752`
2. **Task 2 — recoverAssociationsAfterRestart + elo no index.ts:** `8b89644`
3. **Ajuste de teste existente (consequência da Task 1):** `136002e`

**Plan metadata:** commit de docs ao final (SUMMARY + STATE + ROADMAP).

## Evidência TDD (RED -> GREEN)

- **Task 1 — RED:** o arquivo de teste falhou por import (módulo inexistente, `Failed to resolve import`), o que não é RED semântico; nenhum stub neutro foi criado. **GREEN:** 14/14 na primeira execução depois do módulo.
- **Task 2 — RED:** 5 testes falharam porque `recoverAssociationsAfterRestart` ainda não existia (`is not a function`). Um sexto caso meu estava errado (duas chamadas de `recover` no mesmo teste reusavam o cache do store) e foi dividido em dois testes. **GREEN:** 20/20.
- **Commits:** um por task (plano §2 e §5), então RED e GREEN não foram commitados separados.

## Files Created/Modified

- `taqciti/src/background/agenteAssociationLifecycle.ts` — `syncAssociationLifecycle`, `recoverAssociationsAfterRestart`, `isLivePhase` (130 linhas)
- `taqciti/src/background/agenteAssociationLifecycle.test.ts` — 20 casos
- `taqciti/src/background/sessionController.ts` — import + chamada fire-and-forget (+2 linhas)
- `taqciti/src/background/index.ts` — import + elo na cadeia `ready` (+2 linhas)
- `taqciti/src/background/agenteStreamer.test.ts` — expectativa de leituras da config 1 -> 2 (+2/-1)

## Decisions Made

Ver `key-decisions` no frontmatter.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Teste de custo de leitura da config contava um leitor só**
- **Found during:** gate do plano depois da Task 1 (`npm test`)
- **Issue:** `agenteStreamer.test.ts` ("custo: ... chamado uma única vez em vários flushes") esperava 1 leitura da chave `taq:agenteConfig`. O leitor próprio que o plano manda criar no módulo novo (`createAgenteConfigReader()`) faz a sua leitura única, então o total passou a 2.
- **Fix:** a expectativa passou para 2, com comentário (um leitor do streamer e um do ciclo de vida; nenhum cresce com os flushes). A garantia original (custo zero por flush) continua testada.
- **Files modified:** `taqciti/src/background/agenteStreamer.test.ts`
- **Commit:** `136002e`

**2. [Rule 2 - Robustez] Posição da chamada em `runSideEffects`**
- **Found during:** Task 1
- **Issue:** o plano pede a linha "no fim de `runSideEffects`", mas o corpo tem `await`s antes (histórico, métricas) dentro de um `try` do `dispatch`: se um deles lançasse, a associação perderia a transição (fim ou retomada).
- **Fix:** a linha ficou no início da função. Continua fire-and-forget (não atrasa nada) e a contagem de linhas da fiação é a mesma (2 adicionadas, 0 removidas). Não há outra mudança no arquivo.
- **Commit:** `4fb6752`

**3. [Rule 2 - Robustez] Recuperação do boot que não rejeita**
- **Found during:** Task 2
- **Issue:** uma rejeição de `recoverAssociationsAfterRestart` cairia no `.catch` da cadeia `ready` e pularia `ensurePanelPrefs`.
- **Fix:** leitura e cada associação têm `try/catch` com log (`recuperação da associação do Agente falhou`).
- **Commit:** `8b89644`

**Total deviations:** 3 (1 bug de teste existente, 2 de robustez). **Impact:** nenhum critério de aceite alterado em comportamento; `index.ts` +2 e `sessionController.ts` +2 (limite do plano: 3).

## Issues Encountered

- Aviso do git sobre LF/CRLF nos arquivos novos (config do Windows); os arquivos novos estão em LF e os antigos em CRLF, sem efeito no conteúdo.
- `.planning/config.json` (só fim de linha) e `08-DECISOES-PENDENTES.md` ficaram de fora de todos os commits, como pedido.

## Riscos que continuam abertos (para os próximos planos)

- **Reinício do service worker no meio de um envio:** a associação vai para `send-failed`/`deferred` e a tela deve oferecer a saída ("Continuar envio" é do plano 08-20); nenhum estado fica sem tela, mas o envio em partes não retoma sozinho.
- **Dois dispatches muito próximos:** os efeitos do ciclo de vida são fire-and-forget e a fila do store serializa a gravação, mas a leitura "existe associação?" pode ver o cache de um instante atrás; `created` e `meeting-*` são idempotentes no reducer, então o pior caso é um evento sem efeito, nunca uma associação duplicada.
- **Reunião retomada depois de a associação ser removida por 0 falas:** nasce uma `pending` nova (coberto por teste), com o mesmo `meetingId`.
- **B3 (chunk_id/reenvio):** este plano NÃO depende dela.

## Known Stubs

Nenhum.

## Threat Flags

Nenhum novo. T-08-41 (fala nova para a sessão errada): `meeting-resumed` só com `prev.phase === 'ended'`, `next` ao vivo e o MESMO `meetingId`; sala diferente cria associação nova, coberto por teste "sala diferente". T-08-42 (DoS): fire-and-forget com log e teste de falha simulada. T-08-SC: nenhum pacote novo (`package.json`/`package-lock.json` sem diff).

## Decisões em aberto herdadas

- **B1/B2 (já respondidas pelo time):** este plano não toca rotas nem a chave do servidor. **Lembrete obrigatório:** `GEMINI_API_KEY` AINDA NÃO existe no Railway — criar antes de qualquer deploy, merge na `master`, merge na `main` ou junção com o AGM.
- **B3, B4-b, B5, D-11:** não bloqueiam este plano.
- **Aviso herdado do 08-01:** com o 08-22, as associações passam a nascer sozinhas em produção; ainda assim não distribuir build da Taqciti antes do teste manual D-20, porque nada envia sem associação `linked` e o fechamento da fase depende dos planos seguintes.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Pronto: a bolha `!`, o cartão e a barra de vínculo (08-14) agora têm associações reais para mostrar; o fim da reunião (08-17) vê `ended-unsent`; o "Continuar envio" (08-20) parte de `send-failed`.
- Human-check pendente (D6): ver a bolha pulando numa reunião real e o estado depois de reiniciar o service worker (teste manual D-20).

## Self-Check: PASSED

- Arquivos presentes: `agenteAssociationLifecycle.ts` e `agenteAssociationLifecycle.test.ts`.
- Commits presentes no histórico: `4fb6752`, `8b89644`, `136002e`; `git rev-list --count 3722b56..HEAD` = 3 no momento da escrita.
- Acceptance: `grep -c "syncAssociationLifecycle(prev, state)" sessionController.ts` = 1 (+2 linhas, 0 removidas); `grep -c "recoverAssociationsAfterRestart(getState())" index.ts` = 1 (+2 linhas, 0 removidas); awk da linha 201 não imprime nada.
- Verificação do plano: `cd taqciti && npm test && npm run typecheck && npm run lint` verdes (68 arquivos, 973 testes).

---
*Phase: 08-taqciti-session-association*
