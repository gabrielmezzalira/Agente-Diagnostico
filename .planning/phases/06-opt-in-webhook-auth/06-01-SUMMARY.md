---
phase: 06-opt-in-webhook-auth
plan: 01
subsystem: auth
tags: [fastapi, chrome-extension, shared-secret, header-auth, webhook]

# Dependency graph
requires:
  - phase: 05-two-lens-monitoring-frontend
    provides: extension/background.js e extension/popup.js no estado atual (padrão backendUrl/SET_BACKEND_URL replicado aqui)
provides:
  - "verify_extension_key() em backend/app/routers/webhook.py — gate opt-in por shared-secret, route-scoped em extension_webhook()"
  - "Header x-agente-key comparado com secrets.compare_digest contra EXTENSION_SHARED_KEY (env var, lida a cada chamada)"
  - "Campo opcional 'Chave de autenticação' no popup da extensão Chrome, persistido via chrome.storage.local"
affects: [07-taqciti-integration, 08-taqciti-capture-engine, 09-cutover]

# Actuals (#2632)
actuals:
  tokens: 2562
  tasks: 2
  commits: 2

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Dependência local route-scoped (Depends(verify_extension_key) só no parâmetro da rota, nunca no APIRouter) para não vazar um gate de uma rota para outra no mesmo router"
    - "Leitura fresca de env var opcional dentro do corpo da função (os.environ.get a cada chamada), nunca em nível de módulo — mesmo padrão de sessions.py::_get_recall()"
    - "Header condicional em fetch() da extensão: construir o objeto headers e só adicionar a chave se truthy, nunca string vazia/undefined"

key-files:
  created:
    - backend/tests/test_webhook_auth.py
    - .planning/phases/06-opt-in-webhook-auth/deferred-items.md
  modified:
    - backend/app/routers/webhook.py
    - extension/popup.html
    - extension/popup.js
    - extension/background.js

key-decisions:
  - "D-01 (do plano): Depends(verify_extension_key) conectado exclusivamente em extension_webhook(); recall_webhook() e o APIRouter(...) permanecem intocados — confirmado por 2 greps automatizados no <verify>"
  - "D-02 (do plano): campo da extensão usa input type=password (mascarado) e chrome.storage.local (nunca .sync) — mesmo nível de exposição do campo backendUrl já existente"
  - "D-03 (do plano, fora de escopo): ativação real de EXTENSION_SHARED_KEY em produção (Railway) e distribuição da chave para usuários da extensão fica como DECISÃO EM ABERTO do time — nenhuma task desta fase seta a env var em ambiente real"
  - "401 com detail='Missing or invalid x-agente-key header' — resolvido como Claude's Discretion no CONTEXT.md, seguindo o padrão de mensagens específicas já usado no repo"

patterns-established:
  - "Gate route-scoped por shared-secret opt-in: útil como modelo para futuras rotas que precisem do mesmo comportamento fail-open-até-configurado"

requirements-completed: [TAQ-03]

coverage:
  - id: D1
    description: "POST /webhook/extension aceita tudo sem EXTENSION_SHARED_KEY configurada (SC1) — comportamento idêntico ao atual"
    requirement: "TAQ-03"
    verification:
      - kind: unit
        ref: "backend/tests/test_webhook_auth.py#test_verify_extension_key_noop_when_unset"
        status: pass
    human_judgment: false
  - id: D2
    description: "POST /webhook/extension rejeita com 401 quando a chave está configurada e o header está ausente ou incorreto (SC2)"
    requirement: "TAQ-03"
    verification:
      - kind: unit
        ref: "backend/tests/test_webhook_auth.py#test_verify_extension_key_rejects_missing_header_when_set"
        status: pass
      - kind: unit
        ref: "backend/tests/test_webhook_auth.py#test_verify_extension_key_rejects_wrong_value_when_set"
        status: pass
    human_judgment: false
  - id: D3
    description: "POST /webhook/extension aceita e processa normalmente quando a chave está configurada e o header está correto (SC3)"
    requirement: "TAQ-03"
    verification:
      - kind: unit
        ref: "backend/tests/test_webhook_auth.py#test_verify_extension_key_accepts_correct_value_when_set"
        status: pass
    human_judgment: false
  - id: D4
    description: "POST /webhook/recall permanece sem qualquer gate (D-01) — Depends(verify_extension_key) nunca aparece em recall_webhook() nem no construtor do APIRouter"
    requirement: "TAQ-03"
    verification:
      - kind: unit
        ref: "grep -c 'Depends(verify_extension_key)' backend/app/routers/webhook.py (== 1)"
        status: pass
      - kind: unit
        ref: "awk sobre o corpo de recall_webhook | grep -c verify_extension_key (== 0)"
        status: pass
    human_judgment: false
  - id: D5
    description: "Campo opcional de chave no popup da extensão Chrome; vazio, nenhum header x-agente-key é enviado; preenchido, todo POST /webhook/extension carrega o header com o valor salvo; persistência via chrome.storage.local (nunca .sync)"
    requirement: "TAQ-03"
    verification: []
    human_judgment: true
    rationale: "Sem harness automatizado em extension/ (plain JS sem package.json, confirmado em 06-RESEARCH.md); a verificação real exige carregar a extensão sem pacote no Chrome, inspecionar DevTools Network num POST real e confirmar presença/ausência do header — passo humano documentado em 06-VALIDATION.md e no <human-check> da Task 2."

duration: ~10min
completed: 2026-09-24
status: complete
---

# Phase 06 Plan 01: Opt-In Webhook Auth Summary

**Gate opcional por shared-secret (`x-agente-key` vs `EXTENSION_SHARED_KEY`) em `POST /webhook/extension`, com `secrets.compare_digest`, route-scoped e inerte até a env var ser configurada — mais o campo correspondente no popup da extensão Chrome.**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-09-24T14:04:00Z
- **Completed:** 2026-09-24T14:10:00Z
- **Tasks:** 2
- **Files modified:** 5 (+ 1 arquivo de deviations)

## Accomplishments
- `verify_extension_key()` adicionada a `backend/app/routers/webhook.py`, lendo `EXTENSION_SHARED_KEY` fresco do ambiente a cada chamada e comparando com `secrets.compare_digest` — sem cache em nível de módulo, testável via `monkeypatch`.
- Gate conectado exclusivamente como `Depends()` no parâmetro de `extension_webhook()` — `recall_webhook()` e o `APIRouter(...)` permanecem byte-idênticos ao estado anterior (D-01), confirmado por 2 greps automatizados.
- 4 testes novos em `backend/tests/test_webhook_auth.py` cobrindo as 3 SCs do roadmap (unset → passa; set + header ausente/errado → 401; set + header correto → passa), seguindo o padrão do repo de chamar a função diretamente, sem `TestClient`.
- Popup da extensão Chrome ganhou campo `Chave de autenticação (opcional)` (`input[type=password]`), espelhando o bloco "URL do backend" existente; `background.js` persiste a chave em `chrome.storage.local` (nunca `.sync`) e monta o header `x-agente-key` condicionalmente antes de cada `fetch()` a `/webhook/extension`.

## Task Commits

Cada task foi commitada atomicamente:

1. **Task 1 (TRACER, TDD): gate opt-in por shared-secret em POST /webhook/extension** - `866a90b` (feat)
2. **Task 2: campo opcional de chave na extensão Chrome** - `e3b9571` (feat)

**Plan metadata:** commit final de documentação será registrado após este SUMMARY.

_Nota: Task 1 seguiu o ciclo TDD completo — RED (ImportError confirmado antes da implementação) → GREEN (4 testes passando) — em um único commit, conforme o contrato de escopo de commit do plano (task atômica, não RED/GREEN separados)._

## Files Created/Modified
- `backend/app/routers/webhook.py` - Adiciona `verify_extension_key()` + `Depends()` route-scoped em `extension_webhook()`
- `backend/tests/test_webhook_auth.py` - 4 testes cobrindo as 3 SCs do gate (novo arquivo)
- `extension/popup.html` - Novo campo `input[type=password]#extension-key` + `button#save-key-btn`; CSS estendido para estilizar `input[type=password]`
- `extension/popup.js` - Leitura/exibição do valor salvo em `render()`; listener de salvar envia `SET_EXTENSION_KEY`
- `extension/background.js` - `extensionKey` no state inicial, `loadState()`, handler `SET_EXTENSION_KEY`, header condicional em `TRANSCRIPT_CHUNK`
- `.planning/phases/06-opt-in-webhook-auth/deferred-items.md` - Registra falha pré-existente e fora de escopo em `test_schema.py::test_tables_exist` (novo arquivo)

## Decisions Made
- 401 com `detail="Missing or invalid x-agente-key header"` (Claude's Discretion no CONTEXT.md), seguindo o padrão de mensagens específicas já usado no repo.
- Nomes dos campos novos (`extensionKey`, `SET_EXTENSION_KEY`, label "Chave de autenticação (opcional)") escolhidos por simetria com `backendUrl`/`SET_BACKEND_URL`, conforme recomendação de 06-RESEARCH.md.
- Tipo do input como `password` (já resolvido no contexto de planejamento da fase, não era mais decisão em aberto).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] CSS do popup não estilizava o novo input[type=password]**
- **Found during:** Task 2 (extensão Chrome)
- **Issue:** O CSS existente em `popup.html` só tinha seletores `input[type="text"]` e `input[type="text"]:focus`. Sem extensão do seletor, o novo campo de chave ficaria com a aparência padrão do navegador (fundo branco), quebrando visualmente o tema escuro do popup.
- **Fix:** Estendidos os dois seletores para `input[type="text"], input[type="password"]` e `input[type="text"]:focus, input[type="password"]:focus`.
- **Files modified:** extension/popup.html
- **Verification:** Grep confirmando `type="password"` presente; revisão visual do CSS (mesmo bloco de estilo aplicado a ambos os tipos de input).
- **Committed in:** e3b9571 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 Rule 1 - bug de CSS)
**Impact on plan:** Correção necessária para consistência visual; sem mudança de comportamento funcional. Sem scope creep.

## Issues Encountered
- `pytest tests/ -x -q` (suíte completa do backend) falhou em `tests/test_schema.py::test_tables_exist`, que depende de uma conexão real ao Supabase (`postgrest.exceptions.APIError` ao consultar `information_schema.tables`). Confirmado como pré-existente e fora de escopo via `git stash` isolando a mudança de `webhook.py` — a falha ocorre de forma idêntica sem a mudança desta fase. Documentado em `deferred-items.md`; `pytest tests/ -q --deselect tests/test_schema.py::test_tables_exist` confirma 92 passed / 4 skipped, zero regressão real causada por este plano.

## User Setup Required

None - nenhuma configuração de serviço externo é necessária para esta fase. **Importante:** `EXTENSION_SHARED_KEY` não foi setada em nenhum ambiente real (Railway ou local) — a ativação em produção é D-03, DECISÃO EM ABERTO do time, explicitamente fora deste plano.

## Next Phase Readiness
- `POST /webhook/extension` está pronto para ser gateado a qualquer momento que o time decida configurar `EXTENSION_SHARED_KEY` em produção (D-03) — nenhuma mudança de código adicional necessária, só a variável de ambiente e a distribuição da chave para quem usa a extensão hoje.
- Verificação manual pendente (não bloqueante para esta fase, registrada como UAT): carregar a extensão sem pacote no Chrome, preencher/limpar o campo de chave, e confirmar no DevTools → Network a presença/ausência do header `x-agente-key` em requisições reais a `/webhook/extension` — procedimento documentado em `06-VALIDATION.md` e no `<human-check>` da Task 2.
- Fases 7-8 (integração Taqciti) vivem em repositório separado — este gate opt-in não bloqueia essas fases, mas fica disponível caso a integração precise proteger o mesmo endpoint.

## Self-Check: PASSED

- FOUND: backend/app/routers/webhook.py (verify_extension_key presente)
- FOUND: backend/tests/test_webhook_auth.py (4 testes)
- FOUND: extension/popup.html (input#extension-key)
- FOUND: extension/popup.js (extensionKeyInput/saveKeyBtn)
- FOUND: extension/background.js (SET_EXTENSION_KEY handler)
- FOUND: .planning/phases/06-opt-in-webhook-auth/deferred-items.md
- FOUND commit 866a90b (Task 1)
- FOUND commit e3b9571 (Task 2)

---
*Phase: 06-opt-in-webhook-auth*
*Completed: 2026-09-24*
