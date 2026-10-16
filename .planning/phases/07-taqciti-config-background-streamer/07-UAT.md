---
status: complete
phase: 07-taqciti-config-background-streamer
source: [07-VERIFICATION.md]
started: 2026-09-26T13:40:00Z
updated: 2026-09-27T00:15:00Z
---

## Current Test

[testing complete]

## Tests

### 1. SC1 — Streaming ao vivo numa chamada real do Google Meet
expected: |
  Numa chamada real do Google Meet, com o toggle de streaming ligado:
  (1) dizer "Olá, boa noite!" em ritmo normal deve virar 1 linha coerente na tela de monitoramento
      do Agente (não mais fragmentada em "Você: Olá" / "Você: boa noite!");
  (2) dizer "boa noite" 3x seguidas SEM pausa deve virar 1 linha só; com pausa perceptível entre as
      repetições, cada repetição vira sua própria linha (no máximo 3 linhas, uma por fala real —
      nunca mais linhas do que falas);
  (3) falar sem parar por uns 15s deve fatiar em linhas de no máximo ~5s (teto de fala contínua),
      sem perder nem repetir palavra;
  (4) desligar o toggle no meio de uma fala interrompe o envio na hora, sem nada chegando depois.
result: pass
note: |
  Reteste pós gap-closure (plano 07-04, phraseBatcher.ts — janela de silêncio 1500ms / teto 5000ms).
  Primeira rodada (2026-09-26) encontrou G-07-1 e G-07-2, ambos com plano de correção executado
  e coberto por 20 testes automatizados (agenteStreamer.test.ts). Reteste humano ao vivo no Meet
  confirmado OK pelo usuário em 2026-09-27.

### 2. SC2 — Fluxo em lote ("Gerar Documento") sem regressão
expected: |
  Com o toggle de streaming desligado, encerrar uma reunião de teste e clicar em "Gerar Documento".
  O documento deve ser gerado como antes desta fase, sem erro nem regressão perceptível.
result: pass

## Summary

total: 2
passed: 2
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps

- gap_id: G-07-1
  truth: "Linhas novas aparecem em transcript_chunks / na tela de monitoramento do Agente sem a mesma frase repetida"
  status: resolved
  resolved_by: 07-04-PLAN.md
  resolved_at: 2026-09-27
  reason: "User reported: falas chegam fragmentadas em várias linhas separadas na tela de monitoramento (ex.: 'Olá, boa noite!' vira duas linhas: 'Você: Olá' e 'Você: boa noite!') em vez de uma linha coerente por fala"
  severity: minor
  test: 1
  root_cause: "Gap de granularidade de envio (não é bug de correção): agenteStreamer.ts dispara um POST /webhook/extension a cada flush coalescido que contenha palavra(s) nova(s), sem acumular entre flushes. sessionController.ts usa um debounce fixo de disparo único (STATE_FLUSH_INTERVAL_MS=250ms, scheduleFlush()) reaproveitado tal e qual do debounce interno de persistência local da Taqciti — nunca foi calibrado pra tamanho de chunk de rede. Duas palavras novas do mesmo segmento espaçadas mais de 250ms (fala com pausa normal) viram duas requisições/linhas separadas. wordDelta.ts (o cálculo do delta em si) está correto e é idempotente — não é o problema."
  artifacts:
    - path: "taqciti/src/background/agenteStreamer.ts"
      issue: "Envia um delta a cada flush, sem acumular entre flushes (nenhuma lógica de agrupamento por frase)"
    - path: "taqciti/src/background/sessionController.ts"
      issue: "scheduleFlush()/flushState()/STATE_FLUSH_INTERVAL_MS — debounce de disparo único de 250ms, compartilhado sem ajuste entre a persistência local e o envio de rede pro Agente"
    - path: "taqciti/src/shared/config/constants.ts"
      issue: "STATE_FLUSH_INTERVAL_MS=250 é de propósito geral (persistência local), não calibrado pra tamanho de chunk de rede"
  missing:
    - "Desacoplar a granularidade do envio de rede pro Agente do debounce de 250ms de persistência local da Taqciti"
    - "Acumular as palavras novas de um segmento entre vários ciclos de flush, mandando só depois de um período de silêncio (sem chunk novo daquele segmento por N ms) ou quando o segmento/linha de legenda for finalizado"
  debug_session: ".planning/debug/duplicate-caption-resend.md"

- gap_id: G-07-2
  truth: "Linhas novas aparecem em transcript_chunks / na tela de monitoramento do Agente em poucos segundos, sem a mesma frase repetida"
  status: resolved
  resolved_by: 07-04-PLAN.md
  resolved_at: 2026-09-27
  reason: "User reported: dizer 'boa noite' 3x virou 6 linhas separadas, uma por PALAVRA (Boa / noite / boa / noite / boa / noite) — CORRIGIDO após esclarecimento do usuário: não é palavra fantasma nem reenvio de texto já mandado (contagem bate exatamente com o que foi falado, 2 palavras x 3 repetições = 6), é o MESMO mecanismo de G-07-1 (granularidade de envio), só observado num grau mais extremo porque as palavras desta reprodução ficaram espaçadas mais que 250ms"
  severity: major
  test: 1
  root_cause: "Mesma causa raiz de G-07-1 — ver acima. Confirmado por evidência: wordDelta.ts é estruturalmente incapaz de reenviar uma palavra já contabilizada (prova: teste de idempotência do wordDelta.test.ts + teste de concorrência do agenteStreamer.test.ts, onde 2 flushes simultâneos com o mesmo estado geram exatamente 1 fetch, um 3º gera 0). O gap é só a granularidade do envio (por flush, não por frase/segmento), não um bug de duplicação."
  artifacts:
    - path: "taqciti/src/background/agenteStreamer.ts"
      issue: "Mesmo artefato de G-07-1 — envia um delta a cada flush, sem acumular entre flushes"
    - path: "taqciti/src/background/sessionController.ts"
      issue: "Mesmo artefato de G-07-1 — debounce de disparo único de 250ms compartilhado com a persistência local"
  missing:
    - "Mesma correção de G-07-1 — resolver os dois gaps com uma única mudança de agrupamento/lote no envio"
  debug_session: ".planning/debug/duplicate-caption-resend.md"

## Deferred Follow-Ups

- test: 1
  idea: "Melhorar pontuação/coerência do texto (vem direto da legenda nativa do Meet, sem limpeza) — promovido para ROADMAP.md Phase 999.1"
  deferred_at: 2026-09-26
- test: 1
  idea: "Deixar mais explícito o link 'Agente Diagnóstico · streaming ao vivo' na tela inicial da Taqciti — promovido para ROADMAP.md Phase 999.2"
  deferred_at: 2026-09-26
- test: 1
  idea: "Opção de não gerar transcrição para uma reunião — promovido para ROADMAP.md Phase 999.3"
  deferred_at: 2026-09-26
- test: 1
  idea: "Aba separada de perguntas (discovery) vs. reuniões de transcrição pura por área — já coberto pelo ROADMAP.md Phase 10 (AGP Question Panel in Taqciti, TAQ-05), sem necessidade de novo item de backlog"
  deferred_at: 2026-09-26
