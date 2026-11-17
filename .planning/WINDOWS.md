---
schema_version: 1
open_count: 5
waived_count: 0
fixed_count: 1
total_count: 6
last_updated: 2026-11-17T22:10:06.696Z
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
| 5 | 10 | unrun-verify | CLAUDE.md | 843 | Aprovacao humana do texto do D-07 (item novo da secao 10, commit b64d8b6) PENDENTE - em 2026-11-17 o usuario pediu para revisar o texto junto antes de responder (plano 10-12, Task 2). Antes do merge da Fase 10 na main: ler git show b64d8b6 -- CLAUDE.md e responder d07-ok (manter) ou d07-reverter (git revert b64d8b6) | fixed |  | 2026-10-30T14:49:14.656Z | 2026-11-17T22:10:06.696Z |
| 6 | 10 | unrun-verify | .planning/phases/10-agp-question-panel-in-taqciti/10-UAT.md |  | UAT da Fase 10 rodou em 2026-10-31 com IA real: 10 pass, teste 7 issue (G-10-7, corrigido no codigo pelos planos 10-13/14/15/17) e teste 8 blocked (bloqueio do DevTools nao pegou o envio). Falta: reteste do 10-16 (Task 2) e refazer o teste 8 com quem conheca o DevTools. Usuario deixou os testes manuais para o fim da implementacao (2026-11-17) | open |  | 2026-10-30T14:53:07.980Z |  |

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
  },
  {
    "id": 5,
    "kind": "unrun-verify",
    "phase": "10",
    "file": "CLAUDE.md",
    "line": 843,
    "description": "Aprovacao humana do texto do D-07 (item novo da secao 10, commit b64d8b6) PENDENTE - em 2026-11-17 o usuario pediu para revisar o texto junto antes de responder (plano 10-12, Task 2). Antes do merge da Fase 10 na main: ler git show b64d8b6 -- CLAUDE.md e responder d07-ok (manter) ou d07-reverter (git revert b64d8b6)",
    "status": "fixed",
    "reason": "",
    "recorded_at": "2026-10-30T14:49:14.656Z",
    "resolved_at": "2026-11-17T22:10:06.696Z",
    "milestone": "v3.0"
  },
  {
    "id": 6,
    "kind": "unrun-verify",
    "phase": "10",
    "file": ".planning/phases/10-agp-question-panel-in-taqciti/10-UAT.md",
    "line": null,
    "description": "UAT da Fase 10 rodou em 2026-10-31 com IA real: 10 pass, teste 7 issue (G-10-7, corrigido no codigo pelos planos 10-13/14/15/17) e teste 8 blocked (bloqueio do DevTools nao pegou o envio). Falta: reteste do 10-16 (Task 2) e refazer o teste 8 com quem conheca o DevTools. Usuario deixou os testes manuais para o fim da implementacao (2026-11-17)",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-10-30T14:53:07.980Z",
    "resolved_at": null,
    "milestone": "v3.0"
  }
]
````
