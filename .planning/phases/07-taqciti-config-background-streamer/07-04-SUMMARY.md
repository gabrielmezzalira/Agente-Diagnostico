---
phase: 07-taqciti-config-background-streamer
plan: 04
subsystem: taqciti-streaming
tags: [taqciti, agente-streamer, phrase-batching, tdd, gap-closure]

requires:
  - phase: 07-taqciti-config-background-streamer (07-01/07-02/07-03)
    provides: agenteStreamer.ts (envio por flush) e agenteConfig.ts (config de streaming) que este plano refina
provides:
  - Janela de agrupamento por fala no envio ao Agente (G-07-1/G-07-2 fechados)
  - phraseBatcher.ts — política pura de buffer/liberação por fala, reutilizável
  - D-06 refinado, registrado como decisão travada aprovada pelo time
affects: [08-taqciti-session-binding, 09-taqciti-extension-cutover]

actuals:
  tokens: 13100
  tasks: 3
  commits: 3
  plan_head_before: b8956686df241db3fabc112fd8431c48dff26457
  plan_head_after: 2d0727d255d00b37d206cc4a1164361912c47d7f

tech-stack:
  added: []
  patterns:
    - "Buffer de falas pendentes (phraseBatcher.ts) desacoplado do debounce de custo local (STATE_FLUSH_INTERVAL_MS) — mesmo padrão de módulo puro sem chrome/fetch/timers já usado em wordDelta.ts"
    - "Timer único por instância do streamer, cancelado/rearmado a cada passo, sempre dentro da mesma fila serializada do cursor (mesmo princípio de D-07/idempotência)"

key-files:
  created:
    - taqciti/src/features/agente/phraseBatcher.ts
    - taqciti/src/features/agente/phraseBatcher.test.ts
  modified:
    - taqciti/src/shared/config/agenteConfig.ts
    - taqciti/src/background/agenteStreamer.ts
    - taqciti/src/background/agenteStreamer.test.ts
    - taqciti/src/features/agente/wordDelta.test.ts

key-decisions:
  - "D-06 refinado (aprovado pelo usuário em 2026-09-26, opção phrase-window): envio ao Agente ganha janela própria por fala — silêncio 1500 ms (AGENTE_PHRASE_QUIET_MS), teto 5000 ms (AGENTE_PHRASE_MAX_WAIT_MS), envio imediato ao sair de 'recording'; a parte estrutural do D-06 (alimentado só por flushState(), sem diff em sessionController.ts/constants.ts/wordDelta.ts) continua valendo."
  - "Chamar onSessionFlushed()/step() enquanto o streaming está desligado reseta o cursor do wordDelta para null (comportamento pré-existente, não introduzido por este plano) — o primeiro flush pós-religar sempre re-ancora (prime) antes de qualquer envio novo; isso ficou explícito num teste de borda corrigido durante a Task 3, sem tocar phraseBatcher.ts/agenteStreamer.ts."

patterns-established:
  - "Módulo de política pura para janelas temporais: nenhuma dependência de chrome/fetch/setTimeout/Date.now dentro de phraseBatcher.ts — todo estado de tempo (now, quietMs, maxWaitMs) é parâmetro explícito, testável sem mock."

requirements-completed: [TAQ-01]

coverage:
  - id: D1
    description: "G-07-1 fechado — uma fala cujas palavras chegam em ciclos de flush de 250ms diferentes gera 1 POST/1 linha, não uma por pedaço"
    requirement: "TAQ-01"
    verification:
      - kind: e2e
        ref: "taqciti/src/background/agenteStreamer.test.ts#G-07-1: uma fala vira um envio (janela de agrupamento por fala) > duas palavras da mesma fala, chegando em ciclos de flush diferentes, geram 1 POST só depois do silêncio"
        status: pass
    human_judgment: false
  - id: D2
    description: "G-07-2 fechado — fala contínua repetida sem pausa vira 1 envio com todas as palavras; repetida com pausa longa vira N envios, sem perder nem repetir palavra"
    requirement: "TAQ-01"
    verification:
      - kind: e2e
        ref: "taqciti/src/background/agenteStreamer.test.ts#G-07-2 e bordas da janela por fala (Task 3, plano 07-04) > G-07-2a"
        status: pass
      - kind: e2e
        ref: "taqciti/src/background/agenteStreamer.test.ts#G-07-2 e bordas da janela por fala (Task 3, plano 07-04) > G-07-2b"
        status: pass
    human_judgment: false
  - id: D3
    description: "Teto de espera (5000ms) preserva o SC1 (quase tempo real) mesmo em fala contínua sem pausa"
    requirement: "TAQ-01"
    verification:
      - kind: e2e
        ref: "taqciti/src/background/agenteStreamer.test.ts#G-07-2 e bordas da janela por fala (Task 3, plano 07-04) > teto em fala contínua"
        status: pass
      - kind: unit
        ref: "taqciti/src/features/agente/phraseBatcher.test.ts#phraseBatcher / takeReady > crescendo sem parar, a fala sai quando now - firstAt atinge maxWaitMs mesmo sem silêncio"
        status: pass
    human_judgment: false
  - id: D4
    description: "Envio imediato do pendente quando a reunião sai de 'recording' (fim ou pausa) — nunca espera a janela nesse caso"
    requirement: "TAQ-01"
    verification:
      - kind: e2e
        ref: "taqciti/src/background/agenteStreamer.test.ts#G-07-2 e bordas da janela por fala (Task 3, plano 07-04) > fim"
        status: pass
      - kind: e2e
        ref: "taqciti/src/background/agenteStreamer.test.ts#G-07-2 e bordas da janela por fala (Task 3, plano 07-04) > pausa"
        status: pass
    human_judgment: false
  - id: D5
    description: "D-09 (desligar descarta o pendente) e D-04 (troca de sessão nunca move palavras entre sessões) preservados com a janela por fala"
    requirement: "TAQ-01"
    verification:
      - kind: e2e
        ref: "taqciti/src/background/agenteStreamer.test.ts#G-07-2 e bordas da janela por fala (Task 3, plano 07-04) > toggle com fala pendente"
        status: pass
      - kind: e2e
        ref: "taqciti/src/background/agenteStreamer.test.ts#G-07-2 e bordas da janela por fala (Task 3, plano 07-04) > troca de sessão"
        status: pass
    human_judgment: false
  - id: D6
    description: "Cadência local da Taqciti (chrome.storage.session a cada 250ms, broadcast ao painel) intacta e independente do envio ao Agente; sessionController.ts/constants.ts/wordDelta.ts/backend sem diff"
    requirement: "TAQ-01"
    verification:
      - kind: e2e
        ref: "taqciti/src/background/agenteStreamer.test.ts#G-07-2 e bordas da janela por fala (Task 3, plano 07-04) > cadência local intacta"
        status: pass
      - kind: other
        ref: "git diff --quiet bb208c2656fa9bb9647d4afac187ea316cb553fc -- taqciti/src/background/sessionController.ts taqciti/src/shared/config/constants.ts taqciti/src/features/agente/wordDelta.ts taqciti/package.json taqciti/package-lock.json backend"
        status: pass
    human_judgment: false
  - id: D7
    description: "Reteste manual do Teste 1 da UAT (SC1) numa chamada real do Google Meet — comportamento visível ao vivo (atraso de ~1.5s, agrupamento correto) não é provável só por teste automatizado"
    human_judgment: true
    rationale: "Requer uma chamada real do Meet com legendas, o comercial/produto observando a tela de monitoramento — comportamento perceptual e de rede real, não reproduzível por vitest/jsdom."

duration: 24min
completed: 2026-09-27
status: complete
---

# Phase 7 Plan 4: Janela de agrupamento por fala no streamer da Taqciti Summary

**Fecha G-07-1/G-07-2 substituindo o envio por-flush-de-250ms por uma janela própria por fala (silêncio 1500ms, teto 5000ms) num módulo puro novo (`phraseBatcher.ts`), sem tocar a cadência local da Taqciti.**

## Performance

- **Duration:** 24 min
- **Started:** 2026-09-27T00:44:20Z
- **Completed:** 2026-09-27T01:08:19Z
- **Tasks:** 3 (1 checkpoint:decision já respondido pelo usuário + 1 tracer TDD + 1 auto TDD)
- **Files modified:** 6 (2 criados, 4 modificados)

## Accomplishments

- **D-06 refinado e aprovado pelo time** (opção `phrase-window`, 2026-09-26): o envio ao Agente ganhou uma janela própria de agrupamento por fala, revogando só a parte "sem cadência própria" do D-06 original — a parte estrutural (streamer alimentado só por `flushState()`) continua intacta.
- **G-07-1 fechado:** uma fala cujas palavras chegam em ciclos de flush de 250ms diferentes agora gera exatamente 1 POST/1 linha na tela de monitoramento, não uma por pedaço.
- **G-07-2 fechado:** fala contínua sem pausa vira 1 envio com todas as palavras faladas; repetições com pausa longa viram N envios distintos, sempre com o total de palavras batendo exatamente com o que foi falado — sem perder nem repetir nenhuma.
- **`phraseBatcher.ts` criado:** módulo de funções puras (`appendDeltas`, `takeReadyPhrases`, `nextPhraseDeadline`) que acumula as palavras novas de cada segmento numa fala pendente e decide quando ela sai (silêncio, teto de espera, ou reunião saiu de `recording`) — sem `chrome`, `fetch`, `setTimeout` nem `Date.now`, 100% testável sem mock.
- **`agenteStreamer.ts` estendido:** buffer de falas + um único timer da janela, tudo dentro da mesma fila serializada do cursor (preserva D-07/idempotência); instância ganhou `dispose()`.
- **Cadência local, backend e dependências intactos:** `sessionController.ts`, `constants.ts`, `wordDelta.ts`, `taqciti/package.json`, `taqciti/package-lock.json` e `backend/` seguem com diff zero contra `bb208c2` (o commit anterior a este plano).
- **59 testes novos/adaptados** cobrindo os dois gaps, as bordas da janela (teto em fala contínua, fim, pausa, toggle, troca de sessão) e a política pura isoladamente; bateria completa da Taqciti (typecheck + lint + 468 testes + build) sai 0.

## Task Commits

Cada task foi commitada atomicamente (Task 2 seguiu o ciclo RED→GREEN da TDD):

1. **Task 1 (CHECKPOINT: confirmar o refinamento do D-06)** — decidida pelo usuário/orquestrador antes desta execução, sem código (nenhum commit).
2. **Task 2 — RED:** `8b67343` — `test(07-04): reproduz G-07-1 — fala fragmentada em dois envios` (constantes novas + teste que falha no código atual).
3. **Task 2 — GREEN:** `72c9be9` — `fix(07-04): agrupa o envio ao Agente por fala (G-07-1/G-07-2)` (phraseBatcher.ts novo + agenteStreamer.ts com buffer/timer + 10 testes existentes adaptados à janela).
4. **Task 3:** `2d0727d` — `test(07-04): casos de borda da janela por fala` (phraseBatcher.test.ts novo, +1 caso em wordDelta.test.ts, +8 casos e2e em agenteStreamer.test.ts — nenhum revelou bug real, nenhum commit `fix()` separado foi necessário).

**Plan metadata:** commit desta seção (a seguir).

## Files Created/Modified

- `taqciti/src/features/agente/phraseBatcher.ts` (novo) — política pura da janela de agrupamento por fala.
- `taqciti/src/features/agente/phraseBatcher.test.ts` (novo) — 18 testes da política pura (append, takeReady, depois do envio, nextPhraseDeadline, coerência).
- `taqciti/src/shared/config/agenteConfig.ts` — `AGENTE_PHRASE_QUIET_MS` (1500) e `AGENTE_PHRASE_MAX_WAIT_MS` (5000).
- `taqciti/src/background/agenteStreamer.ts` — buffer de falas + timer único da janela, `dispose()`, `configureAgenteStreamer` descarta a instância anterior.
- `taqciti/src/background/agenteStreamer.test.ts` — 10 testes existentes adaptados ao novo relógio + 1 teste novo de G-07-1 (Task 2) + 8 testes novos de bordas (Task 3): 20 testes no total.
- `taqciti/src/features/agente/wordDelta.test.ts` — +1 caso de contrato com o agrupador (wordDelta.ts sem diff).

## Decisions Made

- **D-06 refinado (aprovado pelo usuário em 2026-09-26, opção phrase-window):** envio ao Agente ganha janela própria por fala — silêncio 1500 ms e teto 5000 ms, envio imediato ao sair de `recording`; a parte estrutural do D-06 (alimentado só por `flushState()`, sem diff em `sessionController.ts`/`constants.ts`/`wordDelta.ts`) continua valendo.
- **Cursor reseta ao null quando o streaming está desligado (comportamento pré-existente):** ficou explícito durante a Task 3 que qualquer passo do streamer executado enquanto desligado zera o cursor do `wordDelta` (não só o buffer de falas) — o primeiro flush pós-religar sempre re-ancora (prime) antes de qualquer envio novo. Isso não é uma regressão deste plano (o mesmo mecanismo já existia e foi provado no teste "desligar/religar" adaptado na Task 2); só corrigi a suposição de um teste novo da Task 3 que não tinha essa sequência de prime em conta — nenhum código de produção mudou por causa disso.

## Deviations from Plan

None - plan executado exatamente como escrito. As 3 tasks seguiram a ordem e o conteúdo do `07-04-PLAN.md`; a única correção durante a Task 3 foi num teste (suposição de timing errada sobre o prime pós-religar), não no código de produção — coberta pela própria instrução do plano ("se nenhum falhar, não toque no código").

## TDD Gate Compliance

- **RED:** `8b67343` — `test(07-04): reproduz G-07-1 — fala fragmentada em dois envios` (existe e precede o GREEN).
- **GREEN:** `72c9be9` — `fix(07-04): agrupa o envio ao Agente por fala (G-07-1/G-07-2)`.
- **REFACTOR:** nenhum commit — o código ficou dentro do limite de 200 linhas e sem duplicação óbvia após o GREEN; nenhuma limpeza adicional foi necessária.
- **RED evidence:** verificado via `gsd_run check tdd-red-evidence` → `RED_EVIDENCE_OK` (target test "G-07-1: uma fala vira um envio (janela de agrupamento por fala) > duas palavras da mesma fala, chegando em ciclos de flush diferentes, geram 1 POST só depois do silêncio" falhou por uma asserção real de ausência de fetch, não por erro de carregamento/sintaxe).

Status: **PASS** — RED antes de GREEN confirmado no histórico do git, com evidência de falha intencional.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Verificação manual pendente

O `<human-check>` da Task 3 (SC1 da fase, reteste do Teste 1 da UAT) **não foi executado nesta sessão** — fica registrado aqui, palavra por palavra do plano, para `/gsd-verify-work 07`:

> Reteste do Teste 1 da UAT (SC1) numa chamada real: `cd taqciti && npm run build`; em chrome://extensions,
> recarregar a Taqciti "sem compactação" (pasta `taqciti/dist`) e manter a extensão antiga do Agente
> (`extension/`) DESATIVADA. Na tela "Agente Diagnóstico" da Taqciti, toggle ligado + ID da sessão ativa.
> Numa chamada do Meet com legendas: (1) diga "Olá, boa noite!" em ritmo normal → UMA linha na tela de
> monitoramento, cerca de 1,5 s depois de parar de falar; (2) diga "boa noite" 3 vezes seguidas, sem pausa
> longa → UMA linha com as 6 palavras; (3) diga três frases DIFERENTES separadas por ~3 s de silêncio
> ("boa noite", "tudo bem", "até logo") → três linhas; (4) fale sem parar por ~15 s → linhas chegando a
> cada ~5 s no máximo, não só no fim; (5) desligue o toggle no meio de uma frase → nada novo chega.
> Para não confundir: repetir a MESMA frase com pausa longa gera as 3 linhas em `transcript_chunks`
> (Supabase), mas a tela ao vivo pode mostrar só 1, porque o backend descarta um chunk idêntico ao
> anterior do mesmo falante (`pipeline.py::push_chunk`, comportamento pré-existente — DECISÃO EM ABERTO
> da seção 6, não é regressão deste plano). Registrar o resultado na UAT com `/gsd-verify-work 07`.

## Next Phase Readiness

- G-07-1 e G-07-2 (os dois gaps abertos pela UAT da Fase 7) estão fechados por teste automatizado; falta só o reteste manual acima antes de considerar a Fase 7 verificada ponta a ponta.
- Fase 8 (TAQ-02, session binding automático) pode seguir normalmente — nenhuma interface consumida por este plano mudou (`AgenteStreamerDeps`, `AgenteConfig`, contrato `{session_id, text, speaker}`).
- Duas decisões em aberto continuam registradas na seção 6 do plano (fora do escopo desta execução): ajustar a deduplicação por prefixo do backend (`pipeline.py::push_chunk`) e os itens já listados no `07-REVIEW.md` (CR-01, WR-01/02/03/04/05/06/07/08) para o `/gsd-code-review --fix`.

## Self-Check: PASSED

All created files verified present on disk (`taqciti/src/features/agente/phraseBatcher.ts`,
`taqciti/src/features/agente/phraseBatcher.test.ts`) and all modified files verified present
(`taqciti/src/background/agenteStreamer.ts`, `taqciti/src/background/agenteStreamer.test.ts`,
`taqciti/src/shared/config/agenteConfig.ts`, `taqciti/src/features/agente/wordDelta.test.ts`).
All 3 task commits verified present in git history (`8b67343`, `72c9be9`, `2d0727d`).

---
*Phase: 07-taqciti-config-background-streamer*
*Completed: 2026-09-27*
