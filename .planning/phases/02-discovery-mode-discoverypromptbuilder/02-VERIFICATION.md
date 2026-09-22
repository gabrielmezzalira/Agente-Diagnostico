---
phase: 02-discovery-mode-discoverypromptbuilder
verified: 2026-09-21T18:00:00Z
status: passed
score: 4/4 must-haves verified
covered_files:
  - .planning/phases/02-discovery-mode-discoverypromptbuilder/02-01-PLAN.md
  - .planning/phases/02-discovery-mode-discoverypromptbuilder/02-01-SUMMARY.md
  - .planning/phases/02-discovery-mode-discoverypromptbuilder/02-02-PLAN.md
  - .planning/phases/02-discovery-mode-discoverypromptbuilder/02-02-SUMMARY.md
  - .planning/phases/02-discovery-mode-discoverypromptbuilder/02-03-PLAN.md
  - .planning/phases/02-discovery-mode-discoverypromptbuilder/02-03-SUMMARY.md
  - backend/app/models/projects.py
  - backend/app/services/coverage_areas.py
  - backend/app/services/discovery_prompt_builder.py
  - backend/app/services/llm.py
  - backend/app/services/pipeline.py
  - backend/app/services/session_state.py
  - backend/tests/test_discovery_mode.py
  - backend/tests/test_projects.py
  - frontend/src/lib/api.ts
  - frontend/src/pages/ProjectFormPage.tsx
  - supabase/migrations/20260921000000_add_mode_to_projects.sql
covered_digest: "v1:sha256:ce42b1a9f0687b00c6ef112f9ba55a2e4dba6d8dc1aab37a79cc41ff6a4b7d7d"
behavior_unverified: 0
overrides_applied: 0
---

# Fase 2: Discovery Mode + DiscoveryPromptBuilder — Relatório de Verificação

**Objetivo da fase:** Um projeto configurado com `mode=discovery` roda o pipeline completo sobre as 18 áreas de discovery (lentes Produto + Dados) com enquadramento de discovery, enquanto projetos de vendas se comportam exatamente como antes.
**Verificado em:** 2026-09-21
**Status:** passed
**Re-verificação:** Não — verificação inicial

## Conquista do Objetivo

### Verdades Observáveis (Success Criteria do ROADMAP)

| # | Verdade | Status | Evidência |
|---|---------|--------|-----------|
| 1 | Um projeto pode ser criado/editado com `mode=discovery` (vs `mode=sales`); projetos sales existentes seguem funcionando com `mode=sales` sem serem afetados pela nova coluna (SC#1 / DISC-01) | ✓ VERIFICADO | `ProjectMode = Literal["sales","discovery"]` em `models/projects.py:10`; `mode` em ProjectCreate (default 'sales'), ProjectUpdate (Optional) e ProjectResponse. Migration aditiva com DEFAULT 'sales'. Toggle radio no formulário (`ProjectFormPage.tsx:254-273`) gravando/editando `form.mode`. Teste `test_project_mode_default_and_validation` passa (default + rejeição de valor inválido). UAT #4/#12 confirmou persistência end-to-end no Supabase. |
| 2 | Uma sessão discovery mostra as 18 áreas de discovery (Produto + Dados) em vez das 8 de sales (SC#2 / DISC-02) | ✓ VERIFICADO | `DISCOVERY_AREA_SET` com 18 áreas (8 Produto order 0-7 + 10 Dados order 8-17) em `coverage_areas.py:76-100`; `_init_coverage(mode="discovery")` gera 18 chaves sem `not_applicable` (`session_state.py:30-31`); `pipeline.get_or_create` fixa `mode` na SessionState. Testes `test_init_coverage_discovery_mode_has_18_keys_no_not_applicable` e `test_session_state_discovery_mode_initializes_18_areas` passam. UAT #2 confirmou as 18 áreas ao vivo. |
| 3 | Prompts de discovery enviados ao LLM omitem o enquadramento comercial CITI_PORTFOLIO mantendo a calibração por Data Maturity Score (SC#3 / DISC-03) | ✓ VERIFICADO | `discovery_prompt_builder.py` importa apenas `DMS_DESCRIPTION, DMS_LABEL` — nunca as constantes CITI (as únicas menções a CITI_* estão no docstring explicativo, não em prompt gerado). Os 3 prompts realtime carregam `_dms_str()`. Gate no relatório: `citi_block ... if mode == "sales" else ""` (`llm.py:179-183`), com `pipeline._run_report_generator` repassando `mode=self.state.mode` (`pipeline.py:369`). Testes `test_build_*_has_dms_no_citi`, `test_generate_report_discovery_mode_omits_citi_block` e `test_disc03_citi_portfolio_absent_from_all_four_discovery_surfaces` passam. UAT #3 confirmou relatório discovery sem bloco comercial. |
| 4 | Re-rodar uma sessão sales após a mudança ainda produz as 8 áreas e prompts CITI_PORTFOLIO-aware, sem regressão (SC#4) | ✓ VERIFICADO | Ramo `else` de `_init_coverage` mantém `SALES_AREA_SET` com esquema critical/optional/inactive; ramo `else` de `pipeline.get_or_create` mantém `PromptBuilder`; `generate_report(mode='sales')` injeta o bloco comercial. Suíte golden da Fase 1 (`test_coverage_areas_golden.py`) 13/13 verde sem edição. Testes `test_..._sales_mode_default_unchanged`, `test_generate_report_sales_mode_includes_citi_block` e `test_generate_report_default_mode_matches_sales_mode` passam. |

**Score:** 4/4 verdades verificadas (0 presentes com comportamento não exercido)

Verdades de nível de plano (must_haves das PLANs 02-01/02/03) — todas cobertas pelas 4 verdades acima e por testes que passam: seleção de builder por `mode`, boundary de DMS (1/5/None) sem erro, idempotência da migration (ADD COLUMN IF NOT EXISTS), enum Pydantic rejeitando valor fora de {sales, discovery}. As duas asserções `verification: backstop` (fixação do area-set no início da sessão; migration puramente aditiva e concorrência-segura) são confirmáveis diretamente no código — `SessionState.__post_init__` só inicializa a cobertura quando vazia, e a migration é um único `ALTER TABLE ... ADD COLUMN ... DEFAULT` sem UPDATE/DROP.

### Artefatos Requeridos

| Artefato | Esperado | Status | Detalhes |
|----------|----------|--------|----------|
| `backend/app/services/coverage_areas.py` | DISCOVERY_AREA_SET com 18 áreas | ✓ VERIFICADO | 18 AreaDefinition (8 Produto + 10 Dados), instância independente de SALES_AREA_SET |
| `backend/app/services/discovery_prompt_builder.py` | Builder irmão sem CITI, com DMS | ✓ VERIFICADO | 249 linhas, 4 métodos build_* + build_all; sem import de constantes CITI |
| `backend/app/services/session_state.py` | `mode` + `_init_coverage` por mode | ✓ VERIFICADO | Campo `mode='sales'`; `__post_init__` seleciona area-set por mode |
| `backend/app/services/pipeline.py` | Seleção de builder + repasse de mode | ✓ VERIFICADO | `pipeline.py:598-627` seleção por mode; `:369` repassa mode ao relatório |
| `backend/app/services/llm.py` | Gate do bloco comercial por mode | ✓ VERIFICADO | `generate_report(mode='sales')` monta citi_block; discovery = "" |
| `backend/app/models/projects.py` | ProjectMode nos 3 schemas | ✓ VERIFICADO | Literal + campo mode em Create/Update/Response |
| `supabase/migrations/20260921000000_add_mode_to_projects.sql` | Migration aditiva idempotente | ✓ VERIFICADO | ADD COLUMN IF NOT EXISTS mode text DEFAULT 'sales' |
| `frontend/src/pages/ProjectFormPage.tsx` | Toggle sales\|discovery | ✓ VERIFICADO | Radio group wired a form.mode; edição carrega mode existente |
| `frontend/src/lib/api.ts` | Tipo mode em Project/ProjectCreate | ✓ VERIFICADO | `mode: 'sales' \| 'discovery'` nos dois tipos |
| `backend/tests/test_discovery_mode.py` | Cobertura DISC-02/DISC-03 | ✓ VERIFICADO | 15 testes, todos passam |

### Verificação de Key Links (Wiring)

| De | Para | Via | Status |
|----|------|-----|--------|
| `pipeline.get_or_create` | `DiscoveryPromptBuilder` / `PromptBuilder` | seleção por `project.get('mode')` | ✓ WIRED (`pipeline.py:598-611`) |
| `SessionState.__post_init__` | `_init_coverage(mode=self.mode)` | seleção do area-set | ✓ WIRED (`session_state.py:99-101`) |
| `pipeline._run_report_generator` | `llm.generate_report(mode=self.state.mode)` | gate do bloco comercial | ✓ WIRED (`pipeline.py:369`) |
| `llm.generate_report(mode)` | `citi_block` | só quando `mode=='sales'` | ✓ WIRED (`llm.py:179-183`) |
| `DiscoveryPromptBuilder` | `DISCOVERY_AREA_SET.schema_json()/block_enum()` | schema derivado do registro | ✓ WIRED (`discovery_prompt_builder.py:93,204`) |
| frontend `form.mode` | `api.projects.create/update` → `ProjectCreate.mode` | persistência | ✓ WIRED (`api.ts:16,61`; UAT #4) |
| `projects.mode` (coluna) | `pipeline.get_or_create project.get('mode')` | consumo do mode persistido | ✓ WIRED (`pipeline.py:598`; UAT confirmou coluna no Supabase) |

### Behavioral Spot-Checks

| Comportamento | Comando | Resultado | Status |
|---------------|---------|-----------|--------|
| Testes discovery mode (DISC-02/03) | `pytest tests/test_discovery_mode.py` | 15 passed | ✓ PASS |
| Validação de mode nos schemas (DISC-01) | `pytest tests/test_projects.py::test_project_mode_default_and_validation` | passed | ✓ PASS |
| Regressão sales (suíte golden Fase 1) | `pytest tests/test_coverage_areas_golden.py` | 13 passed | ✓ PASS |
| Ausência do literal CITI no builder discovery | `grep CITI_* discovery_prompt_builder.py` | só no docstring, não em prompt | ✓ PASS |

### Requirements Coverage

| Requisito | Plano | Descrição | Status | Evidência |
|-----------|-------|-----------|--------|-----------|
| DISC-01 | 02-03 | Projeto configurável em modo discovery vs sales sem afetar sales | ✓ SATISFEITO | ProjectMode, migration, toggle, teste + UAT |
| DISC-02 | 02-01 | Cobertura sobre as áreas de discovery (18) em vez das 8 de sales | ✓ SATISFEITO | DISCOVERY_AREA_SET + _init_coverage + testes + UAT |
| DISC-03 | 02-01, 02-02 | Prompts discovery sem CITI_PORTFOLIO mantendo calibração DMS | ✓ SATISFEITO | discovery_prompt_builder + gate llm + testes + UAT |

### Anti-Patterns Found

Nenhum. Nenhum marcador de dívida (TODO/FIXME/XXX/TBD/HACK/PLACEHOLDER) nos arquivos modificados; nenhum stub ou implementação vazia que chegue a saída visível.

### Verificação Humana

Nenhum item pendente. A UAT (`02-UAT.md`) já foi concluída pelo humano em 2026-09-21, fechando 12/12 testes com zero defeitos da fase. Os 3 bloqueios que surgiram durante a UAT (B-003 RLS/SUPABASE_KEY, B-005 modelo Gemini descontinuado, B-006 corrida WS+REST ao encerrar sessão) eram de ambiente/pré-existentes, foram resolvidos e registrados em `.planning/BACKLOG.md` — não são defeitos do código entregue pela Fase 2.

### Gaps Summary

Nenhum gap. As 4 verdades observáveis (Success Criteria do ROADMAP) estão verificadas contra o código real com testes comportamentais passando (28 testes relevantes: 15 discovery + 13 golden, mais a validação de mode), wiring completo em todas as conexões críticas, e confirmação humana end-to-end via UAT. O modo discovery inicializa as 18 áreas, os prompts discovery não carregam o portfólio comercial CITi, e o modo sales permanece byte-idêntico ao comportamento anterior sem regressão.

**Nota sobre estado dos testes:** o único teste falhando na suíte backend completa é `test_schema.py::test_tables_exist`, dependente de Supabase real/rede — fora do escopo da Fase 2 e não relacionado a nenhum artefato desta fase.

---

_Verificado em: 2026-09-21_
_Verificador: Claude (gsd-verifier)_
