from datetime import datetime
from decimal import Decimal
from typing import Optional
from uuid import UUID

from pydantic import BaseModel


class SessionCreate(BaseModel):
    project_id: UUID
    meeting_url: Optional[str] = None
    source: Optional[str] = None
    additional_context: Optional[str] = None
    budget_usd: Optional[Decimal] = None


class ReportResponse(BaseModel):
    id: UUID
    session_id: UUID
    markdown_content: str
    cost_usd: Decimal
    generated_at: datetime


class SessionResponse(BaseModel):
    id: UUID
    project_id: UUID
    meeting_url: Optional[str] = None
    source: str
    status: str
    tokens_used: int
    cost_usd: Decimal
    tunnel_url: Optional[str] = None
    recall_bot_id: Optional[str] = None
    started_at: datetime
    finished_at: Optional[datetime] = None
