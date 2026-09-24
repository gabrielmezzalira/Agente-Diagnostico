---
phase: 05-two-lens-monitoring-frontend
plan: 03
subsystem: backend+api-client
tags: [fastapi, pydantic, typescript, readiness, discovery-report]

# Dependency graph
requires:
  - phase: 04-discovery-report-pricing-handoff
    provides: "SessionState.readiness_score() puro (D-33/D-34) e coluna reports.status (D-36) + PATCH /sessions/{id}/report (D-38)"
provides:
  - "Rota GET /sessions/{id}/readiness (D-49) — expõe score/signals/ready/low_signals"
  - "ReportResponse.status (Optional[Literal] = None) — status volta a aparecer no JSON sem regredir sales"
  - "Client api.sessions.getReadiness + updateReportStatus + tipo Readiness + Report.status"
affects: [05-04, "página do projeto (botão Gerar PRD)", "seletor de aprovação na sessão encerrada"]

# Actuals (#2632)
actuals:
  tokens: 1837
  tasks: 3
  commits: 3
plan_head_before: e3344a80f9d8f7bc651a4688484b8a5d6af8ec7e

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Optional[Literal[...]] = None em vez de Literal obrigatório quando um valor pode faltar por linha de negócio distinta (sales vs discovery) — evita 422 na serialização"
    - "Rota GET reaproveitando pipeline_manager.get_or_create(allow_finished=True) + 404 — mesmo padrão das rotas de report já existentes"

key-files:
  created:
    - backend/tests/test_readiness_route.py
  modified:
    - backend/app/models/sessions.py
    - backend/app/routers/sessions.py
    - frontend/src/lib/api.ts

key-decisions:
  - "ReportResponse.status como Optional[Literal[...]] = None (decisão de implementação já registrada no plano) — Literal obrigatório quebraria a serialização de relatórios sales, que nunca gravam status"
  - "Rota de readiness sem response_model explícito — retorna o dataclass ReadinessScore direto, mesmo precedente ad-hoc de {\"triggered\": True} já usado no arquivo"

requirements-completed: [REP-02]

coverage:
  - id: D1
    description: "GET /sessions/{id}/readiness retorna score/signals/ready/low_signals (os 4 campos de ReadinessScore) para uma sessão resolvida pelo pipeline_manager"
    requirement: "REP-02"
    verification:
      - kind: unit
        ref: "backend/tests/test_readiness_route.py::test_get_session_readiness_returns_score_for_existing_session"
        status: pass
    human_judgment: false
  - id: D2
    description: "GET /sessions/{id}/readiness responde 404 quando a sessão não existe (pipeline_manager.get_or_create devolve None) — mesmo padrão das rotas de report existentes"
    requirement: "REP-02"
    verification:
      - kind: unit
        ref: "backend/tests/test_readiness_route.py::test_get_session_readiness_404_for_missing_session"
        status: pass
    human_judgment: false
  - id: D3
    description: "A rota usa allow_finished=True — readiness legível também em sessões discovery encerradas"
    requirement: "REP-02"
    verification:
      - kind: unit
        ref: "backend/tests/test_readiness_route.py::test_get_session_readiness_returns_score_for_existing_session (assert allow_finished is True dentro do fake get_or_create)"
        status: pass
    human_judgment: false
  - id: D4
    description: "ReportResponse.status aparece no JSON de resposta (discovery) e continua None sem quebrar a serialização quando ausente (sales)"
    requirement: "REP-02"
    verification:
      - kind: unit
        ref: "python -c: 'status' in ReportResponse.model_fields (REPORT_STATUS_FIELD_OK) + construção sem status -> status is None (SALES_STATUS_NONE_OK)"
        status: pass
    human_judgment: false
  - id: D5
    description: "Client typado (Readiness, Report.status, getReadiness, updateReportStatus) compila sem erros e expõe as assinaturas descritas no plano"
    requirement: "REP-02"
    verification:
      - kind: unit
        ref: "cd frontend && npx tsc -b --noEmit (exit 0) + grep API_CLIENT_OK"
        status: pass
    human_judgment: false

duration: ~20min
completed: 2026-09-24
status: complete
---

# Phase 5 Plan 3: Rota de readiness + client typado (handoff de PRD) Summary

**Única mudança de backend da Fase 5 (aditiva): `GET /sessions/{id}/readiness` expõe o readiness já calculado desde a Fase 4, `ReportResponse.status` volta a aparecer no JSON sem regredir sales, e o client do front (`Readiness`, `getReadiness`, `updateReportStatus`) fica pronto para a 05-04 consumir.**

## Performance

- **Duration:** ~20min
- **Completed:** 2026-09-24
- **Tasks:** 3
- **Files modified:** 4 (1 criado, 3 modificados)

## Accomplishments

- `ReportResponse` (backend) ganhou o campo `status` (`Optional[Literal["Rascunho", "Em revisão", "Aprovado para build"]] = None`) — corrige a filtragem silenciosa do JSON (Impl Note 3): a coluna `reports.status` existe desde a Fase 4 (D-36), mas o `response_model` escondia o campo. `Optional`/`None` garante que relatórios sales (que nunca gravam `status`) continuem serializando sem erro 422.
- Nova rota `GET /sessions/{session_id}/readiness` (D-49) reaproveita `pipeline_manager.get_or_create(str(session_id), allow_finished=True)` + 404 idêntico às rotas de report já existentes, e devolve `pipeline.state.readiness_score()` (função pura, zero I/O, Fase 4). `allow_finished=True` garante que a página do projeto leia o readiness também de sessões discovery já encerradas.
- Teste isolado `backend/tests/test_readiness_route.py` (sem rede, sem Supabase real) cobre o caso 200 (score/signals/ready/low_signals com score em `[0, 1]`, assertando `allow_finished is True`) e o caso 404 (pipeline inexistente).
- `frontend/src/lib/api.ts` ganhou o tipo `Readiness` (espelha `ReadinessScore` verbatim), o campo `Report.status`, e os métodos `api.sessions.getReadiness`/`api.sessions.updateReportStatus` — client pronto para o botão "Gerar PRD" e o seletor de aprovação da 05-04.

## Task Commits

Cada task foi commitada atomicamente:

1. **Task 1 (correção aditiva isolada — Impl Note 3): expor `status` em ReportResponse** - `859db37` (fix)
2. **Task 2 (D-49): rota GET /sessions/{id}/readiness + teste isolado** - `8d2df36` (feat)
3. **Task 3 (D-48/D-49 — Impl Note 5): client api.ts** - `7554c44` (feat)

**Plan metadata:** commit final (docs) — ver `git log` após esta etapa.

## Files Created/Modified

- `backend/app/models/sessions.py` — `ReportResponse.status` (Optional[Literal] = None, aditivo); import de `Literal`.
- `backend/app/routers/sessions.py` — `GET /{session_id}/readiness` (D-49), inserida logo após as rotas de report, antes de `/transcript/upload`.
- `backend/tests/test_readiness_route.py` (novo) — 200 (4 campos + `allow_finished=True`) + 404.
- `frontend/src/lib/api.ts` — `Readiness` (interface nova), `Report.status` (campo novo), `api.sessions.getReadiness` + `api.sessions.updateReportStatus` (métodos novos).

## Decisions Made

- `ReportResponse.status` como `Optional[Literal[...]] = None` — decisão de implementação já registrada no plano (não em aberto): preserva sales byte-idêntico (REP-03), já que relatórios sales nunca gravam `status` e um `Literal` obrigatório causaria `422` na serialização.
- Rota de readiness sem `response_model=` explícito — retorna o dataclass `ReadinessScore` direto (FastAPI serializa), mesmo precedente ad-hoc de `{"triggered": True}` já usado no arquivo para respostas internas sem schema de DB.

## Deviations from Plan

None - plano executado exatamente como escrito. As 3 tasks seguiram o padrão de leitura prévia (read_first) sem necessidade de ajuste de escopo.

## Issues Encountered

None. `python -m pytest -q` (suíte completa do backend) roda 88 passed, 4 skipped, 1 failed — a única falha (`tests/test_schema.py::test_tables_exist`) é pré-existente e depende de conexão real ao Supabase (fora do escopo desta task, não tocada por nenhuma das 3 mudanças). `npm test -- --run` (frontend) roda 4 passed (suíte já existente da 05-01, intacta).

## User Setup Required

None - nenhuma configuração externa necessária; rota aditiva, sem migration.

## Next Phase Readiness

- `api.sessions.getReadiness`/`updateReportStatus` e os tipos `Readiness`/`Report.status` estão prontos para a 05-04 implementar o botão "Gerar PRD" (gated por readiness, D-47) e o seletor de status/aprovação na sessão encerrada (D-48).
- Nenhum bloqueio identificado.

## Self-Check: PASSED

Todos os arquivos declarados (3 modificados + 1 criado + este SUMMARY.md) e os 3 commits (`859db37`, `8d2df36`, `7554c44`) foram confirmados no disco/histórico do git.

---
*Phase: 05-two-lens-monitoring-frontend*
*Completed: 2026-09-24*
