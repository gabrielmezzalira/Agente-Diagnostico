import json
from datetime import datetime, timezone

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.database import get_supabase
from app.services.pipeline import pipeline_manager
from app.services.ws_manager import ws_manager

router = APIRouter(tags=["websocket"])


@router.websocket("/ws/{session_id}")
async def websocket_endpoint(session_id: str, ws: WebSocket):
    await ws_manager.connect(session_id, ws)
    pipeline = await pipeline_manager.get_or_create(session_id)
    if pipeline is None:
        await ws.close(code=4004, reason="Session not found or not active")
        ws_manager.disconnect(session_id, ws)
        return

    # Send current state to the newly connected client
    await ws.send_text(json.dumps({
        "event": "initial_state",
        "data": {
            "coverage": pipeline.state.coverage_to_dict(),
            "red_flags": [rf.__dict__ for rf in pipeline.state.red_flags],
            "questions": [
                q.__dict__ for q in pipeline.state.questions
                if q.status in ("queued", "pinned")
            ],
            "transcript": pipeline.state.transcript_chunks,
            "budget": pipeline._budget_payload(),
        },
    }))

    try:
        while True:
            raw = await ws.receive_text()
            try:
                msg = json.loads(raw)
            except json.JSONDecodeError:
                continue

            event = msg.get("event", "")
            data = msg.get("data", {})

            if event == "generate_questions":
                await pipeline.trigger_questions()

            elif event == "force_classify":
                import asyncio
                asyncio.create_task(pipeline._run_coverage_classifier())

            elif event in ("pin_question", "dismiss_question", "use_question"):
                qid = data.get("question_id")
                if qid:
                    status_map = {
                        "pin_question": "pinned",
                        "dismiss_question": "dismissed",
                        "use_question": "used",
                    }
                    new_status = status_map[event]
                    for q in pipeline.state.questions:
                        if q.id == qid:
                            q.status = new_status
                    db = get_supabase()
                    db.table("questions").update({"status": new_status}).eq("id", qid).execute()

            elif event == "finish_session":
                db = get_supabase()
                db.table("sessions").update({
                    "status": "finished",
                    "finished_at": datetime.now(timezone.utc).isoformat(),
                    "tokens_used": pipeline.state.tokens_used,
                    "cost_usd": str(round(pipeline.state.cost_usd, 8)),
                }).eq("id", session_id).execute()
                await pipeline_manager.stop_session(session_id)
                break

    except WebSocketDisconnect:
        pass
    finally:
        ws_manager.disconnect(session_id, ws)
