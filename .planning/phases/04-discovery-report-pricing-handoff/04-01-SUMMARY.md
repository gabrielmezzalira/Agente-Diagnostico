---
phase: 04-discovery-report-pricing-handoff
plan: 01
subsystem: api
tags: [fastapi, supabase, pydantic, langchain, pricing-handoff]

# Dependency graph
requires:
  - phase: 02-discovery-mode-foundation
    provides: projects.mode column + mode-gated branching pattern (D-24)
provides:
  - "reports.status column (text, nullable, no default) — migration applied to Supabase"
  - "Discovery reports grant status='Rascunho' on generation (sales stays NULL)"
  - "PATCH /sessions/{session_id}/report — status transition route (D-38)"
  - "import_from_diagnosis gate: 422 unless status is None or 'Aprovado para build' (D-37)"
affects: [04-02-discovery-report-prd-skeleton, 04-03, 04-04, 05-pricing-ui-handoff]

# Actuals (#2632)
actuals:
  tokens: 2623
  tasks: 3
  commits: 2
  plan_head_before: e97242b3a913875c3970a9b7a6ecb7c64d381277

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Gate único por mode/status — nunca introduzir um segundo flag paralelo (pipeline.py:411-413)"
    - "Business gate vive no service (llm_pricing_service.py), nunca no router — router só faz update de campo simples"
    - "Migration aditiva/nullable/sem-default para colunas enum-like (validação em Pydantic Literal, sem CHECK/ALTER TYPE)"

key-files:
  created:
    - supabase/migrations/20260923000000_add_status_to_reports.sql
    - backend/tests/test_import_from_diagnosis_gate.py
  modified:
    - backend/app/repositories/pricing_repository.py
    - backend/app/services/pipeline.py
    - backend/app/routers/sessions.py
    - backend/app/services/llm_pricing_service.py

key-decisions:
  - "D-36 (checkpoint aprovado pelo usuário): coluna reports.status é one-way/aditiva/nullable/sem-default, aplicada manualmente no Supabase SQL Editor — mesmo padrão de projects.mode/questions.lens"
  - "D-37: gate de aprovação vive em LLMPricingService.import_from_diagnosis (service), nunca no router nem no frontend — trata status=None como 'sem gate' (nunca consulta projects.mode)"
  - "D-38: rota PATCH /sessions/{session_id}/report é escrita simples de campo, aceitável no router (mesmo nível dos GET/POST de report já existentes) — não confundir com o gate de negócio"

requirements-completed: []  # REP-02/REP-03 blocked pela shared-ID gate — sibling plans 04-02/03/04 também declaram esses IDs e ainda não têm SUMMARY (ver requirements.ready-ids)

coverage:
  - id: D1
    description: "Coluna reports.status criada e aplicada no Supabase (migration aditiva/nullable/sem-default), repositório lê status nos dois SELECTs"
    requirement: "REP-02"
    verification:
      - kind: other
        ref: "grep MIGRATION_OK + NO_DEFAULT_NO_ALTERTYPE_OK + SELECT_STATUS_OK (Task 2 verify) + confirmação humana no SQL Editor"
        status: pass
    human_judgment: false
  - id: D2
    description: "Discovery reports nascem com status='Rascunho' (grant gated por mode=='discovery'); sales continua sem status (NULL)"
    requirement: "REP-03"
    verification:
      - kind: other
        ref: "python -c check STATUS_GRANT_OK (grep 'Rascunho' + 'mode == \"discovery\"' em pipeline.py)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Rota PATCH /sessions/{session_id}/report valida status contra Literal de 3 valores e transiciona o campo (D-38)"
    requirement: "REP-02"
    verification:
      - kind: other
        ref: "python -c check PATCH_MODEL_OK (ReportStatusUpdate.model_fields['status'] existe)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Gate de aprovação em import_from_diagnosis: 422 para status não aprovado, sucesso (>=1 feature + pricings.session_id) para aprovado, no-op (importa) para sales (status=None)"
    requirement: "REP-02"
    verification:
      - kind: unit
        ref: "backend/tests/test_import_from_diagnosis_gate.py#test_import_blocks_when_status_not_approved"
        status: pass
      - kind: unit
        ref: "backend/tests/test_import_from_diagnosis_gate.py#test_import_succeeds_when_approved"
        status: pass
      - kind: unit
        ref: "backend/tests/test_import_from_diagnosis_gate.py#test_import_allows_sales_report_with_null_status"
        status: pass
    human_judgment: false

# Metrics
duration: 2h (Task 1 checkpoint aguardou decisão humana entre sessões do executor)
completed: 2026-09-23
status: complete
---

# Phase 04 Plan 01: Discovery Report Status Grant + Approval Gate Summary

**Relatório discovery nasce como "Rascunho", uma rota PATCH transiciona seu status, e o Precificador só extrai funcionalidades quando o status é "Aprovado para build" — sales (status=None) segue intocado.**

## Performance

- **Duration:** ~2h (inclui pausa no checkpoint de decisão D-36, entre sessões do executor)
- **Completed:** 2026-09-23T11:31:07Z
- **Tasks:** 3 (Task 1 checkpoint:decision aprovado, Task 2 migration+repo, Task 3 tracer)
- **Files modified:** 6 (4 código + 1 migration + 1 teste novo)

## Accomplishments

- Migration aditiva `supabase/migrations/20260923000000_add_status_to_reports.sql` criada e APLICADA no Supabase (coluna `reports.status text`, nullable, sem default) — confirmada via `information_schema.columns` pelo usuário.
- `pricing_repository.py::get_session_report`/`get_project_reports` agora selecionam `status` (Pitfall 5 — sem isso o gate passaria sempre em silêncio).
- `pipeline.py::_run_report_generator` grava `status='Rascunho'` apenas quando `mode == "discovery"` — sales nunca grava a coluna.
- Nova rota `PATCH /sessions/{session_id}/report` com `ReportStatusUpdate(Literal["Rascunho","Em revisão","Aprovado para build"])` (D-38).
- `LLMPricingService.import_from_diagnosis` gateia por `report.status`: 422 se não for `None` nem `"Aprovado para build"`; extração (`with_structured_output`/`bulk_insert_features`/`update_pricing`) inalterada (D-31).
- `backend/tests/test_import_from_diagnosis_gate.py` (novo) — 3 testes com stubs (`FakeRepo`/`FakeLLM`), sem Supabase real, provando os 3 caminhos: bloqueado, aprovado, sales.

## Task Commits

Each task was committed atomically:

1. **Task 1 (checkpoint:decision, D-36)** — aprovado pelo usuário via orchestrator (sem commit de código; decisão registrada em sessão anterior).
2. **Task 2: migration + repo SELECT** - `d7cc510` (feat) — migration criada e aplicada; `pricing_repository.py` lê `status` nos dois métodos.
3. **Task 3 (TRACER): grant + rota PATCH + gate + teste** - `772194f` (feat) — as 4 mudanças descritas acima, num único commit atômico (fatia fina, ponta a ponta).

**Plan metadata:** (este commit, feito a seguir)

## Files Created/Modified

- `supabase/migrations/20260923000000_add_status_to_reports.sql` - migration aditiva/nullable/sem-default (D-36)
- `backend/app/repositories/pricing_repository.py` - `status` acrescentado ao `.select(...)` de `get_session_report`/`get_project_reports`
- `backend/app/services/pipeline.py` - grant `status='Rascunho'` no INSERT de `_run_report_generator`, gated por `mode`
- `backend/app/routers/sessions.py` - `ReportStatusUpdate` (Pydantic Literal) + rota `PATCH /{session_id}/report`
- `backend/app/services/llm_pricing_service.py` - gate 422 em `import_from_diagnosis` logo após `get_session_report`
- `backend/tests/test_import_from_diagnosis_gate.py` - 3 testes de integração (stubs) do gate REP-02/REP-03

## Decisions Made

- D-36 (checkpoint, aprovado): coluna one-way aditiva/nullable/sem-default no Supabase, seguindo o padrão de `projects.mode`/`questions.lens`.
- D-37: gate de negócio vive no service (`llm_pricing_service.py`), nunca no router/frontend — CLAUDE.md ("router não toca regra de negócio").
- D-38: rota PATCH de status é escrita simples de campo — aceitável no router (mesmo nível de simplicidade dos GET/POST de report já existentes), diferente do gate real que é lógica de negócio.

## Deviations from Plan

None - plan executado exatamente como escrito. As 3 verificações automáticas do Task 3 (pytest, STATUS_GRANT_OK, PATCH_MODEL_OK) passaram sem necessidade de ajuste além do que o plano já especificava.

Nota sobre o teste-semente: o plano sugeria IDs como `"pricing-1"`/`"session-1"` nos exemplos do RESEARCH/PATTERNS, mas `PricingFeatureResponse` exige `UUID` real em `id`/`pricing_id` — o `FakeRepo.bulk_insert_features` foi implementado retornando UUIDs válidos (`uuid4()`) e `citi_responsible`/`created_at` (campos obrigatórios do schema de resposta) para que a chamada real do service (`PricingFeatureResponse(**r)`) não falhasse na validação Pydantic. Isso é fidelidade ao contrato real do service, não uma mudança de escopo.

## Issues Encountered

Nenhum bloqueio. `python -m pytest tests/ -q` (regressão completa) mostra 1 falha pré-existente e não relacionada: `tests/test_schema.py::test_tables_exist` (`APIError: Could not find the table 'public.information_schema.tables'`) — depende de uma conexão real ao Supabase de produção/schema cache e falha da mesma forma com `git stash` aplicado (confirmado antes desta mudança, no HEAD anterior a este plano). Fora do escopo do Task 3 (scope boundary) — documentado aqui, não corrigido.

## User Setup Required

None - nenhuma configuração de serviço externo necessária além da migration já aplicada pelo usuário na Task 2.

## Next Phase Readiness

- A espinha do handoff discovery→pricing está provada ponta a ponta: relatório nasce Rascunho → PATCH aprova → import gateado libera. Sales permanece byte-idêntico (status sempre NULL).
- Plano 04-02 (corpo rico do PRD, esqueleto de 16 seções) pode assumir que `reports.status` existe e está sendo gravado/lido corretamente — nenhuma migração adicional necessária para esse propósito.
- REP-02/REP-03 ainda não marcados `Complete` em REQUIREMENTS.md — bloqueados pelo shared-ID gate (#2388) até que os planos irmãos 04-02/03/04, que também declaram esses IDs, produzam seus SUMMARY.md.
- Fase 5 (D-35) é quem constrói o botão "Gerar PRD" / UI de revisão e aprovação humana que vai consumir a rota PATCH criada aqui.

---
*Phase: 04-discovery-report-pricing-handoff*
*Completed: 2026-09-23*

## Self-Check: PASSED

- FOUND: supabase/migrations/20260923000000_add_status_to_reports.sql
- FOUND: backend/tests/test_import_from_diagnosis_gate.py
- FOUND: commit d7cc510 (Task 2)
- FOUND: commit 772194f (Task 3)
