---
status: testing
phase: 06-opt-in-webhook-auth
source: [06-VERIFICATION.md]
started: 2026-09-24T23:22:48Z
updated: 2026-09-24T23:22:48Z
---

## Current Test

number: 1
name: Verificação manual no Chrome real (DevTools → Network) — header x-agente-key presente/ausente
expected: |
  Header presente com o valor salvo quando a chave está preenchida; header totalmente ausente (não string vazia) quando a chave foi limpa e salva vazia.
awaiting: user response

## Tests

### 1. Carregar a extensão sem pacote no Chrome real (chrome://extensions → Modo desenvolvedor → Carregar sem compactação → pasta extension/), abrir o popup com uma sessão ativa, preencher e salvar o campo "Chave de autenticação (opcional)", abrir DevTools → Network, disparar um chunk de transcrição real e confirmar que o POST /webhook/extension inclui o header x-agente-key com o valor salvo; limpar o campo, salvar de novo, repetir e confirmar que o header está AUSENTE (não vazio).
expected: Header presente com o valor salvo quando a chave está preenchida; header totalmente ausente (não string vazia) quando a chave foi limpa e salva vazia.
result: [pending]

## Summary

total: 1
passed: 0
issues: 0
pending: 1
skipped: 0
blocked: 0

## Gaps
