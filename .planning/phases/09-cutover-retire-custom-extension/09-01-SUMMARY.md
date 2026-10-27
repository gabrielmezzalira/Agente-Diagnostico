---
phase: 09-cutover-retire-custom-extension
plan: 01
subsystem: testing
tags: [pytest, fastapi, openapi, pydantic, webhook, regression-seed]

requires:
  - phase: 08-taqciti-session-association
    provides: "contrato POST /webhook/extension com chunk_id opcional e gate verify_extension_key"
provides:
  - "4 testes test_sc3_* que travam o contrato usado pela Taqciti (rota, 202, gate, schema ExtensionChunk, enum source, sessão histórica)"
  - "Lista dos 7 planos e ondas da Fase 9 no ROADMAP"
affects: [09-05, 09-06]

actuals:
  tokens: 1500
  tasks: 2
  commits: 2
plan_head_before: 3a321fe29067bc5e045bf82ee720394097cc9de8
plan_head_after: b6b15a405025d0d2bf1b6be128ec81e727fb2ddc
commits: 2

tech-stack:
  added: []
  patterns: ["inspeção de router.routes (APIRoute) + app.openapi() em vez de app.routes"]

key-files:
  created: []
  modified:
    - backend/tests/test_extension_chunk_extra_fields.py
    - .planning/ROADMAP.md

key-decisions:
  - "Semente SC3 mora em test_extension_chunk_extra_fields.py (mesmo assunto, arquivo pequeno), não em test_extension_clients.py (já acima de 200 linhas)"

requirements-completed: []  # TAQ-04 é da fase inteira; fecha só em 09-05/09-06 (extensão antiga removida)

coverage:
  - id: D1
    description: "Rota POST /webhook/extension registrada com 202 e atrás de verify_extension_key"
    requirement: "TAQ-04"
    verification:
      - kind: unit
        ref: "backend/tests/test_extension_chunk_extra_fields.py#test_sc3_post_webhook_extension_registered_with_202_and_gate"
        status: pass
    human_judgment: false
  - id: D2
    description: "OpenAPI expõe /webhook/extension e o schema ExtensionChunk tem exatamente session_id, text, speaker, chunk_id"
    requirement: "TAQ-04"
    verification:
      - kind: unit
        ref: "backend/tests/test_extension_chunk_extra_fields.py#test_sc3_openapi_exposes_webhook_extension_and_chunk_contract"
        status: pass
    human_judgment: false
  - id: D3
    description: "Enum source ainda aceita extension, default de ProjectCreate continua extension e sessão histórica finished/extension é lida"
    requirement: "TAQ-04"
    verification:
      - kind: unit
        ref: "backend/tests/test_extension_chunk_extra_fields.py#test_sc3_source_enum_still_accepts_extension"
        status: pass
      - kind: unit
        ref: "backend/tests/test_extension_chunk_extra_fields.py#test_sc3_historical_extension_session_still_resolves"
        status: pass
    human_judgment: false

duration: 3min
completed: 2026-10-27
status: complete
---

# Phase 9 Plan 01: Semente SC3 e abertura da fase Summary

**Quatro testes `test_sc3_*` travam o contrato que a Taqciti usa (`POST /webhook/extension` 202 com gate, schema `ExtensionChunk`, `source=extension`, sessão histórica) antes de qualquer remoção da extensão antiga.**

## Performance

- **Duration:** ~3 min (esta continuação)
- **Started:** 2026-10-27T16:38:38Z
- **Completed:** 2026-10-27T16:40:01Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Task 1 fechada pela decisão do usuário: branch mantida e ROADMAP da Fase 9 com `**Plans**: 7 plans` e as ondas W1 a W6.
- Task 2 (tracer): 4 testes novos, sem tocar em nenhum arquivo de `backend/app/`. Teste de OpenAPI usa import tardio de `app.main`; nenhum uso de `app.routes`.
- Baseline de 61 testes do contrato continuou verde; agora são 65. Suíte inteira do backend (com o `test_tables_exist` desmarcado, falha preexistente ao vivo): 279 passed, 4 skipped.

## Task Commits

1. **Task 1: pré-condição de git + ROADMAP** - `ad85576` (docs) — o commit dos 12 docs da fase já existia em `7c84abe`/`3a321fe`; este traz só o ROADMAP
2. **Task 2: semente SC3** - `b6b15a4` (test)

**Plan metadata:** commit `docs(09-01)` seguinte (SUMMARY, STATE, ROADMAP, REQUIREMENTS)

## Files Created/Modified
- `backend/tests/test_extension_chunk_extra_fields.py` - bloco "Fase 9 / SC3" com 4 testes (163 linhas no total, abaixo do limite de 200)
- `.planning/ROADMAP.md` - bloco da Fase 9 com 7 planos e ondas

## Decisions Made
- Semente SC3 estendeu o arquivo pequeno do mesmo assunto em vez do `test_extension_clients.py` (520 linhas).

## Deviations from Plan

### Decisões do usuário que ajustaram o plano (checkpoint da Task 1)

**1. [Decisão A - nome da branch] Branch oficial é `feat/fase-09-cutover-retire-custom-extension`**
- O plano cita `feat/fase-09-cutover-extension`; o usuário decidiu manter a branch já existente, com o nome longo. Os checks de `<verify>` foram lidos com esse nome. Conteúdo do plano inalterado. Nenhuma branch foi criada, renomeada ou trocada.

**2. [Decisão B - Fase 8 só local] Merge local da Fase 8 na `main` basta; sem push**
- Não houve `git pull`/`checkout main`. `main` local (5944748) contém a Fase 8 e é ancestral do HEAD.

**3. [Decisão C - ROADMAP] Commit separado de ROADMAP**
- O plano previa os docs da fase e o ROADMAP num mesmo commit. Os docs já tinham sido commitados antes (`7c84abe`, `3a321fe`), então o ROADMAP foi num commit pequeno próprio (`ad85576`). Como consequência, o `<verify>` da Task 1 (que exige o último commit só com a pasta da fase + ROADMAP) é satisfeito de forma equivalente: o último commit da Task 1 contém apenas `.planning/ROADMAP.md`; `.planning/config.json` não foi tocado.

### Auto-fixed Issues
Nenhuma.

**Total deviations:** 3 ajustes por decisão do usuário, 0 auto-fixes.

## Pendências do time
- **Push da main:** a `main` local está 196 commits à frente de `origin/main` (638f0f7); nada foi enviado. Fica para o time decidir quando publicar.
- `.planning/STATE.md`, `state.json`, `config.json` seguem modificados pelo orquestrador (ruído de CRLF/`effort sync`); `config.json` ficou de fora de todos os commits.

## Issues Encountered
None

## Known Stubs
Nenhum.

## Threat Flags
Nenhum — só testes novos, sem superfície nova. T-09-01 mitigado pelos 4 testes; T-09-02 aceito (D-08); T-09-SC: nenhum pacote instalado.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Contrato protegido; planos 09-02 em diante podem seguir. 09-05 deve rodar `-k sc3` antes e depois do `git rm`.

---
*Phase: 09-cutover-retire-custom-extension*
*Completed: 2026-10-27*

## Self-Check: PASSED
