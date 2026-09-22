---
status: complete
phase: 03-two-agent-questions-lens-tagging
source: [03-01-SUMMARY.md, 03-02-SUMMARY.md, 03-03-SUMMARY.md]
started: 2026-09-22T13:53:36Z
updated: 2026-09-22T13:54:30Z
---

## Current Test

[testing complete]

## Tests

### 1. Cold Start Smoke Test
expected: Mate qualquer backend/serviço rodando e limpe estado efêmero (caches, lock files). Suba o backend do zero. Ele inicia sem erros, a migração `20260922000000_add_lens_tagging.sql` está aplicada, e uma query primária (health check, criar sessão discovery, ou listar projetos) responde com dados vivos.
result: pass
reported: "o backend subiu limpo"

### 2. Produto e Dados populam a fila com a lente correta (LENS-01)
expected: Numa sessão discovery, os agentes de Produto e Dados inserem perguntas na mesma fila com a lente certa em cada uma.
result: pass
source: automated
coverage_id: D1

### 3. Cadência par do agente de Dados (LENS-02)
expected: O agente de Dados só dispara em gatilhos pares (2,4,6…); Produto dispara em todo gatilho discovery.
result: pass
source: automated
coverage_id: D2

### 4. Dedup por texto normalizado entre agentes (LENS-05)
expected: Nenhuma dupla de texto normalizado na fila, mesmo entre agentes diferentes ou dentro do mesmo lote.
result: pass
source: automated
coverage_id: D3

### 5. Modo sales permanece byte-idêntico (LENS-03)
expected: Sales usa 1 planner, lens=None, sem contador de cadência, sem fatiamento, sem trava de dedup normalizado.
result: pass
source: automated
coverage_id: D4

### 6. Sem regressão nas Fases 1-2
expected: Registro sales, gate por mode e prompts discovery sem CITI_PORTFOLIO continuam intactos.
result: pass
source: automated
coverage_id: D5

### 7. Colunas lens no Supabase (LENS-03)
expected: Colunas `questions.lens` e `red_flags.lens` criadas no Supabase (text nullable).
result: pass
source: automated
coverage_id: D1

### 8. QuestionResponse expõe lens (LENS-04)
expected: `QuestionResponse` tem o campo `lens: Optional[str] = None`, expondo a lente persistida na API.
result: pass
source: automated
coverage_id: D2

### 9. Red flag discovery persiste lens do LLM (LENS-04)
expected: Lente válida ('produto'|'dados') devolvida pelo LLM é persistida em `RedFlag.lens` e no insert de `red_flags`.
result: pass
source: automated
coverage_id: D1

### 10. Red flag: fallback para produto em lens inválida (LENS-04)
expected: Lens ausente/vazia/inválida cai em fallback 'produto' via allowlist fechada (D-22).
result: pass
source: automated
coverage_id: D2

### 11. Red flag sales: lens sempre None (LENS-04)
expected: Em sales, `RedFlag.lens` é sempre None, insert não grava lens não-nula, detector chamado uma única vez.
result: pass
source: automated
coverage_id: D3

### 12. Contrato JSON do red flag detector discovery (LENS-04)
expected: `build_red_flag_detector()` discovery contém `"lens":"produto|dados"` no contrato JSON, sem CITI_PORTFOLIO.
result: pass
source: automated
coverage_id: D4

### 13. coverage_to_dict discovery deriva lens do registro (LENS-04)
expected: As 18 áreas trazem lens produto (order 0-7) / dados (order 8-17) derivado do registro estático.
result: pass
source: automated
coverage_id: D5

### 14. coverage_to_dict sales: lens None sem crash (LENS-04)
expected: Em sales, lens None para todas as áreas; área custom não quebra.
result: pass
source: automated
coverage_id: D6

### 15. Sem regressão na suíte completa
expected: Suíte completa passa (test_discovery_mode.py, test_coverage_areas_golden.py, test_two_agent_lens.py).
result: pass
source: automated
coverage_id: D7

## Summary

total: 15
passed: 15
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps

[none yet]
