---
status: complete
phase: 07-taqciti-config-background-streamer
source: [07-VERIFICATION.md]
started: 2026-09-26T13:40:00Z
updated: 2026-09-26T15:00:00Z
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
  artifacts: []
  missing: []

- gap_id: G-07-2
  truth: "Linhas novas aparecem em transcript_chunks / na tela de monitoramento do Agente em poucos segundos, sem a mesma frase repetida"
  status: failed
  reason: "User reported: dizer a mesma frase 3 vezes de verdade ('boa noite' x3) gerou MAIS de 3 linhas na tela de monitoramento — indica que o streamer está reenviando/duplicando texto já mandado (cursor do wordDelta não está deduplicando corretamente), não só refletindo o que foi de fato falado"
  severity: major
  test: 1
  artifacts: []
  missing: []

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
