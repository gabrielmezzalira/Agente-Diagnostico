import asyncio

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from supabase import Client

from app.database import get_supabase

router = APIRouter(prefix="/webhook", tags=["webhook"])


class ExtensionChunk(BaseModel):
    session_id: str
    text: str
    speaker: str | None = None


@router.post("/extension", status_code=202)
async def extension_webhook(payload: ExtensionChunk, db: Client = Depends(get_supabase)):
    """Recebe chunks de transcrição da extensão Chrome."""
    if not payload.text.strip():
        return {"accepted": True}

    db.table("transcript_chunks").insert({
        "session_id": payload.session_id,
        "speaker": payload.speaker,
        "text": payload.text.strip(),
    }).execute()

    # Push to in-memory pipeline (non-blocking)
    from app.services.pipeline import pipeline_manager
    asyncio.create_task(
        pipeline_manager.push_chunk(payload.session_id, payload.text.strip(), payload.speaker)
    )

    return {"accepted": True}


@router.post("/recall", status_code=202)
async def recall_webhook(request: Request, db: Client = Depends(get_supabase)):
    """Receive real-time transcript chunks from Recall.ai."""
    payload = await request.json()
    event = payload.get("event")

    if event != "transcript.data":
        return {"accepted": True}

    data = payload.get("data", {})
    bot_id = data.get("bot", {}).get("id")
    session_id = data.get("bot", {}).get("metadata", {}).get("session_id")

    if not session_id:
        if bot_id:
            result = (
                db.table("sessions")
                .select("id")
                .eq("recall_bot_id", bot_id)
                .eq("status", "active")
                .execute()
            )
            if result.data:
                session_id = result.data[0]["id"]

    if not session_id:
        raise HTTPException(status_code=422, detail="Cannot resolve session_id from payload")

    inner = data.get("data", {})
    words = inner.get("words", [])
    text = " ".join(w.get("text", "") for w in words).strip()
    participant = inner.get("participant", {})
    speaker = participant.get("name")

    if text:
        db.table("transcript_chunks").insert({
            "session_id": session_id,
            "speaker": speaker,
            "text": text,
        }).execute()

        from app.services.pipeline import pipeline_manager
        asyncio.create_task(pipeline_manager.push_chunk(session_id, text, speaker))

    return {"accepted": True}
