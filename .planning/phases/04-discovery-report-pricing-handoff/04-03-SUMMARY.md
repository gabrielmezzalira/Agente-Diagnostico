---
phase: 04-discovery-report-pricing-handoff
plan: 03
subsystem: api
tags: [langchain, pricing-service, session-state, readiness-score, tdd]

# Dependency graph
requires:
  - phase: 04-01
    provides: reports.status + import_from_diagnosis approval gate (D-36/D-37) — readiness score is the backend signal that feeds the Phase 5 "Gerar PRD" button gated by that same approval flow
provides:
  - "12 blocos temáticos sincronizados nos dois prompts do Precificador (import_from_diagnosis + suggest_features), com linha de desambiguação ML/GenAI/Ciência de Dados (D-32)"
  - "SessionState.readiness_score() — método puro que combina 4 sinais (D-33) por score ponderado + limiar (D-34), retornando ReadinessScore{score,signals,ready,low_signals}"
  - "READINESS_WEIGHTS/READINESS_THRESHOLD/READINESS_LOW_SIGNAL_FLOOR como constantes de módulo calibráveis"
affects: [05-pricing-ui-handoff]

# Actuals (#2632)
actuals:
  tokens: 2903
  tasks: 2
  commits: 3
  plan_head_before: 82a69bf

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pesos/limiar como constantes de módulo calibráveis (Open/Closed) — mesmo padrão do TTL de perguntas (30s)"
    - "Função pura sobre estado em memória (sem I/O/await/db/LLM) — mesma forma de estimated_report_cost()"
    - "RED-GREEN-REFACTOR: test(04-03) -> feat(04-03), sem commit de refactor (implementação já limpa na primeira passada)"

key-files:
  created:
    - backend/tests/test_readiness_score.py
  modified:
    - backend/app/services/llm_pricing_service.py
    - backend/app/services/session_state.py

key-decisions:
  - "D-32: os 5 blocos novos (GenAI/IA, Machine Learning, Governança & LGPD/Segurança, Infra/MLOps/Observabilidade, Descoberta/Consultoria) entram na MESMA lista literal nos dois prompts (import_from_diagnosis e suggest_features) — nunca deixar divergir"
  - "D-33/D-34: readiness combina 4 sinais (cobertura por lente, cobertura global, perguntas/transcrição, seções-chave) por soma ponderada (0.30/0.30/0.20/0.20) com limiar 0.65 — pesos discricionários (Claude's Discretion), documentados como calibráveis inline"
  - "Sinal 3 (perguntas/transcrição) usa max() dos dois sinais parciais, não soma — qualquer um dos dois já prova insumo de conversa suficiente, evitando penalizar sessões com pouca digitação de perguntas mas transcrição rica"

requirements-completed: [REP-01, REP-02]

coverage:
  - id: D1
    description: "Os dois prompts do Precificador (import_from_diagnosis e suggest_features) listam os mesmos 12 blocos temáticos + linha de desambiguação; bloco continua texto livre, nenhuma migration tocada"
    requirement: "REP-02"
    verification:
      - kind: other
        ref: "python -c check BLOCKS_12_OK (grep das 5 categorias novas + 'RAG' + 'exploratória' nos dois system_prompt)"
        status: pass
    human_judgment: false
  - id: D2
    description: "SessionState.readiness_score() existe, é puro (sem I/O/await/db/LLM), e retorna ReadinessScore{score,signals,ready,low_signals} com score em [0,1]"
    requirement: "REP-01"
    verification:
      - kind: unit
        ref: "backend/tests/test_readiness_score.py#test_readiness_score_empty_session_is_low_and_not_ready"
        status: pass
      - kind: unit
        ref: "backend/tests/test_readiness_score.py#test_readiness_score_well_covered_session_is_high_and_ready"
        status: pass
      - kind: unit
        ref: "backend/tests/test_readiness_score.py#test_readiness_score_is_pure_no_io_side_effects"
        status: pass
      - kind: other
        ref: "python -c check READINESS_PURE_OK"
        status: pass
    human_judgment: false

# Metrics
duration: 25min
completed: 2026-09-23
status: complete
---

# Phase 04 Plan 03: Blocos Ampliados + Readiness Score Summary

**Precificador reconhece 12 blocos temáticos (5 novos: GenAI, ML, Governança/LGPD, Infra/MLOps, Descoberta) nos dois prompts sincronizados, e SessionState ganha um "termômetro de prontidão" puro (readiness_score) que a Fase 5 vai consumir para habilitar o botão "Gerar PRD".**

## Performance

- **Duration:** 25 min
- **Started:** 2026-09-23T12:05:00Z (aprox.)
- **Completed:** 2026-09-23T12:30:00Z (aprox.)
- **Tasks:** 2 (Task 1 auto; Task 2 TDD — RED/GREEN, sem refactor)
- **Files modified:** 3 (2 modificados + 1 teste novo)

## Accomplishments

- `llm_pricing_service.py`: os dois `system_prompt` (`import_from_diagnosis` e `suggest_features`) passam a listar 12 blocos temáticos idênticos — Engenharia de Dados, Visualização, Ciência de Dados, Automação, Integração, Consumo/Interface, **GenAI/IA, Machine Learning, Governança & LGPD/Segurança, Infra/MLOps/Observabilidade, Descoberta/Consultoria**, Geral — com a linha de desambiguação (ML = modelos preditivos clássicos; GenAI = LLM/RAG/agentes; Ciência de Dados = análise/estatística exploratória) logo depois da lista nos dois prompts.
- `session_state.py`: novo dataclass `ReadinessScore` (`score`, `signals`, `ready`, `low_signals`) + constantes `READINESS_WEIGHTS` (0.30/0.30/0.20/0.20), `READINESS_THRESHOLD` (0.65) e `READINESS_LOW_SIGNAL_FLOOR` (0.5) + método `readiness_score()` que combina os 4 sinais de D-33 (cobertura mínima por lente, % global das 18 áreas, perguntas respondidas/transcrição mínima, seções-chave com dado mapeável) por soma ponderada.
- `test_readiness_score.py` (novo): 3 testes provando o cálculo em sessão vazia (score baixo, `ready=False`, sinais baixos reportados), sessão bem coberta (score alto, `ready=True`, sem sinais baixos) e pureza (nenhuma mutação de estado).

## Task Commits

Ciclo TDD explícito na Task 2 (RED → GREEN, sem REFACTOR — implementação já limpa na primeira passada):

1. **Task 1: Ampliar blocos nos dois prompts (D-32)** - `f0b5916` (feat)
2. **Task 2 RED: teste falhando para readiness_score** - `b0c37ed` (test) — `ImportError` intencional (`ReadinessScore`/`readiness_score` ainda não existiam)
3. **Task 2 GREEN: implementação de readiness_score** - `4d040d8` (feat) — os 3 testes passam

**Plan metadata:** (este commit, feito a seguir)

_Nota: sem commit de REFACTOR — a implementação da Task 2 já saiu limpa na primeira passada (funções puras, nomes descritivos, constantes calibráveis desde o início); rodar um refactor cosmético sem mudança real violaria a regra do CLAUDE.md de não misturar refator sem necessidade._

## Files Created/Modified

- `backend/app/services/llm_pricing_service.py` - 12 blocos + desambiguação nos dois `system_prompt` (D-32)
- `backend/app/services/session_state.py` - `ReadinessScore` (dataclass), `READINESS_WEIGHTS`/`READINESS_THRESHOLD`/`READINESS_LOW_SIGNAL_FLOOR` (constantes), `readiness_score()` (método puro, D-33/D-34)
- `backend/tests/test_readiness_score.py` - 3 testes (sessão vazia, sessão coberta, pureza)

## Decisions Made

- D-32: lista literal de 12 blocos idêntica nos dois prompts do Precificador (import_from_diagnosis e suggest_features) — decisão já tomada no CONTEXT.md, aplicada sem desvio.
- D-33/D-34: pesos 0.30/0.30/0.20/0.20 e limiar 0.65 usados como default calibrável (discricionário, conforme CONTEXT.md "Claude's Discretion") — documentado inline no código como ponto de ajuste futuro após sessões reais.
- Sinal 3 (perguntas/transcrição) implementado como `max()` dos dois sub-sinais (perguntas respondidas / 3, transcrição / 2000 chars), não soma — decisão de implementação para não penalizar sessões onde um dos dois insumos já é suficiente.

## Deviations from Plan

None - plan executado exatamente como escrito. As duas tasks seguiram o `<action>`/`<behavior>` do plano sem necessidade de ajuste; os dois `<verify>` automatizados e a suíte `test_readiness_score.py` passaram na primeira tentativa após a implementação GREEN.

## Issues Encountered

Nenhum bloqueio novo. Regressão completa (`python -m pytest tests/ -q`) mostra 1 falha pré-existente e não relacionada: `tests/test_schema.py::test_tables_exist` (`APIError: Could not find the table 'public.information_schema.tables'`, depende de conexão real ao Supabase de produção) — já documentada como pré-existente no SUMMARY do plano 04-01 (mesma causa, fora do escopo desta task). 78 passed, 4 skipped, 1 failed (pré-existente).

## User Setup Required

None - nenhuma configuração de serviço externo necessária.

## Next Phase Readiness

- Os dois prompts do Precificador estão prontos para reconhecer projetos de GenAI/IA, ML, Governança/LGPD, Infra/MLOps e Descoberta/Consultoria assim que o plano 04-04 (ou uso real) rodar `import_from_diagnosis`/`suggest_features` sobre um relatório discovery.
- `SessionState.readiness_score()` está pronto para ser exposto pelo endpoint de report (consumido pela UI da Fase 5, D-35) — nenhuma mudança de rota foi feita nesta fase (fora de escopo, backend-only).
- REP-01 permanece bloqueado por REQUIREMENTS.md até o plano irmão 04-04 (que também declara REP-01) produzir seu SUMMARY.md (shared-ID gate #2388). REP-02 é declarado só por 04-01 (concluído) e este plano — deve liberar nesta execução.
- Fase 5 (D-35) é quem constrói a UI que consome `readiness_score()` para habilitar/desabilitar o botão "Gerar PRD" e mostrar `low_signals`.

---
*Phase: 04-discovery-report-pricing-handoff*
*Completed: 2026-09-23*

## Self-Check: PASSED

- FOUND: backend/tests/test_readiness_score.py
- FOUND: commit f0b5916 (Task 1)
- FOUND: commit b0c37ed (Task 2 RED)
- FOUND: commit 4d040d8 (Task 2 GREEN)
