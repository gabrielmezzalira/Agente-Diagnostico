---
gsd_state_version: "1.0"
milestone: v3.0
milestone_name: Pivot Discovery
current_phase: 06
current_phase_name: opt-in-webhook-auth
status: executing
stopped_at: Completed 06-01-PLAN.md
last_updated: "2026-09-24T22:34:31.727Z"
last_activity: 2026-09-24
last_activity_desc: Phase 06 execution started
state_head: 26ac75b4986d22f050eeab3f667b6bda0dc1512e
progress:
  total_phases: 10
  completed_phases: 5
  total_plans: 20
  completed_plans: 19
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-09-24)

**Core value:** Discovery teams map the bottleneck and its solution completely during the call, so nothing unmapped surprises delivery — and the discovery output feeds pricing directly
**Current focus:** Phase 06 — Opt-In Webhook Auth

## Current Position

Phase: 06 (opt-in-webhook-auth) — READY TO EXECUTE
Plan: 1 of 1
Status: Ready to execute
Last activity: 2026-09-24 — Phase 06 execution started

Progress: [█████░░░░░] 50%

## Performance Metrics

**Velocity:**

- Total plans completed: 18
- Average duration: -
- Total execution time: 0 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01 | 3 | - | - |
| 02 | 3 | - | - |
| 03 | 3 | - | - |
| 04 | 4 | - | - |
| 05 | 5 | - | - |

**Recent Trend:**

- Last 5 plans: -
- Trend: -

*Updated after each plan completion*
**Per-Plan Metrics:**

| Plan | Duration | Tasks | Files |
|------|----------|-------|-------|
| Phase 01 P01 | 25min | 2 tasks | 5 files |
| Phase 01 P02 | 8min | 2 tasks | 3 files |
| Phase 01 P03 | 9min | 2 tasks | 4 files |
| Phase 02 P01 | 21min | 3 tasks | 6 files |
| Phase 02 P02 | 10min | 2 tasks | 3 files |
| Phase 04 P01 | 2h | 3 tasks | 6 files |
| Phase 04 P02 | ~1h | 3 tasks | 4 files |
| Phase 04 P03 | 25min | 2 tasks | 3 files |
| Phase 04 P04 | 12min | 1 tasks | 2 files |
| Phase 05 P01 | 15min | 2 tasks | 6 files |
| Phase 05 P03 | ~20min | 3 tasks | 4 files |
| Phase 05 P02 | ~10min | 2 tasks | 3 files |
| Phase 05 P04 | ~15min | 2 tasks | 2 files |
| Phase 05 P05 | ~10min | 2 tasks | 5 files |
| Phase 06 P01 | ~10min | 2 tasks | 5 files |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- Pivot sales → discovery, keep sales behind `mode` flag until discovery is validated
- Single coverage-area registry (kill 8 hardcoded areas duplicated across ~6 files) — Phase 1 enabling refactor
- Two agents only at the question stage (coverage + red-flags stay 1×) — bounds LLM cost near 1× while honoring "dois agentes"
- Adopt Taqciti capture engine + add live streaming; retire the custom extension after cutover is validated (Phase 9)
- [Phase 01]: Registry per-area dataclass named AreaDefinition (not CoverageArea) to avoid name collision with session_state.CoverageArea — session_state.py already has an unrelated runtime CoverageArea dataclass; reusing the name would be confusing even without an import cycle
- [Phase 01]: Only llm.classify_coverage rewired to the registry in plan 01-01; area_labels and block-enum call sites deferred to later plans — Plan 01-01 scope is the tracer slice (one consumer, proven end-to-end); remaining consumers are plan 02/03 work
- [Phase 01]: [Phase 01-02]: AREAS_BY_PROJECT_TYPE re-exported through prompt_builder.py's top-level import rather than repointing session_state.py directly, keeping this plan's diff scoped to its two named files — plan 03 is the one that repoints session_state's import directly to the registry
- [Phase 01]: [Phase 01-03]: session_state.py re-pointed directly to coverage_areas (import no longer via prompt_builder re-export); structured_context.py's _EXTRACTOR_SYSTEM split into static PREFIX/SUFFIX plus a registry-sourced middle line (concatenation, not f-string) to avoid escaping literal JSON braces
- [Phase 02]: [Phase 02-01]: DiscoveryPromptBuilder e classe irma (nao subclasse) de PromptBuilder; nunca importa CITI_PORTFOLIO/CATALOG/TECH_REFERENCE — garante DISC-03 por construcao para os 3 agentes realtime
- [Phase 02]: [Phase 02-01]: _init_coverage ganha mode como kwarg novo com default 'sales' (project_type continua 1o posicional) para nao quebrar test_session_state_custom_areas.py
- [Phase 02]: citi_block interpolado na mesma posicao textual (entre Alertas detectados e Transcricao completa) — gate por mode nunca reescreve o caminho sales — Garante SC#4 (sales byte-identico) e evita mover o bloco para o system_prompt, o que mudaria user->system no payload do Gemini
- [Phase 02]: [Phase 02-03] Task 1 (checkpoint:decision, blocking-human, aprovado): coluna projects.mode criada como text DEFAULT 'sales' sem CHECK/enum nativo — Segue o padrao ja usado por project_type/source/status no repo -- validacao de enum 100% no Pydantic Literal, sem ALTER TYPE a cada modo futuro
- [Phase 02]: [Phase 02-03] Task 2 concluida: migration aditiva + ProjectMode nos 3 schemas Pydantic + teste de validacao (commit 6b6f55a) — ProjectResponse.mode sem default Python (sempre presente pos-migration); nenhum ProjectRepository criado (Pitfall 5)
- [Phase 04]: D-37: gate de aprovacao de import_from_diagnosis vive no service (llm_pricing_service.py), nunca no router — trata status=None como sem-gate (nunca consulta projects.mode) — Segue CLAUDE.md (router nao toca regra de negocio) e mantem sales byte-identico (REP-03)
- [Phase 04]: D-38: rota PATCH /sessions/{session_id}/report e escrita simples de campo no router (Literal de 3 valores), separada do gate de negocio D-37 que fica no service — Mesmo nivel de simplicidade dos GET/POST de report ja existentes no arquivo
- [Phase 04]: [Phase 04] [Phase 04-02]: build_report_generator reescrito para o esqueleto do PRD de 16 secoes (D-26); marcador [a preencher no PRD] em subsecoes sem insumo
- [Phase 04]: [Phase 04] [Phase 04-02]: generate_report ganha ramo discovery com duas tabelas de cobertura por lens (DISCOVERY_AREA_SET) e red flags/perguntas particionados por lens; questions_used vira list[dict] com lens (D-27/D-28/D-40); shape lens-less de upload_pdf_transcript tolerado via bucket nao classificado (D-39)
- [Phase 04]: D-32: 12 blocos temáticos sincronizados nos dois prompts do Precificador (import_from_diagnosis + suggest_features), com desambiguação ML/GenAI/Ciência de Dados — Aditivo, sem migration — bloco continua texto livre no banco
- [Phase 04]: D-33/D-34: readiness_score puro em SessionState combina 4 sinais por score ponderado (0.30/0.30/0.20/0.20) + limiar 0.65 (constantes calibráveis) — Backend-only; UI da Fase 5 consome ready/low_signals para habilitar botão Gerar PRD
- [Phase 04]: D-39: upload_pdf_transcript propaga mode=project.get('mode','sales') para generate_report + grant condicional de status='Rascunho' no INSERT do upload quando discovery — Corrige inconsistencia silenciosa: PDF de sessao discovery gerava relatorio sales por omissao do parametro mode (Pitfall 4). Grant reusa o mesmo padrao condicional ja usado no pipeline ao vivo (D-36).
- [Phase 05]: [Phase 05-01]: CoverageArea.status ganhou o literal not_applicable no tipo compartilhado (Rule 1 - bug de tipo pre-existente exposto ao trocar a prop coverage do CoveragePanel para o CoverageState compartilhado)
- [Phase 05]: [Phase 05-03]: ReportResponse.status como Optional[Literal] = None (nao Literal obrigatorio) para preservar sales byte-identico (REP-03); rota GET /sessions/{id}/readiness reusa pipeline_manager.get_or_create(allow_finished=True) + 404 identico as rotas de report
- [Phase 05]: [Phase 05-02]: LensBadge extraido como componente compartilhado (nao helper de string) entre QuestionCard e TranscriptPanel — evita a cor da badge Produto/Dados divergir entre pergunta e red flag
- [Phase 05]: [Phase 05]: [Phase 05-04]: Bloco 'Gerar PRD' inserido como secao dedicada antes de 'Precificacoes' (Claude's Discretion) em vez de por-card-de-sessao; seletor de status como <select> nativo (Claude's Discretion) em vez de 3 botoes
- [Phase 05]: [Phase 05] [Phase 05-05]: shouldShowManualReportButton extraido para lens.ts (nao inline) — gate fail-closed do botao Relatorio por hasReceivedInitialState (fonte sincrona) em vez de ws.coverage assincrono (fecha CR-01)
- [Phase 05]: [Phase 05] [Phase 05-05]: prdError separado de readinessError no ProjectDetailPage — GET-error (fail-closed, desabilita) distinto de POST-error (nao desabilita, permite retry) (fecha CR-02)
- [Phase 06]: [Phase 06] D-01: Depends(verify_extension_key) conectado exclusivamente em extension_webhook(); recall_webhook() e o APIRouter(...) permanecem intocados — confirmado por 2 greps automatizados no <verify>
- [Phase 06]: [Phase 06] D-02: campo da extensao usa input type=password e chrome.storage.local (nunca .sync) — mesmo nivel de exposicao do campo backendUrl ja existente
- [Phase 06]: [Phase 06] D-03: ativacao real de EXTENSION_SHARED_KEY em producao (Railway) fica como DECISAO EM ABERTO do time — nenhuma task desta fase seta a env var em ambiente real

### Pending Todos

None yet.

### Blockers/Concerns

- Phases 1-3 touch backend files shared with sales mode (`prompt_builder.py`, `llm.py`, `session_state.py`) — every change needs a sales-mode regression check, not just a discovery-mode happy path
- Phases 2 and 3 need additive-only Supabase migrations (`projects.mode`, `questions.lens`) — confirm migration approach before Phase 2 execution
- Phases 7-8 live in the separate Taqciti repo — coordinate access/branch strategy before starting Phase 7
- Phase 9 (cutover) should not start until a real Meet call has validated Phases 6-8 end-to-end
- [Phase 02-03] RESOLVIDO (2026-09-21): Task 3 aplicada — migration 20260921000000_add_mode_to_projects.sql executada no Supabase (SQL Editor), coluna projects.mode confirmada com default 'sales'::text. Task 4 (toggle frontend) concluida em dacc146.

## Deferred Items

Items acknowledged and deferred at milestone close, most recent first:

| Category | Item | Status | Deferred At | Milestone |
|----------|------|--------|-------------|-----------|
| Discovery depth | Report template refined against a real discovery document sample (DISCF-01) | Deferred | v3.0 requirements | v3.1+ |
| Discovery depth | Dynamic/AI-generated discovery areas per client context — wire up `generate_custom_areas` (DISCF-02) | Deferred | v3.0 requirements | v3.1+ |
| Transcription | Multi-provider capture beyond Google Meet — Zoom/Teams (TAQF-01) | Deferred | v3.0 requirements | v3.1+ |
| Transcription | Real per-user auth (JWT/RLS) for the transcription webhook (TAQF-02) | Deferred | v3.0 requirements | v3.1+ |
| v2 req | Dynamic report cost estimation (data-driven, after 10 sessions) | Deferred | v2.0 init | v2.1+ |
| v2 req | A/B test framework for dynamic vs v1 prompts | Deferred | v2.0 init | v2.1+ |
| v2 req | Multi-user / team access | Deferred | v2.0 init | v2.1+ |

## Session Continuity

Last session: 2026-09-24T14:11:29.270Z
Stopped at: Completed 06-01-PLAN.md
Resume file: None
