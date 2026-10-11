---
phase: 07-taqciti-config-background-streamer
plan: 02
subsystem: taqciti-streaming
tags: [chrome-extension, chrome-storage, mv3, vitest, typescript, streaming, config-runtime]

requires:
  - phase: 07-taqciti-config-background-streamer
    provides: "Plano 01: agenteConfig.ts (normalizeAgenteConfig/DEFAULT_AGENTE_CONFIG), agenteStreamer.ts com o seam AgenteStreamerDeps (loadConfig/send), wordDelta.ts (planStreamStep/regra de prime)"
provides:
  - "STORAGE_KEYS.agenteConfig ('taq:agenteConfig') em constants.ts"
  - "agenteConfigStore.ts: loadAgenteConfig/patchAgenteConfig (fila serializada, único caminho de escrita)/subscribeAgenteConfig (onChanged, sem polling)/createAgenteConfigReader (leitor com cache para o service worker)"
  - "agenteStreamer.ts: loadConfig padrão agora é createAgenteConfigReader() — gravar a config no storage liga a transmissão sem recompilar a extensão"
  - "15 testes novos (11 do store + 4 do bloco 'configuração vinda do storage (D-08)' no streamer) provando D-08/D-09/D-10 com o storage real"
affects: [07-03-config-screen, 08-taqciti-session-association, 09-cutover-retire-extension]

actuals:
  tokens: 5600
  tasks: 2
  commits: 3
  plan_head_before: 0a71e51c5b4ba23ae4d885bdd56743470fefdfd2

tech-stack:
  added: []
  patterns:
    - "Fila de escrita serializada (queue = queue.then(...)) idêntica a prefsStore.ts, aplicada agora à config do Agente — nenhum objeto inteiro é gravado por cima, só patch"
    - "Leitor com cache (createAgenteConfigReader): lê o storage uma única vez e depois só atualiza por chrome.storage.onChanged — nunca relê a cada flush (custo zero para quem deixa o streaming desligado)"
    - "normalizeAgenteConfig como único portão de validação: aplicado na leitura, na escrita e em cada evento onChanged — nenhum valor lixo sobrevive no storage"

key-files:
  created:
    - taqciti/src/shared/config/agenteConfigStore.ts
    - taqciti/src/shared/config/agenteConfigStore.test.ts
  modified:
    - taqciti/src/shared/config/constants.ts
    - taqciti/src/background/agenteStreamer.ts
    - taqciti/src/background/agenteStreamer.test.ts

key-decisions:
  - "createAgenteConfigReader registra o listener de onChanged ANTES da leitura inicial (mesma ordem de prefsStore.ts) para não perder uma mudança que chegue entre as duas operações assíncronas"
  - "Sem ensureAgenteConfig() no boot (decisão já registrada no próprio PLAN.md, seção 6, Claude's Discretion): a assinatura já entrega o valor atual ao assinar, então semear o storage na instalação só criaria uma escrita a mais para todo mundo"
  - "Ledger de commits do plano (#3968) recriado retroativamente: o passo 0c (criar o sentinel antes do primeiro commit) não foi executado no início desta execução; o HEAD anterior ao plano (0a71e51, último commit do plano 01) foi identificado com segurança a partir do `git log` e do git status inicial da sessão, e o arquivo sentinel foi gravado com esse valor antes de medir os commits — nenhum commit deste plano foi perdido ou recontado, mas o processo correto é gravar o sentinel ANTES do primeiro commit, não depois"

requirements-completed: [TAQ-01]

coverage:
  - id: D1
    description: "agenteConfigStore.ts — registro único da config do Agente em chrome.storage.local: loadAgenteConfig/patchAgenteConfig (fila serializada)/subscribeAgenteConfig (onChanged)/createAgenteConfigReader (leitor com cache); STORAGE_KEYS.agenteConfig novo em constants.ts"
    requirement: "TAQ-01"
    verification:
      - kind: unit
        ref: "taqciti/src/shared/config/agenteConfigStore.test.ts (11 casos: padrão vazio, patch de campo único, 3 patches concorrentes, normalização na escrita, invariante salvo-vence/ausente-cai-no-padrão, assinatura x4, leitor com cache x2)"
        status: pass
    human_judgment: false
  - id: D2
    description: "agenteStreamer.ts lê a config salva via createAgenteConfigReader(): gravar ligado + session_id + URL no storage liga a transmissão sem recompilar; desligar para na hora; religar não reenvia o período desligado (D-09); reinício do service worker não reenvia texto antigo; 1 única leitura do storage em vários flushes (custo zero desligado)"
    requirement: "TAQ-01"
    verification:
      - kind: e2e
        ref: "taqciti/src/background/agenteStreamer.test.ts, bloco 'configuração vinda do storage (D-08)' (4 casos, dispatch real via sessionController + patchAgenteConfig no storage simulado)"
        status: pass
      - kind: e2e
        ref: "taqciti/src/background/agenteStreamer.test.ts, 6 casos do plano 01 (continuam verdes após a troca do loadConfig padrão)"
        status: pass
      - kind: other
        ref: "cd taqciti && npm test (32 arquivos, 430 testes) e npm run typecheck (0 erros)"
        status: pass
    human_judgment: false

duration: ~20min
completed: 2026-09-25
status: complete
---

# Phase 7 Plan 2: Config do Agente editável em runtime (chrome.storage.local) + streamer ligado ao storage real Summary

**Cria `agenteConfigStore.ts` (mesmo padrão de `prefsStore.ts`: fila de patch + `chrome.storage.onChanged`, sem polling) e troca o `loadConfig` padrão do streamer do plano 01 para lê-lo — gravar "ligado + session_id + URL" no storage da extensão passa a transmitir a reunião de verdade, sem recompilar nada, e desligar para na hora sem reenviar o que foi falado no período desligado.**

## Performance
- **Duration:** ~20min
- **Started:** 2026-09-25T22:53:42-03:00 (commit anterior do plano 01)
- **Completed:** 2026-09-25T23:07:44-03:00
- **Tasks:** 2/2
- **Files modified:** 5 (2 novos + 3 modificados)

## Accomplishments
- `STORAGE_KEYS.agenteConfig = 'taq:agenteConfig'` adicionado a `constants.ts`, sem tocar mais nenhuma linha do arquivo.
- `agenteConfigStore.ts` criado espelhando `prefsStore.ts` linha a linha na estrutura: `loadAgenteConfig` (lê + normaliza), `patchAgenteConfig` (único caminho de escrita, fila serializada — três patches concorrentes não se apagam), `subscribeAgenteConfig` (entrega o valor atual + propaga mudanças de qualquer aba/contexto + ignora outras chaves + cancelável) e `createAgenteConfigReader` (leitor com cache para o service worker: lê o storage uma única vez, depois só atualiza por `onChanged`).
- Invariante do assumption-delta provado: um valor salvo parcial (`{ agenteSessionId }`) faz `loadAgenteConfig` devolver o `session_id` salvo com URL e toggle caindo no padrão da build — campo salvo vence, campo ausente cai no padrão, nunca os dois pela metade.
- `agenteStreamer.ts`: `loadConfig` padrão trocado de `DEFAULT_AGENTE_CONFIG` fixo (sempre desligado) para `createAgenteConfigReader()` — a partir deste plano, gravar a config no storage real da extensão liga a transmissão sem precisar chamar `configureAgenteStreamer` nem recompilar.
- Prova ponta a ponta com o storage real (sem `configureAgenteStreamer`, só `patchAgenteConfig`): dispatch real de `MEETING_DETECTED` + `CAPTION_CHUNK` gera `fetch` para `http://agente.test/webhook/extension` com o texto certo.
- D-09 confirmado com o mecanismo de storage de verdade (não só com o `loadConfig` injetado como no plano 01): desligar pelo storage para o envio no próximo flush; religar não reenvia "pausa aqui" (o trecho falado desligado) — só a palavra realmente nova ("sim") sai no envio seguinte, graças à regra de prime de `planStreamStep` do plano 01 reagindo à mudança real de `streamingEnabled`.
- Reinício do service worker simulado (`vi.resetModules()` + `hydrate()` do `sessionController` recém-importado, mesmo storage): o primeiro flush pós-reinício não reenvia o texto já mandado antes do "restart"; só as palavras novas saem no envio seguinte.
- Custo confirmado: `chrome.storage.local.get` da chave `taq:agenteConfig` é chamado exatamente 1 vez ao longo de 4 flushes (1 de `MEETING_DETECTED` + 3 de `CAPTION_CHUNK`) — o leitor nunca relê a cada flush.
- Suíte inteira da Taqciti: 32 arquivos, 430 testes, verde (415 do plano 01 + 15 novos: 11 do store + 4 do streamer). `npm run typecheck`: 0 erros.

## Task Commits
1. **Task 1 (RED): teste do store da config do Agente** - `647d128` (test)
2. **Task 1 (GREEN): agenteConfigStore.ts + STORAGE_KEYS.agenteConfig** - `2f67477` (feat)
3. **Task 2: streamer lê a config salva no storage (test+feat juntos — ver Deviations)** - `7644787` (feat)
**Plan metadata:** commit final deste SUMMARY (a seguir)

## Files Created/Modified
- `taqciti/src/shared/config/constants.ts` - `STORAGE_KEYS.agenteConfig = 'taq:agenteConfig'` (1 linha nova)
- `taqciti/src/shared/config/agenteConfigStore.ts` - registro único da config do Agente (100 linhas)
- `taqciti/src/shared/config/agenteConfigStore.test.ts` - 11 casos de borda do store
- `taqciti/src/background/agenteStreamer.ts` - `loadConfig` padrão agora é `createAgenteConfigReader()`
- `taqciti/src/background/agenteStreamer.test.ts` - bloco novo "configuração vinda do storage (D-08)" (4 casos)

## Decisions Made
- **Ledger de commits recriado retroativamente:** ver Deviations abaixo.
- **Sem `ensureAgenteConfig()` no boot:** decisão já travada no próprio `07-02-PLAN.md` (seção 6) — não há consumidor esperando um primeiro evento `onChanged`, então semear o storage na instalação só custaria uma escrita extra sem benefício.
- **Listener de `onChanged` registrado antes da leitura inicial** em `createAgenteConfigReader`, igual a `subscribeAgenteConfig`/`prefsStore.ts` — evita perder uma mudança que chegue entre o registro do listener e a resolução da leitura inicial.

## Deviations from Plan

### Notas de processo (não são deviations de regra 1-4)

**1. Ledger de commits (#3968) criado depois do primeiro commit, não antes.** O passo 0c do protocolo pede gravar o sentinel `gsd-plan-head-before-07-02` ANTES do primeiro commit da execução. Isso não foi feito no início desta execução. Ao chegar na hora de escrever este SUMMARY, o HEAD anterior ao plano (`0a71e51`, o commit final do plano 01, confirmado pelo `git log` e pelo git status do início da sessão) foi identificado com segurança e o sentinel foi gravado retroativamente com esse valor antes de medir `git rev-list --count`. Nenhum commit foi perdido ou contado a mais — `COMMITS_ACTUAL = 3` bate exatamente com os 3 commits desta execução (`647d128`, `2f67477`, `7644787`) — mas o processo correto é gravar o sentinel ANTES do primeiro commit, e isso não foi seguido à risca aqui.

**2. RED não observado isoladamente para a Task 2.** A Task 1 seguiu RED→GREEN de verdade: o teste (`agenteConfigStore.test.ts`) foi escrito e rodado primeiro, falhando por import não resolvido (módulo `./agenteConfigStore` ainda não existia) — um RED válido para um módulo novo, exatamente como o plano previu — e só depois o store foi implementado até GREEN (2 commits separados, `647d128` test → `2f67477` feat). Já na Task 2, o código de produção de `agenteStreamer.ts` (import de `createAgenteConfigReader` + troca do `loadConfig` padrão) foi editado antes do bloco de teste novo ser escrito, então não houve uma execução isolada mostrando o teste falhando contra o código antigo (`DEFAULT_AGENTE_CONFIG` fixo). Como `workflow.tdd_mode` deste projeto está `false` (sem gate bloqueante que exija um commit RED separado), isso não bloqueia a execução — mas é um desvio da disciplina que o próprio texto da Task 2 pedia ("Confirme RED"). Os 4 casos novos passaram já na primeira execução depois da implementação, e os 5 casos do plano 01 continuam verdes (10/10 no arquivo, 430/430 na suíte inteira).

**Total deviations:** 0 auto-fixed de Rule 1-4 (nenhum bug, funcionalidade crítica faltante ou bloqueio encontrado). 2 notas de processo (acima), nenhuma com impacto em comportamento ou correção — só disciplina de execução do próprio fluxo GSD. **Impact on plan:** nenhum no resultado entregue; os dois pontos ficam registrados para a próxima execução seguir o protocolo à risca desde o início.

## Issues Encountered
None. `npm test`/`npm run typecheck` verdes de primeira em ambas as tasks; nenhum retrabalho de bug real.

## User Setup Required
None - o streaming continua desligado por padrão para quem não gravar nada no storage (D-09); nenhuma variável de ambiente/serviço externo novo é necessária. A verificação manual ponta a ponta numa chamada real do Google Meet (SC1 do roadmap) permanece adiada para o Plano 03/UAT, como já registrado no `07-01-SUMMARY.md` e no `07-VALIDATION.md`.

## Next Phase Readiness
Pronto para o Plano 03 (tela de configuração): `agenteConfigStore.ts` já expõe `loadAgenteConfig`/`patchAgenteConfig`/`subscribeAgenteConfig` prontos para o formulário ler e escrever (URL, toggle, session_id, chave) sem nenhum polling — o Plano 03 só precisa construir a tela/rota e ligar os campos a essas três funções. A Fase 8 (TAQ-02, detecção automática de sessão) também já tem onde escrever: `patchAgenteConfig({ agenteSessionId })` por cima do registro, sem exigir nenhuma mudança neste módulo. Nenhum bloqueio conhecido.

## Self-Check: PASSED

Todos os 5 arquivos de código/teste criados/modificados e o próprio SUMMARY.md foram confirmados em
disco; os 3 commits desta execução (`647d128`, `2f67477`, `7644787`) foram confirmados em
`git log --oneline --all`.

---
*Phase: 07-taqciti-config-background-streamer*
*Completed: 2026-09-25*
