## Conflict Detection Report

### BLOCKERS (0)

(none)

### WARNINGS (0)

(none)

### INFO (2)

[INFO] SDK migration required before any LLM work
  Note: google-generativeai is deprecated. All phases involving LLM calls must use google.genai. Only llm/gemini_client.py changes — the rest of the codebase is unaffected. This is a v2 prerequisite, not a conflict.

[INFO] v1 backend preserved as fallback
  Note: v1 prompts.py constants are kept as PromptBuilder internal fallback. v1 CLI mode (main.py without --ui web) remains functional throughout v2 development. This is a design decision, not a conflict.
