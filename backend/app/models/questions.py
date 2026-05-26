from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel


class QuestionStatusUpdate(BaseModel):
    status: str  # pinned | dismissed | used | queued


class QuestionResponse(BaseModel):
    id: UUID
    session_id: UUID
    text: str
    block: Optional[str] = None
    source: str
    status: str
    generated_at: datetime
    expires_at: Optional[datetime] = None
