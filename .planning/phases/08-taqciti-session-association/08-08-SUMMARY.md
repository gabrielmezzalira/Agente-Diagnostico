---
phase: 08-taqciti-session-association
plan: 08
subsystem: projects-gemini-key-optional
status: complete
tags: [backend, frontend, fastapi, pydantic, vault, gemini, decision-b2, pdf-fallback]

requires:
  - phase: 08-taqciti-session-association
    provides: "08-07: rotas da extensão (cliente criado pela Taqciti nasce sem chave própria)"
provides:
  - "ProjectCreate.gemini_api_key opcional; POST /projects só toca o Vault quando há chave"
  - "Importação de PDF usa GEMINI_API_KEY do servidor quando o projeto não tem chave própria"
  - "Formulário do web app sem chave obrigatória; tela do projeto diz 'Usando a chave do servidor'"
affects: [08-12, 08-15, 08-21]

actuals:
  tokens: 9000
  tasks: 3
  commits: 4

plan_head_before: 8cf60bd906e0297b9cf23bb4c65a31b64cf55e6e
plan_head_after: 7c70c73ff5bfefd7f674b14016dc212fabd3d73b

tech-stack:
  added: []
  patterns:
    - "Segredo opcional: Vault condicional (`if payload.gemini_api_key`), mesmo padrão do pricing_api_key"
    - "Fallback de chave em duas camadas: chave do projeto (Vault) e, na ausência, env do servidor"

key-files:
  created: []
  modified:
    - backend/app/models/projects.py
    - backend/app/routers/projects.py
    - backend/tests/test_projects.py
    - backend/app/routers/sessions.py
    - backend/tests/test_upload_pdf_mode.py
    - frontend/src/pages/ProjectFormPage.tsx
    - frontend/src/pages/ProjectDetailPage.tsx

key-decisions:
  - "B2 = aprovar-sem-env: chave Gemini por projeto vira opcional; GEMINI_API_KEY ainda NÃO está no Railway"
  - "pdf-fallback = sim: importação de PDF cai na chave do servidor (commit separado do contrato)"

requirements-completed: [TAQ-02]

coverage:
  - id: D1
    description: "ProjectCreate sem gemini_api_key é válido (None) e com chave continua válido"
    requirement: TAQ-02
    verification:
      - kind: unit
        ref: "backend/tests/test_projects.py#test_project_create_gemini_key_is_optional"
        status: pass
    human_judgment: false
  - id: D2
    description: "create_project sem chave (ou com string vazia) não chama o Vault e não grava gemini_api_key_secret_id; com chave guarda no Vault uma vez"
    requirement: TAQ-02
    verification:
      - kind: unit
        ref: "backend/tests/test_projects.py#test_create_project_without_key_skips_vault"
        status: pass
      - kind: unit
        ref: "backend/tests/test_projects.py#test_create_project_with_key_stores_in_vault"
        status: pass
      - kind: unit
        ref: "backend/tests/test_projects.py#test_create_project_with_empty_key_is_treated_as_absent"
        status: pass
    human_judgment: false
  - id: D3
    description: "Importação de PDF: sem chave no projeto + GEMINI_API_KEY segue com a chave do servidor; sem nada continua 503; chave própria tem prioridade; os 3 testes antigos não mudaram"
    requirement: TAQ-02
    verification:
      - kind: unit
        ref: "backend/tests/test_upload_pdf_mode.py#test_upload_without_project_key_uses_server_key"
        status: pass
      - kind: unit
        ref: "backend/tests/test_upload_pdf_mode.py#test_upload_without_any_key_is_503"
        status: pass
      - kind: unit
        ref: "backend/tests/test_upload_pdf_mode.py#test_upload_project_key_has_priority_over_server_key"
        status: pass
    human_judgment: false
  - id: D4
    description: "Formulário sem campo obrigatório e com apoio 'Opcional...'; tela do projeto com 'Usando a chave do servidor' (build e testes do frontend verdes)"
    requirement: TAQ-02
    verification:
      - kind: command
        ref: "npm --prefix frontend run build && npm --prefix frontend test"
        status: pass
    human_judgment: true
    rationale: "A aparência e o texto na tela real são julgamento visual; o build prova só que compila"
  - id: D5
    description: "Criar projeto sem chave no web app e abrir sessão: o pipeline responde com a chave do servidor (ponta a ponta)"
    requirement: TAQ-02
    verification: []
    human_judgment: true
    rationale: "Teste manual D-20 do fim da fase; BLOQUEADO enquanto GEMINI_API_KEY não existir no ambiente do backend (Railway ainda sem a variável)"
---

# Phase 8 Plan 08: Chave Gemini opcional na criação de projeto Summary

**Criar projeto sem chave Gemini agora funciona no backend e no web app: o Vault só é chamado quando há chave, e tanto o pipeline quanto a importação de PDF usam a `GEMINI_API_KEY` do servidor como padrão.**

## Lembrete bloqueante

> **TEM QUE CRIAR `GEMINI_API_KEY` NO RAILWAY** antes de qualquer deploy, merge na `master` ou junção com o AGM.
> Sem ela, projeto sem chave própria não roda o pipeline de IA nem a importação de PDF (responde 503). É também a pendência bloqueante do teste manual D-20.

## Task 1: Decisão B2 (respondida pelo time, registrada literalmente)

- **Resposta B2:** `aprovar-sem-env` (2026-10-12): a chave Gemini do projeto pode ser retirada/opcional; `GEMINI_API_KEY` NÃO está configurada no Railway ainda.
- **`GEMINI_API_KEY` no Railway?** NÃO. Vira pendência bloqueante do teste manual D-20 e do deploy.
- **pdf-fallback:** `sim` (2026-10-12): a importação de PDF (`routers/sessions.py`, `upload_pdf_transcript`) passa a usar `GEMINI_API_KEY` do servidor quando o projeto não tem chave própria; vai em commit separado (commit b); sem chave no projeto E sem a env, continua 503 como hoje.
- **Fonte:** `08-DECISOES-PENDENTES.md`, seção "B2". O registro foi commitado (`e1799d8`) antes de qualquer mudança de código, como pede a precondição das Tasks 2 e 3.

## Performance

- **Início:** 2026-10-12T14:10Z aprox. · **Tarefas:** 3 de 3 (Task 1 era a decisão, já respondida) · **Arquivos de código:** 7

## Accomplishments

- `ProjectCreate.gemini_api_key` é `Optional[str] = None`; `ProjectUpdate` e `pricing_api_key` não mudaram.
- `create_project` envolve o Vault da chave Gemini em `if payload.gemini_api_key:`; string vazia conta como ausente e a linha inserida não leva `gemini_api_key_secret_id` (T-08-14: a chave continua sem voltar ao front).
- `upload_pdf_transcript`: se o Vault não devolve chave, tenta `os.environ.get("GEMINI_API_KEY", "")` antes do 503. Chave própria continua com prioridade.
- `ProjectFormPage`: campo sem `required`, apoio "Opcional. Sem chave própria, o Agente usa a chave do servidor." (só na criação sem chave salva) e chave vazia fora do payload. `ProjectDetailPage`: "Usando a chave do servidor" em cinza no lugar de "Não configurada" em vermelho.
- Nenhum pacote novo (`requirements.txt` e `package*.json` sem diff).

## Task Commits

1. **Task 1 (registro da decisão B2):** `e1799d8` docs(08-08)
2. **Task 2, commit (a) contrato:** `bdb91cc` feat(08-08): chave Gemini opcional na criação de projeto
3. **Task 2, commit (b) importação de PDF:** `09e9c0c` feat(08-08): importação de PDF usa a chave do servidor quando o projeto não tem chave
4. **Task 3 (frontend):** `7c70c73` feat(08-08): formulário com chave Gemini opcional e cópia 'Usando a chave do servidor'

Teste primeiro nos dois commits de backend. RED do (a): 3 falhas nos alvos certos (default None, Vault chamado sem chave, string vazia indo ao Vault). RED do (b): 1 falha (503 no caso "sem chave no projeto + env definida"); os outros dois casos novos já passavam por preservarem o comportamento atual.

## Deviations from Plan

Nenhuma de comportamento. Ajustes de forma:

- Em `test_upload_pdf_mode.py` estendi só os helpers (`FakeSupabase` e `_run_upload` ganharam o parâmetro opcional `has_project_key=True`); os 3 testes antigos ficaram intactos e verdes.
- Em `ProjectFormPage.tsx` a remoção da chave vazia do payload vale para criação e edição (antes só na edição). Para a edição o efeito é idêntico; o cast de criação passou de `ProjectCreate & { gemini_api_key: string }` para `ProjectCreate`.

## Issues Encountered

- `backend/tests/test_schema.py::test_tables_exist` falha com `postgrest.exceptions.APIError` na suíte completa (`117 passed, 1 failed, 4 skipped`). É teste que fala com um Supabase real, sem relação com este plano (fora do escopo; não corrigido).

## Authentication Gates

Nenhum.

## Known Stubs

Nenhum.

## Threat Flags

Nenhum novo. T-08-13 (custo da chave compartilhada) segue aceito pelo time (decisão B2); o orçamento por projeto (`budget_usd`) continua valendo. Atenção: com `GEMINI_API_KEY` ausente no Railway, o efeito é o contrário do custo, projeto sem chave fica "mudo" (pipeline sem IA e PDF com 503), registrado acima como pendência bloqueante. T-08-14 e T-08-SC mitigados (nada de chave no retorno; sem dependência nova).

## Verification

- `cd backend && python -m pytest tests/test_projects.py tests/test_upload_pdf_mode.py -x -q`: 11 passed, 4 skipped (os 4 skips são stubs antigos de `test_projects.py`).
- Suíte completa do backend: 117 passed, 4 skipped, 1 failed (`test_schema.py::test_tables_exist`, ver Issues Encountered).
- `npm --prefix frontend run build`: tsc + vite OK. `npm --prefix frontend test`: 10 passed (1 arquivo).
- `grep -c "if payload.gemini_api_key" backend/app/routers/projects.py`: 2 (criação e a edição que já existia). `gemini_api_key: Optional[str] = None` em `models/projects.py`: presente em `ProjectCreate`.
- `awk` de "Não configurada" em `ProjectDetailPage.tsx`: 0; "Usando a chave do servidor": 1; texto "Opcional. Sem chave própria...": 1 em `ProjectFormPage.tsx`.
- Pendente (D-20, fim da fase): criar projeto sem chave no web app local e abrir sessão; exige `GEMINI_API_KEY` no ambiente do backend.

## Next Phase Readiness

O plano 08-12 (criar cliente pela Taqciti sem chave) está desbloqueado no código. Antes de qualquer deploy: criar `GEMINI_API_KEY` no Railway e conferir o T-08-10 (08-07) até o login do AGM.

## Self-Check: PASSED

- FOUND: backend/app/models/projects.py, backend/app/routers/projects.py, backend/tests/test_projects.py, backend/app/routers/sessions.py, backend/tests/test_upload_pdf_mode.py, frontend/src/pages/ProjectFormPage.tsx, frontend/src/pages/ProjectDetailPage.tsx
- FOUND commits: e1799d8, bdb91cc, 09e9c0c, 7c70c73
