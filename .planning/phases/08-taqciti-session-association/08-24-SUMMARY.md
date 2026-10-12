---
phase: 08-taqciti-session-association
plan: 24
subsystem: taqciti-extension-meeting-rejoin
status: complete
tags: [taqciti, chrome-extension, association, rejoin, decision-b4b, da-1, meeting-machine, startFresh]

requires:
  - phase: 08-taqciti-session-association
    provides: "08-01: reducer da associação; 08-16: marcas de encerramento (sessionFinished, finishBy, finishTries, finishGaveUp); 08-22: ciclo de vida e recuperação no boot; 08-27: agendador do encerramento (isClosing)"
provides:
  - "associationMeeting.ts: BEFORE_LINK, reduceMeetingEnded e reduceMeetingResumed (com a regra da reentrada depois do encerramento e o cancelamento do prazo na volta)"
  - "recoverAssociationsAfterRestart: associação encerrada ou com prazo pendurado de uma reunião ao vivo recebe meeting-resumed"
  - "MEETING_DETECTED.startFresh (opcional) na máquina da reunião"
  - "shouldStartFreshMeeting (agenteFreshStart.ts) e a linha no case 'meet/detected' do index.ts"
affects: [08-20, 08-21, 08-25, 08-26]

actuals:
  tokens: 14000
  tasks: 3
  commits: 3

plan_head_before: 5995dcd486e291ea578ee8e9f2322a26f9734db6
plan_head_after: 8330d0b08c36379d8908618b40dafb2deb919131

tech-stack:
  added: []
  patterns:
    - "Refator mecânico em commit separado do commit de comportamento (CLAUDE.md): primeiro mover, depois mudar"
    - "Campo opcional no evento da máquina (startFresh) calculado fora dela por um hook com dependências injetáveis; a máquina continua pura"
    - "Defesa em duas camadas: a máquina abre a reunião nova e, por corrida, o reducer ainda devolve a associação encerrada a pending"

key-files:
  created:
    - taqciti/src/features/agente/associationMeeting.ts
    - taqciti/src/features/agente/associationMeeting.test.ts
    - taqciti/src/background/agenteFreshStart.ts
    - taqciti/src/background/agenteFreshStart.test.ts
    - taqciti/src/features/meeting/machineStartFresh.test.ts
  modified:
    - taqciti/src/features/agente/association.ts
    - taqciti/src/background/agenteAssociationLifecycle.ts
    - taqciti/src/background/agenteAssociationLifecycle.test.ts
    - taqciti/src/features/meeting/machine.ts
    - taqciti/src/background/index.ts

key-decisions:
  - "DA-1 = reuniao-nova-de-verdade aplicada sem nova parada: a volta depois do encerramento é reunião nova (novo meetingId, segmentos vazios, associação pending); antes do encerramento a retomada do 08-22 continua"
  - "Um finish em voo (isClosing) conta como encerrada na decisão de startFresh: a captura nunca espera por ele"
  - "A volta sem encerramento cancela o prazo (finishBy, finishTries, finishGaveUp somem), com a mesma referência quando não havia nada a limpar"

requirements-completed: []

coverage:
  - id: D1
    description: "Associação cuja sessão do Agente foi encerrada nunca volta a ficar linking, linked ou sending ligada a ela: a volta à sala devolve pending limpo em qualquer estado com sessão"
    requirement: TAQ-02
    verification:
      - kind: unit
        ref: "taqciti/src/features/agente/associationMeeting.test.ts#reduceMeetingResumed com a sessão do Agente encerrada"
        status: pass
      - kind: unit
        ref: "taqciti/src/background/agenteAssociationLifecycle.test.ts#volta à mesma sala depois do encerramento da sessão do Agente"
        status: pass
    human_judgment: false
  - id: D2
    description: "Reentrar antes do encerramento continua como o 08-22 entregou e cancela o prazo; ended-unsent e linking ficam como estavam"
    requirement: TAQ-02
    verification:
      - kind: unit
        ref: "taqciti/src/features/agente/associationMeeting.test.ts#reduceMeetingResumed sem sessionFinished e #cancela o prazo de encerramento"
        status: pass
      - kind: unit
        ref: "taqciti/src/background/agenteAssociationLifecycle.test.ts#retomada da mesma sala (D-06, T-08-41)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Depois de um reinício do service worker nenhuma associação encerrada fica ligada a uma reunião ao vivo e nenhum prazo velho sobrevive; a associação encerrada de reunião que não está ao vivo não muda"
    requirement: TAQ-02
    verification:
      - kind: unit
        ref: "taqciti/src/background/agenteAssociationLifecycle.test.ts#recuperação no boot do service worker (casos da reunião ao vivo com sessionFinished e prazo)"
        status: pass
    human_judgment: false
  - id: D4
    description: "A máquina trata a volta como reunião nova só com startFresh; sem o campo a máquina da Fase 7 é idêntica (machine.test.ts sem alteração)"
    requirement: TAQ-02
    verification:
      - kind: unit
        ref: "taqciti/src/features/meeting/machineStartFresh.test.ts"
        status: pass
      - kind: unit
        ref: "taqciti/src/features/meeting/machine.test.ts (inalterado)"
        status: pass
    human_judgment: false
  - id: D5
    description: "shouldStartFreshMeeting só lê o storage em fase ended com a mesma sala; sessionFinished ou finish em voo valem como encerrada; ended-unsent não"
    requirement: TAQ-02
    verification:
      - kind: unit
        ref: "taqciti/src/background/agenteFreshStart.test.ts"
        status: pass
      - kind: unit
        ref: "taqciti/src/background/agenteAssociationLifecycle.test.ts#com startFresh (a máquina real)"
        status: pass
    human_judgment: false
  - id: D6
    description: "Voltar à mesma sala depois do encerramento no Chrome real mostra a bolha '!' de reunião nova e a escolha do cliente cria uma sessão NOVA só com o que foi dito depois da volta"
    requirement: TAQ-02
    human_judgment: true
    rationale: "Ponta a ponta com Chrome, Meet e backend: é o roteiro manual D-20 do 08-21, depois da fiação do 08-25."
---

# Phase 8 Plan 24: Reentrada na mesma sala depois do encerramento = reunião nova Summary

Depois que a sessão do Agente foi encerrada (ou o encerramento está em voo), voltar à mesma sala abre uma reunião NOVA: a máquina cria novo `meetingId` com segmentos vazios (campo opcional `startFresh` em `MEETING_DETECTED`), a associação nova nasce `pending` e a antiga fica no histórico intocada. Quem volta ANTES do encerramento continua na mesma sessão, como o 08-22 entregou, e a volta cancela o prazo de encerramento. O reducer e a recuperação do boot garantem que nenhuma associação encerrada volte a ficar ligada à sessão fechada.

**Duração:** cerca de 25 min · **Tasks:** 3 · **Arquivos:** 10 (5 novos, 5 alterados)

## Decisões do time (respondidas em 2026-10-12)

Registro literal, conforme `08-DECISOES-PENDENTES.md` (confirmado por `grep` antes da Task 3: `reuniao-nova-de-verdade` e `fechar-aba-encerra` presentes, uma ocorrência cada):

- **DA-1 = `reuniao-nova-de-verdade`:** novo registro no histórico, nova associação e sessão só com o que for dito depois da volta. Implementada neste plano (Tasks 1 e 3).
- **DA-2 = `continuar-com-aviso`:** "A sessão no Agente já foi encerrada. O restante entra na transcrição, mas o relatório precisa ser gerado de novo." Implementada no plano 08-20 e na cópia do UI-SPEC (nada neste plano).
- **DA-3 = `fechar-aba-encerra`:** fechar a aba da reunião no meio da call conta como fim da reunião. Implementada no plano 08-26 (muda um handler da Fase 7; nada neste plano).

DA-4 e DA-5 continuam em aberto e não bloqueiam este plano.

Nota de ordem: o `grep` de registro foi rodado antes de a Task 3 ser commitada, mas este arquivo só foi escrito depois dos três commits de código (o plano pede o registro "ao escrever o SUMMARY"). A resposta já estava versionada no arquivo de decisões, então nada foi decidido sem ela.

## O que foi feito

| Task | Commit | O que |
|------|--------|-------|
| 1 (refator) | `3fa9fc9` | `refactor(08-24)`: `BEFORE_LINK`, `reduceMeetingEnded` e `reduceMeetingResumed` saem de `association.ts` (195 para 168 linhas) para `associationMeeting.ts`; o novo arquivo importa só TIPOS; nenhum teste alterado (73 testes verdes sem mudança) |
| 1 (comportamento) | `93ef1ce` | `feat(08-24)`: `sessionFinished` + volta em sending/linked/sent/send-failed devolve `{ meetingId, state: 'pending' }`; sem a marca, o 08-22 fica e a volta limpa `finishBy`/`finishTries`/`finishGaveUp` (mesma referência se nada a limpar); boot emite `meeting-resumed` para a associação da reunião ao vivo com marca de encerramento ou prazo |
| 2 | (neste SUMMARY) | Registro das respostas DA-1, DA-2 e DA-3 (seção acima), sem código |
| 3 | `8330d0b` | `feat(08-24)`: `startFresh?: boolean` em `MEETING_DETECTED` e o ramo de retomada exige que não seja verdadeiro; `shouldStartFreshMeeting` (`agenteFreshStart.ts`, 37 linhas); `index.ts` calcula `startFresh` antes do dispatch |

Cada commit é reversível sozinho. Para voltar atrás: `git revert 8330d0b`, depois `93ef1ce`, depois `3fa9fc9` (ordem inversa).

## Verificação

- Testes do plano: `npx vitest run` dos seis arquivos (`associationMeeting`, `association`, `agenteAssociationLifecycle`, `machineStartFresh`, `machine`, `agenteFreshStart`) -> 6 arquivos, **154 testes passando**. `machine.test.ts` e `association.test.ts` rodam sem nenhuma alteração.
- Portão do plano: `npm test` -> **82 arquivos, 1226 testes passando**; `npm run typecheck` e `npm run lint` sem erros.
- RED confirmado no commit de comportamento da Task 1 (8 falhas do reducer e 5 do ciclo de vida antes da implementação). Na Task 3 os testes foram escritos antes do código, mas o código foi escrito antes da primeira execução, então não houve execução vermelha registrada ali.
- Tamanhos: `association.ts` 168, `associationMeeting.ts` 60, `agenteAssociationLifecycle.ts` 145, `agenteFreshStart.ts` 37 (`awk 'FNR == 201'` sem saída). `machine.ts` +3 linhas e `index.ts` +3 linhas, nenhuma removida (`git show --numstat`). `machine.test.ts` não aparece no commit; `package.json` e `package-lock.json` sem diff (T-08-SC).

## Deviations from Plan

Nenhuma de regra 1 a 4. Observações:

- **Recuperação do boot (`recoveryEvents`):** em vez de editar cada `case`, a função ganhou uma camada que acrescenta `meeting-resumed` quando a reunião está ao vivo e a associação tem marca de encerramento ou prazo e o caso não emitiu esse evento ainda. Cobre também `sending` com sessão (que antes só virava `send-failed`). Mesmo comportamento do `<behavior>` do plano; o arquivo ficou com 145 linhas.
- **Armadilha de teste (não é bug de produção):** duas chamadas a `recover()` no mesmo teste reaproveitam o cache do store (o `vi.resetModules()` é por teste); os casos foram separados em testes próprios.
- **Fim de linha:** `machine.ts` está em CRLF no índice do git, então as três linhas foram acrescentadas em CRLF (o diff ficou em 3 linhas, não no arquivo inteiro).
- `.planning/config.json` continua modificado (só fim de linha, não relacionado) e NÃO foi commitado.

## Riscos residuais (do plano)

- Corrida de milissegundos: se a pessoa volta no instante em que o finish está sendo disparado (antes de `isClosing` ficar verdadeiro), a máquina retoma a mesma reunião; quando o finish termina o agendador (08-27) avisa a associação e o reducer a devolve a `pending` (nunca `linked` com a sessão fechada), mas nesse caso raro a sessão nova receberia a transcrição inteira.
- Custo aceito pelo time: reentrada por engano (clicou "finalizar" sem querer e voltou em 3 s depois de a sessão ter sido encerrada) vira reunião nova e a pessoa escolhe o cliente de novo.
- Este plano NÃO liga o encerramento em produção: o gatilho que encerra a sessão ao fim da reunião é a fiação do 08-25. Até lá `sessionFinished` só aparece se algo chamar o agendador, então a regra nova fica inerte na prática.

## Lembretes obrigatórios (herdados da fase)

> **TEM QUE CRIAR `GEMINI_API_KEY` NO RAILWAY** antes de qualquer deploy, merge na `master`/`main` ou junção com o AGM (resposta B2 = `aprovar-sem-env`). Sem ela, projetos sem chave própria não rodam o pipeline de IA. O executor nunca lê `.env`; nada foi deployado e não houve migração nesta tarefa.

- **NÃO distribuir build da Taqciti antes do teste manual D-20** (roteiro do 08-21). O passo manual deste plano: terminar uma reunião vinculada, esperar a sessão aparecer encerrada no web app, voltar à mesma sala em até 10 min -> aparece a bolha "!" de reunião nova; escolher o cliente cria uma sessão NOVA só com o que foi dito depois da volta.
- `TAQ-02` NÃO foi marcado como concluído neste plano (instrução do orquestrador: só o último plano da fase que o declara).
- Risco T-08-10 segue aceito pelo Time Antonio até o login do AGM.

## Threat Flags

Nenhum: não há endpoint, caminho de autenticação nem acesso a arquivo novos; a mudança é local à extensão. T-08-50 (fala da reunião nova na sessão encerrada) e T-08-51 (captura atrasada pela leitura do storage) mitigados como no plano.

## Known Stubs

Nenhum.

## Self-Check: PASSED

- Arquivos: `associationMeeting.ts`, `associationMeeting.test.ts`, `agenteFreshStart.ts`, `agenteFreshStart.test.ts`, `machineStartFresh.test.ts` presentes.
- Commits `3fa9fc9`, `93ef1ce` e `8330d0b` presentes no histórico da branch.
