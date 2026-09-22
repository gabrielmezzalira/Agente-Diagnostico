---
phase: 03-two-agent-questions-lens-tagging
plan: 03
subsystem: api
tags: [python, fastapi, google-genai, pytest]

# Dependency graph
requires:
  - phase: 03-two-agent-questions-lens-tagging (plano 03-01)
    provides: "AreaDefinition.lens + AreaSet.by_lens(), DiscoveryPromptBuilder, SessionState.mode, question_trigger_count"
provides:
  - "RedFlag.lens (último campo, default None) — lente do alerta discovery classificada pelo LLM com fallback produto"
  - "DiscoveryPromptBuilder.build_red_flag_detector() com contrato JSON \"lens\":\"produto|dados\" + instrução de classificação"
  - "SessionPipeline._run_red_flag_detector com allowlist {produto,dados} + fallback produto (D-22), gateado por mode"
  - "SessionState.coverage_to_dict() com lens por área derivada do registro (DISCOVERY_AREA_SET/SALES_AREA_SET) por mode"
  - "backend/tests/test_two_agent_lens.py estendido — +10 testes (red flag lens + coverage area lens)"
affects: [04-report-lens, 05-ui-lens-badges]

# Actuals (#2632)
actuals:
  tokens: 2392
  tasks: 2
  commits: 2

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Allowlist fechada com fallback (raw_lens in (a,b) else default) para qualquer campo classificado pelo LLM antes de persistir (V5 ASVS)"
    - "Lente de área sempre derivada do registro estático (AreaSet.areas) por lookup de chave — nunca do estado runtime (CoverageArea)"
    - "Gate único por self.state.mode == 'discovery' reaplicado ao red flag detector e ao coverage_to_dict, sem introduzir 2º flag"

key-files:
  created: []
  modified:
    - backend/app/services/session_state.py
    - backend/app/services/discovery_prompt_builder.py
    - backend/app/services/pipeline.py
    - backend/tests/test_two_agent_lens.py

key-decisions:
  - "lens como ÚLTIMO campo de RedFlag (dataclass), default None — mesma regra de ordem de campos do Question.lens/AreaDefinition.lens do 03-01"
  - "coverage_to_dict reescrito para montar lens_by_key = {a.key: a.lens for a in area_set.areas} uma vez por chamada — sem cache entre sessões"
  - ".get(\"lens\",\"\") (nunca indexação direta) no parser do red flag — o sales não devolve o campo e não pode quebrar o parser"

patterns-established:
  - "Pattern: allowlist + fallback aplicado a qualquer classificação do LLM que vire coluna persistida (mesmo padrão reusável para futuros campos LLM-derivados)"

requirements-completed: [LENS-04]

coverage:
  - id: D1
    description: "Red flag discovery: lens válida devolvida pelo LLM ('produto'|'dados') é persistida em RedFlag.lens e no insert de red_flags"
    requirement: "LENS-04"
    verification:
      - kind: unit
        ref: "backend/tests/test_two_agent_lens.py#test_red_flag_discovery_lens_from_llm_is_persisted"
        status: pass
    human_judgment: false
  - id: D2
    description: "Red flag discovery: lens ausente/vazia/inválida cai em fallback 'produto' via allowlist fechada (D-22)"
    requirement: "LENS-04"
    verification:
      - kind: unit
        ref: "backend/tests/test_two_agent_lens.py#test_red_flag_discovery_lens_fallback_to_produto_when_missing_or_invalid"
        status: pass
      - kind: unit
        ref: "backend/tests/test_two_agent_lens.py#test_red_flag_discovery_lens_invalid_value_falls_back_to_produto"
        status: pass
    human_judgment: false
  - id: D3
    description: "Sales: RedFlag.lens sempre None, insert não grava lens não-nula, detector chamado uma única vez"
    requirement: "LENS-04"
    verification:
      - kind: unit
        ref: "backend/tests/test_two_agent_lens.py#test_red_flag_sales_lens_is_none_and_detector_called_once"
        status: pass
    human_judgment: false
  - id: D4
    description: "build_red_flag_detector() discovery contém \"lens\":\"produto|dados\" no contrato JSON, sem CITI_PORTFOLIO"
    requirement: "LENS-04"
    verification:
      - kind: unit
        ref: "backend/tests/test_two_agent_lens.py#test_build_red_flag_detector_discovery_has_lens_contract_no_citi_portfolio"
        status: pass
    human_judgment: false
  - id: D5
    description: "coverage_to_dict discovery: as 18 áreas trazem lens produto (order 0-7) / dados (order 8-17) derivado do registro"
    requirement: "LENS-04"
    verification:
      - kind: unit
        ref: "backend/tests/test_two_agent_lens.py#test_coverage_to_dict_discovery_lens_matches_registry_partition"
        status: pass
      - kind: unit
        ref: "backend/tests/test_two_agent_lens.py#test_coverage_to_dict_discovery_specific_keys_lens_smoke"
        status: pass
    human_judgment: false
  - id: D6
    description: "coverage_to_dict sales: lens None para todas as áreas; área custom: lens None sem crash"
    requirement: "LENS-04"
    verification:
      - kind: unit
        ref: "backend/tests/test_two_agent_lens.py#test_coverage_to_dict_sales_lens_is_none_for_all_areas"
        status: pass
      - kind: unit
        ref: "backend/tests/test_two_agent_lens.py#test_coverage_to_dict_custom_area_lens_is_none_without_crash"
        status: pass
    human_judgment: false
  - id: D7
    description: "Nenhuma regressão nas Fases 1-2 e no plano 03-01 (registro sales, gate por mode, prompts discovery sem CITI_PORTFOLIO, suíte completa)"
    verification:
      - kind: unit
        ref: "backend/tests/test_discovery_mode.py (18 testes) + backend/tests/test_coverage_areas_golden.py (12 testes) + pytest -q (67 passed, 4 skipped, 1 erro pré-existente sem SUPABASE_URL/KEY)"
        status: pass
    human_judgment: false

duration: ~15min
completed: 2026-09-22
status: complete
---

# Phase 3 Plan 3: Two-Agent Questions + Lens Tagging — Lens em Red Flags e Coverage Areas Summary

**Red flags discovery ganham lente classificada pelo LLM com fallback allowlist "produto" (detector continua único); coverage areas passam a emitir lente derivada do registro estático por `mode` — sales permanece byte-idêntico (lens None) em ambos.**

## Performance

- **Duration:** ~15 min
- **Completed:** 2026-09-22
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- `RedFlag.lens` (último campo, default None) — lente do alerta discovery ("produto"|"dados"), classificada pelo LLM via contrato JSON estendido de `build_red_flag_detector`, com fallback "produto" via allowlist fechada quando ausente/vazia/inválida (D-22, V5 ASVS)
- Detector de red flags continua único (1x) em ambos os modos — só ganhou o campo `lens`, gateado por `self.state.mode == "discovery"`; sales continua `lens=None` sempre
- `DiscoveryPromptBuilder.build_red_flag_detector()` estendido com `"lens":"produto|dados"` no contrato JSON + instrução de classificação (produto = gargalo/processo/viabilidade; dados = fontes/qualidade/LGPD/métricas); `prompt_builder.py` (sales) permanece intocado
- `SessionState.coverage_to_dict()` reescrito para anexar `lens` por área via lookup em `DISCOVERY_AREA_SET`/`SALES_AREA_SET` conforme `mode` — nunca lida do `CoverageArea` runtime (D-19/Pitfall 3); área custom cai em `.get(area)` → None sem crash
- `CoverageArea` runtime NÃO ganhou campo `lens` — a lente das áreas vem exclusivamente do registro estático
- 10 testes novos em `test_two_agent_lens.py`: 6 para red flag lens (LLM válido, fallback ausente, fallback valor inválido, sales None+detector único, contrato JSON) e 4 para coverage area lens (partição discovery, sales None, área custom, smoke gargalo/métricas)

## Task Commits

Each task was committed atomically:

1. **Task 1: lente nos red flags — contrato JSON + instrução (D-15) + allowlist/fallback produto (D-22), gateado por mode** - `5c3b487` (feat)
2. **Task 2: lente nas coverage areas — coverage_to_dict deriva lens do registro por mode (D-19)** - `57bb6a1` (feat)

_Nenhum commit de metadata adicional (worktree paralelo — STATE.md/ROADMAP.md não são escritos aqui; o orquestrador é dono dessas escritas)._

## Files Created/Modified
- `backend/app/services/session_state.py` - `RedFlag.lens` (último campo, default None); `coverage_to_dict()` reescrito com lookup `lens_by_key` por `mode`
- `backend/app/services/discovery_prompt_builder.py` - `build_red_flag_detector()` com `"lens":"produto|dados"` no contrato JSON + instrução de classificação
- `backend/app/services/pipeline.py` - `_run_red_flag_detector`: parse `.get("lens","")` + allowlist `{produto,dados}` + fallback "produto", gateado por `mode`; insert de `red_flags` com `lens`
- `backend/tests/test_two_agent_lens.py` - +10 testes: 6 de red flag lens (Task 1) + 4 de coverage area lens (Task 2)

## Decisions Made
- `lens` como **último** campo de `RedFlag` (dataclass), default `None` — mesma regra de ordem de campos já usada em `Question.lens`/`AreaDefinition.lens` no plano 03-01, por consistência.
- `coverage_to_dict()` monta `lens_by_key` a partir de `area_set.areas` (não `_ordered()`) — a ordem não importa para um dict de lookup por chave, e evita chamada redundante ao método de ordenação a cada invocação.
- `.get("lens", "")` (nunca indexação direta `flag["lens"]`) no parser do red flag discovery — protege contra `KeyError` caso o LLM omita o campo, consistente com o padrão já usado para `text`/`severity`/`evidence` no mesmo método.
- Não foi tocado `_send_initial_state` (reload de red flags do banco ao reconectar) — o plano escopou explicitamente as tasks ao caminho de escrita (`_run_red_flag_detector`) e à derivação de área (`coverage_to_dict`); a exibição/reload visual é Fase 5 conforme o objetivo do plano.

## Deviations from Plan

None - plano executado exatamente como escrito. Ambas as tasks seguiram a ação descrita no PLAN.md sem necessidade de correções automáticas (Rules 1-3) nem decisões de arquitetura (Rule 4).

## Issues Encountered

Nenhum problema técnico não resolvido. A suíte completa do backend está verde (67 passed, 4 skipped) exceto `tests/test_schema.py::test_tables_exist`, que exige `SUPABASE_URL`/`SUPABASE_KEY` reais configuradas no ambiente — pré-existente, fora do escopo desta fase (não foi tocado nem modificado), conforme já documentado no SUMMARY do plano 03-01.

**Nota de ambiente:** o worktree nasceu de um commit anterior à existência dos artefatos da Fase 3 (`3ed727b`), sem os commits do plano 03-01/03-02. Confirmado via `git merge-base --is-ancestor` que o HEAD do worktree era ancestral estrito da branch base (nenhum trabalho divergente a perder); executado `git merge --ff-only feat/fase-03-two-agent-questions`, trazendo os 12 commits de planejamento/pesquisa/execução da Fase 3 sem criar merge commit nem perder histórico. Confirmado via grep que o código do 03-01 (`_run_single_planner`, `AreaSet.by_lens`, `test_two_agent_lens.py`) estava presente antes de iniciar qualquer edição, conforme exigido pelo protocolo `CRITICAL_sync_base`.

## User Setup Required
None - nenhuma configuração de serviço externo necessária. As colunas `questions.lens`/`red_flags.lens` já foram aplicadas no Supabase pelo plano 03-02 (executado anteriormente).

## Next Phase Readiness
- SC#2 (LENS-04) fechado: todo red flag e toda área de cobertura de uma sessão discovery carregam a tag de lente, no payload WebSocket e no banco.
- O texto exato da instrução de classificação da lente no prompt do red flag detector permanece discricionário (análogo a D-10) — ajustável pelo time de negócio sem tocar o contrato JSON.
- Nenhum bloqueio identificado. Pronto para a Fase 5 (exibição visual da lente na UI — badges/agrupamento), que consome os campos `lens` já emitidos por este plano.

## Self-Check: PASSED

Todos os 4 arquivos citados (`session_state.py`, `discovery_prompt_builder.py`, `pipeline.py`,
`test_two_agent_lens.py`) confirmados modificados no worktree. Ambos os commits (`5c3b487`,
`57bb6a1`) confirmados via `git log --oneline --all`.

---
*Phase: 03-two-agent-questions-lens-tagging*
*Plan: 03*
*Completed: 2026-09-22*
