---
phase: 08-taqciti-session-association
plan: 08
subsystem: projects-gemini-key-optional
status: in-progress
requirements-completed: []
---

# Phase 8 Plan 08: Chave Gemini opcional na criação de projeto (registro da decisão B2)

## Task 1: Decisão B2 (respondida pelo time, registrada literalmente)

- **Resposta B2:** `aprovar-sem-env` (2026-10-12): a chave Gemini do projeto pode ser retirada/opcional; `GEMINI_API_KEY` NÃO está configurada no Railway ainda.
- **`GEMINI_API_KEY` no Railway?** NÃO. Vira pendência bloqueante do teste manual D-20 e do deploy.
- **pdf-fallback:** `sim` (2026-10-12): a importação de PDF (`routers/sessions.py`, `upload_pdf_transcript`) passa a usar `GEMINI_API_KEY` do servidor quando o projeto não tem chave própria; vai em commit separado (commit b do plano), porque muda uma rota existente. Sem chave no projeto E sem a env, continua 503 como hoje.
- **Fonte:** `08-DECISOES-PENDENTES.md`, seção "B2".

## Lembrete bloqueante

> **TEM QUE CRIAR `GEMINI_API_KEY` NO RAILWAY** antes de qualquer deploy, merge na `master` ou junção com o AGM.
> Sem ela, projetos sem chave própria não rodam o pipeline de IA nem a importação de PDF.
