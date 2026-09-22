---
status: complete
phase: 03-two-agent-questions-lens-tagging
source: 03-01-SUMMARY.md, 03-02-SUMMARY.md, 03-03-SUMMARY.md
started: 2026-09-22T11:24:49Z
updated: 2026-09-22T11:25:30Z
---

## Current Test
<!-- OVERWRITE each test - shows where we are -->

[testing complete]

## Tests

### 1. Cold Start do backend com o código da lente
expected: Backend importa/inicia sem erro; coverage_areas e session_state carregam; by_lens('produto')=8 áreas, by_lens('dados')=10 áreas.
result: pass
reported: "IMPORT_OK 8 10 e rodei o terminal"

### 2. LENS-01/02 — dois planejadores por lente (discovery)
expected: No discovery, planner Produto pede 3 perguntas (sempre roda) e Dados pede 2 (só em gatilho par), escopados por lente; sales continua com 1 planner.
result: pass
source: automated
coverage_id: 03-01/D1-D2

### 3. LENS-03 — fila única com lens por pergunta + persistência
expected: Perguntas dos dois agentes caem na mesma fila, cada uma com lens (produto/dados); questions.lens persiste e QuestionResponse expõe o campo.
result: pass
source: automated
coverage_id: 03-01/D3 + 03-02/D1-D2

### 4. LENS-04 — lens em red flags e coverage areas
expected: Red flags carregam lens (allowlist {produto,dados} + fallback produto); cada área de coverage deriva lens do registro estático; sales fica lens None.
result: pass
source: automated
coverage_id: 03-03/D-redflags + D6

### 5. LENS-05 — dedup entre agentes (só discovery)
expected: Nenhuma pergunta duplicada entre Produto e Dados (nem dentro do mesmo lote), via trava de texto normalizado; sales não aplica a trava.
result: pass
source: automated
coverage_id: 03-01/D3(SC#5)

### 6. Regressão sales (D-24) — byte-idêntico
expected: Modo sales inalterado: 1 planner, lens=None, sem contador, sem dedup normalizado; suíte golden das Fases 1-2 verde.
result: pass
source: automated
coverage_id: 03-01/D4-D5 + 03-03/D7

## Summary

total: 6
passed: 6
issues: 0
pending: 0
skipped: 0

## Gaps

[none yet]

## Deferred Follow-Ups

- test: (visual)
  idea: "Observar a lente (produto/dados) ao vivo nas perguntas/alertas/coverage na tela de monitoramento — depende da Fase 5 (Two-Lens Monitoring Frontend), ainda não construída."
  deferred_at: 2026-09-22
