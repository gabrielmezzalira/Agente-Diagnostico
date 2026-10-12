---
phase: 08-taqciti-session-association
plan: 16
subsystem: taqciti-extension-close-foundation
status: complete
tags: [taqciti, chrome-extension, session-finish, decision-b4b, reducer, backoff, zod]

requires:
  - phase: 08-taqciti-session-association
    provides: "08-15: rota POST /webhook/extension/sessions/{id}/finish (200 {id,status}, 404, 409) e B4-b consolidada; 08-12: httpAgenteJson/httpSessionGateway; 08-22/08-23: carryIdentity e política de reenvio como estilo; 08-01: reducer da associação"
provides:
  - "finishPolicy.ts: AGENTE_STALLED_SEND_CLOSE_MS (5 min), AGENTE_FINISH_POLL_MS (30 s), AGENTE_FINISH_DRAIN_GRACE_MS (10 s), AGENTE_FINISH_DRAIN_CHECK_MS (1 s), AGENTE_FINISH_MAX_TRIES (11), AGENTE_FINISH_ALARM_PREFIX, backoffAfterFailure, nextCheckAt, SessionFinisherPort, AgenteFinishError"
  - "associationClose.ts: reduceCloseFlow (session-finished, finish-armed, finish-failed) e isEligibleForClose; a associação ganha sessionFinished, finishBy, finishTries e finishGaveUp"
  - "carryIdentity (associationSend.ts) leva os quatro campos; lista branca do store (normalizeClose) os grava e os relê num reinício"
  - "createHttpSessionFinisher (httpSessionGateway.ts): POST do finish com erro tipado retryable/não-retryable"
affects: [08-20, 08-21, 08-24, 08-25, 08-26, 08-27]

actuals:
  tokens: 7866
  tasks: 3
  commits: 3

plan_head_before: c6c834b90492cdaacb0d3e0f51c570ddfe67ba0d
plan_head_after: 6cd66dd55e1a2afa537e5ad9a626c4482f929f35

tech-stack:
  added: []
  patterns:
    - "Constantes de decisão do time fixadas por teste de valor de produção (mesmo desenho do B3-b em sendRetryPolicy.ts)"
    - "Reducer dividido por arquivo (associationClose.ts, como associationSend.ts) para manter cada arquivo abaixo de 200 linhas; transição inválida devolve a MESMA referência"
    - "Porta HTTP com erro tipado: AgenteFinishError { retryable, httpStatus }, id validado como UUID antes de montar a URL, mensagens só com status (nunca corpo nem chave)"

key-files:
  created:
    - taqciti/src/features/agente/finishPolicy.ts
    - taqciti/src/features/agente/finishPolicy.test.ts
    - taqciti/src/features/agente/associationClose.ts
    - taqciti/src/features/agente/associationClose.test.ts
  modified:
    - taqciti/src/features/agente/association.ts
    - taqciti/src/features/agente/associationSend.ts
    - taqciti/src/shared/config/agenteAssociationStore.ts
    - taqciti/src/shared/config/agenteAssociationStore.test.ts
    - taqciti/src/background/httpSessionGateway.ts
    - taqciti/src/background/httpAgentePorts.test.ts

key-decisions:
  - "B4-b aplicada como já respondida (sem nova parada): 5 min com envio parado, reconferência de 30 s, 10 s para a última fala em voo; a janela de 10 min do RESEARCH está superada"
  - "O prazo de 5 min conta do PRIMEIRO momento em que a Taqciti vê o envio parado (finish-armed devolve a mesma referência quando já há finishBy) — Claude's Discretion do plano, reversível"
  - "Backoff com duas pistas (30 s a 8 min; 30 min a 8 h), 11 tentativas, total de cerca de 16 h (15 h 30 min + 15 min 30 s) — Claude's Discretion do plano"
  - "finish-failed em associação já desistida/encerrada devolve a mesma referência: depois de desistir, nenhuma contagem nem gravação nova (T-08-49)"
  - "Só origin 'picker' é elegível; sessão do plano B (manual-id) nunca é encerrada pela Taqciti (T-08-30 do 08-15)"

requirements-completed: []

coverage:
  - id: D1
    description: "Os tempos da B4-b ficam em constantes nomeadas fixadas por teste, com backoff limitado (a 11ª falha desiste) e nextCheckAt"
    requirement: TAQ-02
    verification:
      - kind: unit
        ref: "taqciti/src/features/agente/finishPolicy.test.ts#AGENTE_STALLED_SEND_CLOSE_MS vale cinco minutos"
        status: pass
      - kind: unit
        ref: "taqciti/src/features/agente/finishPolicy.test.ts#tabela inteira: 30 s, 1, 2, 4, 8 min, depois 30 min, 1, 2, 4, 8 h"
        status: pass
    human_judgment: false
  - id: D2
    description: "A associação guarda sessionFinished, finishBy (só o primeiro prazo), finishTries e finishGaveUp; carryIdentity os leva entre estados; a lista branca do store os mantém num reinício; desistida ou esgotada deixa de ser elegível"
    requirement: TAQ-02
    verification:
      - kind: unit
        ref: "taqciti/src/features/agente/associationClose.test.ts#finish-armed e #finish-failed e #isEligibleForClose e #integração com reduceAssociation e carryIdentity"
        status: pass
      - kind: unit
        ref: "taqciti/src/shared/config/agenteAssociationStore.test.ts#prazo, tentativas e desistência gravados voltam iguais depois de um reinício"
        status: pass
    human_judgment: false
  - id: D3
    description: "A porta HTTP do finish distingue o que repetir (rede, timeout, 408/429/5xx, corpo inválido) do que não repetir (401/403 e demais 4xx), trata 404/409 como gone e valida o UUID antes de montar a URL"
    requirement: TAQ-02
    verification:
      - kind: unit
        ref: "taqciti/src/background/httpAgentePorts.test.ts#createHttpSessionFinisher.finishSession (B4-b, plano 08-16)"
        status: pass
    human_judgment: false
  - id: D4
    description: "O encerramento automático funcionando de ponta a ponta com o Chrome e o backend (agendador, fiação e permissão alarms são dos planos 08-27 e 08-25)"
    requirement: TAQ-02
    human_judgment: true
    rationale: "Este plano é só o alicerce inerte; o comportamento real depende do agendador (08-27) e é exercitado no roteiro D-20 do 08-21."
---

# Phase 8 Plan 16: Alicerce do encerramento da sessão (B4-b) Summary

Alicerce inerte do encerramento decidido na B4-b: os tempos (5 min com envio parado, 30 s, 10 s e backoff de 11 tentativas) fixados por teste em `finishPolicy.ts`, a associação guardando `sessionFinished`/`finishBy`/`finishTries`/`finishGaveUp` com `reduceCloseFlow` e `isEligibleForClose`, e `createHttpSessionFinisher` chamando a rota do 08-15 e distinguindo falha passageira de recusa definitiva.

**Duração:** cerca de 8 min (2026-10-12T19:14:56Z a 19:22Z) · **Tasks:** 3 · **Arquivos:** 10 (4 novos, 6 alterados)

## O que foi feito

| Task | Commit | O que |
|------|--------|-------|
| 1 | `9413abf` | `feat(08-16)`: `finishPolicy.ts` (95 linhas) com as constantes B4-b, `backoffAfterFailure`, `nextCheckAt`, `SessionFinisherPort`, `AgenteFinishError`; 11 testes, entre eles o que fixa os cinco minutos e a tabela inteira do backoff |
| 2 | `5baf1b7` | `feat(08-16)`: `associationClose.ts` (3 eventos + elegibilidade), quatro campos opcionais e três eventos em `association.ts` (195 linhas), `carryIdentity` levando os quatro, `normalizeClose` na lista branca do store; 52 testes novos em `associationClose.test.ts` e 3 de ida e volta no store |
| 3 | `6cd66dd` | `feat(08-16)`: `createHttpSessionFinisher` (zod no corpo do 200, UUID validado antes da URL); 21 casos novos de tabela por status |

Cada commit é reversível sozinho e nenhum comportamento existente da Taqciti mudou: nada fora dos próprios módulos usa as peças novas (conferido por `grep`). Os casos do 08-01 e do 08-22 (`association.test.ts`, 53 testes) seguem verdes sem alteração.

## Verificação

- Testes do plano: `npx vitest run src/features/agente/finishPolicy.test.ts src/features/agente/associationClose.test.ts src/features/agente/association.test.ts src/shared/config/agenteAssociationStore.test.ts src/background/httpAgentePorts.test.ts` verdes (finishPolicy 11; associationClose 52; association 53; store 15; httpAgentePorts 43).
- Portão do plano: `npm test` -> **75 arquivos, 1139 testes passando**; `npm run typecheck` e `npm run lint` sem erros.
- RED confirmado antes de cada GREEN: Task 1 falhou na importação do módulo inexistente; Task 2 falhou na coleta de `associationClose.test.ts` e em 3 testes do store; Task 3 falhou com `createHttpSessionFinisher is not a function`.
- Todos os arquivos abaixo de 200 linhas (`awk 'FNR == 201'` sem saída; `association.ts` 195, store 186, `httpSessionGateway.ts` 102). `package.json` e `package-lock.json` sem diff (T-08-SC).
- O ponta a ponta com o Chrome e o backend é o roteiro D-20 do 08-21, depois da fiação do 08-25.

## Deviations from Plan

None - plano executado como escrito. Observações (não são desvios):

- `association.ts` terminou com 195 linhas (limite 200): não foi preciso mover `reduceLinkFailed`. Quem acrescentar mais campos ou eventos ali (08-24, 08-20) provavelmente precisará mover `reduceLinkFailed` para `associationSend.ts` num commit mecânico anterior.
- `finish-failed` e `finish-armed` usam a mesma noção de "elegível para reducer" (`isOpenForClose`: sessionId, sem encerramento, sem desistência, estado linked/sent/send-failed), sem exigir `origin`; a regra da origem `picker` mora só em `isEligibleForClose`, como o `<behavior>` do plano descreve.
- A porta não faz retry nem backoff: apenas classifica (`retryable`); o laço de espera é do agendador do 08-27, que usa `backoffAfterFailure`.

## Decisões em aberto (herdadas, NÃO bloqueiam este plano)

- **DA-4 e DA-5 continuam em aberto.** Sem resposta, nada foi implementado sobre elas. Sobre a DA-5: depois de desistir (cerca de 16 h de falha de rede/5xx, ou recusa definitiva 401/403/4xx) nada mais encerra a sessão sozinho; o 08-21 deve listar isto como **PENDÊNCIA DO TIME**, nunca como aceito. A opção recomendada pelo plano é `nova-rodada-no-boot`.

## Lembretes obrigatórios (herdados da fase)

> **TEM QUE CRIAR `GEMINI_API_KEY` NO RAILWAY** antes de qualquer deploy, merge na `master`/`main` ou junção com o AGM (resposta B2 = `aprovar-sem-env`). Sem ela, projetos sem chave própria não rodam o pipeline de IA. O executor nunca lê `.env`; nada foi deployado e não houve migração nesta tarefa.

- **NÃO distribuir build da Taqciti antes do teste manual D-20** (roteiro do 08-21).
- Risco T-08-10 segue aceito pelo Time Antonio até o login do AGM (rotas de escrita da extensão sob gate opt-in).
- Rollback: reverter na ordem inversa `git revert 6cd66dd`, depois `5baf1b7`, depois `9413abf`. Como o alicerce é inerte, reverter não muda o que a Taqciti faz hoje; campos já gravados em associações de teste são ignorados pela lista branca anterior.
- `TAQ-02` NÃO foi marcado como concluído neste plano (instrução do orquestrador: só o último plano da fase que o declara).

## Auth Gates

Nenhum.

## Known Stubs

Nenhum. As peças são intencionalmente inertes (sem chamador) até o agendador do 08-27 e a fiação do 08-25; isto não é stub, é o escopo deste plano.

## Threat Flags

Nenhum. A superfície nova (chamada ao finish) é a coberta por T-08-32, T-08-48 e T-08-49 do `<threat_model>`: tempos fixados por teste, UUID validado antes da URL, backoff limitado com `finishGaveUp` tornando a associação inelegível. Sem pacote novo.

## Self-Check: PASSED

- FOUND: `taqciti/src/features/agente/finishPolicy.ts`, `finishPolicy.test.ts`, `associationClose.ts`, `associationClose.test.ts`; `createHttpSessionFinisher` em `httpSessionGateway.ts`
- FOUND commits: 9413abf, 5baf1b7, 6cd66dd (ancestrais de HEAD)
