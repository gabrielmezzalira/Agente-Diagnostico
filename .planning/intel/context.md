# Context — Agente Diagnóstico v2.0

## What Exists (v1 — Already Built)

A fully functional v1 system in `./diagnostico/`:
- `agent.py` — DiagnosticAgent (interactive terminal interview mode)
- `realtime_agent.py` — RealtimeOrchestrator (6 concurrent asyncio tasks)
- `llm/gemini_client.py` — GeminiClient (google-generativeai SDK, deprecated, needs migration)
- `llm/claude_client.py` — ClaudeClient (alternative LLM)
- `coverage/classifier.py` — CoverageClassifier (area risk classification)
- `analysis/red_flag.py` — RedFlagDetector
- `analysis/question_planner.py` — QuestionPlanner
- `report.py` — ReportGenerator (saves to local file)
- `transcription/webhook_server.py` — WebhookServer (aiohttp, :8765)
- `transcription/taqtic.py`, `recall_source.py` — transcription sources
- `prompts.py` — SYSTEM_PROMPT, CLASSIFIER_SYSTEM_PROMPT (static constants)
- `config.py` — Config (env var based)
- `conversation.py` — ConversationManager
- `ui/renderer.py` — CLIRenderer (rich terminal UI)
- `ui/web_renderer.py` — WebRenderer (WebSocket to browser)
- `main.py` — entry point

## What v2 Adds

1. **React web frontend** (full monitoring UI replacing the terminal renderer)
2. **FastAPI REST API** (project/session/question management)
3. **Supabase persistence** (projects, sessions, questions, red_flags, coverage_snapshots, reports, question_bank, session_prompts)
4. **Dynamic prompt generation** (PromptBuilder replaces static prompts.py constants)
5. **Question bank** (thematic blocks per project type, seeded in question_bank table)
6. **Budget control** (real-time token tracking and automatic pause)
7. **Question queue UI** (pin/dismiss/TTL with animations)
8. **Session history** (view past sessions with reports and timelines)
9. **Tunnel management** (auto-start cloudflared/ngrok for Taqtic)
10. **Data Maturity Score** (1-5 scale, calibrates all agents)

## Team Context

- CITi (Centro de Informática de Tecnologia e Informação) — university IT consultancy
- Subárea de Dados — data team
- Use case: sales team uses the agent during client pre-contract meetings to detect technical risks before project execution begins
- May 2026 development timeline

## Known Risks (from SDD Section 8)

1. Dynamic prompts may be lower quality than v1 hand-crafted constants → A/B before full replacement
2. Report cost estimation is static → improve after 10 sessions of data
3. Gemini API key security → Supabase Vault required
4. cloudflared tunnel latency → must be < 500ms round-trip with Taqtic
5. TTL calibration → 30s default, adjust after user testing
