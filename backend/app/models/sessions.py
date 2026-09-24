from datetime import datetime
from decimal import Decimal
from typing import Literal, Optional
from uuid import UUID

from pydantic import BaseModel


class SessionCreate(BaseModel):
    project_id: UUID
    name: Optional[str] = None
    meeting_url: Optional[str] = None
    source: Optional[str] = None
    additional_context: Optional[str] = None
    budget_usd: Optional[Decimal] = None


class SessionRename(BaseModel):
    name: str


class ReportResponse(BaseModel):
    id: UUID
    session_id: UUID
    markdown_content: str
    cost_usd: Decimal
    generated_at: datetime
    # Impl Note 3 (Fase 5, UI-SPEC): a coluna `reports.status` existe desde a
    # Fase 4 (D-36), mas o response_model filtrava o campo fora do JSON por
    # esquecimento. Optional com default None de propósito: relatórios sales
    # não gravam status (REP-03) — Literal obrigatório causaria 422 e
    # regrediria o sales. Discovery devolve um dos 3 valores; sales devolve
    # null.
    status: Optional[Literal["Rascunho", "Em revisão", "Aprovado para build"]] = None


class SessionResponse(BaseModel):
    id: UUID
    project_id: UUID
    name: Optional[str] = None
    meeting_url: Optional[str] = None
    source: str
    status: str
    tokens_used: int
    cost_usd: Decimal
    tunnel_url: Optional[str] = None
    recall_bot_id: Optional[str] = None
    started_at: datetime
    finished_at: Optional[datetime] = None
