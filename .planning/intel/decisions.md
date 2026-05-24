# Decisions — Synthesized from SPEC + ADR

## LOCKED (from ADR — do not override without new ADR)

- **No LangChain/LangGraph**: The realtime pipeline runs 6 concurrent tasks (render 0.25s, coverage 30s, red_flag 15s, watchdog 10s, ingestion continuous, web_command polling). LangGraph is sequential/conditional — it has no primitive for this concurrency pattern. asyncio handles it natively. Adding LangChain would replace one simple LLMClient class with a ~100-package framework for zero benefit.

- **SDK migration to google.genai**: `google-generativeai` is deprecated by Google. Only `llm/gemini_client.py` changes — the rest of the codebase is unaffected. This is a required migration for v2.

- **asyncio.to_thread() for LLM calls**: All `llm.generate()` calls must be wrapped in `asyncio.to_thread()` inside coroutines. Direct calls block the event loop, freezing the UI for 1–5 seconds.

## OPEN (from SPEC — decisions to be made during planning)

- **Prompt quality vs dynamic generation**: Dynamic prompts from PromptBuilder may be lower quality than hand-crafted v1 constants. Decision: keep v1 prompts as internal fallback; test dynamic prompts via A/B before full replacement.

- **Report cost estimation strategy**: Static estimation (tokens × factor × 1.2 margin) may be inaccurate. After 10 sessions, replace with rolling average by project type.

- **Supabase Vault for Gemini API key**: Never expose key in frontend. Use pgsodium-backed Vault column.

- **v1/v2 coexistence**: `main.py` entry point preserved; `--ui web` activates new frontend. CLI mode remains intact for local use.

- **TTL default for questions**: 30 seconds default, configurable per project. Adjust after initial user testing.

- **cloudflared preferred over ngrok**: cloudflared is free, no account required, temporary URLs. ngrok requires account. Both supported; detect via PATH.
