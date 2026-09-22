---
phase: 03-two-agent-questions-lens-tagging
plan: 01
subsystem: api
tags: [python, fastapi, google-genai, pytest]

# Dependency graph
requires:
  - phase: 02-discovery-mode-discoverypromptbuilder
    provides: DISCOVERY_AREA_SET (18 áreas Produto 0-7 / Dados 8-17), DiscoveryPromptBuilder, SessionState.mode
provides:
  - "AreaDefinition.lens + AreaSet.by_lens() — filtro de áreas por lente no registro único"
  - "DiscoveryPromptBuilder.build_question_planner(lens) escopado + build_all() com question_planner_produto/question_planner_dados"
  - "SessionPipeline._run_single_planner(lens, prompt_key, max_questions) — helper único compartilhado entre Produto/Dados/sales"
  - "SessionState.question_trigger_count — contador determinístico de cadência do agente Dados"
  - "Question.lens — lente autoritária setada pelo orquestrador (D-21), nunca derivada do LLM"
  - "_normalize_question_text — trava de dedup por texto normalizado entre agentes (D-17)"
  - "backend/tests/test_two_agent_lens.py — 13 testes cobrindo SC#1/#3/#5 + regressão sales D-24"
affects: [03-03-red-flags-lens, 04-report-lens, 05-ui-lens-badges]

# Actuals (#2632)
actuals:
  tokens: 9593
  tasks: 3
  commits: 3

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Gate único por self.state.mode == 'discovery' antes de qualquer split de comportamento (nunca um 2º flag paralelo)"
    - "Helper privado parametrizado (_run_single_planner) compartilhado entre os N caminhos (Produto/Dados/sales) em vez de N métodos divergentes"
    - "Lente autoritária setada como constante fixa no laço do orquestrador, nunca lida de campo retornado pelo LLM (D-21)"
    - "await sequencial (nunca asyncio.gather) quando um agente precisa ver o efeito colateral (insert) do agente anterior no mesmo ciclo"

key-files:
  created:
    - backend/tests/test_two_agent_lens.py
  modified:
    - backend/app/services/coverage_areas.py
    - backend/app/services/session_state.py
    - backend/app/services/discovery_prompt_builder.py
    - backend/app/services/pipeline.py
    - backend/tests/test_discovery_mode.py

key-decisions:
  - "lens como ÚLTIMO campo de AreaDefinition/Question (dataclass), default None — evita quebrar a ordem de campos sem default em dataclass frozen (Pitfall 2 do RESEARCH.md)"
  - "_run_single_planner único, parametrizado por (lens, prompt_key, max_questions) — reusado pelos 3 caminhos (Produto/Dados/sales), evitando 3 blocos de código divergentes"
  - "Trava de dedup normalizado só roda quando lens is not None — preserva o comportamento sales de hoje byte-a-byte (D-24)"

patterns-established:
  - "Pattern: split de comportamento por lente sobre um registro único (AreaSet.by_lens) em vez de listas hardcoded paralelas"
  - "Pattern: contador de cadência determinístico em SessionState (estado em memória por sessão, nunca persistido)"

requirements-completed: [LENS-01, LENS-02, LENS-03, LENS-05]

coverage:
  - id: D1
    description: "Numa sessão discovery, Produto e Dados inserem perguntas na mesma fila state.questions, cada uma com sua lente correta"
    requirement: "LENS-01"
    verification:
      - kind: unit
        ref: "backend/tests/test_two_agent_lens.py#test_two_triggers_discovery_populate_shared_queue_with_both_lenses"
        status: pass
    human_judgment: false
  - id: D2
    description: "Dados só dispara em gatilhos pares (2,4,6…); Produto dispara em todo gatilho discovery"
    requirement: "LENS-02"
    verification:
      - kind: unit
        ref: "backend/tests/test_two_agent_lens.py#test_sc3_dados_runs_only_on_even_triggers_across_n_cycles"
        status: pass
    human_judgment: false
  - id: D3
    description: "Nenhuma dupla de texto normalizado na fila, mesmo entre agentes diferentes ou dentro do mesmo lote"
    requirement: "LENS-05"
    verification:
      - kind: unit
        ref: "backend/tests/test_two_agent_lens.py#test_sc5_dados_duplicate_of_produto_text_is_discarded"
        status: pass
      - kind: unit
        ref: "backend/tests/test_two_agent_lens.py#test_dedup_within_same_batch_keeps_only_first_occurrence"
        status: pass
    human_judgment: false
  - id: D4
    description: "Sales permanece byte-idêntico: 1 planner, lens=None, question_trigger_count nunca incrementado, sem fatiamento, sem trava de dedup normalizado"
    requirement: "LENS-03"
    verification:
      - kind: unit
        ref: "backend/tests/test_two_agent_lens.py#test_sales_mode_single_planner_no_lens_no_counter"
        status: pass
      - kind: unit
        ref: "backend/tests/test_two_agent_lens.py#test_sales_mode_does_not_apply_normalized_dedup"
        status: pass
    human_judgment: false
  - id: D5
    description: "Nenhuma regressão nas Fases 1-2 (registro sales, gate por mode, prompts discovery sem CITI_PORTFOLIO)"
    verification:
      - kind: unit
        ref: "backend/tests/test_coverage_areas_golden.py (12 testes) + backend/tests/test_discovery_mode.py (18 testes)"
        status: pass
    human_judgment: false

duration: ~20min
completed: 2026-09-22
status: complete
---

# Phase 3 Plan 1: Two-Agent Questions + Lens Tagging (tracer) Summary

**Split de `_run_question_planner` em dois agentes sequenciais (Produto sempre, Dados em gatilho par) inserindo na mesma fila com lente autoritária (`Question.lens`), gate único por `mode`, trava de dedup por texto normalizado, e regressão sales byte-idêntica provada por teste real.**

## Performance

- **Duration:** ~20 min
- **Completed:** 2026-09-22
- **Tasks:** 3
- **Files modified:** 5 (+ 1 criado)

## Accomplishments
- `AreaDefinition.lens` + `AreaSet.by_lens()` no registro único de áreas — as 18 áreas discovery ganharam lente explícita (`produto` order 0-7, `dados` order 8-17); sales permanece `lens=None`
- `DiscoveryPromptBuilder.build_question_planner(lens)` escopa o enum de `block` por `by_lens(lens).block_enum()` e varia enquadramento/quantidade (Produto 3, Dados 2); `build_all()` devolve `question_planner_produto`/`question_planner_dados`
- `SessionPipeline._run_single_planner(lens, prompt_key, max_questions)` — helper único extraído do corpo antigo de `_run_question_planner`, reusado pelos 3 caminhos (Produto, Dados, sales)
- `_run_question_planner` gateado por `self.state.mode == "discovery"`: Produto roda em todo gatilho (max 3), Dados só quando `question_trigger_count % 2 == 0` (max 2), `await` sequencial (nunca `asyncio.gather`) para o Dados ver as perguntas frescas do Produto no seu `recent`
- `_normalize_question_text` (função pura) + trava de dedup por texto normalizado — só ativa quando `lens is not None` (discovery); sales não é afetado
- 13 testes novos em `backend/tests/test_two_agent_lens.py` cobrindo SC#1 (fila única), SC#3 (cadência), SC#5 (dedup entre agentes e dentro do lote), e regressão sales D-24
- 3 testes existentes em `test_discovery_mode.py` atualizados para o novo contrato de `build_all`/`build_question_planner(lens)` (mudança de contrato explícita do plano, D-23 — não é regressão)

## Task Commits

Each task was committed atomically:

1. **Task 1 (TRACER): dois agentes → fila única com lens** - `5b3685b` (feat)
2. **Task 2 (EXPANSÃO): trava de dedup por texto normalizado** - `560203a` (feat)
3. **Task 3 (EXPANSÃO): teste-semente de regressão sales (D-24)** - `36b578a` (test)

_Nenhum commit de metadata adicional (worktree paralelo — STATE.md/ROADMAP.md não são escritos aqui; o orquestrador é dono dessas escritas)._

## Files Created/Modified
- `backend/app/services/coverage_areas.py` - `AreaDefinition.lens` (último campo) + `AreaSet.by_lens()`; 18 áreas discovery populadas com lente
- `backend/app/services/session_state.py` - `Question.lens` (último campo) + `SessionState.question_trigger_count`
- `backend/app/services/discovery_prompt_builder.py` - `build_question_planner(lens)` escopado por `by_lens`; `build_all()` com duas chaves de planner
- `backend/app/services/pipeline.py` - `_normalize_question_text` + `_run_single_planner` (novo helper) + `_run_question_planner` reescrito com gate por `mode`, contador, split Produto/Dados, dedup
- `backend/tests/test_discovery_mode.py` - 3 testes atualizados para a nova assinatura/contrato (`lens` obrigatório, 5 chaves em `build_all`)
- `backend/tests/test_two_agent_lens.py` (novo) - 13 testes: by_lens, build_all escopado, fila única com as duas lentes, cadência, dedup normalizado (entre agentes e dentro do lote), regressão sales, golden do registro sales

## Decisions Made
- `lens` como **último** campo em `AreaDefinition` e `Question` (dataclasses), com default `None` — obrigatório em `AreaDefinition` por ser `frozen=True` (campo com default não pode vir antes de campo sem default), aplicado por consistência também em `Question`.
- `_run_single_planner` único parametrizado por `(lens, prompt_key, max_questions)` em vez de 3 métodos separados — reduz duplicação (SOLID: Single Responsibility / DRY), decisão discricionária do plano (A2 do RESEARCH.md) confirmada na implementação.
- Trava de dedup normalizado (`existing_normalized`) calculada uma vez por chamada de `_run_single_planner` a partir de `self.state.questions` — nunca cacheada entre chamadas, evitando vazamento de estado entre sessões.
- Payload de insert em `questions` sempre inclui a chave `"lens"` (mesmo `None` no sales) — o plano permite explicitamente "lens is None OU a chave lens ausente" (Task 3, acceptance criteria); optou-se por manter a chave presente por simplicidade e paridade com o dataclass.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Atualizados 3 testes de `test_discovery_mode.py` quebrados pela mudança de contrato de `build_all`/`build_question_planner`**
- **Found during:** Task 1 (leitura do verify obrigatório `pytest tests/test_two_agent_lens.py tests/test_discovery_mode.py tests/test_coverage_areas_golden.py -q`)
- **Issue:** O plano (D-23, acceptance criteria da Task 1) muda deliberadamente `build_all()` de 4 para 5 chaves (`question_planner` vira `question_planner_produto`/`question_planner_dados`) e `build_question_planner()` passa a exigir o parâmetro `lens`. Três testes pré-existentes da Fase 2 (`test_build_question_planner_has_dms_no_citi_and_block_enum`, `test_build_all_returns_four_agent_keys`, `test_disc03_citi_portfolio_absent_from_all_four_discovery_surfaces`) chamavam a API antiga e quebrariam com `TypeError`/`AssertionError` — bloqueando o verify explícito do plano.
- **Fix:** Testes atualizados para a nova assinatura/contrato: `build_question_planner(lens="produto")` com asserção sobre `by_lens("produto").block_enum()`; `test_build_all_returns_four_agent_keys` renomeado para `test_build_all_returns_five_agent_keys` com o novo conjunto de 5 chaves; `test_dms_boundary_values_do_not_raise` ajustado para `len(prompts) == 5`; o teste consolidado DISC-03 passou a cobrir as duas chaves de planner (produto e dados) em vez de uma.
- **Files modified:** `backend/tests/test_discovery_mode.py`
- **Verification:** `pytest tests/test_two_agent_lens.py tests/test_discovery_mode.py tests/test_coverage_areas_golden.py -q` → 41 passed
- **Committed in:** `5b3685b` (Task 1 commit)

**2. [Ambiente] Worktree criado a partir de um ponto anterior à existência dos arquivos do plano — fast-forward merge necessário**
- **Found during:** Início da execução (leitura obrigatória do PLAN.md)
- **Issue:** O worktree `agent-a07ec0b50dada6f06` foi criado a partir do commit `3ed727b`, anterior aos commits que trazem `03-01-PLAN.md`, `03-PATTERNS.md`, `03-RESEARCH.md` e o restante do contexto da Fase 3 (esses arquivos só existiam em `feat/fase-03-two-agent-questions`, na tip `c57f34f`). Sem eles, a execução não poderia nem começar.
- **Fix:** Confirmado via `git merge-base --is-ancestor` que o HEAD do worktree é ancestral estrito da branch base (nenhum trabalho divergente a perder); executado `git merge --ff-only feat/fase-03-two-agent-questions`, trazendo os 9 commits de planejamento/pesquisa da Fase 3 sem criar merge commit nem perder histórico.
- **Files modified:** nenhum arquivo de código — só trouxe commits já existentes na branch base
- **Verification:** `git log --oneline -3` confirmou o fast-forward limpo; `git status` mostrou working tree limpo antes de iniciar as edições
- **Committed in:** n/a (fast-forward, sem novo commit; ficou registrado como `Fast-forward` no output do merge)

### Erro de rotulagem (cosmético, sem impacto funcional)

O commit da Task 2 foi rotulado por engano como `feat(03-02): ...` em vez de `feat(03-01): ...` na mensagem de commit (hash `560203a`). O plano executado é `03-01` — `03-02` é um plano diferente (migration de lens), já executado anteriormente. O conteúdo do commit está correto (é a Task 2 do plano 03-01); apenas o prefixo da mensagem está com o número de plano errado. Não foi corrigido via `git commit --amend` por política explícita do protocolo de execução (nunca amendar, sempre criar novo commit) — documentado aqui para rastreabilidade. Sem impacto em código, testes ou comportamento.

---

**Total deviations:** 2 auto-fixed (1 blocking/Rule 3, 1 ambiente) + 1 erro cosmético de rotulagem documentado
**Impact on plan:** Nenhum impacto em escopo ou comportamento. As atualizações de teste eram consequência direta e esperada da mudança de contrato já especificada no plano (D-23); o fast-forward do worktree era pré-requisito para qualquer execução.

## Issues Encountered
Nenhum problema técnico não resolvido. A suíte completa do backend está verde (58 passed, 4 skipped) exceto `tests/test_schema.py::test_tables_exist`, que exige `SUPABASE_URL`/`SUPABASE_KEY` reais configuradas no ambiente — pré-existente, fora do escopo desta fase (não foi tocado nem modificado).

## User Setup Required
None - nenhuma configuração de serviço externo necessária. A coluna `questions.lens`/`red_flags.lens` já foi aplicada no Supabase pelo plano 03-02 (executado anteriormente, conforme confirmado no CONTEXT.md e STATE.md).

## Next Phase Readiness
- A fatia vertical central da Fase 3 (SC#1) está provada ponta a ponta: registro de áreas → builder → pipeline → estado, com teste real.
- Pronto para o Plano 03-03 (lens em red flags e coverage areas, conforme LENS-04) — o padrão de gate por `mode` e o registro `by_lens` já estão prontos para reuso.
- Nenhum bloqueio identificado. O texto exato do enquadramento dos prompts Produto/Dados (discricionário, análogo a D-10 da Fase 2) pode ser refinado pelo time de negócio sem tocar o contrato JSON.

## Self-Check: PASSED

Todos os 6 arquivos citados (`coverage_areas.py`, `session_state.py`, `discovery_prompt_builder.py`,
`pipeline.py`, `test_discovery_mode.py`, `test_two_agent_lens.py`) confirmados presentes no
worktree. Todos os 3 commits (`5b3685b`, `560203a`, `36b578a`) confirmados via `git log --oneline
--all`.

---
*Phase: 03-two-agent-questions-lens-tagging*
*Plan: 01*
*Completed: 2026-09-22*
