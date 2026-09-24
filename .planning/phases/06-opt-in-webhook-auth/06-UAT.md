---
status: testing
phase: 06-opt-in-webhook-auth
source: [06-VERIFICATION.md]
started: 2026-09-24T14:28:40Z
updated: 2026-09-24T14:28:40Z
---

## Current Test

number: 1
name: Extension envia o header quando a chave está configurada
expected: |
  Carregar a extensão sem pacote (chrome://extensions → Modo desenvolvedor → "Carregar sem
  compactação" → pasta extension/), abrir o popup com uma sessão ativa, preencher e salvar o
  campo "Chave de autenticação (opcional)", abrir DevTools → Network, disparar um chunk real de
  transcrição (legenda do Meet) e confirmar que o POST /webhook/extension inclui o header
  x-agente-key com o valor exatamente igual ao salvo.
awaiting: user response

## Tests

### 1. Extension envia o header quando a chave está configurada
expected: O request POST /webhook/extension carrega o header x-agente-key com o valor exatamente igual ao salvo em chrome.storage.local.
result: [pending]

### 2. Extension omite o header quando o campo está vazio
expected: Limpar o campo de chave, salvar de novo, disparar outro chunk real e inspecionar o mesmo POST /webhook/extension — o header x-agente-key deve estar AUSENTE da requisição (não vazio — ausente), reproduzindo byte-a-byte o comportamento atual sem a mudança desta fase.
result: [pending]

## Summary

total: 2
passed: 0
issues: 0
pending: 2
skipped: 0
blocked: 0

## Gaps
