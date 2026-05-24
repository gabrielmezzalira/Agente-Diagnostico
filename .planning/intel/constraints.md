# Constraints — Synthesized from SPEC + ADR

## Technology Stack (locked by SPEC + existing codebase)

- **Frontend**: React + Vite + TypeScript + Tailwind CSS
- **Backend**: Python + FastAPI + Uvicorn
- **Database**: Supabase (PostgreSQL) with Supabase Vault for secrets
- **LLM**: Google Gemini (configurable per project) — migrate to google.genai SDK
- **Transcription**: Taqtic (Chrome extension webhook) or Recall.ai (cloud bot)
- **Tunnel**: cloudflared (preferred) or ngrok

## Concurrency Model (locked by ADR)

- Realtime pipeline uses 6 asyncio tasks; no LangChain/LangGraph
- All LLM calls must use asyncio.to_thread()
- WebhookServer uses aiohttp AppRunner pattern (not web.run_app) to share the event loop

## API Key Security

- Gemini API key must never be exposed in the frontend
- Must be stored via Supabase Vault (pgsodium column encryption)

## v1 Compatibility

- main.py entry point preserved
- --ui web activates new frontend; CLI terminal mode remains intact
- v1 prompts.py constants kept as internal fallback for PromptBuilder

## Budget Limits (from SDD)

- Per-project budget configurable (null = no limit)
- Session inherits project budget or overrides it
- Automatic stop when budget_remaining < estimated_report_cost

## WebSocket

- Connection: ws://localhost:8000/ws/{session_id}
- Render interval: 250ms (_render_task)
- Coverage classification: 30s or 250 new tokens
- Red flag detection: 15s fixed timer

## Question Queue

- Max 5 queued questions at once
- Default TTL: 30 seconds (configurable per project)
