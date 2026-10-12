---
phase: 08-taqciti-session-association
plan: 11
subsystem: taqciti-storage
tags: [taqciti, chrome-extension, chrome-storage, outbox, delivery-status, drop-trace, vitest]

requires:
  - phase: 08-taqciti-session-association
    provides: "08-01: padrão de store com fila serializada, valor inteiro e lista branca (agenteAssociationStore) e destino por associação"
provides:
  - "Fila durável de falas em taq:agenteOutbox (storage.local): escritor único, fila serializada, valor inteiro, teto de 1000 que recusa só o excedente novo e devolve o overflow"
  - "OutboxItem de 6 campos, sem headers nem x-agente-key; buildOutboxRequest remonta o request com a chave da config atual (e devolve null para item de outro backend)"
  - "Status de entrega (ok/offline/failed/rejected, fila, overflow, recoveredAt) em taq:agenteDelivery (storage.local) com subscribeDelivery para o painel do Meet"
  - "Rastro de falas descartadas em taq:agenteDropTrace, chave própria com escrita serializada própria; nenhuma gravação de status o apaga"
  - "Reporter com delivery(record) (só repassa quando muda) e dropped(drop) (toda queda), com sink opcional"
  - "Tela 'Agente Diagnóstico' anexa ao status a nota do rastro ('N falas da sessão … não chegaram ao Agente — a última em …')"
affects: [08-13, 08-14, 08-19, 08-20, 08-21, 08-23]

actuals:
  tokens: 13500
  tasks: 3
  commits: 3

plan_head_before: c03bd286631f903ee670aff47b4364f45efa1143
plan_head_after: eccc33dc0211f4ec776092f7e0c76e96775e24b4

tech-stack:
  added: []
  patterns:
    - "Duas chaves em storage.local, cada uma com um único dono (status de entrega e rastro): writeDelivery nunca toca o rastro, então o próximo 'ok' não o apaga"
    - "subscribeNormalized genérico (valor atual + onLocalChange normalizado, leitura inicial descartada se um onChanged chegou antes) reaproveitado por subscribeDelivery e subscribeDropTrace"
    - "Rastro e fila lidos de dentro da fila serializada de escrita (sem cache no rastro): nenhuma queda apaga outra"

key-files:
  created:
    - taqciti/src/features/agente/outbox.ts
    - taqciti/src/features/agente/outbox.test.ts
    - taqciti/src/shared/config/agenteOutboxStore.ts
    - taqciti/src/shared/config/agenteOutboxStore.test.ts
    - taqciti/src/shared/config/agenteDeliveryStore.ts
    - taqciti/src/shared/config/agenteDeliveryStore.test.ts
    - taqciti/src/background/agenteStatusReporter.test.ts
    - taqciti/src/sidepanel/screens/AgenteConfigScreenDropTrace.test.tsx
  modified:
    - taqciti/src/shared/config/constants.ts
    - taqciti/src/background/agenteStatusReporter.ts
    - taqciti/src/shared/config/agenteStatus.ts
    - taqciti/src/shared/config/agenteStatus.test.ts
    - taqciti/src/shared/hooks/useAgenteStreamingStatus.ts

key-decisions:
  - "agenteDeliveryStore.ts (status + rastro) ficou com 189 linhas: a extração para agenteDropTraceStore.ts prevista como contingência NÃO foi necessária; nenhum arquivo extra foi criado"
  - "writeDelivery normaliza o valor antes de gravar (além de ler): um campo estranho, como a chave, nunca chega ao storage mesmo que um chamador passe um objeto sujo"
  - "recordDroppedUtterances ignora contagem inválida (<= 0 ou não inteira) sem gravar; rastro com contagem 0 normaliza para EMPTY_DROP_TRACE"
  - "Sem lastAt a nota omite o trecho 'a última em …'; sem lastReason omite o parêntese de motivo (casos defensivos, o sender do 08-23 sempre preenche os dois)"

patterns-established:
  - "Pergunta 'o que o painel do Meet lê' resolvida por storage.local + onChanged (nunca storage.session, Pitfall 3)"

requirements-completed: []

coverage:
  - id: D1
    description: "Fila durável com escritor único: duas escritas concorrentes mantêm os itens das duas, em ordem; remoção pontual, limpeza e contagem por sessão"
    requirement: TAQ-02
    verification:
      - kind: unit
        ref: "taqciti/src/shared/config/agenteOutboxStore.test.ts#appendToOutbox"
        status: pass
    human_judgment: false
  - id: D2
    description: "Teto de 1000 que nunca descarta o mais antigo: 999 + 3 novos = 1000 com os 999 intactos e overflow 2"
    requirement: TAQ-02
    verification:
      - kind: unit
        ref: "taqciti/src/features/agente/outbox.test.ts#appendItems: teto sem descartar o mais antigo"
        status: pass
    human_judgment: false
  - id: D3
    description: "Nenhum segredo na fila, no status de entrega nem no rastro: o JSON cru dos três storages não contém s3cr3t, x-agente-key nem texto de fala"
    requirement: TAQ-02
    verification:
      - kind: unit
        ref: "taqciti/src/shared/config/agenteOutboxStore.test.ts#o JSON cru do storage nunca contém a chave nem headers (T-08-20)"
        status: pass
      - kind: unit
        ref: "taqciti/src/shared/config/agenteDeliveryStore.test.ts#o JSON cru de taq:agenteDelivery nunca contém a chave"
        status: pass
      - kind: unit
        ref: "taqciti/src/shared/config/agenteDeliveryStore.test.ts#o JSON cru não contém a chave nem texto de fala"
        status: pass
    human_judgment: false
  - id: D4
    description: "Status de entrega em storage.local (nunca session), só gravado quando muda; rastro intacto depois de um status 'ok', somado em quedas concorrentes e recomeçado só em outra sessão"
    requirement: TAQ-02
    verification:
      - kind: unit
        ref: "taqciti/src/shared/config/agenteDeliveryStore.test.ts"
        status: pass
      - kind: unit
        ref: "taqciti/src/background/agenteStatusReporter.test.ts"
        status: pass
    human_judgment: false
  - id: D5
    description: "A tela mostra a nota do rastro junto do status (mesmo depois de 'último envio às …'); sem rastro o texto da Fase 7 fica idêntico e AgenteConfigScreen.tsx e seu teste não foram alterados"
    requirement: TAQ-02
    verification:
      - kind: unit
        ref: "taqciti/src/shared/config/agenteStatus.test.ts#agenteStatus / describeDropTrace"
        status: pass
      - kind: integration
        ref: "taqciti/src/sidepanel/screens/AgenteConfigScreenDropTrace.test.tsx"
        status: pass
      - kind: command
        ref: "git show --name-only HEAD (commit da Task 3) não lista AgenteConfigScreen.tsx nem AgenteConfigScreen.test.tsx"
        status: pass
    human_judgment: false
  - id: D6
    description: "Queda do Agente, reinício do service worker e reenvio de ponta a ponta com a fila"
    requirement: TAQ-02
    verification: []
    human_judgment: true
    rationale: "Neste plano a fila e o status só existem e são testados isolados (nada os usa); o sender e a prova ponta a ponta ficam no plano 08-23 e no teste manual D-20."

duration: ~25min
completed: 2026-10-12
status: complete
---

# Phase 8 Plan 11: Fila durável, status de entrega e rastro de falas descartadas Summary

**A Taqciti ganhou o "caderno" (fila durável em `taq:agenteOutbox`, sem segredo e com teto que nunca joga fora a fala antiga), o "painel de entrega" legível pelo painel do Meet (`taq:agenteDelivery`) e o "livro de ocorrências" (`taq:agenteDropTrace`), que nenhum status apaga e que a tela "Agente Diagnóstico" mostra. O reenvio automático nasce desligado (`AGENTE_OUTBOX_RESEND_ENABLED = false`) até a decisão B3.**

## Performance

- **Duration:** ~25 min
- **Tasks:** 3 (um commit por task, como o plano manda)
- **Files:** 8 criados, 5 alterados; `package.json` e `package-lock.json` sem diff; nenhum arquivo extra de contingência

## Accomplishments

- **Fila durável (Task 1):** `outbox.ts` (puro) define `OutboxItem` de 6 campos, `phrasesToOutboxItems`, `appendItems` (recusa só o excedente novo e devolve o `overflowed`), `normalizeOutbox` (lista branca), `buildOutboxRequest` (chave da config atual; `null` para outro backend) e `countForSession`. `agenteOutboxStore.ts` grava o valor inteiro por uma fila serializada, com cache em memória. `constants.ts` ganhou `agenteOutbox`, `agenteDelivery` e `agenteDropTrace`; a chave legada `taq:outbox` não foi reaproveitada.
- **Status de entrega e rastro (Task 2):** `agenteDeliveryStore.ts` guarda o status em `storage.local` (Pitfall 3) e o rastro em chave própria, com `recordDroppedUtterances` numa fila serializada: mesma sessão soma, outra sessão recomeça, e `writeDelivery` nunca toca o rastro. O reporter ganhou `delivery()` (só repassa quando algum campo muda) e `dropped()` (toda queda), com `writeDelivery?` e `recordDropped?` opcionais no sink, então a Fase 7 segue igual (`src/background` inteiro: 10 arquivos, 150 testes verdes).
- **Nota na tela (Task 3):** `describeDropTrace` (pura) monta "N falas da sessão 1a2b3c4d… não chegaram ao Agente — a última em … (motivo)"; `useAgenteStreamingStatus` assina o rastro e anexa a nota ao `text` do status. Sem rastro o texto é o da Fase 7; `AgenteConfigScreen.tsx` e `AgenteConfigScreen.test.tsx` não mudaram (25 testes do segundo continuam verdes).
- **Gate do plano:** `cd taqciti && npm test` (62 arquivos, 871 testes), `npm run typecheck` e `npm run lint` verdes. Arquivos novos de produção: 126, 80 e 189 linhas (todos abaixo de 200); `awk 'FNR == 201'` não imprimiu nenhum arquivo.

## Task Commits

1. **Task 1 — fila durável (outbox.ts, agenteOutboxStore.ts, chaves em constants.ts):** `24163bc`
2. **Task 2 — status de entrega, rastro e `delivery()`/`dropped()` no reporter:** `aa2490b`
3. **Task 3 — nota do rastro na tela "Agente Diagnóstico":** `eccc33d`

**Plan metadata:** commit de docs ao final (SUMMARY + STATE + ROADMAP).

## Deviations from Plan

None - plan executed exactly as written.

A contingência de extração (`agenteDropTraceStore.ts`) estava prevista e não foi acionada: o arquivo ficou com 189 linhas.

## Decisões do time e pendências

- **B3 (`chunk_id`, reenvio automático):** não bloqueou este plano. `AGENTE_OUTBOX_RESEND_ENABLED` nasceu `false`; quem a liga é o plano 08-19, depois da resposta do time (B3-a/B3-b/B3-c ainda em branco em `08-DECISOES-PENDENTES.md`). O rastro existe em qualquer resposta de B3-b: ele só garante que, quando a Taqciti desiste de uma fala, a pessoa fica sabendo.
- **Medição de cota:** o teto de 1000 itens é suposição (fala é texto curto). `getBytesInUse` deve ser medido no teste manual D-20 (08-21, Task 2); só pedir `unlimitedStorage` se passar de ~5 MB.
- **Lembrete herdado (não é desta task):** criar `GEMINI_API_KEY` no Railway antes de deploy, merge na `master` ou junção com o AGM (B2 = aprovar-sem-env).

## Known Stubs

Nenhum. Fila, status e rastro ainda não têm quem os alimente em produção: isso é o plano 08-23 (sender sobre a fila e fiação no streamer), declarado no plano e não é stub dentro dos arquivos.

## Threat Flags

Nenhum. Nada de rede nova; as três chaves em `storage.local` estão no `<threat_model>` (T-08-20, T-08-44, T-08-22) e cobertas pelos testes de JSON cru.

## Self-Check: PASSED

- Arquivos criados e alterados conferidos em disco; commits `24163bc`, `aa2490b` e `eccc33d` presentes no histórico da branch `feat/fase-08-taqciti-session-association`.
- `commits: 3` medido por `git rev-list --count c03bd28..HEAD`.
