---
phase: 02-discovery-mode-discoverypromptbuilder
plan: 01
subsystem: backend
tags: [python, fastapi, pytest, tdd, prompt-engineering, coverage-registry]

# Dependency graph
requires:
  - phase: 01-area-set-registry
    provides: "AreaSet/AreaDefinition registry (keys()/labels()/schema_json()/block_enum()), SALES_AREA_SET, AREAS_BY_PROJECT_TYPE — o seam Open/Closed que este plano consome para somar um segundo AreaSet"
provides:
  - "DISCOVERY_AREA_SET — 18 areas de discovery (Produto 0-7, Dados 8-17) em coverage_areas.py"
  - "DiscoveryPromptBuilder — classe irma de PromptBuilder, sem CITI_PORTFOLIO/CATALOG/TECH_REFERENCE, com calibracao por DMS"
  - "SessionState.mode (default 'sales') e fork mode em _init_coverage — area-set fixado no inicio da sessao"
  - "pipeline.get_or_create seleciona builder (PromptBuilder vs DiscoveryPromptBuilder) por project.get('mode')"
  - "backend/tests/test_discovery_mode.py — 11 testes cobrindo DISC-02/DISC-03"
affects: [02-02-discovery-report-mode-gate, 02-03-project-mode-column-and-ui]

# Actuals (#2632)
actuals:
  tokens: 6994
  tasks: 3
  commits: 6

tech-stack:
  added: []
  patterns:
    - "Sibling builder por mode (D-09): dois builders com o mesmo contrato informal (build_all), sem heranca — selecao por if/else no ponto de montagem"
    - "Gate por mode, nunca reescrita do caminho sales (D-03/SC#4): if mode == X: <novo> else: <codigo atual intacto, byte-identico>"
    - "kwarg novo com default para estender assinatura sem quebrar chamadas posicionais existentes (mode: str = 'sales' em _init_coverage, project_type continua 1o posicional)"

key-files:
  created:
    - backend/app/services/discovery_prompt_builder.py
    - backend/tests/test_discovery_mode.py
    - .planning/phases/02-discovery-mode-discoverypromptbuilder/COVERAGE.md
  modified:
    - backend/app/services/coverage_areas.py
    - backend/app/services/session_state.py
    - backend/app/services/pipeline.py

key-decisions:
  - "DISCOVERY_AREA_SET como segunda instancia de AreaSet no mesmo modulo (coverage_areas.py), sem alterar AreaSet/AreaDefinition/SALES_AREA_SET/AREAS_BY_PROJECT_TYPE — aditivo puro (D-01/D-02 da Fase 1)"
  - "_init_coverage ganha mode como kwarg NOVO com default 'sales'; project_type continua 1o parametro posicional — evita quebrar test_session_state_custom_areas.py, que chama _init_coverage('bi') posicionalmente (Pitfall 2 do RESEARCH.md)"
  - "DiscoveryPromptBuilder e classe solta (nao subclasse de PromptBuilder, D-09) — duplica __init__/_dms_str e importa so DMS_LABEL/DMS_DESCRIPTION de prompt_builder.py; nunca importa CITI_PORTFOLIO/CITI_SERVICE_CATALOG/CITI_TECH_REFERENCE, o que garante SC#3 por construcao para os 3 agentes realtime"
  - "Ramo else de pipeline.get_or_create (selecao PromptBuilder) e texto identico ao bloco atual — nenhuma linha do caminho sales muda"

patterns-established:
  - "Pattern: novo AreaSet e edicao aditiva em coverage_areas.py, sem tocar keys()/labels()/schema_json()/block_enum()"
  - "Pattern: builder irmao consultado por mode no ponto unico de montagem (pipeline.py), nunca dentro dos proprios builders"

requirements-completed: [DISC-02, DISC-03]

coverage:
  - id: D1
    description: "SessionState em mode='discovery' inicializa coverage com exatamente as 18 chaves de DISCOVERY_AREA_SET, nenhuma not_applicable (DISC-02)"
    requirement: "DISC-02"
    verification:
      - kind: unit
        ref: "backend/tests/test_discovery_mode.py#test_session_state_discovery_mode_initializes_18_areas"
        status: pass
      - kind: unit
        ref: "backend/tests/test_discovery_mode.py#test_init_coverage_discovery_mode_has_18_keys_no_not_applicable"
        status: pass
      - kind: unit
        ref: "backend/tests/test_discovery_mode.py#test_discovery_area_set_keys_order"
        status: pass
    human_judgment: false
  - id: D2
    description: "SessionState em mode='sales' (ou default) continua inicializando as 8 chaves de SALES_AREA_SET com o mesmo esquema critical/optional/inactive de hoje (SC#4, sem regressao)"
    verification:
      - kind: unit
        ref: "backend/tests/test_discovery_mode.py#test_session_state_sales_mode_default_unchanged"
        status: pass
      - kind: unit
        ref: "backend/tests/test_discovery_mode.py#test_init_coverage_sales_mode_default_unchanged"
        status: pass
      - kind: unit
        ref: "backend/tests/test_coverage_areas_golden.py (9 testes)"
        status: pass
      - kind: unit
        ref: "backend/tests/test_session_state_custom_areas.py (4 testes)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Os 3 prompts realtime do DiscoveryPromptBuilder (coverage_classifier, red_flag_detector, question_planner) contem a calibracao por DMS e NAO contem CITI_PORTFOLIO/CATALOG/TECH_REFERENCE (DISC-03)"
    requirement: "DISC-03"
    verification:
      - kind: unit
        ref: "backend/tests/test_discovery_mode.py#test_build_coverage_classifier_has_dms_no_citi"
        status: pass
      - kind: unit
        ref: "backend/tests/test_discovery_mode.py#test_build_red_flag_detector_has_dms_no_citi"
        status: pass
      - kind: unit
        ref: "backend/tests/test_discovery_mode.py#test_build_question_planner_has_dms_no_citi_and_block_enum"
        status: pass
      - kind: unit
        ref: "backend/tests/test_discovery_mode.py#test_discovery_module_does_not_import_citi_constants"
        status: pass
      - kind: unit
        ref: "backend/tests/test_discovery_mode.py#test_dms_boundary_values_do_not_raise"
        status: pass
    human_judgment: false
  - id: D4
    description: "pipeline.get_or_create seleciona DiscoveryPromptBuilder quando project.get('mode')=='discovery' e PromptBuilder caso contrario; ramo sales byte-identico; SessionState recebe mode=mode"
    verification:
      - kind: other
        ref: "cd backend && python -c \"import app.services.pipeline; from app.services.discovery_prompt_builder import DiscoveryPromptBuilder\" (import OK)"
        status: pass
      - kind: other
        ref: "grep -c DiscoveryPromptBuilder pipeline.py >= 2 && grep mode=mode pipeline.py (WIRED)"
        status: pass
      - kind: integration
        ref: "cd backend && python -m pytest -q (40 passed, 4 skipped, exclui falha pre-existente de rede em test_schema.py)"
        status: pass
    human_judgment: true
    rationale: "O caminho real DB->coverage_update via WebSocket (payload com 18 chaves para um projeto discovery real) depende da coluna projects.mode, que so chega em 02-03 — a verificacao ponta a ponta com sessao real fica para /gsd-verify-work apos 02-03, conforme o proprio <done> da Task 3 do plano."

duration: 21min
completed: 2026-09-21
status: complete
---

# Phase 2 Plan 1: Discovery Mode + DiscoveryPromptBuilder (tracer) Summary

**Fork por `mode` ponta a ponta: `DISCOVERY_AREA_SET` (18 áreas Produto+Dados), `DiscoveryPromptBuilder` (classe irmã sem portfólio CITi, com calibração DMS) e seleção de builder/area-set em `pipeline.py`/`session_state.py` — sales permanece byte-idêntico.**

## Performance

- **Duration:** 21 min
- **Started:** 2026-09-21T00:35:00Z (aprox.)
- **Completed:** 2026-09-21T00:56:06Z
- **Tasks:** 3
- **Files modified:** 6 (3 criados, 3 modificados)

## Accomplishments
- `DISCOVERY_AREA_SET` com as 18 áreas de discovery (Produto 0-7, Dados 8-17, ordem D-06) somada a `coverage_areas.py`, coexistindo com `SALES_AREA_SET` sem colisão de namespace.
- `_init_coverage` ganhou o ramo `mode="discovery"` (18 áreas sempre ativas, sem `AREAS_BY_PROJECT_TYPE`) sem alterar a assinatura posicional que os 4 testes existentes de `test_session_state_custom_areas.py` já fixavam.
- `SessionState.mode` (novo campo, default `"sales"`) flui para `_init_coverage` em `__post_init__` — o area-set é fixado no início da sessão (ASSUMPTION documentada no plano).
- `DiscoveryPromptBuilder` — classe irmã nova em `discovery_prompt_builder.py` — gera os 4 prompts (coverage_classifier, red_flag_detector, question_planner, report_generator) com enquadramento de facilitador de discovery, mantendo a calibração por DMS e **nunca** importando `CITI_PORTFOLIO`/`CITI_SERVICE_CATALOG`/`CITI_TECH_REFERENCE`.
- `pipeline.get_or_create` agora lê `mode = project.get("mode") or "sales"` e seleciona `DiscoveryPromptBuilder` ou `PromptBuilder` — o ramo `else` (sales) é texto idêntico ao bloco anterior; `SessionState(...)` recebe `mode=mode`.
- `backend/tests/test_discovery_mode.py` criado do zero (11 testes) provando DISC-02/DISC-03; suíte golden da Fase 1 (9 testes) e `test_session_state_custom_areas.py` (4 testes) seguem verdes sem edição — SC#4 sem regressão.
- `COVERAGE.md` criado declarando ausência de integração de API externa nesta fase.

## Task Commits

Cada task foi commitada atomicamente, com RED/GREEN separados por ser plano TDD:

1. **Task 1 (TRACER): DISCOVERY_AREA_SET + fork de mode em session_state**
   - RED: `a64c6ee` (test) — testes do fork de mode discovery (18 áreas + SessionState)
   - GREEN: `d1e14b2` (feat) — DISCOVERY_AREA_SET + fork de mode em session_state
2. **Task 2: DiscoveryPromptBuilder — classe irmã sem portfólio comercial**
   - RED: `c0f7851` (test) — testes do DiscoveryPromptBuilder
   - GREEN: `8d3dd9a` (feat) — DiscoveryPromptBuilder implementado (inclui fix do teste RED overly-strict, ver Deviations)
3. **Task 3: Seleção de builder por mode em pipeline.get_or_create**
   - `e46d571` (feat) — pipeline seleciona builder por mode + repassa mode para SessionState

**Docs auxiliares:** `5796e65` (docs) — COVERAGE.md (declaração de ausência de API externa)

**Plan metadata:** *(este commit — feito ao final deste SUMMARY)*

## Files Created/Modified
- `backend/app/services/coverage_areas.py` - Adiciona `DISCOVERY_AREA_SET` (18 áreas, D-06)
- `backend/app/services/session_state.py` - `_init_coverage(mode=...)` novo kwarg + `SessionState.mode`
- `backend/app/services/discovery_prompt_builder.py` - Novo módulo: classe `DiscoveryPromptBuilder`
- `backend/app/services/pipeline.py` - Seleção de builder por `mode` + `SessionState(mode=mode)`
- `backend/tests/test_discovery_mode.py` - Novo arquivo, 11 testes (DISC-02/DISC-03)
- `.planning/phases/02-discovery-mode-discoverypromptbuilder/COVERAGE.md` - Declaração de API externa

## Decisions Made
- `_init_coverage` recebe `mode` como kwarg novo com default `"sales"` — `project_type` continua 1º posicional (Pitfall 2 do RESEARCH.md), preservando a assinatura consumida pelos testes existentes.
- `DiscoveryPromptBuilder` duplica `__init__`/`_dms_str` de `PromptBuilder` em vez de herdar (D-09 proíbe subclasse) — importa apenas os dicts `DMS_LABEL`/`DMS_DESCRIPTION`.
- O texto exato do enquadramento de discovery (D-10) é o proposto no RESEARCH.md, adaptado; é reversível (texto de prompt).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Teste RED da Task 2 usava `inspect.getsource()` e falhava mesmo com a implementação correta**
- **Found during:** Task 2 (verificação GREEN antes do commit)
- **Issue:** `test_discovery_module_does_not_import_citi_constants` verificava a presença do literal `"CITI_PORTFOLIO"` em `inspect.getsource(mod)` — isso captura também a docstring do módulo, que **cita em prosa** os nomes `CITI_PORTFOLIO`/`CITI_SERVICE_CATALOG`/`CITI_TECH_REFERENCE` explicando por que eles NÃO são importados. O teste falhava por um falso positivo, não por um bug real de import.
- **Fix:** Trocado para verificar o namespace do módulo (`hasattr(mod, literal)`), que é o que a intenção do teste realmente exige: confirmar que o nome não foi vinculado/importado, não que a string nunca aparece em comentário/docstring.
- **Files modified:** `backend/tests/test_discovery_mode.py`
- **Verification:** `pytest tests/test_discovery_mode.py -q` — 11/11 verde após o ajuste.
- **Committed in:** `8d3dd9a` (commit GREEN da Task 2, junto com `discovery_prompt_builder.py`)

---

**Total deviations:** 1 auto-fixed (1 bug em teste próprio, Rule 1)
**Impact on plan:** Nenhum impacto em código de produção — o ajuste foi só na asserção do teste, corrigindo um falso positivo introduzido pelo próprio commit RED. Nenhuma linha de `discovery_prompt_builder.py` mudou por causa disso.

## Issues Encountered
- `cd backend && python -m pytest -q` (suíte completa) reporta 1 falha pré-existente: `tests/test_schema.py::test_tables_exist`, que depende de conexão real com o Supabase (`postgrest.exceptions.APIError: Could not find the table 'public.information_schema.tables'`). Confirmado via `git stash` que essa falha já existia **antes** de qualquer mudança deste plano — é uma dependência de rede/ambiente, fora do escopo desta fase (não relacionada a `mode`/`coverage_areas`/`prompt_builder`). Não foi corrigida (fora de escopo, Regra "scope boundary").

## User Setup Required
None - nenhuma configuração de serviço externo é necessária por este plano (ver COVERAGE.md).

## Next Phase Readiness
- O seam `mode` está pronto para os planos 02-02 (gate de CITI no `generate_report`, DISC-03 restante) e 02-03 (coluna `projects.mode` + toggle no frontend, DISC-01).
- **Bloqueio conhecido:** DISC-03 só será marcado como `Complete` em REQUIREMENTS.md quando o plano 02-02 (que também o declara) finalizar — comportamento esperado do shared-ID gate (#2388); DISC-02 já foi marcado `Complete` nesta execução.
- A verificação ponta a ponta real (criar projeto `mode=discovery`, abrir sessão, checar payload `coverage_update` via WebSocket com 18 chaves) depende da coluna `projects.mode` que chega em 02-03 — fica para `/gsd-verify-work` após 02-03, conforme o `<done>` da Task 3 do plano.
- Limitação conhecida e documentada no plano (fora de escopo D-06..D-12): `structured_context._EXTRACTOR_SYSTEM` continua restrito aos blocos sales mesmo em projetos discovery (Pitfall 3 do RESEARCH.md) — não corrigida aqui por decisão explícita do CONTEXT.md.

## Self-Check: PASSED

- Todos os 7 arquivos-chave (criados/modificados) confirmados presentes em disco via `[ -f ]`.
- Todos os 6 commits de produção/teste (`a64c6ee`, `d1e14b2`, `c0f7851`, `8d3dd9a`, `e46d571`, `5796e65`) confirmados via `git log --oneline --all`.

---
*Phase: 02-discovery-mode-discoverypromptbuilder*
*Completed: 2026-09-21*
