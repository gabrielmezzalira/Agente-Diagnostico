---
schema_version: 1
open_count: 4
waived_count: 0
fixed_count: 0
total_count: 4
last_updated: 2026-09-27T01:11:38.852Z
---

# Broken Windows Ledger

> Cross-phase defect register. With `workflow.windows_enforce` enabled, `/gsd-ship` blocks while `open_count > 0`.
> Waive with `gsd-tools windows waive <id> "<reason>"` (reason required).
> Mark fixed with `gsd-tools windows fixed <id>`.

| id | phase | kind | file | line | description | status | reason | recorded_at | resolved_at |
|----|-------|------|------|------|-------------|--------|--------|-------------|-------------|
| 1 | 03 | deviation | backend/app/services/pipeline.py |  | Commit da Task 2 do plano 03-01 rotulado por engano como feat(03-02) em vez de feat(03-01) na mensagem — conteudo correto, so o prefixo da mensagem esta errado (hash 560203a) | open |  | 2026-09-22T11:03:45.722Z |  |
| 2 | 07 | unrun-verify | backend/tests/test_schema.py |  | test_tables_exist falha (PGRST205, pre-existente, 0 diff em backend/ nesta fase) - documentado em 07-03 deferred-items.md | open |  | 2026-09-26T11:46:54.569Z |  |
| 3 | 07 | lint-warning | taqciti/src/document/baixarDocumento.ts | 26 | eslint-disable-next-line no-control-regex sem uso (nao suprime nada) - pre-existente, fora do escopo do plano 07-03 | open |  | 2026-09-26T11:46:55.358Z |  |
| 4 | 07 | unrun-verify | .planning/phases/07-taqciti-config-background-streamer/07-04-PLAN.md |  | Reteste manual do Teste 1 da UAT (SC1) numa chamada real do Meet - human-check da Task 3 do plano 07-04, deferido para /gsd-verify-work 07 | open |  | 2026-09-27T01:11:38.852Z |  |

````json
[
  {
    "id": 1,
    "kind": "deviation",
    "phase": "03",
    "file": "backend/app/services/pipeline.py",
    "line": null,
    "description": "Commit da Task 2 do plano 03-01 rotulado por engano como feat(03-02) em vez de feat(03-01) na mensagem — conteudo correto, so o prefixo da mensagem esta errado (hash 560203a)",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-09-22T11:03:45.722Z",
    "resolved_at": null,
    "milestone": "v3.0"
  },
  {
    "id": 2,
    "kind": "unrun-verify",
    "phase": "07",
    "file": "backend/tests/test_schema.py",
    "line": null,
    "description": "test_tables_exist falha (PGRST205, pre-existente, 0 diff em backend/ nesta fase) - documentado em 07-03 deferred-items.md",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-09-26T11:46:54.569Z",
    "resolved_at": null,
    "milestone": "v3.0"
  },
  {
    "id": 3,
    "kind": "lint-warning",
    "phase": "07",
    "file": "taqciti/src/document/baixarDocumento.ts",
    "line": 26,
    "description": "eslint-disable-next-line no-control-regex sem uso (nao suprime nada) - pre-existente, fora do escopo do plano 07-03",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-09-26T11:46:55.358Z",
    "resolved_at": null,
    "milestone": "v3.0"
  },
  {
    "id": 4,
    "kind": "unrun-verify",
    "phase": "07",
    "file": ".planning/phases/07-taqciti-config-background-streamer/07-04-PLAN.md",
    "line": null,
    "description": "Reteste manual do Teste 1 da UAT (SC1) numa chamada real do Meet - human-check da Task 3 do plano 07-04, deferido para /gsd-verify-work 07",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-09-27T01:11:38.852Z",
    "resolved_at": null,
    "milestone": "v3.0"
  }
]
````
