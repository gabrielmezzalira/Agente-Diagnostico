# Phase 1 Context — Project Configuration + Supabase Schema

**Phase**: 1
**Name**: Project Configuration + Supabase Schema
**Date**: 2026-05-24
**Status**: Ready for planning

---

<domain>
Users can create, view, and edit projects in the web UI, with all project data persisted in Supabase. The full 9-table schema is initialized and live. This phase also establishes the React/Vite + FastAPI + Supabase foundation that all subsequent phases build on.
</domain>

---

<decisions>

## Repository Structure

- React/Vite app lives at top-level `/frontend/` (not inside `/diagnostico/`)
- FastAPI backend lives at top-level `/backend/` (not inside `/diagnostico/`)
- `/diagnostico/` stays untouched as the v1 Python module — no changes to it in Phase 1
- Dev: Vite proxy forwards `/api/*` → `localhost:8000` (configured in `vite.config.ts`)
- Prod: FastAPI serves built React static files from `/frontend/dist` via `StaticFiles` mount

## Design System — LIGHT THEME (from user mockup)

> ⚠️ This replaces the v1 dark GitHub aesthetic. The v2 React app uses a clean light design.

### Colors
```
Background page:    #f5f4f0
Surface (cards/topbar): #ffffff
Border standard:    #e8e6e0  (1px solid)
Border hover:       #cccccc
Text primary:       #1a1a1a
Text secondary:     #888888
Accent green:       #22a267
Green BG light:     #f0faf5
Green BG tag:       #edfaf3
Red:                #d43a3a
Yellow/warning:     #e8a020
Red BG light:       #fff5f5
Yellow BG light:    #fff8f0
```

### Typography
```
Font primary:  DM Sans (400, 500)     — all UI text
Font mono:     DM Mono (400, 500)     — timer, budget values, code/tokens
Sizes:
  labels uppercase: 10px, weight 600, letter-spacing 0.1em
  small text:       12px
  body:             13–14px
  section headings: nothing above 14px
```

### Layout — Monitoring Screen (Phase 6 reference, established now in Tailwind config)
```
Topbar:       height 52px, bg #fff, border-bottom 1px #e8e6e0
Budget bar:   ~36px, below topbar, bg #fff, border-bottom 1px #e8e6e0
3 columns:    220px fixed | flex:1 | 280px fixed
              border-right 1px #e8e6e0 between columns
              overflow-y: auto per column
              padding: 16px internal
```

### Components

**Coverage cards (left column):**
```
bg: #fff, border: 1px solid #e8e6e0, border-radius: 8px, padding: 10px 12px
hover: border-color #cccccc
Status dots: 8px, border-radius 50%
  red:    #d43a3a
  yellow: #e8a020
  green:  #22a267
  gray:   #cccccc
Mini progress bar: height 3px, bg #f0ede6, border-radius 99px
```

**Alerts (center column):**
```
warning:  bg #fff8f0, border 1px solid #f0d8b0, border-left 3px solid #e8a020, border-radius 6px
critical: bg #fff5f5, border 1px solid #f0b8b8, border-left 3px solid #d43a3a
```

**Question cards (right column):**
```
queued:  bg #f5fdf9, border 1px solid #a8dfc2
         entry animation: slideIn (opacity 0→1, translateY -8px→0, 300ms)
pinned:  bg #fff, border 1px solid #22a267
TTL bar: height 2px, at card bottom
  green  > 60% TTL remaining
  orange   30–60%
  red    < 30%
Block tag (Negócio, Integração etc):
  bg #edfaf3, color #22a267, font 10px weight 600 uppercase, padding 2px 6px, border-radius 4px
Pin/dismiss buttons: 26×26px, border-radius 6px, border 1px #e8e6e0
  pin hover:    bg #edfaf3, color #22a267, border #a8dfc2
  dismiss hover: bg #fff5f5, color #d43a3a, border #f0b8b8
```

**Budget bar:**
```
height 6px, border-radius 99px
fill green:   #22a267  (< 60% used)
fill yellow:  #e8a020  (60–80% used)
fill red:     #d43a3a  (> 80% used)
values: font DM Mono 12px, color #888; current value in #1a1a1a weight 500
```

**Action buttons:**
```
height ~34px, border-radius 7px, font 13px weight 500
Primary (Gerar perguntas): bg #22a267, color #fff, border #22a267; hover bg #1a8a56
Secondary (Relatório, Sync): bg #fff, color #1a1a1a, border 1px solid #e0ddd6; hover bg #f5f4f0
Danger (Encerrar): bg #fff, color #d43a3a, border 1px solid #f0b8b8; hover bg #fff5f5
Shortcut badge inside button: font DM Mono 11px, bg #f0ede6, color #888, padding 1px 5px, border-radius 3px
```

**Topbar:**
```
Status dot "ao vivo": 7px, bg #22a267, pulse animation 2s
Timer: font DM Mono 13px, color #888
Separators: color #cccccc
```

## Project Form UX

- **Layout**: Single scrollable form with named sections (e.g., "Identificação", "Configuração de IA", "Reunião")
- **Home screen**: Card grid, 2–3 cards per row. Each card shows: project name, client, type badge, green "ao vivo" badge if active session
- **Project type selector**: Icon cards / pills — 6 clickable items (bi, ml, data_engineering, automation, integration, science). Selected state: cyan/green border highlight. One row if fits, wrapped grid if not.
- **DMS slider**: 1–5 with level labels visible (Inicial / Gerenciado / Definido / Quantificado / Otimizado)

## API Key Masking UX

- **Create mode**: standard password input (type="password"), visible toggle optional
- **Edit mode**: Field shows ●●●●●●●●●● (10 dots placeholder), input is disabled
- **To change**: "Alterar chave" link/button clears the field and re-enables it
- **Save behavior**: No extra confirmation. Saving replaces the key immediately. If invalid, the error surfaces at session start (first Gemini call), not at save time.

## Supabase Schema

All 9 tables as defined in CLAUDE.md SDD Section 3. No additional schema decisions needed — the SDD is the source of truth. Tables: projects, sessions, questions, red_flags, coverage_snapshots, reports, question_bank, session_prompts, transcript_chunks.

Gemini API key stored in `projects.gemini_api_key` via Supabase Vault (pgsodium). Key is never returned to the frontend.

</decisions>

---

<canonical_refs>
- CLAUDE.md — SDD v2.0, Section 3 (DB schema), Section 4 F1 (project config fields and behavior), Section 5 (API contracts for /projects endpoints). MUST read before planning.
- .planning/REQUIREMENTS.md — PROJ-01 through PROJ-05 (Phase 1 requirements with acceptance criteria)
- .planning/PROJECT.md — Key decisions and constraints (especially: google.genai SDK, no LangChain, Supabase Vault for API key)
- .planning/intel/decisions.md — Locked ADR decisions that affect backend architecture
</canonical_refs>

<code_context>
- diagnostico/config.py — existing Config dataclass pattern (frozen, dotenv-based). The new backend/config.py or ProjectConfig should extend this pattern.
- diagnostico/frontend/index.html — v1 UI. Design tokens are REPLACED by the new light theme spec above (do not carry forward dark colors).
- diagnostico/requirements.txt — v1 deps (google-generativeai, aiohttp, rich, python-dotenv). Phase 1 backend/requirements.txt adds: fastapi, uvicorn, supabase-py. Does NOT yet add google.genai (that's Phase 5).
- No React components exist yet — greenfield frontend.
- No FastAPI routes exist yet — greenfield backend API layer.
</code_context>

<deferred_ideas>
(none captured)
</deferred_ideas>
