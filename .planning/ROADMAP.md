# Roadmap: Agente Diagnóstico v2.0

## Overview

The v1 Python backend (realtime pipeline, LLM agents, webhook server, CLI renderer) is complete and production-ready. V2 builds the full product surface on top of it: a React web frontend, FastAPI REST + WebSocket layer, Supabase persistence with 9 tables, per-project dynamic prompt generation calibrated by Data Maturity Score, question bank, budget control, question queue with TTL, session history, and automatic tunnel URL exposure. The 10 phases follow the SDD's dependency-ordered sequence: foundational data model first, then infrastructure, then intelligence layers, then the full realtime monitoring screen, then the advanced queue/budget/history features, and finally the DMS calibration layer that ties everything together.

## Phases

**Phase Numbering:**
- Integer phases (1–10): Planned v2.0 milestone work
- Decimal phases: Urgent insertions only (via `/gsd:phase insert`)

- [ ] **Phase 1: Project Configuration + Supabase Schema** - Create, list, and edit projects; initialize all 9 Supabase tables
- [ ] **Phase 2: Session Setup** - Create sessions from projects, pre-fill fields, confirm and persist
- [ ] **Phase 3: Tunnel URL Exposure** - Auto-start cloudflared/ngrok, display public URL in setup screen
- [ ] **Phase 4: Question Bank** - Seed thematic question bank, filter by project type, inject into planner
- [ ] **Phase 5: Dynamic Prompt Generation** - PromptBuilder generates per-agent prompts from project config, stored for replay
- [ ] **Phase 6: Monitoring Screen (base)** - 3-column React layout with live coverage, transcript, alerts, and actions via WebSocket
- [ ] **Phase 7: Question Queue** - Pin/dismiss/TTL/used states, max-5 queue, anti-repeat context
- [ ] **Phase 8: Budget Control** - TokenCounter, cost accumulation, auto-stop, budget bar at 250ms
- [ ] **Phase 9: Session Persistence + History** - Full transcript, snapshots, red flags, reports saved; history screen with timeline
- [ ] **Phase 10: Data Maturity Score** - DMS slider calibrates all 4 agents; report includes maturity gap section

## Phase Details

### Phase 1: Project Configuration + Supabase Schema
**Goal**: Users can create, view, and edit projects in the web UI, with all project data persisted in Supabase; the complete 9-table schema is live
**Mode:** mvp
**Depends on**: Nothing (first phase)
**Requirements**: PROJ-01, PROJ-02, PROJ-03, PROJ-04, PROJ-05
**Success Criteria** (what must be TRUE):
  1. User can create a project with all 11 fields (name, client, description, project type, Gemini API key, budget, DMS, pre-meeting context, meeting URL, source, TTL) and see it in the project list
  2. User can edit a project at any time; the Gemini API key is masked after save and requires re-entry to update
  3. Projects with active sessions display a green "ao vivo" badge in the project list
  4. All 9 Supabase tables (projects, sessions, questions, red_flags, coverage_snapshots, reports, question_bank, session_prompts, transcript_chunks) are initialized and accepting data
  5. Gemini API key is stored via Supabase Vault (pgsodium); it is never returned to the frontend in plaintext
**Plans**: 3 plans
Plans:
- [ ] 01-01-PLAN.md — Scaffold + Schema (backend structure, Vite frontend, 9-table migration SQL, [BLOCKING] migration apply)
- [ ] 01-02-PLAN.md — Project API (FastAPI router, Pydantic models, Vault integration, integration tests)
- [ ] 01-03-PLAN.md — Project UI (HomePage, ProjectFormPage, components, API client, design system applied)
**UI hint**: yes

### Phase 2: Session Setup
**Goal**: Users can create a session from a project, confirm or adjust session-specific settings, and have the session persisted in Supabase as active
**Mode:** mvp
**Depends on**: Phase 1
**Requirements**: SESS-01, SESS-02, SESS-03, SESS-04, SESS-05
**Success Criteria** (what must be TRUE):
  1. User can open "Nova sessão" from a project and see all fields pre-filled from the project (meeting URL, source, context, budget)
  2. On confirmation, a session record is created in Supabase with status='active' and the project list shows the green badge
  3. When source=taqtic, the setup screen shows a public URL (tunnel not yet required — placeholder is acceptable; full tunnel in Phase 3)
  4. When source=recall, the backend POSTs to Recall.ai API and the bot joins the call
  5. Confirmation redirects to the monitoring screen route (even if monitoring is not yet fully implemented)
**Plans**: TBD
**UI hint**: yes

### Phase 3: Tunnel URL Exposure
**Goal**: When a Taqtic session starts, a public tunnel URL is automatically started, displayed to the user, and torn down when the session ends
**Mode:** mvp
**Depends on**: Phase 2
**Requirements**: TUNNEL-01, TUNNEL-02, TUNNEL-03
**Success Criteria** (what must be TRUE):
  1. Backend detects cloudflared or ngrok on PATH at session start; cloudflared is used if both are present
  2. The public tunnel URL appears in the setup screen and in the monitoring screen topbar within seconds of session creation
  3. The tunnel is automatically terminated when the session is finished via the API (POST /sessions/:id/finish) or the Q action
  4. If neither cloudflared nor ngrok is found, the user sees a clear error message with installation instructions rather than a silent failure

### Phase 4: Question Bank
**Goal**: The question_bank table is seeded with all mapped questions per thematic block and project type, and the QuestionPlanner receives filtered questions as context when generating suggestions
**Mode:** mvp
**Depends on**: Phase 1
**Requirements**: QBANK-01, QBANK-02, QBANK-03, QBANK-04
**Success Criteria** (what must be TRUE):
  1. The question_bank table contains at least one question per thematic block (negocio, eng_dados, visualizacao, ciencia_dados, automacao, integracao, consumo, parceria) with correct project_types and priority fields
  2. GET /question-bank?project_type=bi returns only questions relevant to BI projects; GET /question-bank?block=automacao returns only automation-block questions
  3. When the QuestionPlanner is invoked for a session, it receives the filtered bank questions as prompt context — not a blank canvas

### Phase 5: Dynamic Prompt Generation
**Goal**: Every session generates a unique set of agent prompts via PromptBuilder, stored in session_prompts, with v1 constants as fallback — making prompt content visible and debuggable per session
**Mode:** mvp
**Depends on**: Phase 1, Phase 4
**Requirements**: PROMPT-01, PROMPT-02, PROMPT-03, PROMPT-04, PROMPT-05, PROMPT-06, PROMPT-07, PROMPT-08
**Success Criteria** (what must be TRUE):
  1. A BI project and an ML project produce observably different prompts for CoverageClassifier (different areas activated) and QuestionPlanner (different vocabulary and priorities)
  2. All 4 agent prompts (CoverageClassifier, RedFlagDetector, QuestionPlanner, DiagnosticAgent) are stored in the session_prompts table at session start and can be retrieved via the API
  3. When PromptBuilder fails or returns empty, the system falls back to v1 SYSTEM_PROMPT and CLASSIFIER_SYSTEM_PROMPT constants without crashing
  4. RedFlagDetector prompt incorporates known pre-meeting context from the project record

### Phase 6: Monitoring Screen (base)
**Goal**: The React monitoring screen is live, connected to WebSocket, and shows coverage status, transcript chunks, red flag alerts, and session controls in real time
**Mode:** mvp
**Depends on**: Phase 2, Phase 5
**Requirements**: MON-01, MON-02, MON-03, MON-04, MON-05, MON-06, MON-07, MON-08, MON-09, MON-10, MON-11
**Success Criteria** (what must be TRUE):
  1. The 3-column layout renders: Coverage panel (220px fixed, risk areas with status colors), Live feed (flex, scrolling transcript + red flag alerts with severity badges), Questions panel (280px fixed, question cards + "Generate Now" button)
  2. The topbar shows project name + client, animated green status dot with "ao vivo" text, and a live HH:MM:SS session timer
  3. The budget bar below the topbar shows a colored progress bar and consumed/limit values updated in real time
  4. Actions work: Generate questions (P/button), Force classify (S/button), Generate report (R/button with budget check + modal), Finish session (Q/red button with confirmation)
  5. The WebSocket connection at ws://localhost:8000/ws/{session_id} handles all event types: coverage_update, red_flag, question_new, question_expired, transcript_chunk, budget_update, session_status, error
**Plans**: TBD
**UI hint**: yes

### Phase 7: Question Queue
**Goal**: Question cards have full lifecycle management — TTL countdown, pin, dismiss, used states, animated expiry, max-5 cap, and anti-repeat context fed to QuestionPlanner
**Mode:** mvp
**Depends on**: Phase 6
**Requirements**: QUEUE-01, QUEUE-02, QUEUE-03, QUEUE-04, QUEUE-05, QUEUE-06, QUEUE-07
**Success Criteria** (what must be TRUE):
  1. A queued question card shows a TTL countdown bar that is green above 60%, orange at 30–60%, and red below 30%; when it expires, the card fades and slides out
  2. Clicking the pin button (📌) moves the card to the pinned section with no TTL; clicking dismiss (✕) removes it with animation; clicking used (✓) marks it done
  3. When a 6th question arrives while 5 are already queued, the oldest queued card is automatically dismissed
  4. The QuestionPlanner prompt includes the last 3 queued + pinned + used questions as anti-repeat context; dismissed questions are excluded
**Plans**: TBD
**UI hint**: yes

### Phase 8: Budget Control
**Goal**: Every LLM call is metered, cost accumulates in real time, and the session automatically pauses coverage/alert tasks when the remaining budget would not cover the estimated report cost
**Mode:** mvp
**Depends on**: Phase 6
**Requirements**: BUDGET-01, BUDGET-02, BUDGET-03, BUDGET-04, BUDGET-05, BUDGET-06, BUDGET-07
**Success Criteria** (what must be TRUE):
  1. sessions.cost_usd increments after every LLM call, using the Gemini 2.0 Flash pricing table ($0.0001/1k input, $0.0004/1k output)
  2. When cost_usd approaches the budget limit such that budget_remaining < estimated_report_cost, the _coverage_task and _red_flag_task pause and the budget bar shows a red alert; the report button remains active
  3. The estimated report cost is calculated as current_transcript_tokens × output_factor × 1.20 and displayed in the budget bar
  4. When session.budget_usd is null, the system runs without any limit and the budget bar shows "sem limite"
  5. The budget bar updates every 250ms (every _render_task tick)

### Phase 9: Session Persistence + History
**Goal**: All session data (transcript, coverage snapshots, red flags, questions, reports) is saved to Supabase in real time, and a history screen lets users review completed sessions with full timeline and report
**Mode:** mvp
**Depends on**: Phase 6, Phase 7, Phase 8
**Requirements**: HIST-01, HIST-02, HIST-03, HIST-04, HIST-05, HIST-06, HIST-07, HIST-08, HIST-09
**Success Criteria** (what must be TRUE):
  1. Transcript chunks, coverage snapshots, red flags, questions (with status updates), and generated reports are all present in Supabase immediately after a session ends
  2. sessions.tokens_used and sessions.cost_usd reflect the final values after session close
  3. The history screen lists all sessions for a project ordered newest-first; each card shows date, duration, cost, final coverage status, and red flag count badge
  4. Clicking a session card opens a detail view showing: the full rendered Markdown report, a timeline of alerts with severity, and a coverage area evolution chart
**Plans**: TBD
**UI hint**: yes

### Phase 10: Data Maturity Score
**Goal**: The DMS 1–5 value set on a project visibly changes how all 4 agent prompts are generated and adds a maturity gap section to every report
**Mode:** mvp
**Depends on**: Phase 1, Phase 5
**Requirements**: DMS-01, DMS-02, DMS-03
**Success Criteria** (what must be TRUE):
  1. The project configuration screen has a DMS slider (1–5) with a tooltip showing the level definitions (Inicial / Gerenciado / Definido / Quantificado / Otimizado)
  2. Running the same project type (e.g., ML) at DMS 1 vs DMS 4 produces observably different CoverageClassifier and QuestionPlanner prompts — different criticality thresholds and vocabulary
  3. The generated report includes a "Maturidade atual vs maturidade necessária" section with a gap assessment
**Plans**: TBD
**UI hint**: yes

- [ ] **Phase 11: Precificador Foundation** - DB schema (4 new tables), pricing CRUD API, real-time calculation engine, feature-list UI with inline editing, approval flow that saves to pricing_history
- [ ] **Phase 12: LLM-Powered Suggestions** - Parse diagnosis reports to seed feature list, LLM suggests additional features + hour estimates from approved historical pricings, history seed with past approved examples
- [ ] **Phase 13: Embedded Pricing Chatbot** - Chat panel on pricing screen, LLM context = diagnosis report + history + current feature list, tool calls to apply feature CRUD and input updates from conversation

## Phase Details

### Phase 11: Precificador Foundation
**Goal**: Users can create a pricing for a project, manage a feature list (bloco, funcionalidade, horas), see all calculated outputs in real time, and approve a pricing to save it as a historical snapshot
**Mode:** mvp
**Depends on**: Phase 1 (projects table, Supabase)
**Requirements**: PREC-INF-01, PREC-INF-02, PREC-INF-03, PREC-INF-04, PREC-INF-05, PREC-01, PREC-02, PREC-03, PREC-04, PREC-05, PREC-06, PREC-07
**Success Criteria** (what must be TRUE):
  1. Project configuration screen has new LLM fields: provider (openai/anthropic/google), model name (free text), API key (masked after save); user can update at any time
  2. User can create a pricing from a project page with inputs: data_inicio, num_analistas, horas_por_dia, ticket_preco, dias_corridos_extras
  3. Feature table accepts inline add/edit/remove with columns: Bloco, Funcionalidade, Horas, Dias (calculado), CITI?
  4. All 6 outputs update in real time as features or inputs change: preco_total, data_final, dias_corridos, semanas, meses, sprints
  5. Approving a pricing saves an immutable snapshot to pricing_history; only approved pricings enter the history
  6. Project detail page lists all pricings with status (rascunho/aprovada) and calculated price
  7. Backend pricing service factory instantiates BaseChatModel from project config; swapping provider requires only a config change, zero code change
**Plans**: 4 plans
Plans:
- [ ] 11-01-PLAN.md — Schema migration (4 tables + projects LLM columns) + LangChain packages + PricingCalculator + llm_factory + projects model/router extensions + [BLOCKING] migration apply
- [ ] 11-02-PLAN.md — Project LLM config UI (collapsible section on ProjectFormPage, Nova Precificação on ProjectDetailPage)
- [ ] 11-03-PLAN.md — Pricing CRUD backend (models, routers, approve endpoint, pricing-history endpoint)
- [ ] 11-04-PLAN.md — Pricing editor frontend (pricingCalculator.ts, hooks, PricingListPage, PricingEditorPage, routes)

### Phase 12: LLM-Powered Suggestions
**Goal**: The pricing screen can auto-populate features from diagnosis reports and the LLM suggests additional features with hour estimates learned from approved historical pricings
**Mode:** mvp
**Depends on**: Phase 11
**Requirements**: PREC-08, PREC-09, PREC-10, PREC-11
**Success Criteria** (what must be TRUE):
  1. "Importar do diagnóstico" extracts features from one or more diagnosis reports linked to the project and populates the feature table
  2. "Sugerir funcionalidades" generates at least 3 additional feature suggestions not already in the table, with hour estimates, based on approved history
  3. The LLM prompt correctly includes: diagnosis report text, current feature list, top-3 matching approved pricings from history
  4. History is seeded with at least 7 past approved pricings (from provided examples)
**Plans**: TBD

### Phase 13: Embedded Pricing Chatbot
**Goal**: An embedded chatbot in the pricing screen allows the commercial team to refine the pricing via natural language — discussing the diagnosis, querying the history, and applying edits to the feature table
**Mode:** mvp
**Depends on**: Phase 11, Phase 12
**Requirements**: PREC-12, PREC-13, PREC-14, PREC-15
**Success Criteria** (what must be TRUE):
  1. Chat panel renders alongside the feature table; conversation history is persisted in pricing_chat_messages
  2. User can say "adiciona uma funcionalidade de autenticação OAuth com 20 horas no bloco Geral" and the feature appears in the table
  3. User can say "remove a funcionalidade de deploy" and the feature is removed from the table
  4. User can ask "por que esse projeto está custando R$25k?" and the chatbot explains using the current inputs and outputs
  5. Tool calls (add_feature, remove_feature, update_feature, update_inputs) are applied atomically and immediately reflected in the table

## Progress

**Execution Order:**
Phases 1–10: Agente Diagnóstico (already built). Phases 11–13: Agente Precificador.

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Project Configuration + Supabase Schema | 1/5 | In Progress|  |
| 2–10. Agente Diagnóstico (remaining) | — | Built (state outdated) | — |
| 11. Precificador Foundation | 0/? | Not started | - |
| 12. LLM-Powered Suggestions | 0/? | Not started | - |
| 13. Embedded Pricing Chatbot | 0/? | Not started | - |
