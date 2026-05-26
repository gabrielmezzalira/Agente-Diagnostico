from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from supabase import Client

from app.database import get_supabase
from app.models.questions import QuestionResponse, QuestionStatusUpdate

router = APIRouter(prefix="/questions", tags=["questions"])

_VALID_STATUSES = {"pinned", "dismissed", "used", "queued"}


@router.patch("/{question_id}", response_model=QuestionResponse)
async def update_question_status(
    question_id: UUID,
    payload: QuestionStatusUpdate,
    db: Client = Depends(get_supabase),
):
    if payload.status not in _VALID_STATUSES:
        raise HTTPException(status_code=422, detail=f"Invalid status: {payload.status}")
    result = (
        db.table("questions")
        .update({"status": payload.status})
        .eq("id", str(question_id))
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Question not found")
    return result.data[0]
