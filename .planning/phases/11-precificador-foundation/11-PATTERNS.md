# Phase 11: Precificador Foundation — Pattern Map

**Mapped:** 2026-07-19
**Files analyzed:** 18 new/modified files
**Analogs found:** 17 / 18

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `supabase/migrations/20260719000000_precificador_schema.sql` | migration | CRUD | `supabase/migrations/20260524000000_initial_schema.sql` | exact |
| `backend/app/models/pricings.py` | model | request-response | `backend/app/models/projects.py` | exact |
| `backend/app/models/pricing_features.py` | model | request-response | `backend/app/models/questions.py` | exact |
| `backend/app/routers/pricings.py` | router | CRUD | `backend/app/routers/sessions.py` | exact |
| `backend/app/routers/pricing_features.py` | router | CRUD | `backend/app/routers/questions.py` | role-match |
| `backend/app/core/pricing_calculator.py` | utility | transform | `backend/app/services/prompt_builder.py` | partial (pure class, no side effects) |
| `backend/app/core/llm_factory.py` | utility | request-response | `backend/app/database.py` | partial (factory returning typed object) |
| `backend/app/routers/__init__.py` | config | — | `backend/app/routers/__init__.py` | exact (extend) |
| `backend/app/main.py` | config | — | `backend/app/main.py` | exact (extend) |
| `backend/app/models/projects.py` | model | request-response | `backend/app/models/projects.py` | exact (extend) |
| `backend/app/routers/projects.py` | router | CRUD | `backend/app/routers/projects.py` | exact (extend) |
| `requirements.txt` | config | — | (no analog — add entries) | no analog |
| `frontend/src/lib/api.ts` | utility | request-response | `frontend/src/lib/api.ts` | exact (extend) |
| `frontend/src/lib/pricingCalculator.ts` | utility | transform | `frontend/src/lib/useSessionWS.ts` (pure logic sections) | partial |
| `frontend/src/hooks/usePricing.ts` | hook | request-response | `frontend/src/lib/useSessionWS.ts` | role-match |
| `frontend/src/hooks/usePricingFeatures.ts` | hook | CRUD | `frontend/src/lib/useSessionWS.ts` | role-match |
| `frontend/src/pages/PricingListPage.tsx` | page | request-response | `frontend/src/pages/ProjectDetailPage.tsx` | exact |
| `frontend/src/pages/PricingEditorPage.tsx` | page | CRUD | `frontend/src/pages/ProjectDetailPage.tsx` + `ProjectFormPage.tsx` | exact |
| `frontend/src/pages/ProjectFormPage.tsx` | page | request-response | `frontend/src/pages/ProjectFormPage.tsx` | exact (extend) |
| `frontend/src/App.tsx` | config | — | `frontend/src/App.tsx` | exact (extend) |

---

## Pattern Assignments

### `supabase/migrations/20260719000000_precificador_schema.sql` (migration, CRUD)

**Analog:** `supabase/migrations/20260524000000_initial_schema.sql`

**Header and ordering pattern** (lines 1–21):
```sql
-- =============================================================================
-- Migration: 20260719000000_precificador_schema.sql
-- Agente Precificador — Phase 11
--
-- Cria as 4 tabelas do módulo de precificação.
-- Ordem de criação respeita dependências de FK:
--   1. pricings (FK → projects)
--   2. pricing_features (FK → pricings)
--   3. pricing_history (FK → projects, pricings)
--   4. pricing_chat_messages (FK → pricings)
-- =============================================================================
```

**Table creation pattern** (lines 35–70) — copy this structure for each new table:
```sql
CREATE TABLE IF NOT EXISTS pricings (
    id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id           uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    status               text DEFAULT 'draft',       -- enum: draft, approved
    ...
    created_at           timestamptz DEFAULT now(),
    updated_at           timestamptz DEFAULT now()
);
```

**Index creation pattern** (lines 165–192):
```sql
CREATE INDEX IF NOT EXISTS idx_pricings_project_id ON pricings(project_id);
CREATE INDEX IF NOT EXISTS idx_pricing_features_pricing_id ON pricing_features(pricing_id);
CREATE INDEX IF NOT EXISTS idx_pricing_history_project_id ON pricing_history(project_id);
```

**updated_at trigger pattern** (lines 198–208) — reuse existing function, only add trigger:
```sql
-- set_updated_at() function already exists from initial_schema migration.
-- Only create the new trigger:
CREATE OR REPLACE TRIGGER trg_pricings_updated_at
    BEFORE UPDATE ON pricings
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
```

**ALTER TABLE pattern for adding columns to projects** (from `20260525000000_add_tunnel_url.sql`, line 5):
```sql
ALTER TABLE projects ADD COLUMN IF NOT EXISTS pricing_llm_provider text;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS pricing_llm_model text;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS pricing_api_key_secret_id uuid;
```

**Vault wrapper for new pricing API key** — copy vault functions structure from initial_schema lines 219–242. The `vault_create_secret` and `vault_delete_secret` functions already exist; the router just calls them via `db.rpc()`.

---

### `backend/app/models/pricings.py` (model, request-response)

**Analog:** `backend/app/models/projects.py`

**Imports pattern** (lines 1–6):
```python
from datetime import date, datetime
from decimal import Decimal
from typing import Literal, Optional
from uuid import UUID

from pydantic import BaseModel, field_validator
```

**Separate schemas per context pattern** (lines 12–69) — one class per operation:
```python
PricingStatus = Literal["draft", "approved"]

class PricingCreate(BaseModel):
    project_id: UUID
    start_date: date
    num_analysts: int
    hours_per_day: Decimal
    ticket_price: Decimal
    extra_calendar_days: int = 0

class PricingUpdate(BaseModel):
    start_date: Optional[date] = None
    num_analysts: Optional[int] = None
    hours_per_day: Optional[Decimal] = None
    ticket_price: Optional[Decimal] = None
    extra_calendar_days: Optional[int] = None

class PricingResponse(BaseModel):
    id: UUID
    project_id: UUID
    status: str
    start_date: date
    num_analysts: int
    hours_per_day: Decimal
    ticket_price: Decimal
    extra_calendar_days: int
    created_at: datetime
    updated_at: datetime
```

**Computed outputs model** (no analog — new, but follows BaseModel pattern):
```python
class PricingOutputs(BaseModel):
    total_horas: Decimal
    dias_uteis: Decimal
    dias_corridos: Decimal
    preco_total: Decimal
    duracao_meses: Decimal
    duracao_semanas: Decimal
    num_sprints: Decimal
    data_final: date
```

**field_validator pattern** (lines 25–29 of projects.py):
```python
@field_validator("num_analysts")
@classmethod
def validate_analysts(cls, v: int) -> int:
    if v < 1:
        raise ValueError("num_analysts deve ser >= 1")
    return v
```

---

### `backend/app/models/pricing_features.py` (model, request-response)

**Analog:** `backend/app/models/questions.py`

**Minimal schema pattern** (questions.py lines 1–22):
```python
from pydantic import BaseModel
from typing import Optional
from uuid import UUID
from datetime import datetime

class PricingFeatureCreate(BaseModel):
    bloco: str
    funcionalidade: str
    horas: Decimal
    citi_responsible: bool = True
    ordem: Optional[int] = None

class PricingFeatureUpdate(BaseModel):
    bloco: Optional[str] = None
    funcionalidade: Optional[str] = None
    horas: Optional[Decimal] = None
    citi_responsible: Optional[bool] = None
    ordem: Optional[int] = None

class PricingFeatureResponse(BaseModel):
    id: UUID
    pricing_id: UUID
    bloco: str
    funcionalidade: str
    horas: Decimal
    citi_responsible: bool
    ordem: Optional[int] = None
    created_at: datetime
```

---

### `backend/app/routers/pricings.py` (router, CRUD)

> ⚠ **SOLID ARCHITECTURE NOTE:** The code excerpts below are taken from `sessions.py` (the analog), which calls `db.table()` directly inside router functions. **Phase 11 must NOT follow this pattern.** The locked SOLID architecture requires: routers → services → repositories. Routers must only call `PricingService` methods. `db.table()` calls belong exclusively in `pricing_repository.py`. Use these excerpts for import structure and decorator patterns ONLY — never for DB access patterns.

**Analog:** `backend/app/routers/sessions.py` (FK-to-parent pattern) + `backend/app/routers/projects.py` (vault + status guard pattern)

**Imports and router declaration** (sessions.py lines 1–18):
```python
from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from supabase import Client

from app.database import get_supabase
from app.models.pricings import PricingCreate, PricingUpdate, PricingResponse
from app.core.pricing_calculator import PricingCalculator

router = APIRouter(prefix="/pricings", tags=["pricings"])
```

**FK-to-parent existence check pattern** (sessions.py lines 42–49):
```python
@router.post("/", response_model=PricingResponse, status_code=status.HTTP_201_CREATED)
async def create_pricing(payload: PricingCreate, db: Client = Depends(get_supabase)):
    project = (
        db.table("projects")
        .select("id")
        .eq("id", str(payload.project_id))
        .execute()
    )
    if not project.data:
        raise HTTPException(status_code=404, detail="Project not found")
    row = payload.model_dump(mode="json")
    result = db.table("pricings").insert(row).execute()
    return result.data[0]
```

**Supabase query pattern for nested FK listing** (projects.py lines 46–49):
```python
@router.get("/", response_model=list[PricingResponse])
async def list_pricings(project_id: UUID, db: Client = Depends(get_supabase)):
    result = (
        db.table("pricings")
        .select("*")
        .eq("project_id", str(project_id))
        .order("created_at", desc=True)
        .execute()
    )
    return result.data
```

**Status guard pattern** — guard approved pricings from deletion (sessions.py lines 97–110):
```python
@router.delete("/{pricing_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_pricing(pricing_id: UUID, db: Client = Depends(get_supabase)):
    existing = (
        db.table("pricings")
        .select("id, status")
        .eq("id", str(pricing_id))
        .execute()
    )
    if not existing.data:
        raise HTTPException(status_code=404, detail="Pricing not found")
    if existing.data[0]["status"] == "approved":
        raise HTTPException(status_code=409, detail="Cannot delete an approved pricing")
    db.table("pricings").delete().eq("id", str(pricing_id)).execute()
```

**Action endpoint pattern** (sessions.py lines 97–125 — finish_session):
```python
@router.post("/{pricing_id}/approve", response_model=PricingResponse)
async def approve_pricing(pricing_id: UUID, db: Client = Depends(get_supabase)):
    existing = (
        db.table("pricings")
        .select("*, pricing_features(*)")
        .eq("id", str(pricing_id))
        .execute()
    )
    if not existing.data:
        raise HTTPException(status_code=404, detail="Pricing not found")
    row = existing.data[0]
    if row["status"] == "approved":
        raise HTTPException(status_code=409, detail="Already approved")
    # compute outputs, build snapshot, insert into pricing_history
    ...
    result = (
        db.table("pricings")
        .update({"status": "approved", "updated_at": datetime.now(timezone.utc).isoformat()})
        .eq("id", str(pricing_id))
        .execute()
    )
    return result.data[0]
```

**GET with computed outputs** — computed on read, never stored in pricings:
```python
@router.get("/{pricing_id}")
async def get_pricing(pricing_id: UUID, db: Client = Depends(get_supabase)):
    result = (
        db.table("pricings")
        .select("*, pricing_features(*)")
        .eq("id", str(pricing_id))
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Pricing not found")
    row = result.data[0]
    features = row.pop("pricing_features", [])
    outputs = PricingCalculator.calculate(features, row)
    return {**row, "features": features, "outputs": outputs.model_dump()}
```

**update pattern with updated_at** (projects.py lines 75–102):
```python
updates = payload.model_dump(mode="json", exclude_none=True)
updates["updated_at"] = datetime.now(timezone.utc).isoformat()
result = (
    db.table("pricings").update(updates).eq("id", str(pricing_id)).execute()
)
return result.data[0]
```

---

### `backend/app/routers/pricing_features.py` (router, CRUD)

**Analog:** `backend/app/routers/questions.py` (simple sub-resource with patch)

**Minimal sub-resource router pattern** (questions.py lines 1–30):
```python
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException
from supabase import Client
from app.database import get_supabase
from app.models.pricing_features import PricingFeatureCreate, PricingFeatureUpdate, PricingFeatureResponse

router = APIRouter(prefix="/pricings", tags=["pricing-features"])

@router.get("/{pricing_id}/features", response_model=list[PricingFeatureResponse])
async def list_features(pricing_id: UUID, db: Client = Depends(get_supabase)):
    result = (
        db.table("pricing_features")
        .select("*")
        .eq("pricing_id", str(pricing_id))
        .order("ordem")
        .execute()
    )
    return result.data

@router.post("/{pricing_id}/features", response_model=PricingFeatureResponse, status_code=201)
async def add_feature(pricing_id: UUID, payload: PricingFeatureCreate, db: Client = Depends(get_supabase)):
    row = payload.model_dump(mode="json")
    row["pricing_id"] = str(pricing_id)
    result = db.table("pricing_features").insert(row).execute()
    return result.data[0]

@router.put("/{pricing_id}/features/{feature_id}", response_model=PricingFeatureResponse)
async def update_feature(pricing_id: UUID, feature_id: UUID, payload: PricingFeatureUpdate, db: Client = Depends(get_supabase)):
    updates = payload.model_dump(mode="json", exclude_none=True)
    result = (
        db.table("pricing_features")
        .update(updates)
        .eq("id", str(feature_id))
        .eq("pricing_id", str(pricing_id))
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Feature not found")
    return result.data[0]

@router.delete("/{pricing_id}/features/{feature_id}", status_code=204)
async def delete_feature(pricing_id: UUID, feature_id: UUID, db: Client = Depends(get_supabase)):
    result = (
        db.table("pricing_features")
        .delete()
        .eq("id", str(feature_id))
        .eq("pricing_id", str(pricing_id))
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Feature not found")
```

---

### `backend/app/core/pricing_calculator.py` (utility, transform)

**Analog:** `backend/app/services/prompt_builder.py` (pure class with no side effects, no DB access)

**Pure class pattern** (prompt_builder.py lines 255–272):
```python
# Pure function / class: no asyncio, no DB, no external calls.
# All inputs via constructor or method params, all outputs via return value.
# Testable in isolation with pytest — no mocking needed.

from math import ceil
from datetime import date, timedelta
from decimal import Decimal
from dataclasses import dataclass
from typing import Any

@dataclass(frozen=True)
class PricingInputs:
    start_date: date
    num_analysts: int
    hours_per_day: Decimal
    ticket_price: Decimal
    extra_calendar_days: int

class PricingCalculator:
    @staticmethod
    def calculate(features: list[dict[str, Any]], inputs: PricingInputs) -> "PricingOutputs":
        total_horas = sum(Decimal(str(f["horas"])) for f in features)
        daily_capacity = inputs.num_analysts * inputs.hours_per_day
        dias_uteis = total_horas / daily_capacity if daily_capacity else Decimal(0)
        dias_corridos = dias_uteis * Decimal("1.4") + inputs.extra_calendar_days
        preco_total = inputs.ticket_price * (dias_corridos / 30)
        num_sprints = dias_uteis / 5
        data_final = inputs.start_date + timedelta(days=ceil(float(dias_corridos)))
        return PricingOutputs(
            total_horas=total_horas,
            dias_uteis=dias_uteis,
            dias_corridos=dias_corridos,
            preco_total=preco_total,
            duracao_meses=dias_corridos / 30,
            duracao_semanas=dias_corridos / 7,
            num_sprints=num_sprints,
            data_final=data_final,
        )

    @staticmethod
    def feature_dias(horas: Decimal, num_analysts: int, hours_per_day: Decimal) -> Decimal:
        capacity = num_analysts * hours_per_day
        return horas / capacity if capacity else Decimal(0)
```

---

### `backend/app/core/llm_factory.py` (utility, request-response)

**Analog:** `backend/app/database.py` (returns a typed singleton-style object from env config)

**Factory pattern** (database.py lines 22–48):
```python
# llm_factory.py — follows database.py's "validate inputs, fail fast, return typed object" pattern.
# Dependency Inversion: callers depend on BaseChatModel (abstraction), not on ChatOpenAI (concrete).

from langchain_core.language_models import BaseChatModel

def create_llm(provider: str, model: str, api_key: str) -> BaseChatModel:
    """Returns a BaseChatModel for the given provider/model.

    Raises:
        ValueError: if provider is unknown or api_key is empty.
    """
    if not api_key:
        raise ValueError("api_key is required to create an LLM client")

    match provider:
        case "openai":
            from langchain_openai import ChatOpenAI
            return ChatOpenAI(model=model, api_key=api_key)
        case "anthropic":
            from langchain_anthropic import ChatAnthropic
            return ChatAnthropic(model=model, api_key=api_key)
        case "google":
            from langchain_google_genai import ChatGoogleGenerativeAI
            return ChatGoogleGenerativeAI(model=model, google_api_key=api_key)
        case _:
            raise ValueError(
                f"Unknown LLM provider: '{provider}'. "
                "Supported values: 'openai', 'anthropic', 'google'."
            )
```

---

### `backend/app/routers/__init__.py` (config — extend)

**Analog:** `backend/app/routers/__init__.py` (lines 1–15)

**Current pattern to replicate:**
```python
from .projects import router as projects_router
from .sessions import router as sessions_router
# ... existing imports ...

__all__ = [
    "projects_router",
    "sessions_router",
    # ... existing ...
]
```

**Add these lines** following the exact same import + __all__ pattern:
```python
from .pricings import router as pricings_router
from .pricing_features import router as pricing_features_router
```

---

### `backend/app/main.py` (config — extend)

**Analog:** `backend/app/main.py` (lines 20–50)

**Router registration pattern** (lines 45–50):
```python
app.include_router(projects_router)
app.include_router(sessions_router)
# add after existing routers:
app.include_router(pricings_router)
app.include_router(pricing_features_router)
```

---

### `backend/app/models/projects.py` (model — extend)

**Analog:** `backend/app/models/projects.py` (lines 12–69)

**Add to ProjectCreate and ProjectUpdate** following the existing Optional field pattern (lines 14–44):
```python
# Add to ProjectCreate:
pricing_llm_provider: Optional[str] = None   # openai | anthropic | google
pricing_llm_model: Optional[str] = None
pricing_api_key: Optional[str] = None         # plaintext on input, stored in Vault

# Add to ProjectUpdate (all Optional):
pricing_llm_provider: Optional[str] = None
pricing_llm_model: Optional[str] = None
pricing_api_key: Optional[str] = None

# Add to ProjectResponse:
pricing_llm_provider: Optional[str] = None
pricing_llm_model: Optional[str] = None
has_pricing_api_key: bool = False
```

---

### `backend/app/routers/projects.py` (router — extend)

**Analog:** `backend/app/routers/projects.py` (existing vault pattern, lines 20–40)

**Vault pattern to replicate for pricing_api_key** (existing lines 54–58 for gemini key):
```python
# In create_project: handle pricing_api_key same as gemini_api_key
if payload.pricing_api_key:
    secret_id = _vault_store(db, payload.pricing_api_key, f"pricing-{payload.client}")
    row["pricing_api_key_secret_id"] = secret_id
    del row["pricing_api_key"]

# In _to_response: expose has_pricing_api_key boolean
"has_pricing_api_key": bool(row.get("pricing_api_key_secret_id")),
```

**_VAULT_EXCLUDED set** (line 12) — extend:
```python
_VAULT_EXCLUDED = {"gemini_api_key_secret_id", "pricing_api_key_secret_id"}
```

---

### `frontend/src/lib/api.ts` (utility — extend)

**Analog:** `frontend/src/lib/api.ts` (full file)

**Interface declaration pattern** (lines 5–56):
```typescript
export interface Pricing {
  id: string
  project_id: string
  status: 'draft' | 'approved'
  start_date: string
  num_analysts: number
  hours_per_day: string
  ticket_price: string
  extra_calendar_days: number
  created_at: string
  updated_at: string
}

export interface PricingOutputs {
  total_horas: string
  dias_uteis: string
  dias_corridos: string
  preco_total: string
  duracao_meses: string
  duracao_semanas: string
  num_sprints: string
  data_final: string
}

export interface PricingFeature {
  id: string
  pricing_id: string
  bloco: string
  funcionalidade: string
  horas: string
  citi_responsible: boolean
  ordem: number | null
  created_at: string
}

export interface PricingCreate {
  project_id: string
  start_date: string
  num_analysts: number
  hours_per_day: number
  ticket_price: number
  extra_calendar_days?: number
}
```

**api object extension pattern** (lines 90–136) — add namespaced sub-object:
```typescript
export const api = {
  // ... existing sessions, projects, questions ...
  pricings: {
    listByProject: (projectId: string) =>
      request<Pricing[]>(`/projects/${projectId}/pricings`),
    get: (id: string) =>
      request<Pricing & { features: PricingFeature[]; outputs: PricingOutputs }>(`/pricings/${id}`),
    create: (projectId: string, data: Omit<PricingCreate, 'project_id'>) =>
      request<Pricing>(`/projects/${projectId}/pricings`, { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: Partial<PricingCreate>) =>
      request<Pricing>(`/pricings/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: string) =>
      request<void>(`/pricings/${id}`, { method: 'DELETE' }),
    approve: (id: string) =>
      request<Pricing>(`/pricings/${id}/approve`, { method: 'POST' }),
    history: (projectId: string) =>
      request<PricingHistory[]>(`/projects/${projectId}/pricing-history`),
  },
  pricingFeatures: {
    list: (pricingId: string) =>
      request<PricingFeature[]>(`/pricings/${pricingId}/features`),
    add: (pricingId: string, data: PricingFeatureCreate) =>
      request<PricingFeature>(`/pricings/${pricingId}/features`, { method: 'POST', body: JSON.stringify(data) }),
    update: (pricingId: string, featureId: string, data: Partial<PricingFeatureCreate>) =>
      request<PricingFeature>(`/pricings/${pricingId}/features/${featureId}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (pricingId: string, featureId: string) =>
      request<void>(`/pricings/${pricingId}/features/${featureId}`, { method: 'DELETE' }),
  },
}
```

---

### `frontend/src/lib/pricingCalculator.ts` (utility, transform)

**Analog:** Pure logic sections of `frontend/src/lib/useSessionWS.ts` (interface definitions + state transform, lines 4–59)

**TypeScript mirror of Python calculator — no imports, pure functions:**
```typescript
// Mirrors backend/app/core/pricing_calculator.py exactly.
// Called on every local state change in usePricing hook — no round-trip needed.

export interface PricingInputs {
  startDate: string        // ISO date string
  numAnalysts: number
  hoursPerDay: number
  ticketPrice: number
  extraCalendarDays: number
}

export interface PricingOutputs {
  totalHoras: number
  diasUteis: number
  diasCorridos: number
  precoTotal: number
  duracaoMeses: number
  duracaoSemanas: number
  numSprints: number
  dataFinal: string   // ISO date string
}

export function calculatePricing(features: Array<{ horas: number }>, inputs: PricingInputs): PricingOutputs {
  const totalHoras = features.reduce((sum, f) => sum + Number(f.horas), 0)
  const dailyCapacity = inputs.numAnalysts * inputs.hoursPerDay
  const diasUteis = dailyCapacity > 0 ? totalHoras / dailyCapacity : 0
  const diasCorridos = diasUteis * 1.4 + inputs.extraCalendarDays
  const precoTotal = inputs.ticketPrice * (diasCorridos / 30)
  const dataFinal = new Date(inputs.startDate)
  dataFinal.setDate(dataFinal.getDate() + Math.ceil(diasCorridos))
  return {
    totalHoras,
    diasUteis,
    diasCorridos,
    precoTotal,
    duracaoMeses: diasCorridos / 30,
    duracaoSemanas: diasCorridos / 7,
    numSprints: diasUteis / 5,
    dataFinal: dataFinal.toISOString().slice(0, 10),
  }
}

export function featureDias(horas: number, numAnalysts: number, hoursPerDay: number): number {
  const capacity = numAnalysts * hoursPerDay
  return capacity > 0 ? horas / capacity : 0
}
```

---

### `frontend/src/hooks/usePricing.ts` (hook, request-response)

**Analog:** `frontend/src/lib/useSessionWS.ts` (state + effect + send pattern, lines 64–168)

**Hook state + fetch + local-recompute pattern:**
```typescript
import { useCallback, useEffect, useState } from 'react'
import { api, type Pricing, type PricingFeature } from '../lib/api'
import { calculatePricing, type PricingOutputs } from '../lib/pricingCalculator'

export function usePricing(pricingId: string | undefined) {
  const [pricing, setPricing] = useState<Pricing | null>(null)
  const [features, setFeatures] = useState<PricingFeature[]>([])
  const [outputs, setOutputs] = useState<PricingOutputs | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Recompute outputs locally on every features/pricing change (no round-trip)
  useEffect(() => {
    if (!pricing || features.length === 0) { setOutputs(null); return }
    setOutputs(calculatePricing(
      features.map(f => ({ horas: Number(f.horas) })),
      {
        startDate: pricing.start_date,
        numAnalysts: pricing.num_analysts,
        hoursPerDay: Number(pricing.hours_per_day),
        ticketPrice: Number(pricing.ticket_price),
        extraCalendarDays: pricing.extra_calendar_days,
      }
    ))
  }, [pricing, features])

  const refresh = useCallback(async () => {
    if (!pricingId) return
    try {
      const data = await api.pricings.get(pricingId)
      setPricing(data)
      setFeatures(data.features)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erro desconhecido')
    } finally {
      setLoading(false)
    }
  }, [pricingId])

  useEffect(() => { refresh() }, [refresh])

  return { pricing, features, outputs, loading, error, refresh, setPricing, setFeatures }
}
```

---

### `frontend/src/hooks/usePricingFeatures.ts` (hook, CRUD)

**Analog:** `frontend/src/lib/useSessionWS.ts` `updateQuestionStatus` optimistic update pattern (lines 84–94)

**Optimistic CRUD hook pattern:**
```typescript
// Optimistic updates: mutate local state immediately, then sync with backend.
// On error, refresh from server (same pattern as updateQuestionStatus in useSessionWS.ts).

export function usePricingFeatures(pricingId: string | undefined, setFeatures: React.Dispatch<React.SetStateAction<PricingFeature[]>>) {
  const addFeature = useCallback(async (data: PricingFeatureCreate) => {
    if (!pricingId) return
    const created = await api.pricingFeatures.add(pricingId, data)
    setFeatures(fs => [...fs, created])
  }, [pricingId, setFeatures])

  const updateFeature = useCallback(async (featureId: string, data: Partial<PricingFeatureCreate>) => {
    if (!pricingId) return
    // Optimistic update
    setFeatures(fs => fs.map(f => f.id === featureId ? { ...f, ...data } : f))
    try {
      await api.pricingFeatures.update(pricingId, featureId, data)
    } catch {
      // Revert — caller should handle by calling refresh()
      throw new Error('Falha ao atualizar feature')
    }
  }, [pricingId, setFeatures])

  const deleteFeature = useCallback(async (featureId: string) => {
    if (!pricingId) return
    setFeatures(fs => fs.filter(f => f.id !== featureId))
    await api.pricingFeatures.delete(pricingId, featureId)
  }, [pricingId, setFeatures])

  return { addFeature, updateFeature, deleteFeature }
}
```

---

### `frontend/src/pages/PricingListPage.tsx` (page, request-response)

**Analog:** `frontend/src/pages/ProjectDetailPage.tsx`

**Page scaffold pattern** (ProjectDetailPage.tsx lines 50–97):
```typescript
export default function PricingListPage() {
  const { id } = useParams<{ id: string }>()   // project id
  const navigate = useNavigate()
  const [pricings, setPricings] = useState<Pricing[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    api.pricings.listByProject(id)
      .then(setPricings)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
  }, [id])
  // ...
}
```

**Loading state pattern** (ProjectDetailPage.tsx lines 82–97):
```typescript
if (loading) {
  return (
    <div className="min-h-screen bg-[var(--color-bg-page)] flex items-center justify-center">
      <span className="text-sm text-[var(--color-text-secondary)]">Carregando...</span>
    </div>
  )
}
```

**Status badge pattern** (ProjectDetailPage.tsx lines 114–119):
```typescript
// Reuse status badge pattern — draft vs approved:
<span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium
  bg-[var(--color-green-bg-tag)] text-[var(--color-accent)] border border-[var(--color-border-green)]">
  aprovado
</span>
```

**List-as-links pattern** (ProjectDetailPage.tsx lines 222–257):
```typescript
{pricings.map(p => (
  <Link
    key={p.id}
    to={`/pricings/${p.id}`}
    className="flex items-center justify-between gap-4 bg-[var(--color-surface)] border border-[var(--color-border-std)] rounded-lg px-4 py-3 hover:border-[var(--color-border-hover)] transition-colors"
  >
    ...
  </Link>
))}
```

---

### `frontend/src/pages/PricingEditorPage.tsx` (page, CRUD)

**Analog:** `frontend/src/pages/ProjectFormPage.tsx` (form structure) + `frontend/src/pages/ProjectDetailPage.tsx` (layout + navigation)

**Form state management pattern** (ProjectFormPage.tsx lines 55–89):
```typescript
const [form, setForm] = useState({ ...DEFAULT_FORM })

function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
  setForm(f => ({ ...f, [key]: value }))
}
```

**Field component pattern** (ProjectFormPage.tsx lines 30–47):
```typescript
function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium text-[var(--color-text-primary)]">
        {label}
        {required && <span className="text-[var(--color-red)] ml-0.5">*</span>}
      </label>
      {children}
    </div>
  )
}
```

**inputCls constant** (ProjectFormPage.tsx line 27):
```typescript
const inputCls =
  'w-full px-3 py-2 text-sm border border-[var(--color-border-std)] rounded-md bg-[var(--color-surface)] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-secondary)] focus:outline-none focus:border-[var(--color-accent)] transition-colors'
```

**Topbar pattern** (ProjectDetailPage.tsx lines 99–141):
```typescript
<div className="border-b border-[var(--color-border-std)] bg-[var(--color-surface)]">
  <div className="max-w-2xl mx-auto px-6 py-4 flex items-center justify-between">
    <div className="flex items-center gap-3">
      <Link to={`/projects/${projectId}`} className="text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors">
        <ChevronLeft size={18} />
      </Link>
      <h1 className="font-semibold text-sm text-[var(--color-text-primary)]">Precificação</h1>
    </div>
    <button
      disabled={pricing?.status === 'approved'}
      className="px-4 py-2 bg-[var(--color-accent)] text-white rounded-md text-sm font-medium hover:bg-[var(--color-accent-hover)] transition-colors disabled:opacity-50"
    >
      Aprovar
    </button>
  </div>
</div>
```

**Error inline display pattern** (ProjectFormPage.tsx lines 143–147):
```typescript
{error && (
  <div className="text-sm text-[var(--color-red)] bg-[var(--color-red-bg)] border border-[var(--color-border-red)] rounded-md px-4 py-3">
    {error}
  </div>
)}
```

---

### `frontend/src/pages/ProjectFormPage.tsx` (page — extend)

**Analog:** `frontend/src/pages/ProjectFormPage.tsx` (existing file)

**Collapsible section pattern** — add at the end of the form, before submit buttons. Follow the existing `<Field>` + `<div className="grid grid-cols-2 gap-4">` grid pattern (lines 277–298):
```typescript
// Add "Configuração IA do Precificador" section at bottom of form
// before the submit button group (lines 300–315).

<div className="border-t border-[var(--color-border-std)] pt-5">
  <button
    type="button"
    onClick={() => setShowLlmConfig(s => !s)}
    className="text-sm font-medium text-[var(--color-text-primary)] flex items-center gap-2"
  >
    Configuração IA do Precificador
    <ChevronDown size={14} className={showLlmConfig ? 'rotate-180 transition-transform' : 'transition-transform'} />
  </button>

  {showLlmConfig && (
    <div className="mt-4 space-y-4">
      <Field label="Provider">
        <select value={form.pricing_llm_provider ?? ''} onChange={e => set('pricing_llm_provider', e.target.value || undefined)} className={inputCls}>
          <option value="">Selecione</option>
          <option value="openai">OpenAI</option>
          <option value="anthropic">Anthropic</option>
          <option value="google">Google</option>
        </select>
      </Field>
      <Field label="Model name">
        <input type="text" value={form.pricing_llm_model ?? ''} onChange={e => set('pricing_llm_model', e.target.value || undefined)} placeholder="gpt-4o, claude-3-5-sonnet-20241022, gemini-2.0-flash" className={inputCls} />
      </Field>
      <Field label="API Key do Precificador">
        <input type="password" value={form.pricing_api_key ?? ''} onChange={e => set('pricing_api_key', e.target.value || undefined)} placeholder={hasPricingApiKey ? '••••• (deixe em branco para manter)' : 'sk-...'} autoComplete="new-password" className={inputCls} />
        {hasPricingApiKey && <p className="text-xs text-[var(--color-text-secondary)]">Chave salva. Preencha apenas para substituir.</p>}
      </Field>
    </div>
  )}
</div>
```

**State additions** — add alongside existing `hasApiKey` state (line 57):
```typescript
const [hasPricingApiKey, setHasPricingApiKey] = useState(false)
const [showLlmConfig, setShowLlmConfig] = useState(false)
```

**In useEffect load** (after line 78, alongside `setHasApiKey`):
```typescript
setHasPricingApiKey(p.has_pricing_api_key ?? false)
if (p.pricing_llm_provider || p.pricing_llm_model) setShowLlmConfig(true)
```

---

### `frontend/src/App.tsx` (config — extend)

**Analog:** `frontend/src/App.tsx` (lines 1–21)

**Route registration pattern** (lines 10–18):
```typescript
// Add after existing routes:
<Route path="/projects/:id/pricings" element={<PricingListPage />} />
<Route path="/pricings/:id" element={<PricingEditorPage />} />
```

---

## Shared Patterns

### Supabase query pattern
**Source:** `backend/app/routers/projects.py` and `backend/app/routers/sessions.py`
**Apply to:** All new router files

```python
# Chaining pattern: table → select → filter → order → execute → .data
result = (
    db.table("table_name")
    .select("*")
    .eq("column", str(value))
    .order("created_at", desc=True)
    .execute()
)
if not result.data:
    raise HTTPException(status_code=404, detail="Not found")
return result.data[0]
```

### 404 guard pattern
**Source:** `backend/app/routers/projects.py` lines 61–72 and `backend/app/routers/sessions.py` lines 84–94
**Apply to:** Every GET/PUT/DELETE endpoint that operates on a single row

```python
existing = db.table("pricings").select("id, status").eq("id", str(pricing_id)).execute()
if not existing.data:
    raise HTTPException(status_code=404, detail="Pricing not found")
```

### model_dump exclusion pattern
**Source:** `backend/app/routers/projects.py` lines 55–57, 88–89
**Apply to:** Any router that needs to strip a field before inserting

```python
row = payload.model_dump(mode="json", exclude={"pricing_api_key"})
# or for updates:
updates = payload.model_dump(mode="json", exclude_none=True, exclude={"pricing_api_key"})
```

### updated_at on every PUT
**Source:** `backend/app/routers/projects.py` line 98
**Apply to:** `pricings` PUT endpoint

```python
updates["updated_at"] = datetime.now(timezone.utc).isoformat()
```

### React page loading / error guard pattern
**Source:** `frontend/src/pages/ProjectDetailPage.tsx` lines 82–97
**Apply to:** `PricingListPage`, `PricingEditorPage`

```typescript
if (loading) {
  return (
    <div className="min-h-screen bg-[var(--color-bg-page)] flex items-center justify-center">
      <span className="text-sm text-[var(--color-text-secondary)]">Carregando...</span>
    </div>
  )
}
if (error || !data) {
  return (
    <div className="min-h-screen bg-[var(--color-bg-page)] flex items-center justify-center">
      <span className="text-sm text-[var(--color-red)]">{error ?? 'Não encontrado'}</span>
    </div>
  )
}
```

### CSS design tokens
**Source:** All frontend pages — consistent CSS custom properties
**Apply to:** All new TSX pages and components

```typescript
// Always use these CSS variables — never hardcoded colors:
// var(--color-bg-page)          page background
// var(--color-surface)          card/input background
// var(--color-border-std)       default border
// var(--color-border-hover)     hover border
// var(--color-border-red)       error border
// var(--color-text-primary)     main text
// var(--color-text-secondary)   label/helper text
// var(--color-accent)           primary action / links
// var(--color-accent-hover)     primary hover
// var(--color-red)              error text
// var(--color-red-bg)           error background
// var(--color-green-bg-tag)     "active/live" badge bg
// var(--color-border-green)     "active/live" badge border
// var(--color-muted)            inactive badge bg
```

### Vault helper reuse
**Source:** `backend/app/routers/projects.py` lines 20–27
**Apply to:** `backend/app/routers/projects.py` extension for `pricing_api_key`

```python
# _vault_store and _vault_delete are already defined in projects.py.
# For pricing_api_key vault handling, call these same helpers from within
# the existing create_project / update_project functions.
# Do NOT duplicate the helpers in a separate file.
```

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `requirements.txt` | config | — | Plain text file — add `langchain`, `langchain-openai`, `langchain-anthropic`, `langchain-google-genai`, `langgraph` entries; no structural analog needed |

---

## Metadata

**Analog search scope:** `backend/app/routers/`, `backend/app/models/`, `backend/app/services/`, `backend/app/core/` (inferred), `backend/app/database.py`, `frontend/src/`, `supabase/migrations/`
**Files scanned:** 21
**Pattern extraction date:** 2026-07-19
