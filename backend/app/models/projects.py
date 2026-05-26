from datetime import datetime
from decimal import Decimal
from typing import Literal, Optional
from uuid import UUID

from pydantic import BaseModel, field_validator

ProjectType = Literal["bi", "ml", "data_engineering", "automation", "integration", "science"]
TranscriptSource = Literal["extension", "recall"]


class ProjectCreate(BaseModel):
    name: str
    client: str
    description: Optional[str] = None
    project_type: Optional[ProjectType] = None
    gemini_api_key: str
    budget_usd: Optional[Decimal] = None
    data_maturity_score: Optional[int] = None
    pre_meeting_context: Optional[str] = None
    meeting_url: Optional[str] = None
    source: TranscriptSource = "extension"
    question_ttl_seconds: int = 30

    @field_validator("data_maturity_score")
    @classmethod
    def validate_dms(cls, v: Optional[int]) -> Optional[int]:
        if v is not None and not (1 <= v <= 5):
            raise ValueError("data_maturity_score deve ser entre 1 e 5")
        return v


class ProjectUpdate(BaseModel):
    name: Optional[str] = None
    client: Optional[str] = None
    description: Optional[str] = None
    project_type: Optional[ProjectType] = None
    gemini_api_key: Optional[str] = None
    budget_usd: Optional[Decimal] = None
    data_maturity_score: Optional[int] = None
    pre_meeting_context: Optional[str] = None
    meeting_url: Optional[str] = None
    source: Optional[TranscriptSource] = None
    question_ttl_seconds: Optional[int] = None

    @field_validator("data_maturity_score")
    @classmethod
    def validate_dms(cls, v: Optional[int]) -> Optional[int]:
        if v is not None and not (1 <= v <= 5):
            raise ValueError("data_maturity_score deve ser entre 1 e 5")
        return v


class ProjectResponse(BaseModel):
    id: UUID
    name: str
    client: str
    description: Optional[str] = None
    project_type: Optional[str] = None
    budget_usd: Optional[Decimal] = None
    data_maturity_score: Optional[int] = None
    pre_meeting_context: Optional[str] = None
    meeting_url: Optional[str] = None
    source: str
    question_ttl_seconds: int
    has_api_key: bool
    has_active_session: bool = False
    created_at: datetime
    updated_at: datetime
