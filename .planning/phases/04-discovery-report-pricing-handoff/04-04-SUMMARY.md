---
phase: 04-discovery-report-pricing-handoff
plan: 04
subsystem: api
tags: [fastapi, discovery-mode, pdf-upload, reports]

# Dependency graph
requires:
  - phase: 04-01
    provides: "reports.status column + mode-gated status grant pattern (D-36), used verbatim here"
  - phase: 04-02
    provides: "generate_report discovery branch + defensive lens normalization ('não classificado' bucket) that tolerates upload_pdf_transcript's lens-less shapes without AttributeError (D-39 contract)"
provides:
  - "upload_pdf_transcript propagates mode=project.get('mode','sales') to generate_report — PDF uploads for discovery sessions now generate the PRD report, not sales (D-39 fix)"
  - "upload_pdf_transcript's reports INSERT grants status='Rascunho' when mode=='discovery', mirroring the live pipeline grant (D-36); sales stays NULL/unchanged"
  - "backend/tests/test_upload_pdf_mode.py — FakeSupabase-based proof of both paths (discovery vs sales/no-mode)"
affects: [05-pricing-ui-handoff]

# Actuals (#2632)
actuals:
  tokens: 2097
  tasks: 1
  commits: 1
  plan_head_before: 9cc7c5d75d82bea0fcf15623bc7b4cfd7367adeb

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Mode-gated status grant reused verbatim from pipeline.py (D-36): **({\"status\": \"Rascunho\"} if mode=='discovery' else {}) spread into the reports insert dict — same shape, same guard, no duplication of logic"

key-files:
  created:
    - backend/tests/test_upload_pdf_mode.py
  modified:
    - backend/app/routers/sessions.py

key-decisions:
  - "D-39 aplicada: upload_pdf_transcript passa mode=project.get('mode','sales') para generate_report — corrige a inconsistência silenciosa onde um PDF de sessão discovery gerava relatório sales por omissão do parâmetro (Pitfall 4 do RESEARCH)"
  - "Grant de status no INSERT do upload usa exatamente o mesmo padrão condicional do pipeline (D-36) — **({\"status\": \"Rascunho\"} if project.get('mode')=='discovery' else {}) — para manter o relatório discovery via PDF coerente com o caminho ao vivo"
  - "Partição por lens do caminho de PDF (perguntas/red flags sem coluna lens nas seleções do banco) permanece FORA de escopo — os itens caem no bucket 'não classificado' entregue pela normalização defensiva de 04-02; DECISÃO EM ABERTO para task futura caso o time queira o upload totalmente lens-aware"
  - "Teste usa um FakeSupabase mínimo (encadeamento .table/.select/.eq/.order/.limit/.in_/.insert/.update/.execute stub) e chama upload_pdf_transcript diretamente (sem TestClient/rede real), no mesmo espírito de FakeRepo/FakeLLM usado em test_import_from_diagnosis_gate.py — evita qualquer dependência de Supabase real ou de .env"

requirements-completed: [REP-01, REP-03]

coverage:
  - id: D1
    description: "upload_pdf_transcript passa mode=project.get('mode','sales') para generate_report — PDF de sessão discovery gera relatório no formato PRD, não sales"
    requirement: "REP-01"
    verification:
      - kind: unit
        ref: "backend/tests/test_upload_pdf_mode.py::test_upload_discovery_mode_propagates_and_grants_status"
        status: pass
      - kind: other
        ref: "python -c grep check: 'mode=project.get(\"mode\"' presente no corpo de upload_pdf_transcript (UPLOAD_MODE_OK)"
        status: pass
    human_judgment: false
  - id: D2
    description: "O INSERT de reports do upload grava status='Rascunho' quando mode=='discovery' (mesmo grant do pipeline, D-36)"
    requirement: "REP-01"
    verification:
      - kind: unit
        ref: "backend/tests/test_upload_pdf_mode.py::test_upload_discovery_mode_propagates_and_grants_status"
        status: pass
    human_judgment: false
  - id: D3
    description: "Sessões sales via upload de PDF continuam gerando relatório sales (mode default 'sales'); comportamento sales inalterado, status NULL"
    requirement: "REP-03"
    verification:
      - kind: unit
        ref: "backend/tests/test_upload_pdf_mode.py::test_upload_sales_mode_unchanged"
        status: pass
      - kind: unit
        ref: "backend/tests/test_upload_pdf_mode.py::test_upload_no_mode_defaults_to_sales"
        status: pass
    human_judgment: false
  - id: D4
    description: "O caminho de upload manda para o discovery branch de generate_report as shapes lens-less reais (questions_used=list[str], red_flags=dicts sem lens) sem estourar AttributeError — protegido pela normalização defensiva entregue em 04-02"
    requirement: "REP-01"
    verification:
      - kind: unit
        ref: "backend/tests/test_discovery_report.py::test_discovery_tolerates_lensless_upload_shape (04-02, contrato cross-plan verificado ali; este plano depende dessa proteção via depends_on, não a reimplementa)"
        status: pass
    human_judgment: false

# Metrics
duration: 12min
completed: 2026-09-23
status: complete
---

# Phase 04 Plan 04: Discovery Report — PDF Upload Mode Propagation Fix Summary

**Correção isolada D-39: `upload_pdf_transcript` agora propaga `mode=project.get("mode","sales")` para `generate_report` e concede `status='Rascunho'` no INSERT quando discovery — um PDF de reunião discovery deixa de gerar relatório sales por engano.**

## Performance

- **Duration:** 12 min
- **Started:** 2026-09-23T11:52:20Z
- **Completed:** 2026-09-23T12:04:20Z
- **Tasks:** 1/1
- **Files modified:** 2 (1 código + 1 arquivo de teste novo)

## Accomplishments

- **Propagação de `mode` (D-39):** `upload_pdf_transcript` (`backend/app/routers/sessions.py`) agora chama `llm_service.generate_report(..., mode=project.get("mode", "sales"))`. Antes, o parâmetro `mode` simplesmente não era passado, então o default `"sales"` de `generate_report` fazia QUALQUER PDF de transcrição gerar relatório de venda, mesmo para sessões `discovery` — uma inconsistência silenciosa (Pitfall 4 do RESEARCH).
- **Grant de status coerente:** o `db.table("reports").insert({...})` do upload agora inclui `**({"status": "Rascunho"} if project.get("mode") == "discovery" else {})`, reproduzindo exatamente o mesmo padrão condicional já usado no pipeline ao vivo (`pipeline.py:475`, D-36). Um relatório discovery gerado via upload de PDF nasce `'Rascunho'`, pronto para o fluxo de transição de status (`PATCH /sessions/{id}/report`, D-38) e para o gate de handoff (`import_from_diagnosis`, D-37) — igual a um relatório discovery gerado ao vivo.
- **Sales inalterado (REP-03):** quando `project.get("mode")` é `"sales"` ou a chave `mode` está ausente (projeto sem a coluna aditiva), `generate_report` recebe `mode="sales"` (o mesmo default de sempre) e o INSERT não grava `status` — comportamento idêntico ao pré-existente.
- **Teste novo (`backend/tests/test_upload_pdf_mode.py`):** um `FakeSupabase` mínimo (stub do encadeamento `.table/.select/.eq/.order/.limit/.in_/.insert/.update/.execute`) chama `upload_pdf_transcript` diretamente — sem TestClient, sem rede, sem Supabase real. Três cenários provados: `mode='discovery'` (propaga + grant), `mode='sales'` (sem grant) e projeto sem a chave `mode` (default `'sales'`, sem grant).

## Task Commits

Each task was committed atomically:

1. **Task 1: Propagar mode + grant de status coerente (D-39)** - `0a6debd` (fix)

**Plan metadata:** (este commit, feito a seguir)

## Files Created/Modified

- `backend/app/routers/sessions.py` - `upload_pdf_transcript` ganha `mode=project.get("mode", "sales")` na chamada de `generate_report` e `**({"status": "Rascunho"} if project.get("mode") == "discovery" else {})` no INSERT de `reports`. Nenhuma outra linha do endpoint tocada.
- `backend/tests/test_upload_pdf_mode.py` - arquivo novo: `FakeSupabase`/`_FakeQuery`/`_FakeResult` (stub genérico do encadeamento supabase-py) + 3 testes (`test_upload_discovery_mode_propagates_and_grants_status`, `test_upload_sales_mode_unchanged`, `test_upload_no_mode_defaults_to_sales`).

## Decisions Made

- D-39 aplicada exatamente como especificado no plano: mudança mínima, um único commit, sem mexer em mais nada do endpoint.
- Grant de status reutiliza o padrão condicional literal do pipeline (D-36) em vez de criar uma nova abstração — mesma legibilidade, sem duplicação de lógica de negócio no router (CLAUDE.md: sem lógica de negócio em routers — o grant aqui é um espelho de um padrão já decidido em 04-01, não uma nova regra).
- Partição por lens do caminho de PDF permanece FORA de escopo (limitação aceita, registrada no plano) — DECISÃO EM ABERTO para o time caso queiram o upload totalmente lens-aware no futuro.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- Ao escrever o teste, a primeira tentativa de simular um "projeto sem `mode`" usou `{"mode": None, ...}` no dict fake — isso NÃO reproduz `project.get("mode", "sales")` corretamente, porque `.get(key, default)` só aplica o default quando a CHAVE está ausente, não quando o valor é `None`. Corrigido para omitir a chave `mode` inteiramente nesse cenário, reproduzindo fielmente o caso real (projeto sem a coluna aditiva selecionada, ou dict vazio via `session.get("projects") or {}`). Não é uma mudança de comportamento no código de produção — só uma correção do fixture de teste durante a escrita, antes do commit.

## User Setup Required

None - nenhuma configuração de serviço externo necessária. Nenhuma migration nova nesta plan.

## Next Phase Readiness

- Fase 04 (Discovery Report + Pricing Handoff) está com todos os 4 planos concluídos e sumarizados (04-01, 04-02, 04-03, 04-04).
- REP-01/REP-03 agora `Complete` em `REQUIREMENTS.md` — este é o último plano que os declarava (shared-ID gate #2388 liberado).
- O caminho de upload de PDF e o pipeline ao vivo agora produzem relatórios coerentes por `mode`, com o mesmo grant de `status` — a Fase 05 (Pricing UI Handoff) pode consumir `reports.status` sem se preocupar com a origem do relatório (live vs. PDF upload).
- Suíte backend: 81 passed, 1 falha pré-existente e não relacionada (`test_schema.py::test_tables_exist`, depende de conexão real ao schema cache do Supabase — falha da mesma forma antes desta mudança, documentada desde 04-01/04-02), 4 skipped.

---
*Phase: 04-discovery-report-pricing-handoff*
*Completed: 2026-09-23*

## Self-Check: PASSED

- FOUND: backend/app/routers/sessions.py
- FOUND: backend/tests/test_upload_pdf_mode.py
- FOUND: commit 0a6debd (Task 1)
