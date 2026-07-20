from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from typing import TYPE_CHECKING, List, Literal, Optional
from uuid import UUID

from pydantic import BaseModel, field_validator

if TYPE_CHECKING:
    from app.models.pricing_features import PricingFeatureResponse

PricingStatus = Literal["draft", "approved"]


class PricingCreateBody(BaseModel):
    """Request body for POST /projects/:id/pricings — does NOT include project_id."""

    start_date: date
    num_analysts: int
    hours_per_day: Decimal
    ticket_price: Decimal
    extra_calendar_days: int = 0

    @field_validator("num_analysts")
    @classmethod
    def validate_analysts(cls, v: int) -> int:
        if v < 1:
            raise ValueError("num_analysts must be >= 1")
        return v

    @field_validator("hours_per_day")
    @classmethod
    def validate_hours(cls, v: Decimal) -> Decimal:
        if v <= 0:
            raise ValueError("hours_per_day must be > 0")
        return v

    @field_validator("ticket_price")
    @classmethod
    def validate_ticket(cls, v: Decimal) -> Decimal:
        if v <= 0:
            raise ValueError("ticket_price must be > 0")
        return v


class PricingCreate(PricingCreateBody):
    """Internal model used by service layer — includes project_id from URL path."""

    project_id: UUID


class PricingUpdate(BaseModel):
    start_date: Optional[date] = None
    num_analysts: Optional[int] = None
    hours_per_day: Optional[Decimal] = None
    ticket_price: Optional[Decimal] = None
    extra_calendar_days: Optional[int] = None

    @field_validator("num_analysts")
    @classmethod
    def validate_analysts(cls, v: Optional[int]) -> Optional[int]:
        if v is not None and v < 1:
            raise ValueError("num_analysts must be >= 1")
        return v

    @field_validator("hours_per_day")
    @classmethod
    def validate_hours(cls, v: Optional[Decimal]) -> Optional[Decimal]:
        if v is not None and v <= 0:
            raise ValueError("hours_per_day must be > 0")
        return v

    @field_validator("ticket_price")
    @classmethod
    def validate_ticket(cls, v: Optional[Decimal]) -> Optional[Decimal]:
        if v is not None and v <= 0:
            raise ValueError("ticket_price must be > 0")
        return v


class PricingResponse(BaseModel):
    id: UUID
    project_id: UUID
    status: str
    start_date: Optional[date] = None
    num_analysts: Optional[int] = None
    hours_per_day: Optional[Decimal] = None
    ticket_price: Optional[Decimal] = None
    extra_calendar_days: int = 0
    created_at: datetime
    updated_at: datetime


class PricingOutputs(BaseModel):
    total_horas: Decimal
    dias_uteis: Decimal
    dias_corridos: Decimal
    preco_total: Decimal
    duracao_meses: Decimal
    duracao_semanas: Decimal
    num_sprints: Decimal
    data_final: date


class PricingWithDetails(PricingResponse):
    features: List["PricingFeatureResponse"] = []
    outputs: Optional[PricingOutputs] = None


class ChatRequest(BaseModel):
    message: str


class ChatMessageResponse(BaseModel):
    id: UUID
    pricing_id: UUID
    role: str
    content: Optional[str] = None
    created_at: datetime


class ChatResponse(BaseModel):
    reply: str
    features: List["PricingFeatureResponse"]


class SuggestedFeature(BaseModel):
    """Sugestão de funcionalidade gerada pelo LLM — não inserida automaticamente.

    O usuário decide se aceita ou rejeita cada sugestão na UI do Precificador.
    """

    bloco: str
    funcionalidade: str
    horas: Decimal
    justificativa: Optional[str] = None


# Required for forward references when TYPE_CHECKING is False at runtime
from app.models.pricing_features import PricingFeatureResponse  # noqa: E402
PricingWithDetails.model_rebuild()
ChatResponse.model_rebuild()
