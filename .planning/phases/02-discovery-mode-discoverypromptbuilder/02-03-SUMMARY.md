---
phase: 02-discovery-mode-discoverypromptbuilder
plan: 03
subsystem: backend
tags: [python, fastapi, pydantic, supabase, migration]

# Dependency graph
requires:
  - phase: 02-discovery-mode-discoverypromptbuilder
    provides: "Plano 02-01/02-02: DiscoveryPromptBuilder, SessionState.mode, gate do bloco comercial em generate_report por mode"
provides:
  - "Migration aditiva idempotente supabase/migrations/20260921000000_add_mode_to_projects.sql (ADD COLUMN IF NOT EXISTS mode text DEFAULT 'sales', sem CHECK) — ESCRITA mas AINDA NÃO APLICADA ao Supabase (Task 3 pendente)"
  - "ProjectMode = Literal['sales', 'discovery'] em backend/app/models/projects.py"
  - "mode em ProjectCreate (default 'sales'), ProjectUpdate (Optional, default None), ProjectResponse (sempre presente pós-migration)"
  - "Teste test_project_mode_default_and_validation cobrindo default/aceitação/rejeição do enum mode"
  - "Toggle sales|discovery em ProjectFormPage.tsx + tipo mode em Project/ProjectCreate (frontend/src/lib/api.ts) — Task 4 concluída e build (tsc+vite) verde"
affects: [02-03-project-mode-column-and-ui]

# Actuals — Task 1 (decisão), Task 2 (migration+schemas+teste) e Task 4 (toggle frontend) executadas.
# Task 3 (aplicar migration ao Supabase, blocking-human) permanece pendente.
actuals:
  tokens: 882
  tasks: 3
  commits: 2
plan_head_before: "2d1c6f7418c609b9efb5881d7ea57fc2561a6516"

tech-stack:
  added: []
  patterns:
    - "Coluna enum-like sem CHECK/enum nativo Postgres — validação 100% no Pydantic Literal (mesmo padrão de project_type/source/status), seguindo add_tunnel_url.sql como analog exato"

key-files:
  created:
    - supabase/migrations/20260921000000_add_mode_to_projects.sql
  modified:
    - backend/app/models/projects.py
    - backend/tests/test_projects.py
    - frontend/src/lib/api.ts
    - frontend/src/pages/ProjectFormPage.tsx

key-decisions:
  - "Task 1 (checkpoint:decision, blocking-human, one-way): aprovado pelo time — coluna projects.mode criada como text DEFAULT 'sales' SEM CHECK/enum nativo, seguindo o padrão já usado por project_type/source/status no repo. Validação de enum fica só no Pydantic Literal."
  - "ProjectResponse.mode não tem default Python (sempre presente pós-migration, pois a coluna tem DEFAULT no banco) — segue o padrão de campos ProjectResponse existentes como source."
  - "Nenhum ProjectRepository foi criado (Pitfall 5) — o router já persiste via payload.model_dump(mode='json'), mode flui automaticamente sem camada nova."

requirements-completed: [DISC-01]  # fechado ponta a ponta: coluna projects.mode aplicada e confirmada no Supabase (Task 3), schemas Pydantic (Task 2) e toggle no frontend (Task 4)

coverage:
  - id: D1
    description: "Migration aditiva idempotente aplicada e confirmada no Supabase (ADD COLUMN IF NOT EXISTS mode text DEFAULT 'sales', sem CHECK)"
    verification:
      - kind: other
        ref: "test -f supabase/migrations/20260921000000_add_mode_to_projects.sql && grep -q \"ADD COLUMN IF NOT EXISTS mode text DEFAULT 'sales'\" ..."
        status: pass
      - kind: other
        ref: "SQL Editor: SELECT column_name, column_default ... WHERE column_name='mode' -> 1 linha, default 'sales'::text (confirmado pelo humano em 2026-09-21)"
        status: pass
    human_judgment: true
    rationale: "Confirmado no Supabase vivo pelo humano (Task 3): a coluna projects.mode existe com default 'sales'::text; o ALTER idempotente re-executado retornou no-op"
  - id: D2
    description: "ProjectMode + campo mode em ProjectCreate/Update/Response com validação de enum na borda (Pydantic Literal)"
    requirement: "DISC-01"
    verification:
      - kind: unit
        ref: "backend/tests/test_projects.py#test_project_mode_default_and_validation"
        status: pass
      - kind: other
        ref: "python -c \"ProjectCreate(...).mode == 'sales'; ProjectCreate(..., mode='foo') -> ValidationError\""
        status: pass
    human_judgment: false
  - id: D3
    description: "Toggle sales|discovery no formulário de projeto (Task 4) + tipo mode em Project/ProjectCreate (api.ts); grava/edita mode com carga defensiva no useEffect"
    requirement: "DISC-01"
    verification:
      - kind: other
        ref: "cd frontend && npm run build (tsc + vite)"
        status: pass
      - kind: other
        ref: "grep name=\"mode\" src/pages/ProjectFormPage.tsx && grep \"mode: 'sales' | 'discovery'\" src/lib/api.ts -> TOGGLE_OK"
        status: pass
    human_judgment: false

# Metrics
duration: 12min
completed: 2026-09-21
status: complete  # Tasks 1,2,4 (código) + Task 3 (migration aplicada e confirmada no Supabase) — DISC-01 fechado
---

# Phase 2 Plan 3: Configurar/persistir mode (parcial — pausado no checkpoint da Task 3) Summary

**Migration aditiva idempotente `projects.mode` escrita e `ProjectMode` propagado para os três schemas Pydantic (Create/Update/Response) com teste de validação verde — falta aplicar a migration ao Supabase vivo (Task 3, checkpoint blocking-human) e o toggle no frontend (Task 4).**

## Performance

- **Duration:** 12 min
- **Started:** 2026-09-20T (ver Task Commits abaixo)
- **Completed (parcial):** 2026-09-20
- **Tasks:** 2 de 4 (Task 1 decidida, Task 2 executada; Task 3 aguardando humano; Task 4 não iniciada)
- **Files modified:** 3

## Accomplishments
- Task 1 (checkpoint:decision, one-way): decisão registrada — coluna `projects.mode` como `text DEFAULT 'sales'` sem CHECK/enum nativo (opção `text-default`, recomendada pelo plano, aprovada pelo time)
- Migration `supabase/migrations/20260921000000_add_mode_to_projects.sql` criada — `ALTER TABLE projects ADD COLUMN IF NOT EXISTS mode text DEFAULT 'sales'` + `COMMENT ON COLUMN` explicando sales vs discovery
- `ProjectMode = Literal["sales", "discovery"]` adicionado em `backend/app/models/projects.py`, junto de `mode` em `ProjectCreate` (default `"sales"`), `ProjectUpdate` (`Optional`, default `None`) e `ProjectResponse` (sempre presente pós-migration)
- Teste `test_project_mode_default_and_validation` adicionado em `backend/tests/test_projects.py` — default `sales`, `discovery` aceito, valor inválido rejeitado com `ValidationError`

## Task Commits

Cada task executada foi commitada atomicamente:

1. **Task 1: checkpoint de decisão (one-way) — sem commit de código** — decisão registrada (aprovação humana), nenhuma alteração de arquivo nesta task
2. **Task 2: migration + schemas Pydantic + teste de validação** - `6b6f55a` (feat)
3. **Task 4: toggle sales|discovery no frontend + tipo mode em api.ts** - `dacc146` (feat) — build `tsc + vite` verde

**Plano quase fechado — falta apenas a Task 3 (aplicar a migration ao Supabase, checkpoint blocking-human).** DISC-01 fecha ponta a ponta assim que a coluna existir no banco vivo.

_Nota: Task 3 (checkpoint:human-action, blocking-human) permanece pendente — ver "Next Phase Readiness"._

## Files Created/Modified
- `supabase/migrations/20260921000000_add_mode_to_projects.sql` - Migration aditiva idempotente da coluna `mode` (criada, ainda não aplicada ao Supabase vivo)
- `backend/app/models/projects.py` - `ProjectMode` + campo `mode` em `ProjectCreate`/`ProjectUpdate`/`ProjectResponse`
- `backend/tests/test_projects.py` - Teste `test_project_mode_default_and_validation`

## Decisions Made
- **Task 1 (checkpoint:decision, gate="blocking-human", aprovado pelo usuário antes desta execução):** criar a coluna one-way `projects.mode` como `text DEFAULT 'sales'` sem CHECK/enum nativo — consistente com `project_type`/`source`/`status`, validação de enum 100% no Pydantic `Literal`. Registrado sem reabrir a pergunta.
- `ProjectResponse.mode` não recebeu default Python (sempre presente pós-migration, já que a coluna tem `DEFAULT 'sales'` no banco) — segue o padrão de `source: str` (campo obrigatório sem default) já existente em `ProjectResponse`.
- Nenhum `ProjectRepository` foi criado (Pitfall 5 do RESEARCH.md) — persistência continua via `payload.model_dump(mode="json", ...)` direto no router.

## Deviations from Plan

None - plan executed exactly as written (a única "pausa" é a Task 3, que é um checkpoint `blocking-human` planejado desde o início — não é um desvio).

## Issues Encountered
None - as verificações automáticas da Task 2 (pytest + checagem inline do Pydantic + presença/sintaxe da migration) passaram de primeira. A suíte completa do backend (`python -m pytest`) ficou verde, com exceção da falha pré-existente e fora de escopo `tests/test_schema.py::test_tables_exist` (requer conexão viva com Supabase — documentada como pré-existente nas instruções desta execução).

## User Setup Required

**Concluído — a Task 3 (setup manual/humano) foi executada em 2026-09-21:** a migration foi aplicada via Supabase Dashboard → SQL Editor e confirmada (`projects.mode` existe com default `'sales'::text`). Nenhum setup pendente.

## Next Phase Readiness

**Plano 02-03 CONCLUÍDO — todas as 4 tasks fechadas. Fase 02 pronta para verificação/avanço.**

1. **Task 3 (checkpoint:human-action, `gate="blocking-human"`) — CONCLUÍDA (2026-09-21)** — a migration `20260921000000_add_mode_to_projects.sql` foi aplicada ao Supabase de produção (via SQL Editor). Verificação confirmada pelo humano: `SELECT column_name, column_default ... WHERE column_name='mode'` retornou 1 linha com default `'sales'::text`; o `ALTER ... IF NOT EXISTS` re-executado retornou no-op idempotente.
2. **Task 4 (auto) — CONCLUÍDA (`dacc146`)** — toggle sales/discovery em `ProjectFormPage.tsx` + tipo `mode` em `frontend/src/lib/api.ts` (`Project`/`ProjectCreate`). Build `tsc + vite` verde; greps de sanidade `TOGGLE_OK`.

**DISC-01 fechado ponta a ponta** (DB → API → UI). Próximo: teste manual em `/gsd-verify-work 02` e avanço para a Fase 03.

---
*Phase: 02-discovery-mode-discoverypromptbuilder*
*Completed (parcial): 2026-09-20 — pausado no checkpoint da Task 3*

## Self-Check: PASSED

- Arquivos criados/modificados encontrados em disco: migration, `models/projects.py`, `test_projects.py`, este SUMMARY.md
- Commits encontrados no histórico: `6b6f55a` (Task 2), `5aaab54` (SUMMARY parcial)
