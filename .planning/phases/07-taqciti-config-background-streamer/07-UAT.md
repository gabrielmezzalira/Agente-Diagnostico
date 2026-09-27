---
status: diagnosed
phase: 07-taqciti-config-background-streamer
source: [07-VERIFICATION.md]
started: 2026-09-26T13:40:00Z
updated: 2026-09-26T15:20:00Z
---

## Current Test

[testing complete]

## Tests

### 1. SC1 — Streaming ao vivo numa chamada real do Google Meet
expected: |
  Linhas novas aparecem em transcript_chunks / na tela de monitoramento do Agente em poucos segundos
  (não só no fim da chamada), sem a mesma frase repetida; desligar o toggle interrompe o envio na hora.
result: issue
reported: "Transcrição chegando ao vivo e o toggle desligando interrompe o envio na hora (ambos OK).
  Dois problemas encontrados: (1) as falas aparecem fragmentadas em várias linhas separadas na tela de
  monitoramento (ex.: 'Olá, boa noite!' vira duas linhas: 'Você: Olá' e 'Você: boa noite!') em vez de
  uma linha coerente por fala; (2) dizer a mesma frase 3 vezes de verdade ('boa noite' x3) gerou MAIS de
  3 linhas na tela de monitoramento — o streamer está reenviando/duplicando texto já enviado, não só
  refletindo o que foi realmente falado."
severity: major

### 2. SC2 — Fluxo em lote ("Gerar Documento") sem regressão
expected: |
  Com o toggle de streaming desligado, encerrar uma reunião de teste e clicar em "Gerar Documento".
  O documento deve ser gerado como antes desta fase, sem erro nem regressão perceptível.
result: pass

## Summary

total: 2
passed: 1
issues: 1
pending: 0
skipped: 0
blocked: 0

## Gaps

- gap_id: G-07-1
  truth: "Linhas novas aparecem em transcript_chunks / na tela de monitoramento do Agente sem a mesma frase repetida"
  status: failed
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
  status: failed
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
