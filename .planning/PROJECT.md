# Agente Diagnóstico

## What This Is

An AI **discovery assistant** for CITi's Produto and Dados teams, present in live discovery calls. Transcript is captured from Google Meet via **Taqciti** and streamed to the backend; two coordinated agents analyze it in real time — **Produto** (primary: maps the bottleneck, the frente de atuação, user impact, the full process flow, and what is viable to pass to delivery) and **Dados** (auxiliary: sources, data quality, metrics, LGPD/security, solution approach GenAI/ML/other, quick wins). Both feed a single question queue, raise lens-tagged red flags, and produce one complete discovery document that feeds pricing (Precificador). The system was originally built as a pre-sales technical-risk tool ("sales mode"), which is retained behind a mode flag; the current milestone pivots it to discovery.

## Core Value

Discovery teams map the bottleneck and its solution **completely during the call**, so nothing unmapped surprises delivery — and the discovery output feeds pricing directly.

## Current Milestone: v3.0 Pivot Discovery

**Goal:** Pivot the agent from sales-acceleration to a live discovery assistant integrated with Taqciti, covering the Produto and Dados lenses, producing a discovery document that feeds pricing (MVP vertical slice, real Meet call).

**Target features:**
- Discovery mode + single coverage-area registry (Produto + Dados lenses), sales mode retained behind a flag
- Two coordinated agents (Produto primary, Dados auxiliary) sharing one lens-tagged question queue
- Discovery report with a "Métricas para Precificação" section feeding `import-from-diagnosis`
- Taqciti live streaming as the transcription source; retire the duplicated custom extension

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
- ✓ F1–F10 v2 web app: project config CRUD, session setup, dynamic PromptBuilder, question bank, monitoring screen (WebSocket 3-column), question queue (pin/dismiss/TTL), budget control, session persistence/history, Data Maturity Score — v2.0
- ✓ Agente Precificador: pricing CRUD + calc engine, LLM feature suggestions, LangGraph pricing chatbot, diagnostic→pricing handoff (import-from-diagnosis), CITi Flow integration — v2.0
- ✓ Chrome extension: Google Meet caption capture → `/webhook/extension` streaming ingestion — v2.0

### Active

<!-- Milestone v3.0 — Pivot Discovery. See REQUIREMENTS.md for full list. -->

- [ ] DISC: Discovery mode (project mode flag, discovery coverage areas, discovery framing, single area registry)
- [ ] LENS: Two coordinated agents — Produto (primary) + Dados (auxiliary) — one shared question queue, lens tagging
- [ ] REP: Discovery report with "Métricas para Precificação" section feeding the Precificador
- [ ] UI: Two-lens monitoring (coverage grouped by lens, lens badges, server-driven areas)
- [ ] TAQ: Taqciti live streaming as transcription source; retire custom extension

### Out of Scope

- LangChain/LangGraph in Diagnóstico — async concurrency pattern incompatible with the pipeline; retained only for Precificador. (ADR)
- Removing v1 terminal CLI mode (`diagnostico/`) — kept as legacy offline tool
- Deleting sales mode / CITi sales knowledge (CITI_PORTFOLIO) — kept behind the `mode` flag until discovery is validated
- Real per-user authentication for the transcription webhook — MVP uses an opt-in shared secret; full auth is a separate backlog decision (PLANO_AJUSTES Task 2)
- Multi-provider transcription beyond Google Meet (Zoom/Teams) — Recall.ai remains the optional fallback; not in this milestone
- Dynamic cost learning — static estimation first; data-driven estimation later

## Context

Built by CITi Subárea de Dados (university IT consultancy), May 2026. The v1 system (terminal-only, Recall.ai transcription) is production-ready. V2 adds a complete web interface, Supabase persistence, per-project configuration, and dynamic AI prompting calibrated to client data maturity level.

Existing codebase in `./diagnostico/`:
- All core Python modules exist and work
- Needs: FastAPI REST layer, React frontend, Supabase integration, PromptBuilder, question bank seeding
- Critical migration: `llm/gemini_client.py` must switch from `google-generativeai` to `google.genai`

## Constraints

- **Tech stack**: React + Vite + TS + Tailwind (frontend), Python + FastAPI + Uvicorn (backend), Supabase PostgreSQL + Vault (DB) — fixed by SPEC
- **LLM — Diagnóstico**: `google.genai` direto, sem LangChain/LangGraph (ADR locked — incompatível com 6 tasks asyncio concorrentes)
- **LLM — Precificador**: LangChain + LangGraph obrigatório (chatbot com tool calls; abstração permite trocar provider/modelo por config)
- **SOLID + Modularização**: todo código segue princípios SOLID; routers só roteiam, services só orquestram lógica, repositories isolam acesso ao banco — ver seção de Princípios de Arquitetura no CLAUDE.md
- **Security**: API keys (Gemini, Precificador LLM) armazenadas via Supabase Vault (pgsodium); nunca expostas no frontend
- **Compatibility**: v1 CLI mode preserved; `main.py --ui web` activates new frontend
- **Tunnel**: cloudflared preferred over ngrok (free, no account required)

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| No LangChain/LangGraph (Diagnóstico) | 6 concurrent async tasks don't fit LangGraph sequential model; asyncio is simpler and sufficient (ADR — scope: Diagnóstico only) | — Locked |
| LangChain + LangGraph (Precificador) | Chatbot with tool calls + model provider switching require the abstraction layer; SOLID compliance requires DI-friendly BaseChatModel interface | — Locked |
| google.genai over google-generativeai | Old SDK deprecated by Google; migration only touches llm/gemini_client.py (ADR) | — Pending |
| asyncio.to_thread() for all LLM calls | Direct LLM calls block event loop for 1-5s, freezing realtime UI (ADR) | — Pending |
| cloudflared > ngrok for tunnel | Free, no account required, temporary URLs; ngrok requires account (SPEC) | — Pending |
| PromptBuilder with v1 constants as fallback | Dynamic prompts may be lower quality initially; A/B test before full replacement (SPEC) | — Pending |
| 30s default TTL for question queue | Balance between question freshness and frustration from too-short TTL; calibrate after user testing (SPEC) | — Pending |
| Supabase Vault for API key storage | pgsodium column encryption; key never exposed in frontend (SPEC) | — Pending |
| Pivot sales → discovery, keep sales behind `mode` flag | Company now requires every solution to pass through discovery; deleting sales framing is irreversible, so gate it (Open/Closed) until discovery is validated (v3.0) | — Pending |
| Two agents only at the question stage (coverage + red-flags stay 1×) | Produto/Dados biases diverge only in questions; keeps LLM cost near 1× while honoring "dois agentes" (v3.0) | — Pending |
| Adopt Taqciti capture engine + add live streaming; retire custom extension | Taqciti is the more complete/tested Meet capturer (speakers + timestamps + roster); both scraped Meet, so removing the custom extension kills duplication (v3.0) | — Pending |
| Single coverage-area registry (kill 8 hardcoded areas) | 8 areas were duplicated across 6 files; a registry is the SOLID seam that lets discovery areas coexist with sales areas (v3.0) | — Pending |

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
*Last updated: 2026-09-19 after starting milestone v3.0 (Pivot Discovery)*
