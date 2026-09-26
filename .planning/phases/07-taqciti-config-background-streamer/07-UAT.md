---
status: testing
phase: 07-taqciti-config-background-streamer
source: [07-VERIFICATION.md]
started: 2026-09-26T13:40:00Z
updated: 2026-09-26T13:40:00Z
---

## Current Test

number: 1
name: SC1 — Streaming ao vivo numa chamada real do Google Meet
expected: |
  Carregar taqciti/dist no Chrome (extensão antiga do Agente desativada), ligar o toggle na tela
  "Agente Diagnóstico", colar o session_id (UUID) de uma sessão ativa do Agente, entrar numa chamada
  de teste do Meet e falar algumas frases. Linhas novas devem aparecer em transcript_chunks / na tela
  de monitoramento do Agente em poucos segundos (não só no fim da chamada), sem repetir a mesma frase;
  desligar o toggle deve interromper o envio na hora.
awaiting: user response

## Tests

### 1. SC1 — Streaming ao vivo numa chamada real do Google Meet
expected: |
  Linhas novas aparecem em transcript_chunks / na tela de monitoramento do Agente em poucos segundos
  (não só no fim da chamada), sem a mesma frase repetida; desligar o toggle interrompe o envio na hora.
result: [pending]

### 2. SC2 — Fluxo em lote ("Gerar Documento") sem regressão
expected: |
  Com o toggle de streaming desligado, encerrar uma reunião de teste e clicar em "Gerar Documento".
  O documento deve ser gerado como antes desta fase, sem erro nem regressão perceptível.
result: [pending]

## Summary

total: 2
passed: 0
issues: 0
pending: 2
skipped: 0
blocked: 0

## Gaps
