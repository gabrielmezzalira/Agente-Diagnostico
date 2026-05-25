# Requirements — Agente Diagnóstico v2.0

Source: CLAUDE.md SDD v2.0, TECNOLOGIAS.md ADR
Generated: 2026-05-24 via gsd-ingest-docs

---

## v1 Requirements (Active — building now)

### F1 — Project Configuration

- [ ] **PROJ-01**: User can create a project with: name, client, description, project type (bi/ml/data_engineering/automation/integration/science), Gemini API key, budget USD, DMS 1-5, pre-meeting context, meeting URL, transcription source (taqtic/recall), question TTL seconds
- [ ] **PROJ-02**: User can edit a project at any time; edits do not affect sessions already closed
- [ ] **PROJ-03**: Project list displays active-session green badge for projects with live sessions
- [ ] **PROJ-04**: Gemini API key stored via Supabase Vault (pgsodium); masked in UI after save; re-entry required to update
- [x] **PROJ-05**: Supabase schema initialized: tables projects, sessions, questions, red_flags, coverage_snapshots, reports, question_bank, session_prompts, transcript_chunks

### F2 — Session Setup

- [ ] **SESS-01**: User can create a session from a project; fields pre-filled from project, all editable (meeting URL, source, additional context, session-specific budget)
- [ ] **SESS-02**: Backend creates session record in Supabase with status='active' on confirmation
- [ ] **SESS-03**: When source=taqtic: backend starts tunnel and shows public URL in setup screen
- [ ] **SESS-04**: When source=recall: backend POSTs to Recall.ai API with meeting_url; bot joins the call
- [ ] **SESS-05**: Setup confirmation redirects to monitoring screen (F5)

### F9 — Tunnel (URL Exposure)

- [ ] **TUNNEL-01**: Backend detects cloudflared or ngrok on PATH at session start; cloudflared is preferred
- [ ] **TUNNEL-02**: Tunnel started pointing at localhost:8765; public URL displayed in setup screen and monitoring topbar
- [ ] **TUNNEL-03**: Tunnel terminated when session finishes (Q action or API /sessions/:id/finish)

### F4 — Question Bank

- [ ] **QBANK-01**: question_bank table seeded with questions per thematic block: negocio, eng_dados, visualizacao, ciencia_dados, automacao, integracao, consumo, parceria
- [ ] **QBANK-02**: Each question maps to one or more project_types array; priority field (1=high, 2=medium, 3=low)
- [ ] **QBANK-03**: GET /question-bank?project_type=&block= returns filtered questions
- [ ] **QBANK-04**: QuestionPlanner receives filtered bank questions as context (not fixed script)

### F3 — Dynamic Prompt Generation

- [ ] **PROMPT-01**: PromptBuilder class replaces static prompts.py constants; method `build(agent, project_config) -> str`
- [ ] **PROMPT-02**: v1 SYSTEM_PROMPT and CLASSIFIER_SYSTEM_PROMPT kept as internal PromptBuilder fallback
- [ ] **PROMPT-03**: At session start, PromptBuilder generates prompts for: CoverageClassifier, RedFlagDetector, QuestionPlanner, DiagnosticAgent
- [ ] **PROMPT-04**: Generated prompts stored in session_prompts table (for reproducibility and debugging)
- [ ] **PROMPT-05**: CoverageClassifier prompt: activates areas relevant to project type, adjusts criticality by DMS
- [ ] **PROMPT-06**: RedFlagDetector prompt: includes red flags specific to known pre-meeting context, calibrates sensitivity by DMS
- [ ] **PROMPT-07**: QuestionPlanner prompt: prioritizes questions from bank by project type, adapts vocabulary to DMS
- [ ] **PROMPT-08**: DiagnosticAgent prompt: focuses interview on highest-risk areas for the given project type

### F5 — Monitoring Screen

- [ ] **MON-01**: 3-column layout: Coverage panel (220px fixed) | Live feed (flex) | Questions panel (280px fixed)
- [ ] **MON-02**: Topbar: project name + client name, animated green status dot + "ao vivo" text, session timer HH:MM:SS
- [ ] **MON-03**: Budget bar below topbar: colored progress bar (green <60%, yellow 60-80%, red >80%), "consumed / limit" values, report cost estimate text, sufficiency indicator
- [ ] **MON-04**: Coverage column: list of risk areas with status color (red/yellow/green/gray) and per-area progress bar
- [ ] **MON-05**: Live column: scrolling transcript chunks + red flag alerts with severity badge
- [ ] **MON-06**: Questions column: queued question cards with TTL bar + pinned questions section + "Generate Now" button
- [ ] **MON-07**: Action — Generate questions: triggers QuestionPlanner immediately (P key / green primary button)
- [ ] **MON-08**: Action — Generate report: checks budget sufficiency, generates report via ReportGenerator, shows modal (R key / secondary button)
- [ ] **MON-09**: Action — Force classify: triggers _coverage_task immediately (S key / Sync button)
- [ ] **MON-10**: Action — Finish session: confirms, marks session 'finished', redirects to history (Q key / red button)
- [ ] **MON-11**: WebSocket connection to ws://localhost:8000/ws/{session_id}; handles all backend event types

### F6 — Question Queue

- [ ] **QUEUE-01**: Question card states: queued (TTL countdown bar), pinned (no TTL, separate section), dismissed (fade+slide out), used (marked done, excluded from anti-repeat only)
- [ ] **QUEUE-02**: TTL bar color: green >60% remaining, orange 30-60%, red <30%; expires with fade+slide animation
- [ ] **QUEUE-03**: Maximum 5 queued cards simultaneously; when 6th arrives, oldest queued card auto-dismissed
- [ ] **QUEUE-04**: QuestionPlanner receives last 3 (queued + pinned + used) questions as anti-repeat context; dismissed excluded
- [ ] **QUEUE-05**: User can pin a question (📌) → moves to pinned section, no TTL
- [ ] **QUEUE-06**: User can dismiss a question (✕) → immediate removal with animation
- [ ] **QUEUE-07**: User can mark question as used (✓) → status='used', registered for anti-repeat

### F7 — Budget Control

- [ ] **BUDGET-01**: TokenCounter tracks tokens_in and tokens_out per LLM call and accumulates to sessions.cost_usd
- [ ] **BUDGET-02**: Pricing table (Gemini 2.0 Flash: $0.0001/1k input, $0.0004/1k output) applied per call
- [ ] **BUDGET-03**: Every _coverage_task tick: check budget_remaining >= estimated_report_cost; if not, pause _coverage_task and _red_flag_task
- [ ] **BUDGET-04**: Report cost estimated as: current_transcript_tokens × output_factor × 1.20 margin
- [ ] **BUDGET-05**: Budget bar updated every 250ms (every _render_task tick)
- [ ] **BUDGET-06**: When budget insufficient: alert shown in budget bar, report button remains active
- [ ] **BUDGET-07**: session.budget_usd=null means no limit (unlimited mode)

### F8 — Session Persistence & History

- [ ] **HIST-01**: Transcript chunks saved to transcript_chunks table in real-time as they arrive
- [ ] **HIST-02**: coverage_snapshots saved after each _coverage_task completion
- [ ] **HIST-03**: red_flags saved immediately on detection with severity + evidence text
- [ ] **HIST-04**: questions saved with generated_at and expires_at; status updated on pin/dismiss/use
- [ ] **HIST-05**: Generated reports saved to reports table with markdown_content and cost_usd
- [ ] **HIST-06**: session.tokens_used and session.cost_usd updated in real-time
- [ ] **HIST-07**: History screen: list of sessions per project, ordered newest-first
- [ ] **HIST-08**: Session card shows: date, duration, cost, final coverage status, red flag count badge
- [ ] **HIST-09**: Session detail view: full report markdown rendered, alert timeline, coverage area evolution chart

### F10 — Data Maturity Score

- [ ] **DMS-01**: DMS slider 1-5 on project configuration screen; definitions visible as tooltip (Inicial/Gerenciado/Definido/Quantificado/Otimizado)
- [ ] **DMS-02**: DMS value fed into PromptBuilder for all 4 agents; calibration rules per agent as defined in SDD Section 4.10
- [ ] **DMS-03**: ReportGenerator includes "maturidade atual vs maturidade necessária para o projeto" section

---

## v2 Requirements (Deferred)

- Dynamic report cost estimation (data-driven, after 10 sessions per project type)
- A/B test framework for comparing dynamic vs v1 prompts
- Multi-user / team access (current scope: single-user, local deployment)
- Data contracts / lakehouse features (DMS level 5 advanced projects)

---

## Out of Scope

- LangChain/LangGraph — incompatible with 6-task async pipeline, disproportionate dependency (ADR locked)
- Removing v1 terminal CLI mode — preserved for local/dev use
- --resolve interactive in ingest-docs — reserved for future release
- Real-time cost learning in v2.0 — static estimation only in this version

---

## Traceability

| REQ-ID Group | Phase | ROADMAP Phase |
|------|-------|---------------|
| PROJ-01 to PROJ-05 | F1 Project Config | Phase 1 |
| SESS-01 to SESS-05 | F2 Session Setup | Phase 2 |
| TUNNEL-01 to TUNNEL-03 | F9 Tunnel | Phase 3 |
| QBANK-01 to QBANK-04 | F4 Question Bank | Phase 4 |
| PROMPT-01 to PROMPT-08 | F3 Dynamic Prompts | Phase 5 |
| MON-01 to MON-11 | F5 Monitoring | Phase 6 |
| QUEUE-01 to QUEUE-07 | F6 Question Queue | Phase 7 |
| BUDGET-01 to BUDGET-07 | F7 Budget Control | Phase 8 |
| HIST-01 to HIST-09 | F8 Persistence + History | Phase 9 |
| DMS-01 to DMS-03 | F10 Data Maturity Score | Phase 10 |
