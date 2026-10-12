---
phase: 08-taqciti-session-association
plan: 23
subsystem: taqciti-streaming
tags: [taqciti, chrome-extension, service-worker, outbox, retry-policy, delivery-status, drop-trace, vitest]

requires:
  - phase: 08-taqciti-session-association
    provides: "08-01: destino por associação (StreamDestinationPolicy), instance com 293 linhas"
  - phase: 08-taqciti-session-association
    provides: "08-09: resposta B3-b registrada (retirada-nunca, sem resposta do time) e dedup por chunk_id no backend"
  - phase: 08-taqciti-session-association
    provides: "08-11: fila durável taq:agenteOutbox, status taq:agenteDelivery e rastro taq:agenteDropTrace"
provides:
  - "Envio ao vivo sobre a fila durável: a fala só sai de taq:agenteOutbox quando o Agente confirma; reinício do service worker não perde nada e o envio retoma na mesma ordem"
  - "Fim do 'descarta o mais antigo' (teto 50): acima de AGENTE_OUTBOX_MAX_ITEMS = 1000 só o excedente NOVO é recusado e contado como overflow"
  - "Política de reenvio (AGENTE_OUTBOX_RESEND_ENABLED, ainda false até a B3): esgotadas as tentativas por queda o item fica no topo (offline com a contagem), falas novas entram atrás e tudo sai na ordem quando o Agente volta; nova tentativa a cada 15 s via kick()"
  - "classifyExhausted (função pura) + AGENTE_OUTBOX_SERVER_ERROR_MAX_AGE_MS = null (B3-b: retirada-nunca); o limite numérico também entra por injeção (serverErrorMaxAgeMs)"
  - "Toda fala que sai sem entrega (failed, 4xx, 500 da B3-b, overflow, falha ao gravar a fila) soma no rastro taq:agenteDropTrace; cancelAll() e request null (saídas pedidas pela pessoa) não contam"
  - "Retomada no boot (resume) só com o envio pronto: o mesmo portão de step/tick; envio desligado ou config não pronta limpa a fila durável sem rastro (D-09 da Fase 7 também no boot)"
affects: [08-19, 08-20, 08-21]

actuals:
  tokens: 56000
  tasks: 3
  commits: 5

plan_head_before: ca0873d1490b04bce8b6cf13872e10906ee06934
plan_head_after: 5f67d347decc3711cefb39f317075e0bdc13e9ae

tech-stack:
  added: []
  patterns:
    - "Sender sobre uma porta de fila (SendQueuePort): memória por padrão, durável em produção; o request é montado na hora de enviar com a config atual"
    - "Decisão do topo depois das tentativas separada em duas peças: ciclo de tentativas (agenteSendAttempts) e destino do item (agenteSendSettle + classifyExhausted pura)"
    - "Estado de entrega e aviso de queda num rastreador sem I/O (agenteDeliveryTracker), repassado ao reporter que só grava quando muda"
    - "Retomada no boot passa pelo mesmo portão de step/tick (destination.canDrain)"

key-files:
  created:
    - taqciti/src/background/agenteSendQueue.ts
    - taqciti/src/background/agenteSendAttempts.ts
    - taqciti/src/background/agenteSendSettle.ts
    - taqciti/src/background/agenteDeliveryTracker.ts
    - taqciti/src/background/agenteStreamerSender.ts
    - taqciti/src/background/agenteOutbox.test.ts
  modified:
    - taqciti/src/background/agenteSender.ts
    - taqciti/src/background/agenteSender.test.ts
    - taqciti/src/background/agenteStreamerInstance.ts
    - taqciti/src/background/agenteStreamerDeps.ts
    - taqciti/src/background/agenteStreamer.ts
    - taqciti/src/features/agente/sendRetryPolicy.ts
    - taqciti/src/features/agente/sendRetryPolicy.test.ts

key-decisions:
  - "B3-b aplicada = retirada-nunca: AGENTE_OUTBOX_SERVER_ERROR_MAX_AGE_MS = null. Lida na seção 'Decisão B3' do 08-09-SUMMARY ('sem resposta do time' -> padrão D-18 literal). Um teste fixa o valor de produção; o limite numérico existe só por injeção, para o time poder trocar a regra num commit próprio"
  - "O reenvio continua desligado em produção (AGENTE_OUTBOX_RESEND_ENABLED = false): quem liga é o 08-19. Com ele desligado vale a Fase 7 (desiste, status failed, a fila segue) e a fala desistida entra no rastro"
  - "O portão do resume usa destination.canDrain(config) (a política ativa) e não isStreamingReady: é o mesmo portão que tick usa, e vale tanto para a política da associação (produção) quanto para configDestination (Fase 7)"
  - "Fila em memória (padrão sem outbox injetada) passou a seguir a mesma regra da durável (teto 1000, excedente recusado); a regra antiga de teto 50 com descarte do mais antigo vive só no commit de refactor 1593b3a"

patterns-established:
  - "Falha ao gravar na fila durável conta como overflow no rastro (a causa realista é a cota do storage), com log só do código"
  - "tracker.reset() em cancelAll(): desligar ou trocar o destino zera o status de entrega, sem rastro (pedido da pessoa)"

requirements-completed: []

coverage:
  - id: D1
    description: "Fila durável no envio ao vivo: Agente fora do ar -> status offline com a contagem, JSON cru de taq:agenteOutbox sem a chave nem headers; reinício do service worker mantém as 2 falas (mesmos chunkIds) e, com o Agente de volta, saem na ordem original, a fila esvazia e o status volta a ok com recoveredAt"
    requirement: TAQ-02
    verification:
      - kind: integration
        ref: "taqciti/src/background/agenteOutbox.test.ts#reenvio ligado: a fila durável sobrevive a queda e a reinício, na ordem"
        status: pass
      - kind: unit
        ref: "taqciti/src/background/agenteSender.test.ts#agenteSender / reenvio ligado: Agente fora do ar (D-18)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Nenhuma fala antiga é descartada por teto: acima de 1000 só o excedente novo é recusado e contado (overflow no status e no rastro)"
    requirement: TAQ-02
    verification:
      - kind: unit
        ref: "taqciti/src/background/agenteSender.test.ts#acima do teto nada antigo é descartado"
        status: pass
    human_judgment: false
  - id: D3
    description: "Retirada por HTTP 500 só como a B3-b mandou: valor de produção null fixado por teste; com limite numérico injetado só retira quando TODAS as tentativas do ciclo são 500 e o item passa do limite; 429/502/503/504/rede e ciclo misto nunca retiram"
    requirement: TAQ-02
    verification:
      - kind: unit
        ref: "taqciti/src/background/agenteSender.test.ts#agenteSender / retirada por HTTP 500 (B3-b)"
        status: pass
      - kind: unit
        ref: "taqciti/src/features/agente/sendRetryPolicy.test.ts#classifyExhausted"
        status: pass
    human_judgment: false
  - id: D4
    description: "Rastro de falas descartadas: failed, 4xx, 500 da B3-b, overflow e falha de gravação chamam onDropped; cancelAll e request null não; o rastro persistente sobrevive ao próximo 'ok' e ao reinício, sem chave nem texto"
    requirement: TAQ-02
    verification:
      - kind: unit
        ref: "taqciti/src/background/agenteSender.test.ts#agenteSender / fila sem descarte e rastro de falas descartadas (D-18)"
        status: pass
      - kind: integration
        ref: "taqciti/src/background/agenteOutbox.test.ts#padrão de produção (reenvio desligado)"
        status: pass
    human_judgment: false
  - id: D5
    description: "D-09 da Fase 7 preservado: desligar o toggle limpa a fila durável sem somar no rastro; reunião nova sem vínculo (idle) e o descarte da instância (dispose) NÃO limpam; reinício com o envio desligado ou a config não pronta não envia nada, limpa a fila e deixa o rastro igual"
    requirement: TAQ-02
    verification:
      - kind: integration
        ref: "taqciti/src/background/agenteOutbox.test.ts#reinício com o envio desligado ou a config não pronta"
        status: pass
      - kind: unit
        ref: "taqciti/src/background/agenteSender.test.ts#dispose() é terminal mas NÃO limpa a porta"
        status: pass
    human_judgment: false
  - id: D6
    description: "Mecânica da Fase 7 (janela por fala, retry, vínculo CR-01, boot WR-02/WR-04) e o tracer da Fase 8 intactos, sem alterar agenteStreamer.test.ts nem agenteStreamerAssociation.test.ts"
    verification:
      - kind: command
        ref: "cd taqciti && npm test (73 arquivos, 1045 testes)"
        status: pass
    human_judgment: false
  - id: D7
    description: "Reenvio automático ligado de verdade em produção, deduplicação por chunk_id e o comportamento num Chrome real (reinício real do service worker, cota do storage)"
    requirement: TAQ-02
    verification: []
    human_judgment: true
    rationale: "O reenvio nasce desligado até a decisão B3 (plano 08-19) e o chunk_id ainda não vai no corpo; o reinício real e a medição de getBytesInUse ficam no teste manual D-20 (08-21)."

duration: ~25min
completed: 2026-10-12
status: complete
---

# Phase 8 Plan 23: Envio ao vivo sobre a fila durável, com reenvio em ordem e rastro de toda fala descartada Summary

**O envio ao vivo da Taqciti agora passa pela fila durável (`taq:agenteOutbox`): a fala só sai do caderno quando o Agente confirma, um reinício do service worker não perde nada, nenhuma fala antiga é jogada fora por teto, e toda fala de que a Taqciti desiste fica no livro de ocorrências. O reenvio automático em ordem já funciona e está testado, mas continua desligado até a decisão B3 (08-19); a retirada por HTTP 500 segue a B3-b registrada (`retirada-nunca`).**

## Performance

- **Duration:** ~25 min
- **Tasks:** 3 (5 commits: 3 de task + 2 refactors mecânicos de contingência nomeada no plano)
- **Files:** 6 criados, 7 alterados; `package.json` e `package-lock.json` sem diff

## Accomplishments

- **Task 1 — refactor sem mudança de comportamento (`1593b3a`):** `agenteSender.submit` recebe `OutboxItem[]` por uma porta de fila (`SendQueuePort`) e monta o request na hora de enviar (`buildRequest`). A fila em memória reproduziu a regra de hoje (teto 50, descarta o mais antigo) em `agenteSendQueue.ts`; o `drain` do instance entrega `phrasesToOutboxItems(...)`. `agenteSender.test.ts` adaptado ao formato de itens.
- **Refactors de contingência (`708573c`, `ddbc45d`):** o laço de tentativas saiu do sender para `agenteSendAttempts.ts` (como o plano nomeou) e a montagem do sender saiu do instance para `agenteStreamerSender.ts` (idem), ambos como recortes mecânicos com os testes existentes verdes sem alteração.
- **Task 2 — comportamento (`596fa0e`):** teto 1000 com overflow (nada antigo sai), `kick()`/`resume()`, política de reenvio (`classifyExhausted`), `AGENTE_OUTBOX_SERVER_ERROR_MAX_AGE_MS = null`, rastreador de entrega (`agenteDeliveryTracker.ts`) e `onDropped` em toda saída sem entrega. `dispose()` não limpa a porta. `AGENTE_SEND_MAX_QUEUED` removido (sem import quebrado).
- **Task 3 — fiação (`5f67d34`):** `agenteStreamer.ts` liga a fila durável, `writeDelivery` e `recordDroppedUtterances`; o instance chama `sender.kick()` em `step`/`tick`; `resume` carrega a config e passa pelo mesmo portão de `step`/`tick`; `dispose()` deixa de chamar o descarte. Teste ponta a ponta `agenteOutbox.test.ts` (7 casos) com queda, reinício e rastro.
- **Gate do plano:** `cd taqciti && npm test` (73 arquivos, 1045 testes) + `npm run typecheck` + `npm run lint` verdes. Limites: `agenteSender.ts` 200 linhas (gate `awk FNR == 201` não imprimiu nada), tracker 95, fila 42, instance 299 (<= 300). `awk` negativo de `AGENTE_SEND_MAX_QUEUED`/`waiting.shift()` imprimiu 0.

## Pré-condição da Task 2 (B3-b)

Lida a seção "Decisão B3" do `08-09-SUMMARY.md`: **B3-b: sem resposta do time -> padrão `retirada-nunca`** (D-18 literal). Valor aplicado: `AGENTE_OUTBOX_SERVER_ERROR_MAX_AGE_MS = null`. Consequência aceita pelo time ao não responder: se o backend devolver 500 sempre para uma fala específica (por exemplo, sessão apagada que o plano B colou), com o reenvio ligado essa fala fica no topo ("fora do ar") até a pessoa desligar o envio; `404-agora` (B3-c) trocaria esse caso por um 4xx, mas B3-c também ficou no padrão `404-depois`. Para mudar a regra depois: trocar o valor e o teste que o fixa, num commit próprio.

## Task Commits

1. **Task 1 (refactor, sem mudança de comportamento):** `1593b3a`
2. **Contingência nomeada — laço de tentativas para `agenteSendAttempts.ts` (refactor):** `708573c`
3. **Task 2 (comportamento):** `596fa0e`
4. **Contingência nomeada — montagem do sender para `agenteStreamerSender.ts` (refactor):** `ddbc45d`
5. **Task 3 (comportamento, fiação):** `5f67d34`

**Plan metadata:** commit de docs ao final (SUMMARY + STATE + ROADMAP).

## Evidência TDD (RED -> GREEN)

- **Task 2:** os testes novos foram escritos com as APIs já presentes na implementação (escrita e execução no mesmo passo); a primeira execução do arquivo já verde (26/26). Sem RED separado registrado para esta task.
- **Task 3 — RED:** `agenteOutbox.test.ts` contra o streamer ainda sem a fiação: 7 de 7 falharam nas asserções do comportamento planejado (ex.: `expected null to match object { status: 'failed' }`, `expected [] to deeply equal [ ObjectContaining{…}, … ]`, `Target cannot be null or undefined` para a fila durável). `semanticAssessment`: o alvo executou e falhou na asserção planejada, não por import ou fixture. **GREEN:** 7/7. Verificação por mutação: sem o portão do `resume`, a variante "envio desligado" fica vermelha; com o `dispose()` chamando a limpeza, o teste de reinício fica vermelho.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `await whenAgenteStreamerIdle()` da Fase 7 não esperava mais o envio ser despachado**
- **Found during:** Task 3 (gate com `agenteStreamer.test.ts` sem alteração)
- **Issue:** com a fila durável o `submit` guarda a fala (escrita assíncrona) antes de enviar; o teste "pausa: fala pendente + PAUSE envia na hora" afirma `fetch` chamado logo depois de `whenAgenteStreamerIdle()`, sem avançar timers, e falhou. (A mesma falha deixava uma remoção da fila rodar depois do teste, vista como `chrome is not defined` no log.)
- **Fix:** o sender passou a sinalizar quando despachou o 1º envio (ou parou) e expõe `settled()`; `whenIdle()` do instance espera `queue` e `sender.settled()`. Não espera a resposta do envio (sem travar em esperas de retry sob timers falsos).
- **Files modified:** `taqciti/src/background/agenteSender.ts`, `taqciti/src/background/agenteStreamerInstance.ts`
- **Verification:** `agenteStreamer.test.ts` 46/46 sem alteração; suíte completa verde.
- **Commit:** `5f67d34`

**2. [Rule 3 - Blocking] Limites de tamanho: três extrações em vez de uma**
- **Found during:** Tasks 2 e 3
- **Issue:** com a formatação do repositório o sender passava de 200 linhas e o instance de 300.
- **Fix:** as contingências nomeadas no plano foram acionadas (`agenteSendAttempts.ts`, `agenteStreamerSender.ts`, ambas como commits `refactor(08-23)` próprios, antes da mudança de comportamento correspondente) e a decisão do topo depois das tentativas nasceu em `agenteSendSettle.ts` (código novo da Task 2, não prevista no plano). Sender: 200; instance: 299. `discard()` foi dobrada em `stopStreaming()` (único chamador restante).
- **Files modified:** `agenteSendAttempts.ts`, `agenteSendSettle.ts`, `agenteStreamerSender.ts` (novos), `agenteStreamerInstance.ts`
- **Commits:** `708573c`, `596fa0e`, `ddbc45d`, `5f67d34`

**3. [Rule 1 - Adaptação ao estado real do código] Portão do `resume` pela política ativa, e fiação do status no arquivo extraído**
- **Found during:** Task 3
- **Issue:** o plano descreve o portão como `isStreamingReady(config)` e a fiação `status.delivery`/`status.dropped` dentro do instance. Desde o 08-01 o portão de `tick` é `destination.canDrain(config)` (na política da associação, `canUse`: envio ligado e URL válida; `agenteSessionId` vazio não é "não pronto" porque o destino é a associação), e a fiação ficou no `agenteStreamerSender.ts` por causa da contingência de tamanho.
- **Fix:** o `resume` usa `destination.canDrain(config)` (o MESMO portão de `tick`). O `it.each` do "config não pronta" usa URL vazia no lugar de `agenteSessionId` vazio. As checagens por grep do acceptance de `status.delivery`/`status.dropped` valem para `agenteStreamerSender.ts`; o instance contém `sender.kick()` e `sender.resume()`.
- **Files modified:** `agenteStreamerInstance.ts`, `agenteStreamerSender.ts`, `agenteOutbox.test.ts`
- **Commit:** `5f67d34`

**4. [Rule 3 - Blocking] Teste do sender adaptado ao envio assíncrono (Task 1)**
- **Found during:** Task 1
- **Issue:** com a porta de fila assíncrona o envio começa um instante depois do `submit` (antes era síncrono). Dois casos de `agenteSender.test.ts` dependiam do início síncrono (`cancelAll` logo depois do `submit`, e o item "em voo" antes do teto).
- **Fix:** `await vi.advanceTimersByTimeAsync(0)` depois do `submit` nesses casos; nenhuma expectativa mudou.
- **Files modified:** `taqciti/src/background/agenteSender.test.ts`
- **Commit:** `1593b3a`

**5. [Rule 2 - Cobertura] Testes extras não listados no plano**
- `sendRetryPolicy.test.ts` ganhou os casos de `classifyExhausted` (a função pura merecia cobertura própria); `agenteSender.test.ts` ganhou o caso do item sem request (log só com a contagem). Commits `596fa0e` e `1593b3a`.

### Observação sobre premissa do plano

O plano afirma que o `fresh()` de `agenteStreamer.test.ts` não injeta `outbox` e por isso usa a fila em memória. Na prática `configureAgenteStreamer` mescla com as deps de produção, então esses testes já rodam com a fila durável no storage simulado — e continuam 100% verdes sem alteração.

**Total deviations:** 5 (1 bug, 2 bloqueios, 1 adaptação, 1 cobertura). **Impact:** nenhum muda escopo ou comportamento planejado; todos servem aos limites de tamanho, à Fase 7 intacta e à fidelidade ao código real.

## Decisões do time e pendências

- **B3 (reenvio automático):** continua DESLIGADO em produção. O 08-19 liga `AGENTE_OUTBOX_RESEND_ENABLED` e manda o `chunk_id` no corpo (a migração do 08-09 já está aplicada).
- **B3-b / B3-c:** `retirada-nunca` e `404-depois`, ambas "sem resposta do time" (ver acima).
- **Nova tentativa sem `alarms`:** com o item parado esperando o Agente, a nova tentativa só acontece quando alguém chama `kick()` (a cada flush de legenda, a cada tick da janela, no boot do service worker); sem ninguém falando, nada retenta. A permissão `alarms` continua dependendo da decisão B4-b (ajustada pelo usuário, em replanejamento).
- **Medição de cota (D-20):** o teto de 1000 itens é suposição; medir `getBytesInUse` no 08-21 e só pedir `unlimitedStorage` se passar de ~5 MB.
- **Dono do resíduo:** `kick()` não é chamado em `applyConfigChange`; ao religar o toggle com fila parada a nova tentativa espera o próximo flush/tick. Se o time quiser retomar na hora, é uma linha no 08-19.
- Este plano não tocou backend nem deploy. O lembrete herdado permanece (`TEM QUE CRIAR GEMINI_API_KEY NO RAILWAY` antes de qualquer deploy ou junção com o AGM; B2 = aprovar-sem-env).

## Known Stubs

Nenhum. O reenvio desligado é uma decisão registrada (constante `AGENTE_OUTBOX_RESEND_ENABLED = false` até a B3), não um stub; o caminho ligado está testado por injeção.

## Threat Flags

Nenhum novo. As chaves `taq:agenteOutbox`, `taq:agenteDelivery` e `taq:agenteDropTrace` estão no threat model do plano (T-08-45, T-08-21, T-08-43, T-08-46): os testes ponta a ponta leem o JSON cru e provam ausência de `s3cr3t`, `x-agente-key` e do texto das falas no rastro.

## Self-Check: PASSED

- Arquivos criados presentes: `agenteSendQueue.ts`, `agenteSendAttempts.ts`, `agenteSendSettle.ts`, `agenteDeliveryTracker.ts`, `agenteStreamerSender.ts`, `agenteOutbox.test.ts`.
- Commits presentes no histórico da branch: `1593b3a`, `708573c`, `596fa0e`, `ddbc45d`, `5f67d34`; `commits: 5` medido por `git rev-list --count ca0873d..HEAD`.
- Gate: `cd taqciti && npm test` (73 arquivos, 1045 testes), `npm run typecheck` e `npm run lint` verdes; `agenteStreamer.test.ts` e `agenteStreamerAssociation.test.ts` não aparecem nos commits; `package.json`/`package-lock.json` sem diff.

---
*Phase: 08-taqciti-session-association*
*Completed: 2026-10-12*
