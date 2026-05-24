# Synthesis — Agente Diagnóstico v2.0

Synthesized from: CLAUDE.md (SPEC, primary) + TECNOLOGIAS.md (ADR, locked decisions)
Mode: new-project-from-ingest
Conflicts: none

---

## Project Summary

The Agente Diagnóstico is a pre-sales technical risk detection system for CITi's data team. It acts as a senior tech lead interrogating projects before contract signing, surfacing technical risks through structured AI-driven interviews.

**Two operation modes:**
- **Interactive (terminal)**: sales person describes the project, agent asks one question at a time, sales person types answers manually. Already built in v1.
- **Realtime (web)**: agent monitors a live meeting via audio transcription (Taqtic/Recall.ai), classifies risk areas, fires alerts, and suggests questions in real time. v1 backend exists; v2 adds full web frontend.

## What v2 Builds On

V1 is complete: Python backend with 6 concurrent asyncio tasks, GeminiClient, CoverageClassifier, RedFlagDetector, QuestionPlanner, ReportGenerator, WebhookServer, CLIRenderer. All core intelligence works.

V2 scope: React web UI + FastAPI REST API + Supabase persistence + dynamic prompts + question bank + budget control + question queue + session history + tunnel management + Data Maturity Score.

## Phasing (from SPEC Section 7 — Implementation Order)

The SDD defines 10 features with an explicit dependency-ordered implementation sequence:

| Phase | Feature | Dependency | Verifiable Deliverable |
|-------|---------|------------|----------------------|
| 1 | F1 — Project Config + Supabase schema | — | Create/list/edit projects in UI |
| 2 | F2 — Session Setup | F1 | Create session, see in project list |
| 3 | F9 — Tunnel (URL exposure) | F2 | Public URL shown in setup screen |
| 4 | F4 — Question Bank | F1 | Correct questions injected by type |
| 5 | F3 — Dynamic Prompts | F1, F4 | Different prompts per project type |
| 6 | F5 — Monitoring Screen (base) | F2, F3, WebSocket | Coverage + transcript + alerts live |
| 7 | F6 — Question Queue | F5 | Pin/dismiss/TTL working |
| 8 | F7 — Budget Control | F5 | Budget bar realtime, auto-stop |
| 9 | F8 — Persistence + History | F5, F6, F7 | View report and session timeline |
| 10 | F10 — Data Maturity Score | F1, F3 | DMS affects prompts and report |

## Stack

- Frontend: React + Vite + TypeScript + Tailwind CSS
- Backend: Python + FastAPI + Uvicorn
- Database: Supabase (PostgreSQL + Vault)
- LLM: Google Gemini via google.genai (migrated from google-generativeai)
- Transcription: Taqtic (Chrome extension) / Recall.ai (cloud bot)
- Tunnel: cloudflared (preferred) / ngrok

## Locked Decisions (from ADR)

1. No LangChain/LangGraph — asyncio native concurrency, 6 tasks
2. Migrate to google.genai SDK (google-generativeai deprecated)
3. All LLM calls via asyncio.to_thread()
4. cloudflared preferred over ngrok (free, no account)
5. v1 prompts as PromptBuilder fallback

## Requirements Count

10 feature groups → 44 specific requirements across PROJ, SESS, PROMPT, QBANK, MON, QUEUE, BUDGET, HIST, TUNNEL, DMS prefixes.
Plus: Supabase schema (9 tables), FastAPI API (12 endpoints), WebSocket (8+8 event types), v1 migration (8 files).
