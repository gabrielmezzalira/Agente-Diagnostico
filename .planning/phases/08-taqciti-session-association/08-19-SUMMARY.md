---
phase: 08-taqciti-session-association
plan: 19
subsystem: taqciti-extension-sender
status: complete
tags: [taqciti, chrome-extension, outbox, chunk-id, idempotency, resend, decision-b3]

requires:
  - phase: 08-taqciti-session-association
    provides: "08-09: webhook idempotente por chunk_id + migração aplicada em produção (B3-a); 08-11: fila durável (chunkId por item); 08-23: sender com reenvio por injeção e regra B3-b; 08-10: partes com chunkId bulk:{meetingId}:{index}"
provides:
  - "buildExtensionChunkRequest(config, chunk, chunkId?): corpo com chunk_id só quando o terceiro argumento vem preenchido; sem ele o corpo continua {session_id, text, speaker}"
  - "AGENTE_SEND_CHUNK_ID = true (outbox.ts): fala ao vivo sai com o UUID gravado na fila durável; reaproveitado em todas as tentativas e depois de reinício"
  - "Envio em partes (agenteBindUpload.ts): cada parte vai com chunk_id bulk:{meetingId}:{index}"
  - "AGENTE_OUTBOX_RESEND_ENABLED = true: queda do Agente vira offline com contagem e reenvio em ordem quando ele volta (D-18, critério 4)"
affects: [08-21, 08-24, 08-25, 08-26, 08-27]

actuals:
  tokens: 4700
  tasks: 2
  commits: 2

plan_head_before: 70865f5e0d50ba8b1df5d432183a6e51cbe697d3
plan_head_after: ef55e01fd7574340ec9538651fa3d33b3833572b

tech-stack:
  added: []
  patterns:
    - "Parâmetro opcional no builder puro (chunkId?) com spread condicional: contrato antigo preservado byte a byte quando ausente"
    - "Flag de decisão (AGENTE_SEND_CHUNK_ID) exportada do módulo da fila e lida pelos dois pontos que montam request (fila ao vivo e envio em partes)"
    - "Caso do comportamento antigo passa resendEnabled: false explícito; o padrão de produção é testado sem injetar nada"

key-files:
  created: []
  modified:
    - taqciti/src/shared/config/agenteConfig.ts
    - taqciti/src/features/agente/outbox.ts
    - taqciti/src/background/agenteBindUpload.ts
    - taqciti/src/shared/config/agenteConfig.test.ts
    - taqciti/src/features/agente/outbox.test.ts
    - taqciti/src/background/agenteBindFlow.test.ts
    - taqciti/src/background/agenteStreamer.test.ts
    - taqciti/src/background/agenteOutbox.test.ts
    - taqciti/src/background/agenteSender.test.ts
    - taqciti/src/background/agenteSender.ts
    - taqciti/src/background/agenteSendSettle.ts
    - taqciti/src/background/agenteStreamerDeps.ts

key-decisions:
  - "B3-a = aprovar-chunk-id aplicada: chunk_id em toda fala ao vivo (UUID da fila durável) e em toda parte (bulk:{meetingId}:{index}); Tasks 1 e 2 executadas"
  - "B3-b = retirada-nunca mantida: este plano não mexe em AGENTE_OUTBOX_SERVER_ERROR_MAX_AGE_MS (null); o teste do 08-23 que fixa o valor segue verde sem alteração"

requirements-completed: [TAQ-02]

coverage:
  - id: D1
    description: "buildExtensionChunkRequest aceita chunkId opcional: com ele o corpo tem chunk_id; sem ele (ou vazio) o corpo é o de sempre"
    requirement: TAQ-02
    verification:
      - kind: unit
        ref: "taqciti/src/shared/config/agenteConfig.test.ts#buildExtensionChunkRequest (4 casos)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Fala ao vivo sai com o chunk_id da fila (UUID, estável entre tentativas); parte do envio em partes sai com bulk:{meetingId}:{index} na ordem, na reunião ao vivo e na encerrada"
    requirement: TAQ-02
    verification:
      - kind: unit
        ref: "taqciti/src/features/agente/outbox.test.ts#buildOutboxRequest"
        status: pass
      - kind: integration
        ref: "taqciti/src/background/agenteBindFlow.test.ts#cada parte vai com chunk_id bulk:{meetingId}:{index}, na ordem (D-19)"
        status: pass
      - kind: integration
        ref: "taqciti/src/background/agenteStreamer.test.ts#streaming ponta a ponta (chunk_id UUID)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Reenvio automático ligado no padrão de produção: Agente cai -> offline com contagem -> reinício -> volta -> reenvio na ordem com os mesmos chunk_id"
    requirement: TAQ-02
    verification:
      - kind: integration
        ref: "taqciti/src/background/agenteOutbox.test.ts#padrão de produção (sem injetar o reenvio)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Dedup real contra o Supabase (reenvio de fala já gravada não vira duplicata na transcrição) e comportamento com o backend local derrubado durante uma reunião"
    requirement: TAQ-02
    verification: []
    human_judgment: true
    rationale: "Depende do backend real e do índice único em produção; é o teste manual D-20 (b) no fim da fase."

duration: 8min
completed: 2026-10-12
---

# Phase 8 Plan 19: chunk_id na Taqciti e reenvio automático ligado Summary

**A Taqciti passa a mandar `chunk_id` em cada trecho (UUID estável da fila durável ao vivo; `bulk:{meetingId}:{index}` no envio em partes) e liga o reenvio automático: Agente fora do ar vira "offline, N falas na fila" e tudo é reenviado na ordem quando ele volta, sem duplicar.**

## Performance

- **Duration:** 8 min
- **Started:** 2026-10-12T19:04:27Z
- **Completed:** 2026-10-12T19:15:00Z
- **Tasks:** 2
- **Files modified:** 12

## Accomplishments

- `buildExtensionChunkRequest` ganhou o terceiro argumento opcional `chunkId`; o corpo só ganha `chunk_id` quando ele vem preenchido.
- `AGENTE_SEND_CHUNK_ID = true` em `outbox.ts`: `buildOutboxRequest` manda `item.chunkId` (UUID gravado uma vez na fila durável); `runBindUpload` manda `part.chunkId` (`bulk:{meetingId}:{index}`).
- `AGENTE_OUTBOX_RESEND_ENABLED = true`: com o Agente fora do ar as falas ficam guardadas, o painel mostra "fora do ar" com a contagem e o reenvio sai na ordem original, com os mesmos `chunk_id` de antes do reinício do service worker (teste semente).

## Task Commits

1. **Task 1: chunk_id no corpo (ao vivo e em partes)** - `6895da1` (feat)
2. **Task 2: liga o reenvio automático da fila durável** - `ef55e01` (feat)

**Plan metadata:** commit `docs(08-19)` logo depois deste arquivo.

_Nota TDD: em cada task os testes foram escritos e vistos falhando antes da implementação (Task 1: 5 falhas; Task 2: o teste semente falhou com o reenvio desligado). Cada task virou um único commit (testes + implementação), como o plano pede ("dois commits")._

## Files Created/Modified

- `taqciti/src/shared/config/agenteConfig.ts` - `chunkId?` opcional no builder, `chunk_id` condicional no corpo
- `taqciti/src/features/agente/outbox.ts` - `AGENTE_SEND_CHUNK_ID = true`, `AGENTE_OUTBOX_RESEND_ENABLED = true`, `buildOutboxRequest` passa `item.chunkId`
- `taqciti/src/background/agenteBindUpload.ts` - cada parte vai com `part.chunkId`
- Testes: `agenteConfig.test.ts`, `outbox.test.ts`, `agenteBindFlow.test.ts`, `agenteStreamer.test.ts`, `agenteOutbox.test.ts`, `agenteSender.test.ts`
- Comentários (sem mudança de comportamento): `agenteSender.ts`, `agenteSendSettle.ts`, `agenteStreamerDeps.ts`

## Decisions Made

- B3-a (`aprovar-chunk-id`) e B3-b (`retirada-nunca`) já vinham registradas no 08-09-SUMMARY; nada foi decidido neste plano. A regra de retirada por HTTP 500 não foi tocada: `AGENTE_OUTBOX_SERVER_ERROR_MAX_AGE_MS` segue `null`, igual ao registrado no 08-23-SUMMARY, e o teste que fixa o valor continua verde sem alteração.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] O envio em partes é montado em `agenteBindUpload.ts`, não em `agenteBindFlow.ts`**
- **Found during:** Task 1
- **Issue:** o `files_modified` do plano cita `agenteBindFlow.ts` (e a task já cita `agenteBindUpload.ts`); o request de cada parte nasce em `runBindUpload`.
- **Fix:** a alteração foi feita só em `agenteBindUpload.ts` (o `agenteBindFlow.ts` não precisou mudar); os testes ficaram em `agenteBindFlow.test.ts`.
- **Files modified:** `taqciti/src/background/agenteBindUpload.ts`
- **Committed in:** `6895da1`

**2. [Rule 3 - Blocking] Testes fora da lista do plano quebravam com o corpo novo**
- **Found during:** Task 1 (suíte completa)
- **Issue:** três casos de `agenteStreamer.test.ts` comparavam o corpo com `toEqual` sem `chunk_id`; `outbox.test.ts` fixava o corpo sem `chunk_id` e a constante do reenvio como `false`.
- **Fix:** `agenteStreamer.test.ts` espera `chunk_id` com formato UUID; `outbox.test.ts` espera `chunk_id: 'c1'`, `AGENTE_SEND_CHUNK_ID === true` e `AGENTE_OUTBOX_RESEND_ENABLED === true`. Nenhuma asserção foi enfraquecida.
- **Files modified:** `taqciti/src/background/agenteStreamer.test.ts`, `taqciti/src/features/agente/outbox.test.ts`
- **Committed in:** `6895da1` e `ef55e01`

**3. [Rule 3 - Blocking] Três comentários diziam "desligado até a B3"**
- **Found during:** Task 2
- **Issue:** o plano diz que nada além da constante muda; os comentários ficariam errados com o reenvio ligado.
- **Fix:** só texto de comentário em `agenteSender.ts`, `agenteSendSettle.ts` e `agenteStreamerDeps.ts`.
- **Committed in:** `ef55e01`

---

**Total deviations:** 3 auto-fixed (todas Rule 3)
**Impact on plan:** nenhuma muda comportamento além do que o plano pede; sem scope creep.

## Issues Encountered

Nenhum. Suíte completa da Taqciti: 73 arquivos, 1051 testes passando; `npm run typecheck` e `npm run lint` limpos. `grep -c "AGENTE_OUTBOX_RESEND_ENABLED = true"` em `outbox.ts` = 1. Nenhum pacote novo (`package.json`/`package-lock.json` sem diff).

## User Setup Required

None - no external service configuration required. Mas atenção aos lembretes abaixo.

## Lembretes obrigatórios

- **TEM QUE CRIAR `GEMINI_API_KEY` NO RAILWAY** antes de qualquer deploy, merge na `master`/`main` ou junção com o AGM.
- **NÃO distribuir build da Taqciti antes do teste manual D-20.**
- **Ordem de rollout:** migração (feita em 2026-10-12) -> deploy do backend -> build da Taqciti. Este plano é o último passo: mandar `chunk_id` a um backend sem a coluna daria 500 em todo envio.
- **Pendências do time (não bloqueiam este plano):** DA-4 e DA-5 em aberto; B3-b (`retirada-nunca`) e B3-c (`404-depois`) seguem pelo padrão "sem resposta do time".
- **Rollback:** `git revert ef55e01` desliga o reenvio (volta à fila durável sem reenvio automático); `git revert 6895da1` para de mandar `chunk_id` (o backend aceita os dois formatos).

## Known Stubs

None.

## Threat Flags

None - sem novo ponto de rede ou de autenticação; T-08-37 (duplicata no reenvio) mitigado com `chunk_id` estável + índice único do 08-09, T-08-38 (corpo com `chunk_id` antes da migração) coberto pela pré-condição já cumprida.

## Next Phase Readiness

- Falta a prova contra o Supabase real (A2 do 08-09: `APIError.code == "23505"`): teste manual D-20 (b), derrubar o backend durante a reunião, religar e conferir que não há duplicata no banco.
- `TAQ-02` NÃO foi marcado como concluído: ainda há planos da fase que o declaram.

## Self-Check: PASSED

- Arquivos: `agenteConfig.ts`, `outbox.ts`, `agenteBindUpload.ts` e os 6 testes existem em disco.
- Commits: `6895da1` e `ef55e01` são ancestrais de HEAD; `commits: 2` medido por `git rev-list --count 70865f5..HEAD` antes deste commit.
- Critérios de aceitação das duas tasks e a verificação do plano (`npm test`, `typecheck`, `lint`) passando.

---
*Phase: 08-taqciti-session-association*
*Completed: 2026-10-12*
