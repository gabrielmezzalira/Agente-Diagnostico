---
phase: 07-taqciti-config-background-streamer
plan: 01
subsystem: taqciti-streaming
tags: [git-subtree, chrome-extension, mv3, vitest, typescript, streaming]

requires:
  - phase: 06-opt-in-webhook-auth
    provides: "Gate opt-in `x-agente-key`/`EXTENSION_SHARED_KEY` em `/webhook/extension` (D-01/D-02 da Fase 6), reaproveitado aqui por D-10"
provides:
  - "taqciti/ importado neste repositório via git subtree, com os 105 commits de histórico, num merge commit isolado (D-01/D-02/D-03)"
  - "agenteConfig.ts: padrões de build (VITE_AGENTE_*), normalização de URL, prontidão (StreamingReadiness) e montagem da requisição ExtensionChunk"
  - "wordDelta.ts: função pura do delta palavra-a-palavra por segmento, com cursor chaveado por índice+captionId e regras de prime/espera/reunião nova/troca de sessão"
  - "agenteStreamer.ts: orquestração do streaming — fila serializada, cursor em memória, envio fire-and-forget via injeção de dependência (loadConfig/send)"
  - "sessionController.ts plugado (1 linha em flushState(), sem novo timer)"
  - "48 testes novos (6 e2e + 20 unit wordDelta + 22 unit agenteConfig) provando D-06/D-07/D-08/D-09/D-10"
affects: [07-02-config-runtime, 07-03-config-screen, 08-taqciti-session-association, 09-cutover-retire-extension]

actuals:
  tokens: 10300
  tasks: 3
  commits: 109
  plan_head_before: 46896d8c5b22ac3bef05852526e4c9a29b73246b

tech-stack:
  added: []
  patterns:
    - "Injeção de dependência no streamer (AgenteStreamerDeps: loadConfig/send) como seam de composição/teste — nenhum acoplamento direto a fetch/chrome fora do módulo de orquestração"
    - "Cursor de streaming chaveado por ${índice}:${captionId} (não só captionId) — evita cortar o início de um segmento novo que reaproveita a mesma linha do DOM"
    - "Fila de promessas serializada (mesmo padrão de prefsStore.ts) para colapsar flushes concorrentes num único cálculo de delta"

key-files:
  created:
    - taqciti/src/shared/config/agenteConfig.ts
    - taqciti/src/features/agente/wordDelta.ts
    - taqciti/src/background/agenteStreamer.ts
    - taqciti/src/background/agenteStreamer.test.ts
    - taqciti/src/features/agente/wordDelta.test.ts
    - taqciti/src/shared/config/agenteConfig.test.ts
  modified:
    - taqciti/src/background/sessionController.ts

key-decisions:
  - "Precondição da Task 1 tratada como satisfeita incluindo .planning/state.json (companheiro JSON de STATE.md) na mesma categoria de bookkeeping do GSD que o grep da precondição já previa para STATE.md/ROADMAP.md — nenhuma mudança do usuário (config.json/CLAUDE.md/debug/) estava pendente"
  - "computeSegmentDeltas ganhou tipo de retorno próprio ({ cursor: StreamCursor; deltas: SegmentDelta[] }) em vez de reusar StreamStep (que permite cursor null) — elimina checagens de null desnecessárias, revelado pelo typecheck ao escrever os testes da Task 3"
  - "RED/GREEN da Task 2/3 executados em conjunto (não em commits separados test->feat) porque workflow.tdd_mode do projeto está false (sem gate bloqueante) — todos os 68 testes novos passaram já na primeira execução, sem ciclo de correção"

requirements-completed: [TAQ-01]

coverage:
  - id: D1
    description: "taqciti/ importado via git subtree, com histórico completo (105 commits), em commit isolado (D-01/D-02/D-03)"
    requirement: "TAQ-01"
    verification:
      - kind: other
        ref: "checagens git automatizadas: 2 pais, 284 caminhos só sob taqciti/, 105 commits em HEAD^2, trailer git-subtree-split, 3 varreduras de segredo = 0, branch inalterada"
        status: pass
    human_judgment: false
  - id: D2
    description: "agenteConfig.ts — padrões de build, normalização de URL, prontidão (StreamingReadiness) e montagem da requisição ExtensionChunk"
    requirement: "TAQ-01"
    verification:
      - kind: unit
        ref: "taqciti/src/shared/config/agenteConfig.test.ts (22 casos)"
        status: pass
    human_judgment: false
  - id: D3
    description: "wordDelta.ts — delta puro por segmento (crescimento, captionId reaproveitado, reescrita/encolhimento, limpeza, idempotência, prime/reunião nova/troca de sessão)"
    requirement: "TAQ-01"
    verification:
      - kind: unit
        ref: "taqciti/src/features/agente/wordDelta.test.ts (20 casos)"
        status: pass
    human_judgment: false
  - id: D4
    description: "agenteStreamer.ts + wiring em sessionController.ts — streaming ponta a ponta via dispatch real, desligado por padrão, header condicional, não-bloqueante, idempotente/concorrente"
    requirement: "TAQ-01"
    verification:
      - kind: e2e
        ref: "taqciti/src/background/agenteStreamer.test.ts (6 casos, dispatch real da máquina de estados)"
        status: pass
      - kind: integration
        ref: "cd backend && python -m pytest tests/test_webhook_auth.py -x -q (4 passed — contrato/gate da Fase 6 intactos)"
        status: pass
    human_judgment: false

duration: ~30min
completed: 2026-09-25
status: complete
---

# Phase 7 Plan 1: Import da Taqciti via git subtree + tracer do streaming ao vivo (delta por segmento -> /webhook/extension) Summary

**Traz o repositório completo da Taqciti (105 commits) para `taqciti/` neste repo e prova, com um teste ponta a ponta via `dispatch()` real, que o streaming ao vivo funciona: legenda capturada -> flush de 250ms -> só o texto novo por segmento -> `POST /webhook/extension`, desligado por padrão e sem travar a captura.**

## Performance
- **Duration:** ~30min
- **Started:** 2026-09-25T22:34:12-03:00
- **Completed:** 2026-09-25T22:49:19-03:00
- **Tasks:** 3/3
- **Files modified:** 7 arquivos autorais (6 novos + 1 modificado) além dos 284 caminhos trazidos pelo `git subtree add` (importação, não autoria)

## Accomplishments
- `taqciti/` importado com os 105 commits de histórico, num único merge commit isolado (`9a26937`) que só toca caminhos sob `taqciti/` — sem misturar nenhuma mudança de feature ou do usuário.
- Streaming ao vivo provado ponta a ponta: `MEETING_DETECTED` + `CAPTION_CHUNK` reais via `sessionController.dispatch()` chegam, após o debounce de 250ms, a um `fetch` para `/webhook/extension` com só o texto novo do segmento.
- Gate opt-in (D-09) confirmado: sem configurar o streamer (padrão da build), nenhuma chamada de rede é feita.
- Header `x-agente-key` condicional (D-10): ausente quando a chave está vazia, presente quando preenchida — reaproveitando o mesmo gate da Fase 6 sem alterar `backend/app/routers/webhook.py`.
- Envio fire-and-forget confirmado não-bloqueante: `fetch` rejeitando não impede `dispatch()` de resolver nem a gravação do estado em `chrome.storage.session`.
- Fila serializada confirmada idempotente: duas chamadas concorrentes de `onSessionFlushed` com o mesmo estado geram exatamente 1 `fetch`; uma terceira não gera nenhum.
- 20 casos de borda do delta (crescimento, captionId reaproveitado, reescrita/encolhimento, limpeza, vazio, codificação Unicode, idempotência, prime/reunião nova/troca de sessão) e 22 casos de borda da config (padrões de build, normalização de URL, invariante "salvo vence/ausente cai no padrão", prontidão nas 5 situações, forma exata da requisição) — todos verdes.
- Suíte inteira da Taqciti (`npm test`): 31 arquivos, 415 testes, verde. `npm run typecheck`: 0 erros. `pytest tests/test_webhook_auth.py`: 4 passed (contrato/gate da Fase 6 intactos).

## Task Commits
1. **Task 1 (precondição — bookkeeping do GSD antes do subtree)** - `093f0a1` (docs)
2. **Task 1: importar a Taqciti via git subtree** - `9a26937` (chore)
3. **Task 2 (TRACER): streaming ponta a ponta** - `2669c2b` (feat)
4. **Task 3: casos de borda do delta e da config** - `ed8cbfa` (test)
**Plan metadata:** commit final deste SUMMARY (a seguir)

## Files Created/Modified
- `taqciti/` (284 arquivos, importados via subtree) - código-fonte completo da extensão Taqciti, com histórico
- `taqciti/src/shared/config/agenteConfig.ts` - padrões de build, normalização, prontidão, montagem da requisição
- `taqciti/src/features/agente/wordDelta.ts` - delta puro por segmento + regras do cursor
- `taqciti/src/background/agenteStreamer.ts` - orquestração do streaming (fila + cursor + envio)
- `taqciti/src/background/sessionController.ts` - 1 chamada nova em `flushState()`, fire-and-forget
- `taqciti/src/background/agenteStreamer.test.ts` - teste ponta a ponta (dispatch real)
- `taqciti/src/features/agente/wordDelta.test.ts` - 20 casos de borda do delta
- `taqciti/src/shared/config/agenteConfig.test.ts` - 22 casos de borda da config

## Decisions Made
- **Precondição da Task 1 e `.planning/state.json`:** o `git status --porcelain` no início mostrava só `.planning/STATE.md` e `.planning/state.json` modificados (as mudanças do usuário citadas no objetivo do plano — `config.json`, `CLAUDE.md`, `.planning/debug/` — já tinham sido commitadas em `46896d8`, antes desta execução). `state.json` é o companheiro JSON de `STATE.md` (mesmo mecanismo `gsd_run query state.*`), da mesma categoria de "bookkeeping do próprio GSD" que a Passo 3 do plano já antecipa — por isso foi incluído, junto com `STATE.md`, no commit `docs(07): registra início da execução da fase 7` (`093f0a1`) ANTES do subtree, mantendo a precondição de fato satisfeita (nenhum conteúdo do usuário entrou no commit da importação).
- **`computeSegmentDeltas` com tipo de retorno próprio:** ver Deviations abaixo.
- **RED/GREEN em conjunto:** ver Deviations abaixo.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug de tipo] `computeSegmentDeltas` com retorno `StreamStep` obrigava checagem de null desnecessária**
- **Found during:** Task 3 (`npm run typecheck` após escrever `wordDelta.test.ts`)
- **Issue:** `computeSegmentDeltas` sempre devolve um cursor não-nulo, mas sua assinatura reusava o tipo compartilhado `StreamStep` (`cursor: StreamCursor | null`), obrigando os testes (e qualquer chamador futuro) a lidar com um `null` que nunca ocorre na prática.
- **Fix:** assinatura de retorno estreitada para `{ cursor: StreamCursor; deltas: SegmentDelta[] }`, mantendo `planStreamStep` com o tipo mais amplo `StreamStep` (que de fato pode devolver `null` nos ramos 1/2).
- **Files modified:** `taqciti/src/features/agente/wordDelta.ts`
- **Verification:** `npm run typecheck` (0 erros) + `npx vitest run src/features/agente/wordDelta.test.ts` (20/20) após a mudança
- **Commit:** `ed8cbfa`

### Notas de processo (não são deviations de regra 1-4)

**2. RED/GREEN da Task 2 e da Task 3 executados em conjunto.** O plano pede "escreva o teste, confirme RED, rode até GREEN" — mas como `workflow.tdd_mode` deste projeto está `false` (sem gate bloqueante que exija um commit RED separado antes do GREEN), o teste ponta a ponta (Task 2) e os testes de borda (Task 3) foram escritos junto com o código que implementam, e todos os 48 casos novos passaram já na primeira execução (`agenteStreamer.test.ts`: 6/6; `wordDelta.test.ts` + `agenteConfig.test.ts`: 42/42). Não houve ciclo de correção de bug real revelado por teste — só o ajuste de tipo do item 1 acima, encontrado pelo `tsc`, não por um teste falhando.

**Total deviations:** 1 auto-fixed (Rule 1, cosmético de tipo). **Impact on plan:** nenhum — comportamento do caminho feliz inalterado; só a assinatura de tipo do retorno de uma função pura ficou mais precisa.

## Issues Encountered
None. `npm ci` funcionou de primeira (sem EPERM/EBUSY do OneDrive); `git fetch` ao repositório remoto da Taqciti teve rede disponível e o SHA de `FETCH_HEAD` bateu exatamente com o pesquisado (`c41309a1c58f3fa06095db877e6dc8f1dbd65635`) — nenhuma das duas DECISÕES EM ABERTO condicionais do plano (SHA divergente / segredo no histórico) foi acionada.

## User Setup Required
None - o streaming continua desligado por padrão (D-09); nenhuma variável de ambiente/serviço externo precisa ser configurada para esta fase funcionar como entregue. `VITE_AGENTE_BACKEND_URL`/`VITE_AGENTE_STREAMING_ENABLED` são opcionais e só afetam quem decidir configurá-las na build.

## Next Phase Readiness
Pronto para o Plano 02 (config editável em runtime): `agenteStreamer.ts` já expõe `configureAgenteStreamer({ loadConfig, send })` como seam — o Plano 02 só precisa criar `agenteConfigStore.ts` (padrão `prefsStore.ts`) e chamar `configureAgenteStreamer({ loadConfig: loadAgenteConfig })` uma vez, sem tocar no restante do streamer. Nenhum bloqueio conhecido. A verificação manual ponta a ponta numa chamada real do Google Meet (SC1 do roadmap) permanece propositalmente adiada para o Plano 03/UAT, conforme a Seção 7 do próprio plano e o `07-VALIDATION.md`.

## Self-Check: PASSED

Todos os 6 arquivos de código/teste criados e o próprio SUMMARY.md foram confirmados em disco;
os 4 commits desta execução (`093f0a1`, `9a26937`, `2669c2b`, `ed8cbfa`) foram confirmados em
`git log --oneline --all`.

---
*Phase: 07-taqciti-config-background-streamer*
*Completed: 2026-09-25*
