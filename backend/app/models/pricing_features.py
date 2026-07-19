from datetime import datetime
from decimal import Decimal
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, field_validator


class PricingFeatureCreate(BaseModel):
    bloco: str
    funcionalidade: str
    horas: Decimal
    citi_responsible: bool = True
    ordem: Optional[int] = None

    @field_validator("horas")
    @classmethod
    def validate_horas(cls, v: Decimal) -> Decimal:
        if v <= 0:
            raise ValueError("horas must be > 0")
        return v


class PricingFeatureUpdate(BaseModel):
    bloco: Optional[str] = None
    funcionalidade: Optional[str] = None
    horas: Optional[Decimal] = None
    citi_responsible: Optional[bool] = None
    ordem: Optional[int] = None

    @field_validator("horas")
    @classmethod
    def validate_horas(cls, v: Optional[Decimal]) -> Optional[Decimal]:
        if v is not None and v <= 0:
            raise ValueError("horas must be > 0")
        return v


class PricingFeatureResponse(BaseModel):
    id: UUID
    pricing_id: UUID
    bloco: str
    funcionalidade: str
    horas: Decimal
    citi_responsible: bool
    ordem: Optional[int] = None
    created_at: datetime
