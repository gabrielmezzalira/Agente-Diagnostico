# Requirements — Extracted from SPEC (CLAUDE.md)

Source: SDD v2.0, Section 4 (Features), Section 7 (Implementation Order)
Precedence: SPEC

---

## F1 — Project Configuration

- PROJ-01: User can create a project with all required fields (name, client, type, DMS 1-5, pre-meeting context, meeting URL, transcription source, Gemini API key, budget USD, question TTL)
- PROJ-02: User can edit a project at any time; changes do not affect closed sessions
- PROJ-03: Project list shows active-session badge for live projects
- PROJ-04: Gemini API key stored via Supabase Vault (pgsodium), never exposed in frontend
- PROJ-05: Project types: bi, ml, data_engineering, automation, integration, science

## F2 — Session Setup

- SESS-01: User can create a session from a project with pre-filled, editable fields (meeting URL, source, additional context, budget override)
- SESS-02: Backend creates session record with status='active' in Supabase
- SESS-03: When source=taqtic, backend starts WebhookServer and displays public tunnel URL
- SESS-04: When source=recall, backend POSTs to Recall.ai API with meeting_url
- SESS-05: Session creation redirects to monitoring screen (F5)

## F3 — Dynamic Prompt Generation

- PROMPT-01: PromptBuilder generates agent-specific system prompts from project type, pre-meeting context, and DMS
- PROMPT-02: Generated prompts stored in session_prompts table for reproducibility/debugging
- PROMPT-03: Agents use dynamic prompts when project_config available; fall back to v1 SYSTEM_PROMPT constants otherwise
- PROMPT-04: Each agent (CoverageClassifier, RedFlagDetector, QuestionPlanner, DiagnosticAgent) receives tailored inputs as defined in SDD Table 4.3

## F4 — Question Bank

- QBANK-01: question_bank table stores questions mapped by thematic block and project_types array
- QBANK-02: 8 blocks: negocio, eng_dados, visualizacao, ciencia_dados, automacao, integracao, consumo, parceria
- QBANK-03: QuestionPlanner receives filtered questions as context, not as a fixed script
- QBANK-04: Priority field (1=high, 2=medium, 3=low) per question

## F5 — Monitoring Screen

- MON-01: 3-column layout: Coverage (220px fixed) | Live transcript+alerts (flex) | Questions (280px fixed)
- MON-02: Topbar: project name + client, connection status (animated green dot), session timer HH:MM:SS
- MON-03: Budget bar always visible: colored progress (green <60%, yellow 60-80%, red >80%), consumed/limit values, report cost estimate, sufficiency text
- MON-04: Action: Generate questions (P key / green button) — calls QuestionPlanner immediately
- MON-05: Action: Generate report (R key / secondary button) — checks budget, shows modal with report
- MON-06: Action: Force classify (S key / Sync button) — triggers _coverage_task immediately
- MON-07: Action: Finish session (Q key / red button) — confirms, saves as 'finished', redirects to history

## F6 — Question Queue

- QUEUE-01: Question states: queued (TTL countdown), pinned (no expiry), dismissed (immediate remove), used (anti-repeat context)
- QUEUE-02: TTL bar color: green >60% remaining, orange 30-60%, red <30%
- QUEUE-03: Max 5 queued cards simultaneously; oldest auto-dismissed when 6th arrives
- QUEUE-04: QuestionPlanner receives last 3 questions (queued+pinned+used) as anti-repeat context; dismissed questions excluded
- QUEUE-05: Questions expire with fade+slide animation when TTL elapses

## F7 — Budget Control

- BUDGET-01: TokenCounter tracks sent+received tokens per LLM call
- BUDGET-02: Cost accumulated in sessions.cost_usd in real-time (prices: Gemini 2.0 Flash $0.0001/$0.0004 per 1k tokens input/output)
- BUDGET-03: Every coverage_task tick: check budget_remaining >= estimated_report_cost × 1.2
- BUDGET-04: When budget insufficient: stop _coverage_task and _red_flag_task, show alert in budget bar; report button stays active
- BUDGET-05: Report cost estimated from current transcript buffer tokens × output factor × 1.2 margin

## F8 — Session Persistence & History

- HIST-01: Full transcript saved in transcript_chunks table per session
- HIST-02: Coverage snapshots saved after each classification
- HIST-03: All red flags saved with severity and evidence
- HIST-04: All questions saved with final status
- HIST-05: Generated report(s) saved in reports table
- HIST-06: Session tokens_used and cost_usd saved and updated in real-time
- HIST-07: History screen: sessions list per project, ordered by date (newest first)
- HIST-08: Session card: date, duration, cost, final coverage status, red flags count
- HIST-09: Session detail: full report, alert timeline, coverage evolution

## F9 — URL Exposure (Tunnel)

- TUNNEL-01: Backend detects cloudflared or ngrok on PATH at session start (cloudflared preferred)
- TUNNEL-02: Tunnel started pointing to localhost:8765, public URL displayed in setup screen and monitoring topbar
- TUNNEL-03: Tunnel killed when session is finished
- TUNNEL-04: Command: `cloudflared tunnel --url http://localhost:8765`

## F10 — Data Maturity Score

- DMS-01: DMS is a 1-5 slider set per project on project configuration screen
- DMS-02: DMS calibrates CoverageClassifier (areas/criticality vary by level), RedFlagDetector (sensitivity), QuestionPlanner (vocabulary complexity), DiagnosticAgent (interview focus)
- DMS-03: ReportGenerator includes "current maturity vs required maturity" section

---

## Database Schema (from SPEC Section 3)

Tables: projects, sessions, questions, red_flags, coverage_snapshots, reports, question_bank, session_prompts, transcript_chunks

## API Endpoints (from SPEC Section 5)

Full REST API on FastAPI:
- GET/POST/PUT/DELETE /projects
- POST/GET /sessions, POST /sessions/:id/finish, POST /sessions/:id/questions/generate, POST /sessions/:id/report
- PATCH /questions/:id
- GET /question-bank
- POST /webhook/taqtic, POST /webhook/recall

## WebSocket (from SPEC Section 6)

ws://localhost:8000/ws/{session_id}
Backend→Frontend: coverage_update, red_flag, question_new, question_expired, transcript_chunk, budget_update, session_status, error
Frontend→Backend: generate_questions, force_classify, pin/dismiss/use question, generate_report, finish_session

## v1 → v2 Migration (from SPEC Section 9)

- llm/gemini_client.py: migrate google-generativeai → google.genai
- prompts.py: PromptBuilder class with v1 constants as fallback
- config.py: ProjectConfig extending Config
- conversation.py: optional session_id → persist chunks to Supabase
- report.py: save to reports table when session_id available
- agent.py: inject prompt_builder, use dynamic prompt when project_config present
- main.py: add --ui web flag
- requirements.txt: add fastapi, uvicorn, supabase-py, google-genai; remove google-generativeai
