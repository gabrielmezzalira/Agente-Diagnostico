---
phase: 02-discovery-mode-discoverypromptbuilder
plan: 02
subsystem: backend
tags: [python, fastapi, pytest, tdd, prompt-engineering, llm]

# Dependency graph
requires:
  - phase: 02-discovery-mode-discoverypromptbuilder
    provides: "Plano 02-01: DISCOVERY_AREA_SET, DiscoveryPromptBuilder (3 prompts realtime sem CITI_*), SessionState.mode, selecao de builder em pipeline.get_or_create"
provides:
  - "generate_report(mode: str = 'sales') — kwarg novo que gateia o bloco comercial (citi_block) na mensagem 'user'"
  - "citi_block: bloco Portfolio/Catalogo/Referencia de tecnologias, presente so quando mode == 'sales', na mesma posicao de hoje"
  - "pipeline._run_report_generator repassa mode=self.state.mode para generate_report"
  - "Teste de precisao unico cobrindo as 4 superficies discovery (3 prompts realtime + mensagem user do relatorio) — fecha DISC-03"
affects: [02-03-project-mode-column-and-ui]

# Actuals (#2632)
actuals:
  tokens: 2006
  tasks: 2
  commits: 3
plan_head_before: "626410484694da04e4109f1abb6a9cb174f7bbd3"

tech-stack:
  added: []
  patterns:
    - "Gate por mode, nunca reescrita do caminho sales (D-03/SC#4): if mode == 'sales': <bloco> else: '' — mesma f-string, mesma posicao textual"
    - "kwarg novo com default no FINAL da assinatura para nao quebrar chamadas posicionais existentes (mode: str = 'sales' em generate_report)"
    - "Captura da mensagem 'user' (nao 'system') via monkeypatch de llm._call — o padrao do golden da Fase 1 capturava 'system'; aqui o vazamento vive na 'user'"

key-files:
  created: []
  modified:
    - backend/app/services/llm.py
    - backend/app/services/pipeline.py
    - backend/tests/test_discovery_mode.py

key-decisions:
  - "citi_block interpolado na MESMA posicao textual (entre '## Alertas detectados' e '## Transcrição completa') — nenhuma outra linha da mensagem user muda entre sales-antes e sales-depois"
  - "mode nao foi movido para o system_prompt do PromptBuilder sales — ficaria mudando user->system no payload do Gemini, arriscando SC#4 (anti-pattern documentado no RESEARCH.md)"
  - "Teste de precisao da Task 2 e uma rede unica (nao 4 testes separados) que consolida DISC-03 nas 4 superficies de uma vez — mais facil de manter e de ler como prova de requisito"

patterns-established:
  - "Pattern: qualquer novo agente/mensagem que precise gate por mode segue o mesmo molde citi_block — variavel condicional interpolada na posicao exata, nunca reescrita do ramo default"

requirements-completed: [DISC-03]

coverage:
  - id: D1
    description: "generate_report(mode='discovery') nao injeta o bloco comercial (CITI_PORTFOLIO/CATALOG/TECH_REFERENCE) na mensagem 'user' enviada ao Gemini (DISC-03/SC#3)"
    requirement: "DISC-03"
    verification:
      - kind: unit
        ref: "backend/tests/test_discovery_mode.py#test_generate_report_discovery_mode_omits_citi_block"
        status: pass
    human_judgment: false
  - id: D2
    description: "generate_report(mode='sales') e generate_report(...) com mode omitido injetam o bloco comercial byte-identico ao comportamento atual, na mesma posicao (SC#4, sem regressao)"
    verification:
      - kind: unit
        ref: "backend/tests/test_discovery_mode.py#test_generate_report_sales_mode_includes_citi_block"
        status: pass
      - kind: unit
        ref: "backend/tests/test_discovery_mode.py#test_generate_report_default_mode_matches_sales_mode"
        status: pass
      - kind: unit
        ref: "backend/tests/test_coverage_areas_golden.py (13 testes)"
        status: pass
    human_judgment: false
  - id: D3
    description: "pipeline._run_report_generator repassa mode=self.state.mode para llm.generate_report"
    verification:
      - kind: other
        ref: "grep -n 'mode=self.state.mode' backend/app/services/pipeline.py (linha 369)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Teste de precisao unico prova DISC-03 nas 4 superficies discovery (3 prompts realtime do DiscoveryPromptBuilder + mensagem user do relatorio) — nenhuma delas contem CITI_PORTFOLIO; as 3 realtime carregam calibracao DMS"
    requirement: "DISC-03"
    verification:
      - kind: unit
        ref: "backend/tests/test_discovery_mode.py#test_disc03_citi_portfolio_absent_from_all_four_discovery_surfaces"
        status: pass
      - kind: integration
        ref: "cd backend && python -m pytest -q (44 passed, 4 skipped; unica falha e test_schema.py::test_tables_exist, pre-existente e dependente de Supabase real)"
        status: pass
    human_judgment: true
    rationale: "A verificacao ponta a ponta real (gerar um relatorio de uma sessao mode=discovery de verdade e conferir o Markdown final sem secao de portfolio) depende da coluna projects.mode que so chega em 02-03 — fica para /gsd-verify-work apos 02-03, conforme a secao 7 do plano."

duration: 10min
completed: 2026-09-21
status: complete
---

# Phase 2 Plan 2: Gate do bloco comercial em generate_report por mode Summary

**`generate_report` ganha um kwarg `mode: str = "sales"` que gateia as 3 linhas do "folheto comercial" (Portfólio/Catálogo/Referência de tecnologias) na mensagem `user` — discovery não recebe o bloco, sales continua byte-idêntico, `pipeline` repassa `mode=self.state.mode`.**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-09-20T22:01:00-03:00 (aprox.)
- **Completed:** 2026-09-21T01:03:17Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- `llm.generate_report` ganhou o parâmetro `mode: str = "sales"` no final da assinatura (default preserva 100% das chamadas atuais que já existem no código).
- As 3 linhas hardcoded de referência comercial (`CITI_PORTFOLIO`/`CITI_SERVICE_CATALOG`/`CITI_TECH_REFERENCE`) viraram a variável `citi_block`, interpolada na MESMA posição textual da mensagem `user` — presente só quando `mode == "sales"`, string vazia caso contrário.
- `pipeline._run_report_generator` agora passa `mode=self.state.mode` na chamada a `llm_service.generate_report(...)` — fecha o fork ponta a ponta (`SessionState.mode` → `generate_report`).
- Fecha o único ponto identificado no RESEARCH.md (Pitfall 1) onde o portfólio comercial ainda vazava para um relatório de discovery, mesmo com `system_prompt` já vindo do `DiscoveryPromptBuilder`.
- `backend/tests/test_discovery_mode.py` ganhou 4 testes novos (3 do gate + 1 de precisão consolidando as 4 superfícies discovery), todos capturando a mensagem `user` via monkeypatch de `llm._call` (não o `system`, conforme Pitfall 1/Pattern 3 do RESEARCH.md).
- Suíte golden da Fase 1 (`test_coverage_areas_golden.py`, 13 testes) permanece verde sem edição — SC#4 sem regressão.
- Suíte completa do backend verde (44 passed, 4 skipped; única falha é a pré-existente `test_schema.py::test_tables_exist`, dependente de conexão real com Supabase — fora do escopo desta fase, já confirmada como pré-existente no SUMMARY do plano 02-01).

## Task Commits

Cada task foi commitada atomicamente, com RED/GREEN separados por ser plano TDD (Task 1):

1. **Task 1 (TDD): Gate do bloco comercial em generate_report por mode + repasse do mode no pipeline**
   - RED: `fc963b8` (test) — 3 testes do gate (discovery omite, sales inclui, default == sales), todos falhando com `TypeError: generate_report() got an unexpected keyword argument 'mode'`
   - GREEN: `f684b77` (feat) — kwarg `mode` + `citi_block` condicional em `llm.py`; `mode=self.state.mode` em `pipeline.py`
2. **Task 2: Asserção de precisão DISC-03 — CITI_PORTFOLIO ausente das 4 superfícies discovery + suíte completa**
   - `4a9acff` (test) — teste único consolidando as 4 superfícies + suíte completa verde

**Plan metadata:** *(este commit — feito ao final deste SUMMARY)*

## Files Created/Modified
- `backend/app/services/llm.py` - `generate_report` ganha kwarg `mode`; `citi_block` condicional substitui as 3 linhas hardcoded, mesma posição
- `backend/app/services/pipeline.py` - `_run_report_generator` passa `mode=self.state.mode` para `generate_report`
- `backend/tests/test_discovery_mode.py` - 4 testes novos: 3 do gate (Task 1) + 1 de precisão DISC-03 consolidada (Task 2)

## Decisions Made
- `citi_block` interpolado na MESMA posição textual (entre `## Alertas detectados` e `## Transcrição completa`) — garante que nenhuma outra linha da mensagem `user` mude entre sales-antes e sales-depois (SC#4).
- Gate ficou em `llm.py`, não no `DiscoveryPromptBuilder`/`system_prompt` — mover o bloco comercial para o `system_prompt` sales mudaria `user`→`system` no payload do Gemini, o que poderia alterar a resposta mesmo com texto idêntico (anti-pattern documentado no RESEARCH.md).
- Teste de precisão da Task 2 é uma rede única (não 4 testes redundantes) que consolida DISC-03 nas 4 superfícies de uma vez — mais fácil de manter como prova única do requisito.

## Deviations from Plan

None - plano executado exatamente como escrito.

## Issues Encountered
- Nenhum. `python -m pytest -q` (suíte completa) reporta a mesma falha pré-existente já documentada no SUMMARY do plano 02-01 (`tests/test_schema.py::test_tables_exist`, dependência de conexão real com Supabase) — confirmada como fora do escopo desta fase, não relacionada a `mode`/`generate_report`/`pipeline`.

## User Setup Required
None - nenhuma configuração de serviço externo é necessária por este plano.

## Next Phase Readiness
- DISC-03 agora está provado nas 4 superfícies discovery (3 prompts realtime, validados em 02-01, + mensagem `user` do relatório, validada aqui) — pronto para ser marcado `Complete` em REQUIREMENTS.md (shared-ID gate #2388 entre 02-01 e 02-02).
- O seam `mode` está completo ponta a ponta no backend (`SessionState.mode` → seleção de builder → `generate_report`) — pronto para o plano 02-03 (coluna `projects.mode` + toggle no frontend, DISC-01).
- A verificação ponta a ponta real (criar projeto `mode=discovery`, gerar um relatório de sessão real e conferir que o Markdown final não traz seção de portfólio comercial) depende da coluna `projects.mode`, que só chega em 02-03 — fica para `/gsd-verify-work` após 02-03.
- Limitação conhecida herdada de 02-01 (fora de escopo D-06..D-12, não corrigida aqui): os fallbacks de `classify_coverage`/`detect_red_flags`/`generate_questions` sem `system_prompt` continuam citando só o area-set sales — não são exercitados pelo pipeline real.

## Self-Check: PASSED

- `backend/app/services/llm.py`, `backend/app/services/pipeline.py`, `backend/tests/test_discovery_mode.py` confirmados presentes em disco via `[ -f ]`.
- Todos os 3 commits (`fc963b8`, `f684b77`, `4a9acff`) confirmados via `git log --oneline --all`.
- `inspect.signature(generate_report)` contém o parâmetro `mode` — confirmado (`OK`).
- `grep -n "mode=self.state.mode" backend/app/services/pipeline.py` — confirmado (linha 369).
- `cd backend && python -m pytest tests/test_discovery_mode.py -q` — 15 passed.
- `cd backend && python -m pytest tests/test_coverage_areas_golden.py -q` — 13 passed.
- `cd backend && python -m pytest -q` — 44 passed, 4 skipped, 1 falha pré-existente fora de escopo (`test_schema.py::test_tables_exist`).

---
*Phase: 02-discovery-mode-discoverypromptbuilder*
*Completed: 2026-09-21*
