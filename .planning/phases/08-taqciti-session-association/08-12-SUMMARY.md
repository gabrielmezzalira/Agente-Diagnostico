---
phase: 08-taqciti-session-association
plan: 12
subsystem: backend-extension-routes + taqciti-http-ports
status: complete
tags: [backend, fastapi, pydantic, taqciti, chrome-extension, zod, vitest, decision-b1, decision-b2]

requires:
  - phase: 08-taqciti-session-association
    provides: "08-07: rotas GET /clients e POST /sessions + gate verify_extension_key (B1); 08-08: chave Gemini opcional (B2); 08-10: raiz de composição agenteAssociation.ts com portas injetáveis"
provides:
  - "POST /webhook/extension/clients {name}: cria cliente só com o nome (client = name, mode discovery, source extension, sem chave Gemini), 201 {id, client, name}; 409 duplicado sem acento/caixa; 422 nome vazio ou maior que 120"
  - "agenteRoutes.ts: AGENTE_CLIENTS_PATH, AGENTE_SESSIONS_PATH e buildAgenteJsonRequest (só monta request para URL válida, x-agente-key só com chave)"
  - "createHttpClientDirectory e createHttpSessionGateway: portas de produção com zod, timeout e corte do nome da sessão em 200 caracteres"
  - "Raiz de composição de produção usa as portas HTTP: escolher cliente cria a sessão nova e a fala vai para ela (critério 1); rotas fora do ar caem no plano B (critério 3)"
affects: [08-13, 08-14, 08-17, 08-18, 08-21, 08-22]

actuals:
  tokens: 9291
  tasks: 3
  commits: 3

plan_head_before: 81fd9c8cc7e22ee9112379b91c04d26205b594f8
plan_head_after: c604c55c01747e9c1f2c6e42389b307631896048

tech-stack:
  added: []
  patterns:
    - "Rota de escrita da extensão em camadas: router (só roteia) -> ExtensionSessionService.create_client (regra, duplicidade por NFKD sem marcas + casefold) -> ExtensionRepository (db.table)"
    - "Portas HTTP da Taqciti compartilham um único helper (requestAgenteJson): config relida por chamada, request só para URL válida, AbortSignal.timeout, corpo nunca logado; cada porta valida a resposta com zod e traduz o status"

key-files:
  created:
    - taqciti/src/shared/config/agenteRoutes.ts
    - taqciti/src/background/httpAgenteJson.ts
    - taqciti/src/background/httpClientDirectory.ts
    - taqciti/src/background/httpSessionGateway.ts
    - taqciti/src/background/httpAgentePorts.test.ts
    - taqciti/src/background/agenteAssociationHttp.test.ts
  modified:
    - backend/app/models/extension.py
    - backend/app/repositories/extension_repository.py
    - backend/app/services/extension_session_service.py
    - backend/app/routers/extension_clients.py
    - backend/tests/test_extension_clients.py
    - taqciti/src/background/agenteAssociation.ts
    - taqciti/src/background/agenteBindFlow.test.ts

key-decisions:
  - "Mode do cliente criado = discovery e source = extension, fixados em EXTENSION_CLIENT_MODE no service, citando B1/B4-a (2026-10-12)"
  - "Duplicidade comparada com unicodedata NFKD sem marcas + casefold, sem índice único no banco (como decidido na B1)"
  - "O corte do nome da sessão em AGENTE_SESSION_NAME_MAX = 200 mora na porta HTTP; o fluxo do 08-10 continua passando o título inteiro"
  - "Rota de criar cliente como def síncrono (mesmo motivo do 08-07: supabase-py bloqueante, FastAPI roda em threadpool)"

requirements-completed: [TAQ-02]

coverage:
  - id: D1
    description: "POST /webhook/extension/clients cria o projeto só com name/client/mode/source, devolve {id, client, name}, 409 para nome repetido ignorando acento e caixa, 422 para vazio ou acima de 120, atrás do mesmo gate x-agente-key"
    requirement: TAQ-02
    verification:
      - kind: unit
        ref: "backend/tests/test_extension_clients.py#test_create_client_inserts_only_decided_columns"
        status: pass
      - kind: unit
        ref: "backend/tests/test_extension_clients.py#test_create_client_duplicate_ignoring_accent_and_case_is_409"
        status: pass
      - kind: unit
        ref: "backend/tests/test_extension_clients.py#test_client_create_rejects_empty_and_too_long_name"
        status: pass
      - kind: unit
        ref: "backend/tests/test_extension_clients.py#test_clients_post_route_is_201_response_model_and_gated"
        status: pass
    human_judgment: false
  - id: D2
    description: "A Taqciti pede ao Agente lista, cliente novo e sessão nova só para URL válida, com x-agente-key apenas quando há chave, timeout em todo fetch, resposta validada por zod e qualquer desvio tratado como indisponível/erro"
    requirement: TAQ-02
    verification:
      - kind: unit
        ref: "taqciti/src/background/httpAgentePorts.test.ts"
        status: pass
    human_judgment: false
  - id: D3
    description: "Nome da sessão enviado respeita o contrato: título de 300 caracteres vai com os 200 primeiros e título vazio omite o campo name (nunca 422 por título longo)"
    requirement: TAQ-02
    verification:
      - kind: unit
        ref: "taqciti/src/background/httpAgentePorts.test.ts#createHttpSessionGateway.createSession"
        status: pass
    human_judgment: false
  - id: D4
    description: "Taqciti montada como em produção: escolher um cliente cria UMA sessão nova e as falas vão para ela; 404 na lista cai em indisponível (plano B)"
    requirement: TAQ-02
    verification:
      - kind: integration
        ref: "taqciti/src/background/agenteAssociationHttp.test.ts"
        status: pass
    human_judgment: false
  - id: D5
    description: "Ponta a ponta com o backend local e a extensão carregada: seletor lista clientes reais, cria cliente (aparece no web app com mode discovery), vincula e a transcrição chega na sessão nova"
    requirement: TAQ-02
    verification: []
    human_judgment: true
    rationale: "Human-check consolidado no teste manual D-20 do fim da fase; este plano prova o contrato com fetch simulado, sem backend nem Chrome reais."

duration: ~20min
completed: 2026-10-12
---

# Phase 8 Plan 12: Rota de criar cliente e portas HTTP da Taqciti Summary

**Fecha o caminho real "lista de clientes -> criar cliente -> criar sessão": o backend ganha POST `/webhook/extension/clients` (só o nome, mode `discovery`, 409 sem acento/caixa) e a Taqciti passa a falar com as rotas `/webhook/extension/*` por portas HTTP validadas com zod, com timeout e o gate `x-agente-key` opcional. Sem as rotas no ar, a lista cai em "indisponível" e o plano B aparece.**

## Aviso obrigatório (decisão B2 = `aprovar-sem-env`)

> **TEM QUE CRIAR `GEMINI_API_KEY` NO RAILWAY** antes de qualquer deploy, merge na `master`, merge na `main` ou junção com o AGM.
> Os clientes criados por esta rota nascem sem chave Gemini própria; sem a variável no servidor, o pipeline de IA e a importação de PDF dessas sessões não rodam (ver `08-DECISOES-PENDENTES.md`).

Risco T-08-10 (rotas de escrita abertas enquanto `EXTENSION_SHARED_KEY` não estiver ativa): aceito pelo Time Antonio até o login do AGM (registrado no 08-07). Esta rota nova de escrita herda o mesmo aceite.

## Performance

- **Duração:** ~20 min
- **Tasks:** 3 de 3 (um commit por task)
- **Arquivos:** 6 criados, 7 alterados; `backend/requirements.txt`, `package.json` e `package-lock.json` sem diff

## Accomplishments

- **Task 1 (backend):** `ExtensionClientCreate` (`name` 1 a 120, `strip` antes da checagem), `ExtensionRepository.list_client_names` e `insert_project`, `ExtensionSessionService.create_client` (função `_fold` com NFKD sem marcas + `casefold`, 409 "Client already exists", linha inserida só com `name`, `client`, `mode`, `source`) e rota `POST /clients` com `status_code=201`, `ExtensionClientResponse` e `Depends(verify_extension_key)`. Zero chamadas a Vault, CITi Flow ou `ProjectCreate`.
- **Task 2 (Taqciti):** `agenteRoutes.ts` (caminhos e `buildAgenteJsonRequest`, `null` para URL que não é https nem loopback), `httpClientDirectory.ts` (lista, cria, 409 vira `DuplicateClientError`), `httpSessionGateway.ts` (nome cortado em 200, omitido quando vazio, id precisa ser UUID) e o helper `httpAgenteJson.ts` com o timeout e a leitura segura do JSON.
- **Task 3 (comportamento):** `agenteAssociation.ts` troca as portas "indisponível" pelas HTTP (mesmo leitor de config). Teste de ponta a ponta sem trocar as portas: lista com `x-agente-key`, bind por cliente cria UMA sessão (`project_id` = cliente, `name` = título da reunião) e as falas vão para o id novo, e 404 em `GET /clients` vira `{ ok: false, error: 'unavailable' }`.

## Task Commits

1. **Task 1:** `9864d25` feat(08-12): POST /webhook/extension/clients cria cliente só com o nome
2. **Task 2:** `a84107e` feat(08-12): portas HTTP da Taqciti para clientes e sessão do Agente
3. **Task 3:** `c604c55` feat(08-12): produção usa as portas HTTP de clientes e sessão

## Evidência TDD (RED -> GREEN)

- **Task 1 — RED:** `ImportError: cannot import name 'ExtensionClientCreate'` (coleta falhou), RED por import, não semântico. **GREEN:** `pytest tests/test_extension_clients.py` = 21 passed.
- **Task 2 — RED:** arquivo de teste falhou na coleta (módulos inexistentes), RED por import. **GREEN:** `httpAgentePorts.test.ts` = 21 passed.
- **Task 3 — RED semântico:** 2 dos 3 casos falharam com `{ ok: false, error: 'create-session' }` e lista indisponível (as portas ainda eram "indisponível"). **GREEN:** 3/3 e os 35 casos do 08-10 no mesmo comando (38 passed).
- Cada task tem um commit só (teste + código), como o plano manda.

## Verification

- `cd backend && python -m pytest tests/test_extension_clients.py -x -q`: **21 passed**.
- `awk` de `vault|citiflow|db.table` (fora de comentários) no service e no router: **0**.
- `cd taqciti && npx vitest run src/background/httpAgentePorts.test.ts`: **21 passed**.
- `cd taqciti && npx vitest run src/background/agenteAssociationHttp.test.ts src/background/agenteBindFlow.test.ts src/background/agenteAssociationService.test.ts`: **3 arquivos, 38 passed**.
- Portão do plano: `cd taqciti && npm test` = **64 arquivos, 895 testes passed**; `npm run typecheck` e `npm run lint` sem erros.
- Todos os arquivos novos de produção abaixo de 200 linhas (47, 57, 40, 47; `agenteAssociation.ts` com 66).
- Suíte inteira do backend: `tests/test_schema.py::test_tables_exist` falha por precisar do Supabase real (fora do escopo, não relacionado a este plano); os 91 demais passaram até a parada.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking de duplicação] Helper `httpAgenteJson.ts` (arquivo não listado no plano)**
- **Found during:** Task 2
- **Issue:** `httpClientDirectory.ts` e `httpSessionGateway.ts` repetiriam o mesmo bloco (relê config, monta request, fetch com timeout, lê JSON); CLAUDE.md pede um arquivo, uma responsabilidade.
- **Fix:** `requestAgenteJson` + `AgenteInvalidUrlError` em um módulo de 47 linhas. Consequência para o critério de aceite: o literal `AbortSignal.timeout` mora nesse helper, usado pelas duas portas, e não nos dois arquivos; o teste "todo fetch recebe um signal" cobre o comportamento.
- **Files modified:** `taqciti/src/background/httpAgenteJson.ts`
- **Commit:** `a84107e`

**2. [Rule 1 - Teste que passaria a bater na rede] `agenteBindFlow.test.ts` (arquivo não listado no plano)**
- **Found during:** Task 3
- **Issue:** o teste "padrão de produção: lista indisponível" esperava `unavailable` por causa das portas falsas; com as portas HTTP ele tentaria `http://localhost:8000` de verdade (e daria `ok: true` com um backend local no ar).
- **Fix:** o teste agora simula `fetch` global com 404 e o `beforeEach` do arquivo chama `vi.unstubAllGlobals()`. Nenhum teste do 08-10 mudou de comportamento.
- **Files modified:** `taqciti/src/background/agenteBindFlow.test.ts`
- **Commit:** `c604c55`

**Total de desvios:** 2 (um de estrutura, um de teste). **Impacto:** nenhum critério de aceite alterado em comportamento.

## Authentication Gates

Nenhum.

## Known Stubs

Nenhum.

## Threat Flags

Nenhum novo. T-08-23 (nome malicioso/duplicado): `min_length=1`, `max_length=120`, `strip`, 409 sem acento/caixa, testes. T-08-24 (chave em trânsito): `buildAgenteJsonRequest` devolve `null` para URL que não é https/loopback e só põe o header com chave, testado. T-08-25 (resposta inesperada): zod nas respostas, desvio vira indisponível/erro, nenhum corpo é logado. T-08-SC: nenhum pacote novo (`package.json`, `package-lock.json` e `requirements.txt` sem diff). A rota nova de escrita aberta sem `EXTENSION_SHARED_KEY` é o T-08-10, já aceito pelo Time Antonio até o login do AGM.

## Issues Encountered

- Aviso do git sobre LF/CRLF nos arquivos novos (config do Windows); sem efeito no conteúdo.
- `.planning/config.json` e `08-DECISOES-PENDENTES.md` ficaram fora de todos os commits, como pedido.
- Pendência de leitura: `create_client` consulta os nomes e depois insere (duas chamadas, sem índice único, decisão B1). Dois pedidos simultâneos com o mesmo nome podem criar duas linhas; janela pequena e aceita na B1.

## Decisões em aberto herdadas

- **B3 (chunk_id e reenvio, plano 08-09):** este plano NÃO depende dela; não foi respondida e não foi tomada nenhuma decisão aqui.
- **B4-b, B5, D-11:** não bloqueiam este plano.
- **Aviso herdado do 08-01:** não distribuir build da Taqciti entre o 08-01 e o 08-14 (ainda não há tela de vínculo montada).
- **Human-check pendente (D-20, fim da fase):** backend local em `:8000` + extensão carregada: o seletor lista clientes reais, cria um cliente (aparece no web app com mode `discovery`), vincula e a transcrição chega na sessão nova.

## Next Phase Readiness

As telas dos planos 08-14, 08-17 e 08-18 já podem emitir `ui/agente/*` e contar com portas reais. Para o deploy: criar `GEMINI_API_KEY` no Railway e rever o T-08-10 até o login do AGM.

## Self-Check: PASSED

- FOUND: backend/app/services/extension_session_service.py (`create_client`, `EXTENSION_CLIENT_MODE`)
- FOUND: taqciti/src/shared/config/agenteRoutes.ts, taqciti/src/background/httpClientDirectory.ts, taqciti/src/background/httpSessionGateway.ts, taqciti/src/background/httpAgenteJson.ts
- FOUND: `createHttpClientDirectory(` e `createHttpSessionGateway(` em taqciti/src/background/agenteAssociation.ts
- FOUND commits: 9864d25, a84107e, c604c55 (`git rev-list --count 81fd9c8..HEAD` = 3)

---
*Phase: 08-taqciti-session-association*
*Completed: 2026-10-12*
