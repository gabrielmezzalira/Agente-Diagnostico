---
schema_version: 1
open_count: 1
waived_count: 0
fixed_count: 0
total_count: 1
last_updated: 2026-09-22T11:03:45.722Z
---

# Broken Windows Ledger

> Cross-phase defect register. With `workflow.windows_enforce` enabled, `/gsd-ship` blocks while `open_count > 0`.
> Waive with `gsd-tools windows waive <id> "<reason>"` (reason required).
> Mark fixed with `gsd-tools windows fixed <id>`.

| id | phase | kind | file | line | description | status | reason | recorded_at | resolved_at |
|----|-------|------|------|------|-------------|--------|--------|-------------|-------------|
| 1 | 03 | deviation | backend/app/services/pipeline.py |  | Commit da Task 2 do plano 03-01 rotulado por engano como feat(03-02) em vez de feat(03-01) na mensagem — conteudo correto, so o prefixo da mensagem esta errado (hash 560203a) | open |  | 2026-09-22T11:03:45.722Z |  |

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
  }
]
````
