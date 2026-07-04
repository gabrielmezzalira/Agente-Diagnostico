import asyncio
import io
import os
from datetime import datetime, timezone
from uuid import UUID

import pdfplumber
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from supabase import Client, create_client

from app.database import get_supabase
from app.models.sessions import ReportResponse, SessionCreate, SessionResponse
from app.services import llm as llm_service
from app.services.llm import tokens_to_usd
from app.services.tunnel import tunnel_manager
from app.services.recall import RecallService

router = APIRouter(prefix="/sessions", tags=["sessions"])


def _get_recall() -> RecallService | None:
    key = os.environ.get("RECALL_API_KEY", "")
    region = os.environ.get("RECALL_REGION", "us-west-2")
    return RecallService(key, region) if key else None


@router.get("/", response_model=list[SessionResponse])
async def list_sessions(project_id: UUID, db: Client = Depends(get_supabase)):
    result = (
        db.table("sessions")
        .select("*")
        .eq("project_id", str(project_id))
        .order("started_at", desc=True)
        .execute()
    )
    return result.data


@router.post("/", response_model=SessionResponse, status_code=status.HTTP_201_CREATED)
async def create_session(payload: SessionCreate, db: Client = Depends(get_supabase)):
    project = (
        db.table("projects")
        .select("meeting_url, source")
        .eq("id", str(payload.project_id))
        .execute()
    )
    if not project.data:
        raise HTTPException(status_code=404, detail="Project not found")

    project_data = project.data[0]
    source = payload.source or project_data.get("source", "recall")
    meeting_url = payload.meeting_url or project_data.get("meeting_url")

    row = {
        "project_id": str(payload.project_id),
        "meeting_url": meeting_url,
        "source": source,
        "status": "active",
    }
    result = db.table("sessions").insert(row).execute()
    session = result.data[0]
    session_id = session["id"]

    if source == "recall":
        if not meeting_url:
            raise HTTPException(status_code=422, detail="meeting_url is required for source=recall")
        recall = _get_recall()
        if not recall:
            raise HTTPException(status_code=503, detail="RECALL_API_KEY not configured")
        tunnel_url = os.environ.get("PUBLIC_WEBHOOK_URL", "")
        if not tunnel_url:
            raise HTTPException(status_code=503, detail="PUBLIC_WEBHOOK_URL not configured — needed for Recall.ai webhook")
        webhook_url = f"{tunnel_url.rstrip('/')}/webhook/recall"
        bot_id = recall.create_bot(meeting_url, webhook_url, session_id)
        db.table("sessions").update({"recall_bot_id": bot_id}).eq("id", session_id).execute()
        session["recall_bot_id"] = bot_id

    elif source == "extension":
        pass  # extensão Chrome faz POST direto para localhost — sem tunnel necessário

    return session


@router.get("/{session_id}", response_model=SessionResponse)
async def get_session(session_id: UUID, db: Client = Depends(get_supabase)):
    result = (
        db.table("sessions")
        .select("*")
        .eq("id", str(session_id))
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Session not found")
    return result.data[0]


@router.post("/{session_id}/finish", response_model=SessionResponse)
async def finish_session(session_id: UUID, db: Client = Depends(get_supabase)):
    existing = (
        db.table("sessions")
        .select("id, status, source, recall_bot_id")
        .eq("id", str(session_id))
        .execute()
    )
    if not existing.data:
        raise HTTPException(status_code=404, detail="Session not found")
    row = existing.data[0]
    if row["status"] != "active":
        raise HTTPException(status_code=409, detail="Session is not active")

    if row["source"] == "recall" and row.get("recall_bot_id"):
        recall = _get_recall()
        if recall:
            recall.stop_bot(row["recall_bot_id"])
        await tunnel_manager.stop(str(session_id))

    # extension mode: sem tunnel para derrubar

    result = (
        db.table("sessions")
        .update({"status": "finished", "finished_at": datetime.now(timezone.utc).isoformat()})
        .eq("id", str(session_id))
        .execute()
    )
    return result.data[0]


@router.post("/{session_id}/questions/generate")
async def generate_session_questions(session_id: UUID, db: Client = Depends(get_supabase)):
    from app.services.pipeline import pipeline_manager
    pipeline = await pipeline_manager.get_or_create(str(session_id))
    if not pipeline:
        raise HTTPException(status_code=404, detail="Session not found or not active")
    await pipeline.trigger_questions()
    return {"triggered": True}


@router.get("/{session_id}/report", response_model=ReportResponse)
async def get_session_report(session_id: UUID, db: Client = Depends(get_supabase)):
    result = (
        db.table("reports")
        .select("*")
        .eq("session_id", str(session_id))
        .order("generated_at", desc=True)
        .limit(1)
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="No report found for this session")
    return result.data[0]


@router.post("/{session_id}/report", response_model=ReportResponse, status_code=status.HTTP_201_CREATED)
async def generate_session_report(session_id: UUID, db: Client = Depends(get_supabase)):
    from app.services.pipeline import pipeline_manager
    pipeline = await pipeline_manager.get_or_create(str(session_id), allow_finished=True)
    if not pipeline:
        raise HTTPException(status_code=404, detail="Session not found or not active")
    markdown = await pipeline.trigger_report()
    if not markdown:
        raise HTTPException(status_code=422, detail="Could not generate report — check Gemini API key")
    result = (
        db.table("reports")
        .select("*")
        .eq("session_id", str(session_id))
        .order("generated_at", desc=True)
        .limit(1)
        .execute()
    )
    return result.data[0]


@router.post(
    "/{session_id}/transcript/upload",
    response_model=ReportResponse,
    status_code=status.HTTP_201_CREATED,
)
async def upload_pdf_transcript(
    session_id: UUID,
    file: UploadFile = File(...),
    db: Client = Depends(get_supabase),
):
    """Ingere um PDF com transcrição da reunião e gera um relatório para a sessão."""
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=422, detail="O arquivo deve ser um PDF (.pdf)")

    session_res = (
        db.table("sessions")
        .select("*, projects(*)")
        .eq("id", str(session_id))
        .execute()
    )
    if not session_res.data:
        raise HTTPException(status_code=404, detail="Session not found")

    session = session_res.data[0]
    project = session.get("projects") or {}

    gemini_key = ""
    secret_id = project.get("gemini_api_key_secret_id")
    if secret_id:
        try:
            key_res = db.rpc("vault_get_secret", {"p_secret_id": secret_id}).execute()
            gemini_key = key_res.data or ""
        except Exception:
            pass
    if not gemini_key:
        raise HTTPException(status_code=503, detail="Chave Gemini não configurada para este projeto")

    pdf_bytes = await file.read()
    try:
        with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
            pages_text = [page.extract_text() or "" for page in pdf.pages]
        transcript = "\n\n".join(p for p in pages_text if p.strip())
    except Exception as exc:
        raise HTTPException(status_code=422, detail=f"Erro ao processar PDF: {exc}") from exc

    if not transcript.strip():
        raise HTTPException(status_code=422, detail="Não foi possível extrair texto do PDF")

    last_snapshot = (
        db.table("coverage_snapshots")
        .select("coverage_json")
        .eq("session_id", str(session_id))
        .order("snapshot_at", desc=True)
        .limit(1)
        .execute()
    )
    coverage: dict = {}
    if last_snapshot.data:
        coverage = last_snapshot.data[0].get("coverage_json") or {}

    red_flags_res = (
        db.table("red_flags")
        .select("text, severity, evidence")
        .eq("session_id", str(session_id))
        .execute()
    )
    red_flags = red_flags_res.data or []

    questions_res = (
        db.table("questions")
        .select("text, status")
        .eq("session_id", str(session_id))
        .in_("status", ["used", "pinned"])
        .execute()
    )
    questions_used = [q["text"] for q in (questions_res.data or [])]

    project_type = project.get("project_type") or ""
    dms = project.get("data_maturity_score")
    pre_meeting_context = project.get("pre_meeting_context") or ""

    prompts_res = (
        db.table("session_prompts")
        .select("agent, prompt_text")
        .eq("session_id", str(session_id))
        .execute()
    )
    prompts = {row["agent"]: row["prompt_text"] for row in (prompts_res.data or [])}

    markdown, inp, out = await llm_service.generate_report(
        api_key=gemini_key,
        transcript=transcript,
        coverage=coverage,
        red_flags=red_flags,
        questions_used=questions_used,
        project_type=project_type,
        dms=dms,
        pre_meeting_context=pre_meeting_context,
        system_prompt=prompts.get("report_generator"),
    )

    cost = round(tokens_to_usd(inp, out), 6)
    result = (
        db.table("reports")
        .insert({
            "session_id": str(session_id),
            "markdown_content": markdown,
            "cost_usd": str(cost),
        })
        .execute()
    )

    db.table("sessions").update({
        "tokens_used": (session.get("tokens_used") or 0) + inp + out,
        "cost_usd": str(round((float(session.get("cost_usd") or 0)) + cost, 8)),
    }).eq("id", str(session_id)).execute()

    return result.data[0]


async def _start_tunnel_and_save(session_id: str) -> None:
    url = await tunnel_manager.start(session_id)
    if not url:
        return
    supabase_url = os.environ.get("SUPABASE_URL", "")
    supabase_key = os.environ.get("SUPABASE_KEY", "")
    if supabase_url and supabase_key:
        db = create_client(supabase_url, supabase_key)
        db.table("sessions").update({"tunnel_url": url}).eq("id", session_id).execute()
