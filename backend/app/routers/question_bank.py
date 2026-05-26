from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from supabase import Client

from app.database import get_supabase

router = APIRouter(prefix="/question-bank", tags=["question-bank"])


class QuestionBankItem(BaseModel):
    id: UUID
    block: str
    project_types: Optional[list[str]] = None
    text: str
    priority: int


@router.get("/", response_model=list[QuestionBankItem])
async def list_question_bank(
    project_type: Optional[str] = None,
    block: Optional[str] = None,
    db: Client = Depends(get_supabase),
):
    query = db.table("question_bank").select("*").order("priority").order("block")

    if block:
        query = query.eq("block", block)

    result = query.execute()
    rows = result.data

    # Filter by project_type: include rows where project_types is null or contains the type
    if project_type:
        rows = [
            r for r in rows
            if not r.get("project_types") or project_type in r["project_types"]
        ]

    return rows
