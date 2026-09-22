# Phase 11: Precificador Foundation — Context

**Gathered:** 2026-07-19
**Status:** Ready for planning
**Source:** Direct user specification

<domain>
## Phase Boundary

Build the foundation of the Agente Precificador: database schema, FastAPI CRUD routes, a pure-function calculation engine, and a React UI where users can create a pricing linked to a project, manage a feature list with inline editing, see all 6 outputs recalculated in real time, and approve a pricing to save it as a historical snapshot.

This phase also installs the LangChain/LangGraph dependency infrastructure (packages, BaseChatModel factory, LLM config fields on the project) — required as scaffolding for Phases 12 and 13 even though no LLM call is made in this phase.

Out of scope for this phase: LLM feature suggestions (Phase 12), chatbot (Phase 13).

</domain>

<decisions>
## Implementation Decisions

### Architecture — SOLID (LOCKED)
- Camadas obrigatórias: `routers/` → `services/` → `repositories/` → Supabase. Nenhuma camada pula outra.
- Calculation engine (`PricingCalculator`) é uma função pura em `backend/app/core/pricing_calculator.py` — sem side effects, testável isoladamente.
- `BaseChatModel` factory em `backend/app/core/llm_factory.py` — instancia o modelo correto a partir da config do projeto; nenhum service importa `ChatOpenAI` / `ChatAnthropic` diretamente.
- Schemas Pydantic separados: `PricingCreate`, `PricingUpdate`, `PricingResponse`, `PricingFeatureCreate`, `PricingFeatureUpdate`, `PricingFeatureResponse`.

### LLM Infrastructure (LOCKED — requisito do usuário)
- Adicionar ao `projects` table (Supabase migration): `pricing_llm_provider TEXT` (openai/anthropic/google), `pricing_llm_model TEXT`, `pricing_api_key TEXT` (Supabase Vault).
- UI do projeto: novo bloco "Configuração IA do Precificador" com select de provider, text input de model name, password input de API key (mascarado após save).
- `llm_factory.py` lê esses 3 campos e retorna `BaseChatModel`. Provider desconhecido → raise `ValueError` com mensagem clara.
- Dependências novas em `requirements.txt`: `langchain`, `langchain-openai`, `langchain-anthropic`, `langchain-google-genai`, `langgraph`.

### Database Schema — New Tables
Quatro novas tabelas Supabase (ver detalhes abaixo). Aplicar via migration SQL.

**`pricings`**
- `id UUID PK`
- `project_id UUID FK → projects`
- `status TEXT` — `draft` | `approved`
- `start_date DATE`
- `num_analysts INT` — número de analistas
- `hours_per_day NUMERIC` — horas codando por dia por analista
- `ticket_price NUMERIC` — valor do ticket médio em BRL
- `extra_calendar_days INT DEFAULT 0` — dias corridos extras a somar
- `created_at TIMESTAMPTZ`
- `updated_at TIMESTAMPTZ`

**`pricing_features`**
- `id UUID PK`
- `pricing_id UUID FK → pricings`
- `bloco TEXT` — categoria/bloco temático (ex: "Engenharia de Dados")
- `funcionalidade TEXT` — nome da funcionalidade
- `horas NUMERIC` — estimativa de horas
- `citi_responsible BOOLEAN DEFAULT true` — flag visual CITI?, não afeta cálculo
- `ordem INT` — ordem de exibição na tabela
- `created_at TIMESTAMPTZ`

**`pricing_history`** — snapshot imutável de precificações aprovadas
- `id UUID PK`
- `project_id UUID FK → projects`
- `pricing_id UUID FK → pricings` — referência à precificação original
- `snapshot JSONB` — snapshot completo: {inputs, features[], outputs calculados, project_type}
- `approved_at TIMESTAMPTZ`

**`pricing_chat_messages`** — tabela criada agora (vazia), usada pela Phase 13
- `id UUID PK`
- `pricing_id UUID FK → pricings`
- `role TEXT` — `user` | `assistant` | `tool`
- `content TEXT`
- `tool_calls JSONB`
- `created_at TIMESTAMPTZ`

### Calculation Engine — Fórmulas (LOCKED — confirmadas pelo usuário)
```python
# PricingCalculator.calculate(features, inputs) -> PricingOutputs
total_horas = sum(f.horas for f in features)
dias_uteis = total_horas / (inputs.num_analysts * inputs.hours_per_day)
dias_corridos = dias_uteis * (7 / 5) + inputs.extra_calendar_days
preco_total = inputs.ticket_price * (dias_corridos / 30)
duracao_meses = dias_corridos / 30
duracao_semanas = dias_corridos / 7
num_sprints = dias_uteis / 5
data_final = inputs.start_date + timedelta(days=ceil(dias_corridos))
# Per-feature: dias_feature = feature.horas / (inputs.num_analysts * inputs.hours_per_day)
```

### FastAPI Routes — New Router `/pricings`
```
GET    /projects/:id/pricings          → list pricings for project
POST   /projects/:id/pricings          → create pricing (body: PricingCreate)
GET    /pricings/:id                   → get pricing with features + calculated outputs
PUT    /pricings/:id                   → update pricing inputs
DELETE /pricings/:id                   → delete draft (approved pricings cannot be deleted)
POST   /pricings/:id/approve           → approve pricing → saves snapshot to pricing_history
GET    /pricings/:id/features          → list features
POST   /pricings/:id/features          → add feature
PUT    /pricings/:pricing_id/features/:feature_id  → update feature
DELETE /pricings/:pricing_id/features/:feature_id  → remove feature
GET    /projects/:id/pricing-history   → list approved snapshots
```

Calculated outputs are NEVER stored in `pricings` — always computed on read by `PricingCalculator`.

### Frontend Pages & Components
- **`PricingListPage`** — listed under project detail, shows all pricings with status + price
- **`PricingEditorPage`** — main pricing screen:
  - Left panel: inputs (start date, analysts, hours/day, ticket, extra days) + calculated outputs card
  - Center: feature table (Bloco | Funcionalidade | Horas | Dias calculado | CITI | Ações) with inline add/edit/delete rows
  - Top right: Approve button (disabled if already approved)
- **`usePricing` hook** — fetches pricing, features, and recomputes outputs locally on every edit (no round-trip for outputs)
- **`usePricingFeatures` hook** — CRUD for feature rows with optimistic updates
- All calculations run client-side in `lib/pricingCalculator.ts` (mirrors the Python logic exactly)

### Project Form — New LLM Config Section
Add a collapsible section "Configuração IA do Precificador" at the bottom of `ProjectFormPage`:
- Select: provider (OpenAI / Anthropic / Google)
- Text: model name (placeholder: "gpt-4o", "claude-3-5-sonnet-20241022", "gemini-2.0-flash")
- Password: API key (masked after save)

### Claude's Discretion
- Exact Tailwind styling and color scheme for the pricing editor (follow existing design system in the project)
- Whether to use a modal or inline row editing for feature CRUD
- Pagination vs scroll for long feature lists

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Existing codebase patterns
- `backend/app/routers/projects.py` — router pattern to replicate
- `backend/app/routers/sessions.py` — session CRUD pattern (FK to projects)
- `backend/app/models/` — existing Pydantic schema patterns
- `backend/app/database.py` — Supabase client instantiation
- `frontend/src/pages/ProjectFormPage.tsx` — form pattern to extend with LLM config section
- `frontend/src/pages/ProjectDetailPage.tsx` — project detail page to add pricing list to
- `supabase/` — existing migration files for reference

### Planning references
- `.planning/REQUIREMENTS.md` — PREC-INF-01 to PREC-07 (full requirement text)
- `.planning/ROADMAP.md` — Phase 11 success criteria
- `CLAUDE.md` — SOLID architecture rules, LangChain/LangGraph module rule, folder structure

</canonical_refs>

<specifics>
## Specific Requirements

### Pricing formulas (exact, confirmed by user)
- `dias_uteis = SUM(horas) / (num_analysts * hours_per_day)`
- `dias_corridos = dias_uteis * 1.4 + extra_calendar_days`
- `preco_total = ticket_price * (dias_corridos / 30)`
- `num_sprints = dias_uteis / 5`
- Per-feature dias column: `horas / (num_analysts * hours_per_day)`
- CITI? checkbox is visual only — has no effect on any calculation

### LLM providers to support (Phase 11 scaffolding)
- `openai` → `langchain_openai.ChatOpenAI`
- `anthropic` → `langchain_anthropic.ChatAnthropic`
- `google` → `langchain_google_genai.ChatGoogleGenerativeAI`

### Historical pricing snapshot format (pricing_history.snapshot JSONB)
```json
{
  "project_type": "bi",
  "inputs": { "start_date": "...", "num_analysts": 3, "hours_per_day": 3, "ticket_price": 10000, "extra_calendar_days": 0 },
  "features": [{ "bloco": "...", "funcionalidade": "...", "horas": 15 }],
  "outputs": { "preco_total": 12000, "dias_corridos": 36, "dias_uteis": 26, "duracao_meses": 1.2, "duracao_semanas": 5.14, "num_sprints": 5.2, "data_final": "..." }
}
```

</specifics>

<deferred>
## Deferred to Later Phases

- LLM feature suggestions from diagnosis reports (Phase 12)
- Historical similarity matching for suggestions (Phase 12)
- Embedded chatbot with tool calls (Phase 13)
- PDF export of pricing (future)
- Multi-currency support (future)

</deferred>

---

*Phase: 11-precificador-foundation*
*Context gathered: 2026-07-19 via direct user specification*
