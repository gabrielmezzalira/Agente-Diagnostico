# Discussion Log — Phase 1

**Date**: 2026-05-24
**Areas discussed**: App structure, Design language, Project form UX, API key masking UX

---

## Area 1: React App Structure

| Question | Options | Selected |
|---|---|---|
| Where should the React/Vite app live? | /frontend (root), /diagnostico/frontend/, /web/ | /frontend (root) |
| Where should FastAPI live? | /backend/ (root), /diagnostico/api/, root-level file | /backend/ (root) |
| Dev: frontend → backend communication? | Vite proxy, CORS on FastAPI, You decide | Vite proxy (initially answered CORS, revised to Vite proxy) |
| Prod: how React app is served? | FastAPI serves static files, nginx + uvicorn, You decide | FastAPI serves static files |

## Area 2: Design Language

| Question | Options | Selected |
|---|---|---|
| Carry forward v1 dark aesthetic? | Yes same, Yes modernized, Fresh start | Yes same (later revised — user provided full light theme spec) |
| Font choice? | 100% monospace, Mixed, You decide | 100% monospace (later revised — DM Sans body + DM Mono for data) |

**Note**: User provided a detailed mockup design spec overriding initial "same v1 dark" answer. Final design is a LIGHT theme with DM Sans/DM Mono, green accent (#22a267), neutral grays on #f5f4f0 background. Full spec captured in CONTEXT.md decisions section.

## Area 3: Project Form UX

| Question | Options | Selected |
|---|---|---|
| Form layout for 11 fields? | Single scrollable with sections, Two-tab, Multi-step wizard | Single scrollable with sections |
| Home screen layout? | Card grid, Table/list, You decide | Card grid |
| Project type selector? | Icon cards/pills, Select dropdown, Radio buttons | Icon cards/pills |

## Area 4: API Key Masking UX

| Question | Options | Selected |
|---|---|---|
| Edit mode field behavior? | Dots + Alterar chave button, Always empty on edit, Revealed on hover | Dots + Alterar chave button |
| New key confirmation? | No confirmation (save immediately), Test key before save, Confirm modal | No confirmation |

---

## Claude Discretion Items

- Supabase Vault details (pgsodium column) — defined by SDD, no ambiguity
- Specific section names for the form (e.g., "Identificação", "Configuração de IA", "Reunião") — Claude to decide during planning
- DMS slider tooltip text — use SDD Section 4.10 level definitions
