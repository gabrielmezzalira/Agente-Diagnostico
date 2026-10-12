---
phase: 08-taqciti-session-association
plan: 07
subsystem: backend-extension-routes
status: complete
tags: [backend, fastapi, pydantic, camadas, gate-x-agente-key, pytest, decision-b1]

requires:
  - phase: 06-opt-in-webhook-auth
    provides: "verify_extension_key (gate opt-in por EXTENSION_SHARED_KEY), reaproveitado e não duplicado"
provides:
  - "GET /webhook/extension/clients -> [{id, client, name}] (dados mínimos, T-08-11)"
  - "POST /webhook/extension/sessions {project_id, name?} -> 201 {id}; 404 para projeto inexistente (T-08-12)"
  - "ExtensionRepository, ExtensionSessionService, schemas de extension.py e extension_clients_router registrado em main.py"
affects: [08-08, 08-10, 08-12, 08-14, 08-21]

actuals:
  tokens: 4200
  tasks: 3
  commits: 3

plan_head_before: e4e0e71db19b2e339ab8564a330c0eb4d09f4e80
plan_head_after: 2b68b603489ad0282a74ea7ec8c1c4e528209b08

tech-stack:
  added: []
  patterns:
    - "Rotas da extensão em camadas: router (só roteia) -> ExtensionSessionService (regra) -> ExtensionRepository (db.table)"
    - "Testes puros: repositório fake no service, service fake nas funções de rota chamadas direto, inspeção do APIRouter para o gate e os caminhos"

key-files:
  created:
    - backend/app/models/extension.py
    - backend/app/repositories/extension_repository.py
    - backend/app/services/extension_session_service.py
    - backend/app/routers/extension_clients.py
    - backend/tests/test_extension_clients.py
  modified:
    - backend/app/routers/__init__.py
    - backend/app/main.py

key-decisions:
  - "B1 = aprovar-recomendado: contrato das rotas novas como proposto (mode discovery no cliente criado, 409 sem índice único, gate opt-in)"
  - "Risco residual T-08-10 aceito pelo Time Antonio até o login do AGM"
  - "Rotas de leitura/escrita declaradas como def síncrono (não async): o supabase-py é bloqueante e o FastAPI roda def em threadpool, sem travar o event loop"

requirements-completed: [TAQ-02]

coverage:
  - id: D1
    description: "GET /webhook/extension/clients devolve só id, client e name, mesmo que o repositório traga contexto e orçamento; client em branco vira o name e name nulo vira vazio"
    requirement: TAQ-02
    verification:
      - kind: unit
        ref: "backend/tests/test_extension_clients.py#test_service_list_clients_returns_only_minimal_fields"
        status: pass
      - kind: unit
        ref: "backend/tests/test_extension_clients.py#test_service_list_clients_fills_blank_client_with_name_and_none_name"
        status: pass
    human_judgment: false
  - id: D2
    description: "POST /webhook/extension/sessions cria sessão active, source extension, nome padrão 'Reunião pela Taqciti', e devolve 404 sem inserir nada quando o projeto não existe"
    requirement: TAQ-02
    verification:
      - kind: unit
        ref: "backend/tests/test_extension_clients.py#test_create_session_builds_extension_row_and_returns_id"
        status: pass
      - kind: unit
        ref: "backend/tests/test_extension_clients.py#test_create_session_unknown_project_is_404_and_inserts_nothing"
        status: pass
    human_judgment: false
  - id: D3
    description: "As duas rotas passam pelo mesmo gate verify_extension_key da Fase 6, sob o prefixo /webhook/extension, sem rota vazia; o router está registrado uma vez em routers/__init__.py e main.py"
    requirement: TAQ-02
    verification:
      - kind: unit
        ref: "backend/tests/test_extension_clients.py#test_clients_route_is_behind_extension_key_gate"
        status: pass
      - kind: unit
        ref: "backend/tests/test_extension_clients.py#test_sessions_route_is_201_response_model_and_gated"
        status: pass
      - kind: unit
        ref: "backend/tests/test_extension_clients.py#test_router_is_registered_once_in_package_and_app"
        status: pass
    human_judgment: false
  - id: D4
    description: "A Taqciti de fato lista os clientes e cria sessão contra o backend rodando (ponta a ponta)"
    requirement: TAQ-02
    verification: []
    human_judgment: true
    rationale: "Fluxo ponta a ponta com a extensão e o backend reais é o teste manual D-20 do fim da fase; este plano só prova as rotas com fakes"
---

# Phase 8 Plan 07: Rotas da extensão (clientes e sessão) Summary

**Duas portas próprias da extensão sob `/webhook/extension` (listar clientes com `{id, client, name}` e abrir uma sessão nova por reunião), em camadas router -> service -> repository, protegidas pelo mesmo gate `x-agente-key` da Fase 6 e sem passar pelo CITi Flow.**

## Performance

- **Duração:** ~10 min (início 2026-10-12T13:55Z aprox., fim 14:06Z)
- **Tarefas:** 3 de 3 (Task 1 era a decisão B1, já respondida pelo time)
- **Arquivos:** 7 (5 novos, 2 de registro alterados)

## Task 1: Decisão B1 (respondida pelo time, registrada literalmente)

- **Opção escolhida:** `aprovar-recomendado` (contrato como proposto: mode `discovery`, 409 sem índice único, gate opt-in `verify_extension_key`).
- **B4-a (mode do cliente criado pela Taqciti):** `discovery` (recomendado; implementado no plano 08-12).
- **Duplicidade de nome:** 409 sem índice único, comparando sem acento e sem diferença de caixa; nome de 1 a 120 caracteres.
- **Gate das rotas de escrita:** opt-in da Fase 6 (o mesmo `verify_extension_key`).
- **Data da decisão:** 2026-10-12.
- O registro foi commitado (`aa82f4c`) antes de qualquer rota, como pede a precondição das Tasks 2 e 3.

## Risco residual T-08-10

- **Risco:** enquanto `EXTENSION_SHARED_KEY` não estiver ativa no Railway, qualquer pessoa com a URL do backend consegue criar clientes e sessões pelas rotas novas; com a decisão B2 (chave Gemini opcional), cada sessão criada roda o pipeline com a chave do SERVIDOR (custo de IA). Severidade alta.
- **Dono do risco:** "Time Antonio" (resposta literal do usuário; entendido como Antonio).
- **Condição de revisão / até quando vale:** "até o login do AGM".
- **Contexto informado pelo usuário:** o deploy ainda NÃO foi feito; os merges vão para a `main` e o deploy sai da `master`, então as rotas ainda não estão expostas em produção.
- **Data do aceite:** 2026-10-12.
- **Conferência no fechamento da fase:** o plano 08-21 confere este registro (ou a env var ativa).

## Lembrete bloqueante (decisão B2 = `aprovar-sem-env`)

> **TEM QUE CRIAR `GEMINI_API_KEY` NO RAILWAY** antes de deploy / merge na `master` / junção com o AGM.
> Sem ela, projetos sem chave própria não rodam o pipeline de IA (ver `08-DECISOES-PENDENTES.md`).

## Accomplishments

- `GET /webhook/extension/clients`: o repositório faz `select("id, client, name")` e o service reconstrói cada item só com esses três campos, então nada de contexto pré-reunião, orçamento ou chave chega à extensão (T-08-11).
- `POST /webhook/extension/sessions`: cria a sessão (`status active`, `source extension`, `meeting_url None`, nome padrão "Reunião pela Taqciti") e devolve 201 `{id}`; projeto inexistente vira 404 "Project not found" sem inserir nada (T-08-12).
- Router só roteia (zero `db.table`), regra no service, banco no repositório. Nenhuma chamada a `/sessions/start` nem ao CITi Flow.
- `extension_clients_router` exportado em `routers/__init__.py` e incluído uma vez em `main.py` logo após o `webhook_router`.
- Nenhum router existente (`projects.py`, `sessions.py`, `webhook.py`) foi alterado (D-17).

## Task Commits

1. **Task 1 (registro da decisão B1 e do T-08-10):** `aa82f4c` docs(08-07)
2. **Task 2:** `8e9ac61` feat(08-07): GET /webhook/extension/clients com listagem mínima em camadas
3. **Task 3:** `2b68b60` feat(08-07): POST /webhook/extension/sessions e registro do router da extensão

O plano é `type: execute`, então cada task teve um commit único (teste + código). O RED da Task 2 falhou por `ImportError` (módulo inexistente) e o da Task 3 falhou em 6 casos nos alvos certos (service sem `create_session`, rota POST ausente, router não registrado) antes de a implementação existir.

## Deviations from Plan

### Ajuste de forma (não de comportamento)

**1. [Ajuste de implementação] Funções de rota síncronas (`def`) em vez de `async def`**
- **Found during:** Task 2
- **Issue:** o plano não fixa async/sync. O supabase-py é bloqueante; uma `async def` com chamada bloqueante travaria o event loop (que também atende o pipeline de IA e os WebSockets).
- **Fix:** rotas como `def`, que o FastAPI roda em threadpool. Os testes chamam as funções direto, sem diferença.
- **Files modified:** `backend/app/routers/extension_clients.py`
- **Commit:** `8e9ac61`, `2b68b60`

**Total de desvios:** 1 (ajuste de forma, sem mudança de contrato). **Impacto:** nenhum além de não bloquear o event loop.

## Issues Encountered

Nenhum. Observação: `get_project_id` + `insert_session` são duas chamadas ao banco (não atômicas); se o projeto for apagado entre as duas, o insert falha por chave estrangeira e vira 500. Janela desprezível e igual à do `POST /sessions` existente.

## Authentication Gates

Nenhum.

## Known Stubs

Nenhum.

## Threat Flags

| Flag | File | Description |
|------|------|-------------|
| threat_flag: write-route-ungated-by-default | backend/app/routers/extension_clients.py | POST /webhook/extension/sessions fica aberta enquanto EXTENSION_SHARED_KEY não existir no ambiente. É o T-08-10, já aceito pelo Time Antonio até o login do AGM (ver "Risco residual T-08-10"). |

T-08-11 (vazamento na listagem) mitigado por schema próprio + select mínimo + teste de chaves. T-08-12 (projeto inexistente) mitigado com 404 explícito + teste. T-08-SC: `backend/requirements.txt` sem diff.

## Verification

- `cd backend && python -m pytest tests/test_extension_clients.py tests/test_webhook_auth.py -x -q`: 15 passed.
- `python -m pytest tests/test_finish_stops_pipeline.py tests/test_extension_chunk_extra_fields.py tests/test_extension_clients.py tests/test_webhook_auth.py -q`: 23 passed.
- `awk` de `db.table|sessions/start|citiflow` no router e no service (fora de comentários): 0.
- `grep -c "include_router(extension_clients_router)" backend/app/main.py`: 1.
- `git show --name-only HEAD -- projects.py sessions.py webhook.py` após cada commit de código: nada impresso.
- `import app.main` carrega sem erro com o router novo.
- Pendente (D-20, fim da fase): a Taqciti listar clientes e criar sessão contra o backend local.

## Next Phase Readiness

Os planos 08-08 (checkpoint B2) e 08-12 (criar cliente, `POST /webhook/extension/clients`, mode `discovery`, 409 por nome sem acento/caixa) podem seguir. Lembrete para o deploy: criar `GEMINI_API_KEY` no Railway e rever o T-08-10 até o login do AGM.

## Self-Check: PASSED

- FOUND: backend/app/models/extension.py
- FOUND: backend/app/repositories/extension_repository.py
- FOUND: backend/app/services/extension_session_service.py
- FOUND: backend/app/routers/extension_clients.py
- FOUND: backend/tests/test_extension_clients.py
- FOUND commits: aa82f4c, 8e9ac61, 2b68b60
