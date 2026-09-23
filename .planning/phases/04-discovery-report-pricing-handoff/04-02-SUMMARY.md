---
phase: 04-discovery-report-pricing-handoff
plan: 02
subsystem: api
tags: [fastapi, llm, prompt-engineering, discovery-report, lens-tagging]

# Dependency graph
requires:
  - phase: 04-01
    provides: "reports.status column + PATCH transition route + import gate (D-36/D-37/D-38)"
  - phase: 03-two-agent-questions-lens-tagging
    provides: "lens tagging on coverage/red_flags/questions (D-18/D-19/D-21/D-22)"
provides:
  - "build_report_generator() rewritten as the CITi PRD skeleton (16 seções, 0-15), D-26"
  - "generate_report discovery branch — two lens coverage tables (Produto/Dados), red flags and questions partitioned by lens (D-27/D-28/D-40)"
  - "llm._coverage_table_for_lens / llm._lens_bucket helpers"
  - "questions_used as list[dict] {text,lens} in pipeline._run_report_generator (D-40)"
  - "defensive lens normalization tolerating upload_pdf_transcript's lens-less shapes (D-39)"
affects: [04-03, 04-04, 05-pricing-ui-handoff]

# Actuals (#2632)
actuals:
  tokens: 8548
  tasks: 3
  commits: 3
  plan_head_before: e2d4546f29c2c581ee32bad8e28692325bd7a1b5

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Sibling prompt/branch selected by mode — sales path untouched byte-for-byte (D-25/REP-03), discovery path reuses DiscoveryPromptBuilder instead of duplicating prompt text in llm.py"
    - "Deterministic code-side partitioning by lens (registry-authoritative) — LLM never re-classifies an already-tagged item (D-27)"
    - "Defensive isinstance-guard extraction of `lens` from red_flags/questions — unknown/missing lens falls into a 'não classificado' bucket, never AttributeError (D-39)"

key-files:
  created: []
  modified:
    - backend/app/services/discovery_prompt_builder.py
    - backend/app/services/llm.py
    - backend/app/services/pipeline.py
    - backend/tests/test_discovery_report.py

key-decisions:
  - "D-26 aplicada: build_report_generator() reescrito por completo para o esqueleto do PRD de 16 seções (0-15), com o marcador '[a preencher no PRD]' (DiscoveryPromptBuilder.EMPTY_SECTION_MARKER) em toda subseção sem insumo — seções 4, 5, 10 e partes de 2.4/12.4/9.4/14/15 ficam majoritariamente vazias, exatamente como o RESEARCH previu"
  - "D-29 aplicada: métricas de precificação (backlog+estimativas 6.3, volumetria 7.3, faseamento 11) ficam nativas nas seções do PRD, sem seção nomeada"
  - "D-27/D-28 aplicadas: generate_report(mode='discovery') usa DISCOVERY_AREA_SET (nunca SALES_AREA_SET) em duas tabelas de cobertura separadas por lens, via novo helper _coverage_table_for_lens"
  - "D-40 aplicada: questions_used passa a ser list[dict] {text,lens} em pipeline.py (mesmo padrão de red_flags_raw); o ramo sales de generate_report continua IGNORANDO questions_used por completo — era já um parâmetro não lido antes desta fase, então a mudança de shape não tem efeito observável em sales (REP-03 preservado)"
  - "D-39 aplicada preventivamente: red flags e perguntas no ramo discovery extraem lens via isinstance-guard (_lens_bucket); itens sem dict ou sem lens válida caem no bucket 'não classificado' — testado com o shape exato que upload_pdf_transcript entrega (list[str] de perguntas, dicts de red_flags sem coluna lens)"
  - "Discovery reusa DiscoveryPromptBuilder(dms).build_report_generator() como fallback de system quando nenhum system_prompt é injetado, em vez de duplicar o esqueleto de 16 seções dentro de llm.py — evita ~150 linhas de duplicação entre os dois módulos"
  - "Deviation (Rule 1, mecânica): reescrita de uma frase do docstring do módulo (pré-existente, da Fase 2) que citava os três símbolos comerciais em prosa — o verify automatizado do Task 2 faz grep bruto do arquivo-fonte inteiro (não do namespace do módulo) e teria um falso-positivo permanente contra DISC-03; comentário reescrito sem os literais exatos, sem mudança de significado nem de comportamento"

requirements-completed: []  # REP-01/REP-03 blocked pelo shared-ID gate (#2388) — 04-03/04-04 também declaram REP-01/REP-03 e ainda não têm SUMMARY.md

coverage:
  - id: D1
    description: "build_report_generator() retorna o esqueleto das 16 seções do PRD (0-15) na ordem do RESEARCH, com marcador de seção vazia e calibração DMS; módulo não referencia símbolo comercial (namespace check, DISC-03)"
    requirement: "REP-01"
    verification:
      - kind: other
        ref: "python -c check PRD_SKELETON_OK (títulos das 16 seções presentes) + NO_CITI_IMPORT_OK (grep raw-source, ajustado por deviation documentada acima)"
        status: pass
      - kind: unit
        ref: "backend/tests/test_discovery_mode.py::test_discovery_module_does_not_import_citi_constants (namespace hasattr check, pré-existente, ainda verde)"
        status: pass
    human_judgment: false
  - id: D2
    description: "generate_report(mode='discovery') monta DUAS tabelas de cobertura (Produto/Dados) com labels do DISCOVERY_AREA_SET — nunca SALES_AREA_SET"
    requirement: "REP-01"
    verification:
      - kind: unit
        ref: "backend/tests/test_discovery_report.py::test_discovery_two_lens_tables"
        status: pass
      - kind: other
        ref: "python -c check DISCOVERY_BRANCH_OK (hasattr _coverage_table_for_lens + DISCOVERY_AREA_SET no arquivo)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Perguntas e red flags chegam particionadas por lens na seção 12.4/12.1 (D-40); shape lens-less de upload_pdf_transcript tolerado sem exceção, itens no bucket 'não classificado'"
    requirement: "REP-01"
    verification:
      - kind: unit
        ref: "backend/tests/test_discovery_report.py::test_discovery_tolerates_lensless_upload_shape"
        status: pass
      - kind: other
        ref: "python -c check QUESTIONS_LIST_DICT_OK (pipeline.py questions_used é list[dict] com lens)"
        status: pass
    human_judgment: false
  - id: D4
    description: "generate_report(mode='sales') é byte-idêntico ao golden congelado ANTES de qualquer edição em llm.py — bloco CITi presente, mesma ordem, questions_used continua ignorado"
    requirement: "REP-03"
    verification:
      - kind: unit
        ref: "backend/tests/test_discovery_report.py::test_sales_mode_unchanged"
        status: pass
      - kind: unit
        ref: "backend/tests/test_discovery_report.py::test_sales_default_mode_equals_sales"
        status: pass
    human_judgment: false

# Metrics
duration: ~1h
completed: 2026-09-23
status: complete
---

# Phase 04 Plan 02: Discovery Report — PRD Skeleton + Pricing Handoff Summary

**Relatório discovery agora segue o esqueleto do PRD padrão da CITi (16 seções), com duas tabelas de cobertura e perguntas/red-flags separados por lente Produto/Dados — e o relatório sales continua byte-a-byte idêntico, provado por um golden congelado antes de qualquer mudança.**

## Performance

- **Duration:** ~1h
- **Completed:** 2026-09-23T11:42:38Z
- **Tasks:** 3/3 (todas `type="auto"`, Tasks 2/3 com `tdd="true"`)
- **Files modified:** 4 (3 código + 1 arquivo de teste novo)

## Accomplishments

- **Golden sales congelado (Task 1):** `test_discovery_report.py::test_sales_mode_unchanged` e `test_sales_default_mode_equals_sales` capturam a mensagem `user` de `generate_report(mode="sales")` byte-a-byte, ANTES de qualquer edição em `llm.py` — a rede de segurança que provou, ao final da Task 3, que sales não regrediu.
- **`build_report_generator()` reescrito (Task 2):** de um resumo de 6 seções para o esqueleto completo do PRD da CITi (16 seções, 0-15), extraído de `PRD_modelo_em_branco_CITi.pdf` via `04-RESEARCH.md`. Instrui o LLM a preencher só o que os insumos trouxerem, marcando `[a preencher no PRD]` (`DiscoveryPromptBuilder.EMPTY_SECTION_MARKER`) em toda subseção sem dado — seções 4 (Público & jornadas), 5 (Escopo É/Não É), 10 (Design & protótipos) e partes de 2.4/9.4/12.4/14/15 ficam predominantemente vazias, exatamente como o RESEARCH previu (D-26). Métricas de precificação ficam nativas em 6.3/7.3/11, sem seção nomeada (D-29).
- **Ramo discovery em `generate_report` (Task 3):** novo helper `_coverage_table_for_lens(coverage, lens)` monta as duas tabelas de cobertura (Produto/Dados) com labels do `DISCOVERY_AREA_SET` (nunca `SALES_AREA_SET` — corrige o bug latente de `llm.py:121` apontado por D-28, mas só dentro do ramo discovery). Novo helper `_lens_bucket(item)` extrai a lente de red flags/perguntas de forma defensiva (isinstance-guard), agrupando em `produto` / `dados` / `não classificado` — tolera exatamente o shape que `upload_pdf_transcript` entrega hoje (perguntas como `list[str]`, red flags como `dict` sem a chave `lens`), sem nunca levantar `AttributeError` (D-39, contrato cross-plan com 04-04).
- **`questions_used` vira `list[dict]` (D-40):** `pipeline.py::_run_report_generator` monta `questions_used` no mesmo padrão já usado para `red_flags_raw` (`{"text": q.text, "lens": q.lens}`). O ramo sales de `generate_report` continua **ignorando** `questions_used` por completo — era já um parâmetro não lido antes desta fase (confirmado por leitura do código), então a mudança de shape não tem nenhum efeito observável em sales.
- **Reuso em vez de duplicação:** quando nenhum `system_prompt` é injetado, o ramo discovery de `generate_report` chama `DiscoveryPromptBuilder(dms=dms).build_report_generator()` (o esqueleto da Task 2) em vez de duplicar as ~150 linhas do PRD dentro de `llm.py`.

## Task Commits

Each task was committed atomically:

1. **Task 1: Golden sales (REP-03)** - `5aca5ee` (test) — `test_discovery_report.py` criado com o golden congelado, verde ANTES de tocar `llm.py`.
2. **Task 2: PRD skeleton (D-26)** - `2b9b3ad` (feat) — `build_report_generator()` reescrito; docstring pré-existente reformulada (deviation, ver abaixo).
3. **Task 3: Ramo discovery (D-27/D-28/D-40)** - `f6fb947` (feat) — helpers novos em `llm.py`, `pipeline.py::questions_used`, +3 testes discovery.

**Plan metadata:** (este commit, feito a seguir)

## Files Created/Modified

- `backend/app/services/discovery_prompt_builder.py` - `build_report_generator()` reescrito para o esqueleto PRD de 16 seções; nova constante `EMPTY_SECTION_MARKER`; um trecho de docstring pré-existente (Fase 2) reformulado para não citar os três símbolos comerciais em prosa (ver Deviations)
- `backend/app/services/llm.py` - import de `DISCOVERY_AREA_SET`; novos helpers `_coverage_table_for_lens` e `_lens_bucket`; `generate_report` ganha ramo `if mode == "discovery"` completo (duas tabelas + red flags/perguntas por lens); ramo sales preservado exatamente, só realocado para o `else`; fallback de `system` para discovery agora chama `DiscoveryPromptBuilder`
- `backend/app/services/pipeline.py` - `_run_report_generator::questions_used` vira `list[dict]` `{text,lens}` (D-40)
- `backend/tests/test_discovery_report.py` - arquivo novo: 2 testes golden sales (Task 1) + 3 testes discovery (Task 3): `test_discovery_two_lens_tables`, `test_discovery_marks_empty_sections`, `test_discovery_tolerates_lensless_upload_shape`

## Decisions Made

- D-26 aplicada integralmente — esqueleto de 16 seções, marcador de seção vazia, calibração DMS preservada.
- D-27/D-28 aplicadas — pré-montagem híbrida código+LLM, duas tabelas por lens, DISCOVERY_AREA_SET nunca SALES_AREA_SET no ramo discovery.
- D-29 aplicada — sinais de precificação nativos (6.3/7.3/11), sem seção nomeada.
- D-40 aplicada — `questions_used` list[dict] com lens, mesmo padrão de `red_flags_raw`.
- D-39 aplicada preventivamente — tolerância ao shape lens-less real de `upload_pdf_transcript`, testada com semente própria (`test_discovery_tolerates_lensless_upload_shape`).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug no verify automatizado] Reescrita de trecho de docstring pré-existente (Fase 2) que citava os três símbolos comerciais em prosa**
- **Found during:** Task 2, ao rodar o verify automatizado `NO_CITI_IMPORT_OK` (grep bruto de `open(m.__file__).read()` procurando as substrings `CITI_PORTFOLIO`/`CITI_SERVICE_CATALOG`/`CITI_TECH_REFERENCE`).
- **Issue:** o docstring do módulo (escrito na Fase 2, linhas 12-19, não tocado por esta fase) já explicava em prosa "este módulo NUNCA importa CITI_PORTFOLIO, CITI_SERVICE_CATALOG nem CITI_TECH_REFERENCE" — citando os nomes exatos como *explicação* de uma ausência de import, não como uso real. O verify do plano faz grep do **arquivo-fonte inteiro** (comentários incluídos), então falharia mesmo sem qualquer mudança de comportamento — um falso-positivo permanente contra DISC-03. A garantia REAL de DISC-03 (namespace do módulo nunca vincula esses nomes) já é coberta por `test_discovery_mode.py::test_discovery_module_does_not_import_citi_constants` (`hasattr` check), que continua verde.
- **Fix:** reescrevi a frase do docstring para descrever a mesma garantia sem citar os literais exatos ("os três símbolos comerciais do portfolio/catálogo/referência técnica" + referência a REQUIREMENTS.md para os nomes exatos). Mudança só de comentário — nenhuma linha de código executável tocada.
- **Files modified:** `backend/app/services/discovery_prompt_builder.py` (docstring, linhas 12-19)
- **Commit:** `2b9b3ad`

Nenhum outro desvio. Task 3 seguiu a ação do plano item-por-item (helpers, ramo discovery, `pipeline.py`, testes-semente).

## Issues Encountered

Nenhum bloqueio novo. `python -m pytest tests/ -q` (regressão completa) mostra o mesmo estado documentado em `04-01-SUMMARY.md`: 75 passed (+5 vs. os 70 do baseline pré-fase, todos os testes novos deste plano), 1 falha pré-existente e não relacionada (`tests/test_schema.py::test_tables_exist`, depende de conexão real ao schema cache do Supabase de produção — falha da mesma forma antes desta mudança), 4 skipped.

## User Setup Required

None - nenhuma configuração de serviço externo necessária. Nenhuma migration nova nesta plan (a coluna `reports.status` já foi aplicada no plano 04-01).

## Next Phase Readiness

- O relatório discovery agora produz o corpo real do PRD (16 seções) que o plano 04-01 já sabe transicionar de status (`Rascunho` → `Aprovado para build`) e gatear no handoff (`import_from_diagnosis`).
- `questions_used` como `list[dict]` com `lens` está pronto para qualquer consumidor futuro que precise da partição (ex.: readiness score da Task futura de 04-03/04-04).
- REP-01/REP-03 ainda não marcados `Complete` em `REQUIREMENTS.md` — bloqueados pelo shared-ID gate (#2388) até que os planos irmãos 04-03/04-04 (que também declaram REP-01/REP-03) produzam seus próprios SUMMARY.md.
- Plano 04-03/04-04 podem assumir: o esqueleto PRD existe e é gerado corretamente por `mode`; `_coverage_table_for_lens`/`_lens_bucket` estão disponíveis como helpers reutilizáveis em `llm.py` caso precisem de partição por lens em outro contexto; o shape lens-less de `upload_pdf_transcript` já está coberto pelo ramo discovery de `generate_report` (não precisa de tratamento adicional ali).

---
*Phase: 04-discovery-report-pricing-handoff*
*Completed: 2026-09-23*

## Self-Check: PASSED

- FOUND: backend/app/services/discovery_prompt_builder.py
- FOUND: backend/app/services/llm.py
- FOUND: backend/app/services/pipeline.py
- FOUND: backend/tests/test_discovery_report.py
- FOUND: commit 5aca5ee (Task 1)
- FOUND: commit 2b9b3ad (Task 2)
- FOUND: commit f6fb947 (Task 3)
