---
phase: 08-taqciti-session-association
plan: 20
subsystem: taqciti-resume-send
status: complete
tags: [taqciti, chrome-extension, resume-send, decision-b3, decision-da2, chunk-id, side-panel]

requires:
  - phase: 08-taqciti-session-association
    provides: "08-09/08-19: chunk_id determinístico e dedup no backend (B3-a); 08-10: fluxo de envio da reunião encerrada; 08-05: runMeetingUpload com startAt; 08-17: AgenteEndSlot; 08-24: regra da reentrada com sessionFinished; 08-25: onSettled em runBindUpload (encerramento B4-b)"
provides:
  - "Evento send-resumed no reducer: send-failed com sessionId volta a sending, preserva sessão e progresso, limpa erro, finishBy e finishTries e mantém sessionFinished"
  - "resumeSend(meetingId) no fluxo de vínculo, com a validação em agenteBindResume.ts (prepareResume): mesma sessão, startAt = sendProgress.done, sem recriar sessão"
  - "Comando ui/agente/meeting/resume-send (schema, case de uma linha no index.ts, repasse em agenteAssociation e no service, ação resumeSend no hook)"
  - "Botão 'Continuar envio' na visão failed do cartão de fim (regra de 3 estados) e o aviso da DA-2 quando a sessão já foi encerrada"
affects: [08-21]

actuals:
  tokens: 11100
  tasks: 3
  commits: 3

plan_head_before: 7ef0d57ffd7e33dae89833d0bc787ed81670c66d
plan_head_after: f1885297002656b0782af88409bdcc6ffd45e818

tech-stack:
  added: []
  patterns:
    - "Validação do comando separada do envio (agenteBindResume.ts) para o fluxo ficar abaixo de 200 linhas"
    - "startUpload único no fluxo: bind e resumeSend disparam o envio em segundo plano pelo mesmo caminho"
    - "Estado derivado na visão (sessionClosed vem de sessionFinished em toEndPromptView); o componente continua apresentacional"

key-files:
  created:
    - taqciti/src/background/agenteBindResume.ts
  modified:
    - taqciti/src/features/agente/association.ts
    - taqciti/src/features/agente/associationSend.ts
    - taqciti/src/features/agente/association.test.ts
    - taqciti/src/background/agenteBindFlow.ts
    - taqciti/src/background/agenteBindFlow.test.ts
    - taqciti/src/background/agenteBindUpload.ts
    - taqciti/src/background/agenteAssociation.ts
    - taqciti/src/background/agenteAssociationService.ts
    - taqciti/src/background/index.ts
    - taqciti/src/shared/types/agenteMessages.ts
    - taqciti/src/shared/hooks/useMeetingAssociation.ts
    - taqciti/src/features/agente/bindingView.ts
    - taqciti/src/features/agente/bindingView.test.ts
    - taqciti/src/sidepanel/components/AgenteEndPrompt.tsx
    - taqciti/src/sidepanel/components/AgenteEndPrompt.test.tsx
    - taqciti/src/sidepanel/components/AgenteEndSlot.tsx
    - taqciti/src/sidepanel/components/AgenteEndSlot.test.tsx

key-decisions:
  - "B3 resolvida (B3-a = aprovar-chunk-id, registrada no 08-09): a retomada reaproveita o chunk_id bulk:{reunião}:{índice} e o backend recusa duplicata; a parte em voo na falha não duplica"
  - "DA-2 = continuar-com-aviso (2026-10-12) implementada como estava respondida: 'Continuar envio' segue valendo com a sessão encerrada e o cartão mostra a linha exata do UI-SPEC; nenhuma pergunta nova ao time"
  - "Regra de 3 estados da mensagem 'Envio parou': com onResume = botão no lugar da linha de apoio; sem onResume = linha de apoio; com sessionClosed = aviso warning extra acima do botão (ou da linha de apoio)"
  - "Retomar mantém finishGaveUp se existir (o plano só manda limpar finishBy e finishTries): backend que recusou o encerramento de forma definitiva não é testado de novo sem decisão do time"
  - "Configuração desligada ou URL inválida ao pedir a retomada responde 'unavailable' (não 'create-session', que mentiria sobre a causa); nada muda no estado"

requirements-completed: []

coverage:
  - id: D1
    description: "send-resumed leva send-failed com sessão a sending preservando sessão e progresso, sem finishBy/finishTries/erro e com sessionFinished mantido; outros estados e send-failed sem sessão devolvem a mesma referência"
    requirement: TAQ-02
    verification:
      - kind: unit
        ref: "taqciti/src/features/agente/association.test.ts#retomar o envio parado (send-resumed, plano 08-20)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Retomar envia só as partes depois da última confirmada (posições 6..29 de 30), para a mesma sessão, sem criar outra, com chunk_id bulk:m2:6..29 e termina em sent com a semente inteira"
    requirement: TAQ-02
    verification:
      - kind: unit
        ref: "taqciti/src/background/agenteBindFlow.test.ts#continuar o envio parado (plano 08-20, B3) > retoma da 7ª parte"
        status: pass
    human_judgment: false
  - id: D3
    description: "Recusas: ao vivo, pending e sent -> invalid-state; sem associação ou sem registro -> not-found; dois comandos simultâneos -> um ok e um invalid-state, cada parte uma vez; nova falha volta a send-failed com o novo progresso"
    requirement: TAQ-02
    verification:
      - kind: unit
        ref: "taqciti/src/background/agenteBindFlow.test.ts#recusas, #dois comandos simultâneos, #nova falha na retomada"
        status: pass
    human_judgment: false
  - id: D4
    description: "Retomar cancela o prazo de 5 min da B4-b; com a sessão já encerrada o envio continua, sessionFinished fica, a associação nunca vira elegível a novo encerramento e a volta à sala durante o envio devolve pending limpo"
    requirement: TAQ-02
    verification:
      - kind: unit
        ref: "taqciti/src/background/agenteBindFlow.test.ts#responde antes de o envio acabar e cancela o prazo; #sessão já encerrada pela B4-b; #a sala volta durante o envio retomado"
        status: pass
      - kind: unit
        ref: "taqciti/src/features/agente/association.test.ts#sessão encerrada: a volta à sala durante o envio retomado devolve pending limpo"
        status: pass
    human_judgment: false
  - id: D5
    description: "O comando ui/agente/meeting/resume-send é validado pelo schema, roteado pelo case de uma linha e atendido pelo fluxo; o hook expõe resumeSend()"
    requirement: TAQ-02
    verification:
      - kind: unit
        ref: "taqciti/src/background/agenteBindFlow.test.ts#comando ui/agente/meeting/resume-send; taqciti/src/sidepanel/components/AgenteEndSlot.test.tsx (um resume-send via hook)"
        status: pass
      - kind: other
        ref: "grep -c \"case 'ui/agente/meeting/resume-send'\" taqciti/src/background/index.ts -> 1"
        status: pass
    human_judgment: false
  - id: D6
    description: "O cartão de fim mostra 'Continuar envio' na falha (um clique = um comando, mesmo com clique duplo), a linha exata da DA-2 só com sessionClosed e nada extra sem ela"
    requirement: TAQ-02
    verification:
      - kind: unit
        ref: "taqciti/src/sidepanel/components/AgenteEndPrompt.test.tsx; AgenteEndSlot.test.tsx; taqciti/src/features/agente/bindingView.test.ts#send-failed com sessionFinished marca sessionClosed"
        status: pass
    human_judgment: false
  - id: D7
    description: "Retomada de ponta a ponta com o Chrome e o backend reais: derrubar a rede no meio do envio de uma reunião longa, voltar, clicar em 'Continuar envio' e conferir que o Agente recebe cada fala uma vez; repetir com a sessão já encerrada (envio parado há mais de 5 min) e ler o aviso da DA-2"
    requirement: TAQ-02
    human_judgment: true
    rationale: "Depende do Chrome real, do backend com a dedup por chunk_id (migration do 08-19) aplicada no banco e da rota de finish (08-15); é o roteiro manual D-20 do 08-21."

duration: 22min
completed: 2026-10-12
---

# Phase 8 Plan 20: "Continuar envio" do envio em partes parado (B3, DA-2) Summary

Uma reunião encerrada cujo envio parou no meio (por exemplo, na parte 7 de 30) agora ganha o botão "Continuar envio": a Taqciti retoma da última parte confirmada, para a mesma sessão, sem criar outra e sem reenviar o que já chegou (o `chunk_id` determinístico da B3 cobre até a parte que estava em voo). Se a Taqciti já tinha encerrado a sessão por envio parado (B4-b), o botão continua valendo e o cartão avisa, por decisão do time (DA-2), que o relatório precisa ser gerado de novo.

**Duração:** cerca de 22 min · **Tasks:** 3 · **Arquivos:** 18 (1 novo, 17 alterados)

## O que foi feito

| Task | Commit | O que |
|------|--------|-------|
| 1 | `9eb2c06` | `feat(08-20)`: evento `send-resumed` (em `associationSend.ts`, ligado por `association.ts`); `resumeSend` no fluxo com a validação em `agenteBindResume.ts`; `runBindUpload` ganha `startAt` opcional; `bind` e `resumeSend` disparam o envio por um único `startUpload`. 14 testes novos (reducer e fluxo) |
| 2 | `e2bddf7` | `feat(08-20)`: comando `ui/agente/meeting/resume-send` no schema; case de uma linha no `index.ts`; repasse em `agenteAssociation.ts` e no service; ação `resumeSend()` no hook |
| 3 | `f188529` | `feat(08-20)`: `AgenteEndPrompt` com `onResume` e `sessionClosed`; `toEndPromptView` marca `sessionClosed` com `sessionFinished`; `AgenteEndSlot` passa `onResume` com trava contra clique duplo; testes dos três grupos |

Cada commit é reversível sozinho. Rollback na ordem inversa: `git revert f188529` (o botão e o aviso somem; a reunião volta a ficar em "Envio parou" com os dados intactos), depois `git revert e2bddf7` (some o comando) e `git revert 9eb2c06` (some o evento e o `resumeSend`).

## Verificação

- RED visto em cada task antes do código (15 falhas do reducer na Task 1).
- Testes do plano: `npx vitest run src/features/agente/association.test.ts src/background/agenteBindFlow.test.ts` -> passando (13 arquivos de `features/agente` + bind flow: 318 testes). `npx vitest run src/sidepanel/components/AgenteEndPrompt.test.tsx src/sidepanel/components/AgenteEndSlot.test.tsx src/features/agente/bindingView.test.ts` -> **3 arquivos, 58 testes passando**.
- Portão do plano: `npm test` -> **85 arquivos, 1294 testes passando**; `npm run typecheck`, `npm run lint` e `npm run build` sem erro.
- Teste semente do plano: falha na parte 7 de 30 -> `resumeSend` -> chunk_ids `bulk:m2:6` a `bulk:m2:29` enviados (24 POSTs), nada antes, 1 sessão só.
- Tamanhos: `agenteBindFlow.ts` 199, `agenteBindResume.ts` 62, `associationSend.ts` 77, `association.ts` 171, `AgenteEndPrompt.tsx` 179, `AgenteEndSlot.tsx` 155 linhas (todos abaixo de 200). `package.json` e `package-lock.json` sem diff (T-08-SC).

## Deviations from Plan

**1. [Rule 3 - Bloqueio] Arquivos fora da lista `files_modified`**
- **Encontrado na Task 1/2:** `startAt` precisava chegar ao executor e o service precisava expor o comando.
- **Correção:** `agenteBindUpload.ts` ganhou o parâmetro opcional `startAt = 0` (os chamadores antigos não mudam); `agenteAssociationService.ts` ganhou a linha `resumeSend` delegando ao fluxo; `associationSend.ts` recebeu a transição (mantém `association.ts` abaixo de 200 linhas); `agenteBindResume.ts` (novo) guarda a validação para o fluxo não passar de 200 linhas (regra do CLAUDE.md).
- **Commits:** 9eb2c06, e2bddf7.

Nenhuma de regra 1, 2 ou 4. Observações:

- Os testes de roteamento da Task 2 passam pelo `agenteAssociation` real com portas injetadas por `configureAgenteAssociation` (a função só troca portas, não o fluxo; um "flow falso" não é injetável sem mudar a composição).
- Se o comando de retomar for recusado (por exemplo, `unavailable`), o cartão simplesmente continua como está e a pessoa pode tentar de novo; o plano não pediu cópia de erro para esse caso e nenhuma foi inventada.
- Testes novos entraram em arquivos de teste já longos (`agenteBindFlow.test.ts` agora com 834 linhas), seguindo "estender testes existentes" do CLAUDE.md. Fica como dívida de organização, não de comportamento.

## Decisões do time aplicadas / em aberto

- **B3** (aprovar-chunk-id) e **DA-2** (continuar-com-aviso) estavam respondidas e foram só aplicadas. B3-b = `retirada-nunca` por falta de resposta, sem efeito neste plano.
- **DA-4** e **DA-5** continuam em aberto e nada foi implementado sobre elas. O 08-21 deve listá-las como PENDÊNCIA DO TIME.
- Suposição registrada no plano e mantida: texto acrescentado a uma fala depois de ela já ter sido confirmada não é reenviado na retomada (as partes são por índice). Com `chunk_id`, no pior caso a parte em voo na falha pode ser reenviada e o backend a recusa como duplicata (suposição A9).
- `finishGaveUp` não é limpo pela retomada (só `finishBy` e `finishTries`, como o plano manda). Se isso for indesejado, é decisão do time.

## Lembretes obrigatórios (herdados da fase)

> **TEM QUE CRIAR `GEMINI_API_KEY` NO RAILWAY** antes de qualquer deploy, merge na `master`/`main` ou junção com o AGM (resposta B2 = `aprovar-sem-env`). O executor nunca lê `.env`; nada foi deployado.

- **NÃO distribuir build da Taqciti antes do teste manual D-20** (roteiro do 08-21). A retomada depende da migration de dedup por `chunk_id` (08-19) estar aplicada no banco de produção, senão uma retomada pode duplicar a parte em voo.
- **A rota backend de finish (08-15) precisa estar no ar antes de distribuir a Taqciti.**
- `TAQ-02` NÃO foi marcado como concluído neste plano (o 08-21 ainda o declara).

## Auth Gates

Nenhum.

## Known Stubs

Nenhum.

## Threat Flags

Nenhum além do modelo do plano. T-08-39 (retomada duplicando partes) mitigada: `startAt = sendProgress.done`, `chunk_id` determinístico, só `send-failed` com sessão e reunião não ao vivo, trava síncrona contra comando duplo, tudo com teste. Nenhum pacote novo (T-08-SC).

## Self-Check: PASSED

- FOUND: `taqciti/src/background/agenteBindResume.ts` e os demais arquivos listados em key-files
- FOUND commits: 9eb2c06, e2bddf7, f188529 (ancestrais de HEAD)
