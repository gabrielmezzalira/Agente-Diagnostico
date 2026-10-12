---
phase: 08-taqciti-session-association
plan: 25
subsystem: taqciti-extension-close-wiring
status: complete
tags: [taqciti, chrome-extension, session-finish, decision-b4b, alarms, mv3, triggers]

requires:
  - phase: 08-taqciti-session-association
    provides: "08-27: agendador agenteSessionFinisher (evaluate, handleAlarm, rescheduleAfterRestart, configureAgenteSessionFinisher com falha segura); 08-24: regra da reentrada; 08-26: aba fechada = fim da reunião (meetingTabClosed); 08-16: elegibilidade isEligibleForClose; 08-22: ciclo de vida da associação"
provides:
  - "Permissão alarms no manifesto (decisão B4-b), com comentário do motivo"
  - "isMeetingLive(state, meetingId): predicado puro e testado, ao lado de isLivePhase"
  - "chrome.alarms.onAlarm.addListener síncrono no topo do index.ts; configureAgenteSessionFinisher({ isMeetingLive }) antes dos listeners; rescheduleAfterRestart na cadeia ready, sem esperar"
  - "Gatilhos do encerramento: fim ou preempção da reunião (sem esperar), onSettled do envio em partes (concluído, parado ou vínculo ao vivo pronto) e injeção em produção"
  - "chrome.alarms simulado em installChromeStorageMock"
affects: [08-20, 08-21]

actuals:
  tokens: 6900
  tasks: 2
  commits: 2

plan_head_before: 7e7ac54c8043e8b15217015571d7125976b77c8b
plan_head_after: e9eb1674dbd31af46b915cad87569129cdb59d2e

tech-stack:
  added: []
  patterns:
    - "Listener de alarme no nível de topo do service worker, handler espera `ready` por dentro (exigência do MV3)"
    - "Aviso fire-and-forget com erro só no log (mesmo desenho do ciclo de vida da associação): gatilhos nunca esperam o agendador"
    - "Dependência opcional onSettled em BindUploadDeps, injetada na composição de produção; resumeSend (08-20) herda o aviso sem código novo"

key-files:
  created:
    - taqciti/src/background/agenteFinishTriggers.test.ts
  modified:
    - taqciti/manifest.config.ts
    - taqciti/src/background/index.ts
    - taqciti/src/background/agenteAssociationLifecycle.ts
    - taqciti/src/background/agenteAssociationLifecycle.test.ts
    - taqciti/src/background/agenteBindUpload.ts
    - taqciti/src/background/agenteAssociation.ts
    - taqciti/src/test/chromeStorageMock.ts

key-decisions:
  - "Decisão B4-b CONSOLIDADA aplicada sem nova parada; DA-4 e DA-5 continuam em aberto e nada foi implementado sobre elas"
  - "runBindUpload chama o aviso de fim num finally em volta do envio (renomeado internamente para uploadParts): vale também quando o envio lança, e a associação já reflete o desfecho"
  - "O aviso do ciclo de vida é disparado depois de aplicar meeting-ended mesmo quando o reducer devolve a mesma associação (linked); a remoção por 0 falas e a associação ausente não avisam"

requirements-completed: []

coverage:
  - id: D1
    description: "A permissão alarms está no manifesto e o build gera o manifesto com ela"
    requirement: TAQ-02
    verification:
      - kind: other
        ref: "grep fora de comentários em taqciti/manifest.config.ts -> 1; npm run build -> dist/manifest.json contém alarms"
        status: pass
    human_judgment: false
  - id: D2
    description: "isMeetingLive é puro e correto: mesma reunião e fase ao vivo; falso para ended, idle, outra reunião e sessão nula"
    requirement: TAQ-02
    verification:
      - kind: unit
        ref: "taqciti/src/background/agenteAssociationLifecycle.test.ts#isMeetingLive: a reunião pedida está ao vivo agora?"
        status: pass
    human_judgment: false
  - id: D3
    description: "Fim da reunião vinculada, preempção, ended-unsent e aba fechada (08-26) avisam o agendador uma vez; 0 falas e sem associação não avisam; o aviso não espera nem derruba (evaluate que nunca resolve ou rejeita)"
    requirement: TAQ-02
    verification:
      - kind: unit
        ref: "taqciti/src/background/agenteFinishTriggers.test.ts#fim e preempção da reunião avisam o agendador; #aba da reunião fechada"
        status: pass
    human_judgment: false
  - id: D4
    description: "O envio em partes avisa o encerramento nos três desfechos (concluído, parado, vínculo ao vivo pronto, este depois de onLinked) e nunca falha por causa do aviso"
    requirement: TAQ-02
    verification:
      - kind: unit
        ref: "taqciti/src/background/agenteFinishTriggers.test.ts#fim do envio em partes avisa o encerramento (onSettled, B4-b)"
        status: pass
    human_judgment: false
  - id: D5
    description: "A sessão é de fato encerrada no backend, de ponta a ponta, com o Chrome real: ao terminar a reunião, 5 minutos depois com o envio parado, no boot, e nunca durante a reunião ao vivo"
    requirement: TAQ-02
    human_judgment: true
    rationale: "Depende do Chrome real (alarme que acorda o service worker, reinício do navegador) e do backend com a rota de finish (08-15) no ar; é o roteiro manual D-20 do 08-21."

duration: 12min
completed: 2026-10-12
---

# Phase 8 Plan 25: Fiação do encerramento automático da sessão (B4-b) Summary

Liga o agendador do 08-27 ao service worker: permissão `alarms` no manifesto, listener `chrome.alarms.onAlarm` síncrono no topo do `index.ts`, predicado puro `isMeetingLive`, varredura no boot e os gatilhos (fim ou preempção da reunião, fim do envio em partes e vínculo concluído) que avisam o agendador sem esperar e sem derrubar nada. Daqui em diante a Taqciti passa a encerrar sozinha as sessões que criou.

**Duração:** cerca de 12 min (termina 2026-10-12T20:01Z) · **Tasks:** 2 · **Arquivos:** 8 (1 novo, 7 alterados)

## O que foi feito

| Task | Commit | O que |
|------|--------|-------|
| 1 | `ae59a40` | `feat(08-25)`: `'alarms'` em `permissions` com comentário; `isMeetingLive` exportado ao lado de `isLivePhase` (2 testes); `index.ts` com `configureAgenteSessionFinisher({ isMeetingLive })` antes de tudo, `chrome.alarms.onAlarm.addListener` no nível de topo e `rescheduleAfterRestart` na cadeia `ready` com `void`; `chromeStorageMock` ganha `alarms` (create, clear, get) |
| 2 | `e9eb167` | `feat(08-25)`: `closeFinishedMeeting` chama `agenteSessionFinisher.evaluate` sem esperar (erro só no log); `runBindUpload` ganha `onSettled` opcional, chamado ao final em todos os desfechos; `agenteAssociation.ts` injeta `onSettled`; `agenteFinishTriggers.test.ts` com 15 testes |

Cada commit é reversível sozinho. Rollback na ordem inversa: `git revert e9eb167` (os gatilhos saem, o agendador volta a ficar inerte) e depois `git revert ae59a40` (sai a permissão, o listener e a varredura do boot). Alarmes já criados no Chrome de quem testou expiram sozinhos ou somem ao remover a extensão.

## Verificação

- RED visto nas duas tasks: `isMeetingLive is not a function` (2 falhas) na Task 1 e 11 falhas de 15 na Task 2, antes do código.
- Testes do plano: `npx vitest run src/background/agenteFinishTriggers.test.ts src/background/agenteAssociationLifecycle.test.ts src/background/agenteSessionFinisherInstance.test.ts src/background/agenteBindFlow.test.ts` -> **4 arquivos, 90 testes passando**. Task 1: `agenteAssociationLifecycle` + `agenteStreamerAssociation` -> 42 passando.
- Portão do plano: `npm test` -> **85 arquivos, 1264 testes passando**; `npm run typecheck`, `npm run lint` e `npm run build` sem erro (o `dist/manifest.json` contém `alarms`).
- Greps do `<verify>`: permissão fora de comentários = 1; listener de alarme na coluna 1 = 1; `rescheduleAfterRestart()` = 1; `configureAgenteSessionFinisher(` = 1; `await agenteSessionFinisher` no ciclo de vida = 0; `awk 'FNR == 201'` sem saída.
- Tamanhos: `agenteBindUpload.ts` 140, `agenteAssociation.ts` 80, `agenteAssociationLifecycle.ts` 162 linhas. `index.ts` (240 para 251) e `manifest.config.ts` (199 para 203) já estavam no limite antes da fase (dívida anterior) e só ganharam o mínimo. `package.json` e `package-lock.json` sem diff (T-08-SC).
- O ponta a ponta com Chrome e backend reais é o roteiro D-20 do 08-21.

## Deviations from Plan

Nenhuma de regra 1 a 4. Observações:

- O plano diz que `runBindUpload` chama o aviso "ao final"; implementei com um `try/finally` em volta do corpo (movido para `uploadParts`), de modo que o aviso também sai se o envio lançar. Não muda nenhum caso do `<behavior>`.
- Descoberta nos testes: depois de `link-failed` com sessão já criada a associação vira `send-failed` (e não `deferred`); a expectativa do teste foi ajustada ao reducer real, sem mudar código de produção.
- Como `onSettled` e `evaluate` são fire-and-forget, os testes esperam o efeito com `vi.waitFor` (não há como `await` o que de propósito não é esperado).

## Decisões em aberto (herdadas, NÃO bloqueiam este plano)

- **DA-4** (aba que navega para outro site sem fechar) e **DA-5** (depois de desistir de encerrar nada mais encerra, nem no boot) continuam em aberto; nada foi implementado sobre elas. O 08-21 deve listá-las como **PENDÊNCIA DO TIME**, nunca como aceitas. Opção recomendada da DA-5: `nova-rodada-no-boot`.
- Com `minimum_chrome_version` 116, o alarme tem intervalo mínimo de 1 min no Chrome 116-119 e 30 s do 120 em diante; o prazo de 5 minutos vale com até 1 minuto de atraso do Chrome.

## Lembretes obrigatórios (herdados da fase)

> **TEM QUE CRIAR `GEMINI_API_KEY` NO RAILWAY** antes de qualquer deploy, merge na `master`/`main` ou junção com o AGM (resposta B2 = `aprovar-sem-env`). O executor nunca lê `.env`; nada foi deployado.

- **NÃO distribuir build da Taqciti antes do teste manual D-20** (roteiro do 08-21). Com este plano a Taqciti passa a mexer sozinha em sessões do backend, e a permissão `alarms` precisa ser conferida no teste de atualização (não deve gerar aviso).
- **A rota backend de finish (08-15) precisa estar no ar antes de distribuir a Taqciti**; sem ela o finish dá 404 (que o agendador trata como "nada a encerrar", mas a sessão ficaria aberta no web app).
- Risco T-08-10 segue aceito pelo Time Antonio até o login do AGM.
- `TAQ-02` NÃO foi marcado como concluído neste plano (instrução do orquestrador).

## Auth Gates

Nenhum.

## Known Stubs

Nenhum.

## Threat Flags

Nenhum além do modelo do plano: T-08-33 (permissão `alarms`, aceita), T-08-52 (mitigada: listener no topo, boot, `configureAgenteSessionFinisher`, `isMeetingLive` testado, gatilhos testados) e T-08-53 (mitigada: avisos sem esperar, testes com `evaluate` que nunca resolve e `onSettled` que rejeita). Nenhum pacote novo.

## Self-Check: PASSED

- FOUND: `taqciti/src/background/agenteFinishTriggers.test.ts` e os demais arquivos listados em key-files
- FOUND commits: ae59a40, e9eb167 (ancestrais de HEAD)
