# Agente Diagnóstico

## What This Is

A pre-sales technical risk detection system for CITi's data team. It acts as a senior tech lead interrogating projects before contract signing, surfacing technical risks through structured AI-driven interviews. Operates in two modes: interactive terminal (sales person describes project, agent asks questions one at a time) and realtime web (agent monitors a live meeting via audio transcription, classifies risk areas, fires alerts, and suggests questions to the sales person in real time).

## Core Value

The sales team can identify and communicate technical risks to the client **before** the contract is signed, avoiding costly project failures during execution.

## Requirements

### Validated

- ✓ Interactive terminal interview mode (DiagnosticAgent + CLIRenderer) — v1
- ✓ Realtime monitoring pipeline (6 asyncio tasks: coverage 30s, red_flag 15s, watchdog 10s, render 0.25s, ingestion, web_command) — v1
- ✓ CoverageClassifier — LLM classifies risk areas from transcript — v1
- ✓ RedFlagDetector — LLM emits up to 2 alerts per window — v1
- ✓ QuestionPlanner — LLM generates contextual questions — v1
- ✓ ReportGenerator — LLM produces Markdown report, saves to local file — v1
- ✓ WebhookServer (aiohttp :8765) — receives Taqtic/Recall.ai transcription chunks — v1
- ✓ GeminiClient wrapping google-generativeai SDK (deprecated; migration to google.genai required for v2) — v1

### Active

- [ ] F1: Project configuration CRUD (UI + Supabase schema for all 9 tables)
- [ ] F2: Session setup flow (create session, pre-fill from project, redirect to monitoring)
- [ ] F9: Tunnel URL exposure (cloudflared/ngrok auto-start, public URL displayed)
- [ ] F4: Question bank (thematic blocks per project type, seeded data)
- [ ] F3: Dynamic prompt generation (PromptBuilder class, prompts stored in session_prompts)
- [ ] F5: Monitoring screen (React 3-column layout, WebSocket, budget bar, actions)
- [ ] F6: Question queue (pin/dismiss/TTL/used states, anti-repeat, max 5 queued)
- [ ] F7: Real-time budget control (TokenCounter, auto-stop, cost estimation)
- [ ] F8: Session persistence and history (full transcript, snapshots, timeline view)
- [ ] F10: Data Maturity Score (1-5 slider, calibrates all agents, maturity section in report)

### Out of Scope

- LangChain/LangGraph — async concurrency pattern incompatible with 6-task pipeline; adds 100+ packages for no gain. (ADR)
- Removing v1 terminal CLI mode — --ui web adds web mode; CLI must stay intact for local use
- --resolve interactive in ingest-docs — reserved for future release
- Dynamic cost learning in v2.0 — static estimation first; data-driven estimation after 10 sessions

## Context

Built by CITi Subárea de Dados (university IT consultancy), May 2026. The v1 system (terminal-only, Recall.ai transcription) is production-ready. V2 adds a complete web interface, Supabase persistence, per-project configuration, and dynamic AI prompting calibrated to client data maturity level.

Existing codebase in `./diagnostico/`:
- All core Python modules exist and work
- Needs: FastAPI REST layer, React frontend, Supabase integration, PromptBuilder, question bank seeding
- Critical migration: `llm/gemini_client.py` must switch from `google-generativeai` to `google.genai`

## Constraints

- **Tech stack**: React + Vite + TS + Tailwind (frontend), Python + FastAPI + Uvicorn (backend), Supabase PostgreSQL + Vault (DB), Google Gemini via google.genai (LLM) — fixed by SPEC
- **Concurrency**: asyncio native; no LangChain/LangGraph (ADR — locked)
- **Security**: Gemini API key stored in Supabase Vault (pgsodium); never in frontend
- **Compatibility**: v1 CLI mode preserved; `main.py --ui web` activates new frontend
- **Tunnel**: cloudflared preferred over ngrok (free, no account required)

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| No LangChain/LangGraph | 6 concurrent async tasks don't fit LangGraph sequential model; asyncio is simpler and sufficient (ADR) | — Pending |
| google.genai over google-generativeai | Old SDK deprecated by Google; migration only touches llm/gemini_client.py (ADR) | — Pending |
| asyncio.to_thread() for all LLM calls | Direct LLM calls block event loop for 1-5s, freezing realtime UI (ADR) | — Pending |
| cloudflared > ngrok for tunnel | Free, no account required, temporary URLs; ngrok requires account (SPEC) | — Pending |
| PromptBuilder with v1 constants as fallback | Dynamic prompts may be lower quality initially; A/B test before full replacement (SPEC) | — Pending |
| 30s default TTL for question queue | Balance between question freshness and frustration from too-short TTL; calibrate after user testing (SPEC) | — Pending |
| Supabase Vault for API key storage | pgsodium column encryption; key never exposed in frontend (SPEC) | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd:complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-05-24 after gsd-ingest-docs initialization*
