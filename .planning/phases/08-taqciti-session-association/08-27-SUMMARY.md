---
phase: 08-taqciti-session-association
plan: 27
subsystem: taqciti-extension-close-scheduler
status: complete
tags: [taqciti, chrome-extension, session-finish, decision-b4b, scheduler, alarms, backoff, outbox-kick]

requires:
  - phase: 08-taqciti-session-association
    provides: "08-16: finishPolicy (constantes B4-b, backoffAfterFailure, nextCheckAt, AgenteFinishError), associationClose (isEligibleForClose e eventos session-finished/finish-armed/finish-failed) e createHttpSessionFinisher; 08-23: fila durável com sender.kick(); 08-11: countOutboxItemsForSession; 08-22/08-24: regra da reentrada (meeting-resumed)"
provides:
  - "kickAgenteSender (agenteStreamer.ts): nova tentativa de entrega da fila durável em qualquer estado da reunião, pelo mesmo portão canDrain da política ativa"
  - "waitForQueueDrain (agenteSessionFinisherDrain.ts): espera a fila da sessão esvaziar até a graça de 10 s"
  - "createAgenteSessionFinisher (agenteSessionFinisherInstance.ts): evaluate, handleAlarm, rescheduleAfterRestart e isClosing, só com portas injetadas"
  - "agenteSessionFinisher e configureAgenteSessionFinisher (agenteSessionFinisher.ts): composição de produção com falha segura (isMeetingLive assume 'ao vivo')"
affects: [08-20, 08-21, 08-24, 08-25, 08-26]

actuals:
  tokens: 10800
  tasks: 3
  commits: 3

plan_head_before: b9584e6c80ec88050c8fca9a300ef41bdb710f6b
plan_head_after: 39b28ee19f8e632a3af090a8b8c688c4fdde6a2e

tech-stack:
  added: []
  patterns:
    - "Agendador como fábrica de portas injetadas (sem chrome) + raiz de composição com objeto que delega e configure(partial), o mesmo desenho de agenteStreamer.ts e agenteAssociation.ts"
    - "Uma avaliação por reunião por vez: chamadas simultâneas do mesmo id compartilham a mesma promessa; isClosing só enquanto a chamada ao backend está em voo"
    - "Falha segura por padrão: sem a configuração de 'está ao vivo?' o agendador assume 'ao vivo' e não encerra ninguém"

key-files:
  created:
    - taqciti/src/background/agenteSessionFinisherDrain.ts
    - taqciti/src/background/agenteSessionFinisherDrain.test.ts
    - taqciti/src/background/agenteSessionFinisherInstance.ts
    - taqciti/src/background/agenteSessionFinisherInstance.test.ts
    - taqciti/src/background/agenteSessionFinisher.ts
    - taqciti/src/background/agenteSessionFinisher.test.ts
    - taqciti/src/background/agenteStreamerKick.test.ts
  modified:
    - taqciti/src/background/agenteStreamer.ts
    - taqciti/src/background/agenteStreamerInstance.ts

key-decisions:
  - "Decisão B4-b CONSOLIDADA aplicada sem nova parada: encerra na hora com a fila vazia (espera até 10 s pela última fala), prazo de 5 min com envio parado, reconferência a cada 30 s com kick dedicado do envio"
  - "O prazo de 5 min é armado DEPOIS da graça de 10 s (momento em que a fila é vista parada); só o primeiro prazo vale (finish-armed devolve a mesma referência quando já há finishBy) — Claude's Discretion, reversível"
  - "Em send-failed não há espera de esvaziamento nem kick: arma o prazo na hora e reconfere a cada 30 s (conforme o plano)"
  - "Acréscimo defensivo (não estava no plano): a reunião é conferida de novo antes de armar o prazo, porque a espera pela fila dura até 10 s; se a sala voltou ao vivo nesse intervalo, nenhum prazo é gravado (evita um finishBy velho no passado quando a reunião terminar de novo)"
  - "Erro que não é AgenteFinishError conta como falha retryable; só AgenteFinishError com retryable=false vira recusa definitiva (finishGaveUp)"
  - "Log só com meetingId e attempts (a lista de chaves permitidas do logger não inclui sessionId)"

requirements-completed: []

coverage:
  - id: D1
    description: "O kick dedicado do envio alcança a fila durável com outra reunião ao vivo (pending) e com a última reunião em sent/send-failed, respeita o portão canDrain e não mexe em status, cursor nem janela"
    requirement: TAQ-02
    verification:
      - kind: unit
        ref: "taqciti/src/background/agenteStreamerKick.test.ts#kickAgenteSender: nova tentativa da fila durável em qualquer estado da reunião"
        status: pass
    human_judgment: false
  - id: D2
    description: "Encerra na hora com a fila vazia, espera a última fala em voo (graça de 10 s), arma o prazo de 5 min com a fila parada ou send-failed e encerra antes do prazo quando a fila esvazia"
    requirement: TAQ-02
    verification:
      - kind: unit
        ref: "taqciti/src/background/agenteSessionFinisherDrain.test.ts#waitForQueueDrain"
        status: pass
      - kind: unit
        ref: "taqciti/src/background/agenteSessionFinisherInstance.test.ts#encerrar na hora (B4-b) e #fila parada: prazo de 5 minutos (B4-b)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Falha do finish repete com a tabela de espera e, na 11ª falha ou recusa definitiva, desiste sem laço: nenhuma avaliação posterior nem a varredura do boot chama o finish de novo"
    requirement: TAQ-02
    verification:
      - kind: unit
        ref: "taqciti/src/background/agenteSessionFinisherInstance.test.ts#falha, repetição e desistência (T-08-49) e #(n) boot"
        status: pass
    human_judgment: false
  - id: D4
    description: "Nunca encerra com a reunião ao vivo, nem sessão do plano B, nem duas vezes ao mesmo tempo; a composição de produção assume 'ao vivo' até o index.ts configurar"
    requirement: TAQ-02
    verification:
      - kind: unit
        ref: "taqciti/src/background/agenteSessionFinisherInstance.test.ts#(b), (d), (m), (o), (r)"
        status: pass
      - kind: unit
        ref: "taqciti/src/background/agenteSessionFinisher.test.ts#sem configurar isMeetingLive (padrão de produção) -> assume ao vivo e NÃO chama o finish"
        status: pass
    human_judgment: false
  - id: D5
    description: "O encerramento automático funcionando de ponta a ponta com o Chrome e o backend (fiação, permissão alarms e gatilhos são do plano 08-25)"
    requirement: TAQ-02
    human_judgment: true
    rationale: "Este plano entrega o agendador INERTE; o comportamento real depende da fiação do 08-25 e é exercitado no roteiro D-20 do 08-21."
---

# Phase 8 Plan 27: Agendador do encerramento da sessão (B4-b) Summary

Agendador inerte do encerramento decidido na B4-b: para cada reunião encerra a sessão na hora com a fila de envio vazia (esperando até 10 s pela última fala), arma o prazo de 5 min com o envio parado (reconfere a cada 30 s e pede nova tentativa de entrega), repete o finish com a tabela de espera do 08-16 e desiste sem laço; nunca encerra com a reunião ao vivo nem sessão do plano B. Junto vem o `kickAgenteSender`, que dá nova tentativa à fila durável em qualquer estado da reunião.

**Duração:** cerca de 12 min (2026-10-12T19:23Z a 19:35Z) · **Tasks:** 3 · **Arquivos:** 9 (7 novos, 2 alterados)

## O que foi feito

| Task | Commit | O que |
|------|--------|-------|
| 1 | `0535660` | `feat(08-27)`: `kickAgenteSender()` em `agenteStreamer.ts` (relê a config, usa o mesmo `canDrain` da política ativa, não passa por `reevaluate` nem `resume`); o instance só expõe `kick: sender.kick` (continua com 299 linhas); comentário de `whenAgenteStreamerIdle` atualizado; 6 testes novos |
| 2 | `1391bfa` | `feat(08-27)`: `waitForQueueDrain` (28 linhas) e `createAgenteSessionFinisher` (149 linhas) com `evaluate`, `handleAlarm`, `rescheduleAfterRestart` e `isClosing`; 4 testes do drain e 19 do agendador (casos (a) a (r) do plano mais um extra) |
| 3 | `39b28ee` | `feat(08-27)`: `agenteSessionFinisher.ts` (65 linhas), composição de produção com falha segura, adaptador de `chrome.alarms` e delegação à instância ativa; 7 testes |

Cada commit é reversível sozinho. O agendador é inerte (nada o chama), então reverter não muda o que a Taqciti faz hoje.

## Verificação

- Testes do plano: `npx vitest run src/background/agenteStreamerKick.test.ts src/background/agenteSessionFinisherDrain.test.ts src/background/agenteSessionFinisherInstance.test.ts src/background/agenteSessionFinisher.test.ts` verdes (kick 6; drain 4; agendador 19; composição 7). Os testes existentes `agenteOutbox`, `agenteStreamerAssociation` e `agenteStreamer` passaram sem alteração (72 testes nos quatro arquivos da Task 1).
- Portão do plano: `npm test` -> **79 arquivos, 1175 testes passando**; `npm run typecheck` e `npm run lint` sem erros.
- Tamanhos: `agenteStreamerInstance.ts` 299 linhas (limite 300); arquivos de produção novos 28, 149 e 65 linhas (`awk 'FNR == 201'` sem saída). `package.json` e `package-lock.json` sem diff (T-08-SC).
- RED confirmado na Task 1 (6 falhas com `kickAgenteSender is not a function`) e na Task 2 (o teste do agendador pegou um defeito real do teste, ver abaixo). Nas Tasks 2 (drain) e 3 os testes foram escritos antes do código, mas o código foi escrito antes da primeira execução, então não houve uma execução vermelha registrada nesses dois.
- O ponta a ponta com o Chrome e o backend é o roteiro D-20 do 08-21, depois da fiação do 08-25.

## Deviations from Plan

Nenhuma de regra 1 a 4. Observações:

- **Acréscimo defensivo (Rule 2, dentro da própria Task 2):** o agendador confere `isMeetingLive` de novo antes de armar o prazo de 5 min (a espera pela fila pode durar até 10 s). Sem isso, uma sala que voltasse ao vivo nesse intervalo ficaria com um `finishBy` velho gravado, e o próximo fim de reunião encerraria sem a graça. Há teste próprio. Não muda nenhum caso do `<behavior>` do plano.
- **Armadilha de teste (não é bug de produção):** depois de `vi.resetModules()` a classe `AgenteFinishError` importada estaticamente no teste é outra que a do agendador, e o `instanceof` falha; o teste importa a classe do mesmo registro. Em produção há um único módulo.
- O `kickAgenteSender` retorna logo depois de empurrar a fila: a fala só sai dela quando o Agente confirma (os testes esperam isso com `vi.waitFor`, porque `whenAgenteStreamerIdle` não espera a resposta de rede, como documentado).
- `agenteSessionFinisherInstance.test.ts` tem 295 linhas (os arquivos de teste não entram no limite de 200 da checagem do plano; o limite vale para os arquivos de produção).

## Decisões em aberto (herdadas, NÃO bloqueiam este plano)

- **DA-4 e DA-5 continuam em aberto.** Sem resposta, nada foi implementado sobre elas. Sobre a DA-5: depois de desistir (cerca de 16 h de falha de rede/5xx, ou recusa definitiva 401/403/4xx) nada mais encerra a sessão sozinho, nem na varredura do boot; o 08-21 deve listar isto como **PENDÊNCIA DO TIME**, nunca como aceito. A opção recomendada é `nova-rodada-no-boot`.
- Limite conhecido (do plano): se a URL do backend for trocada depois do vínculo, o finish vai ao backend novo e recebe 404, que conta como "nada a encerrar".

## Lembretes obrigatórios (herdados da fase)

> **TEM QUE CRIAR `GEMINI_API_KEY` NO RAILWAY** antes de qualquer deploy, merge na `master`/`main` ou junção com o AGM (resposta B2 = `aprovar-sem-env`). Sem ela, projetos sem chave própria não rodam o pipeline de IA. O executor nunca lê `.env`; nada foi deployado e não houve migração nesta tarefa.

- **NÃO distribuir build da Taqciti antes do teste manual D-20** (roteiro do 08-21).
- **Este plano NÃO liga o agendador em produção.** A fiação (listener de `chrome.alarms.onAlarm`, a permissão `alarms` no manifesto, o gatilho de fim de reunião, a varredura do boot e a configuração de `isMeetingLive`) é do plano 08-25. Até lá `chrome.alarms` nunca é tocado e, mesmo que alguém chame `evaluate`, o padrão assume "ao vivo" e não encerra nada.
- Risco T-08-10 segue aceito pelo Time Antonio até o login do AGM (rotas de escrita da extensão sob gate opt-in).
- Rollback: reverter na ordem inversa `git revert 39b28ee`, depois `1391bfa`, depois `0535660`.
- `TAQ-02` NÃO foi marcado como concluído neste plano (instrução do orquestrador: só o último plano da fase que o declara).

## Auth Gates

Nenhum.

## Known Stubs

Nenhum. O agendador é intencionalmente inerte (sem chamador) até a fiação do 08-25, e `isMeetingLive` padrão "ao vivo" é a falha segura documentada, não um stub esquecido.

## Threat Flags

Nenhum. A superfície nova (chamada automática ao finish) é a coberta por T-08-32, T-08-49 e T-08-54: espera da última fala + prazo de 5 min, `isEligibleForClose` em toda avaliação (inclusive no boot), backoff limitado com `finishGaveUp`, e padrão "ao vivo" até o `index.ts` configurar. Sem pacote novo.

## Self-Check: PASSED

- FOUND: `agenteSessionFinisherDrain.ts`, `agenteSessionFinisherInstance.ts`, `agenteSessionFinisher.ts`, `agenteStreamerKick.test.ts` e os três testes novos em `taqciti/src/background/`; `kickAgenteSender` em `agenteStreamer.ts`
- FOUND commits: 0535660, 1391bfa, 39b28ee (ancestrais de HEAD)
