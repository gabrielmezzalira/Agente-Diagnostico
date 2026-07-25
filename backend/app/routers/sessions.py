import asyncio
import io
import logging
import os
from datetime import datetime, timezone
from typing import Optional
from uuid import UUID

import pdfplumber
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from pydantic import BaseModel
from supabase import Client, create_client

from app.database import get_supabase
from app.models.sessions import ReportResponse, SessionCreate, SessionResponse
from app.services import llm as llm_service
from app.services.llm import tokens_to_usd
from app.services.tunnel import tunnel_manager
from app.services.recall import RecallService

router = APIRouter(prefix="/sessions", tags=["sessions"])

_log = logging.getLogger(__name__)


class DiagnosticStartPayload(BaseModel):
    name: str
    client: str
    source: str = "extension"
    runId: Optional[str] = None


@router.post("/start", status_code=status.HTTP_201_CREATED)
async def start_diagnostic_session(
    payload: DiagnosticStartPayload, db: Client = Depends(get_supabase)
):
    """Cria projeto + sessão em um único passo para a integração CITi Flow → Agente Diagnóstico."""
    gemini_key = os.environ.get("GEMINI_API_KEY", "")
    secret_id = None
    if gemini_key:
        try:
            secret_id = db.rpc(
                "vault_create_secret",
                {"p_secret": gemini_key, "p_name": f"gemini-citiflow-{payload.client}"},
            ).execute().data
        except Exception as exc:
            _log.warning("vault não disponível, projeto sem chave: %s", exc)

    project_row: dict = {
        "name": payload.name,
        "client": payload.client,
        "source": payload.source,
        "question_ttl_seconds": 30,
    }
    if secret_id:
        project_row["gemini_api_key_secret_id"] = secret_id
    if payload.runId:
        project_row["citi_flow_run_id"] = payload.runId

    project_result = db.table("projects").insert(project_row).execute()
    if not project_result.data:
        raise HTTPException(status_code=500, detail="Failed to create project")
    project_id = project_result.data[0]["id"]

    session_result = db.table("sessions").insert({
        "project_id": project_id,
        "source": payload.source,
        "status": "active",
    }).execute()
    if not session_result.data:
        raise HTTPException(status_code=500, detail="Failed to create session")
    session_id = session_result.data[0]["id"]

    # Injetar contexto pré-reunião do CITi Flow (best-effort)
    try:
        from app.services.citiflow_client import fetch_briefings_as_context
        company_name = payload.client or payload.name
        if company_name:
            context_md = await fetch_briefings_as_context(company_name)
            if context_md:
                db.table("projects").update(
                    {"pre_meeting_context": context_md}
                ).eq("id", project_id).execute()
    except Exception as exc:
        _log.warning("falha ao buscar contexto pré-reunião do CITi Flow: %s", exc)

    return {"session_id": session_id, "id": session_id, "project_id": project_id}


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
    total_inp = 0
    total_out = 0
    if last_snapshot.data:
        coverage = last_snapshot.data[0].get("coverage_json") or {}

    # Se não há snapshot de cobertura (sessão sem monitoramento ao vivo),
    # classifica a transcrição agora para popular a tabela de cobertura.
    if not coverage:
        prompts_res_early = (
            db.table("session_prompts")
            .select("agent, prompt_text")
            .eq("session_id", str(session_id))
            .execute()
        )
        prompts_early = {row["agent"]: row["prompt_text"] for row in (prompts_res_early.data or [])}
        coverage_data, c_inp, c_out = await llm_service.classify_coverage(
            api_key=gemini_key,
            transcript=transcript,
            project_type=project.get("project_type") or "",
            dms=project.get("data_maturity_score"),
            system_prompt=prompts_early.get("coverage_classifier"),
        )
        total_inp += c_inp
        total_out += c_out
        if coverage_data and "areas" in coverage_data:
            coverage = coverage_data["areas"]
            db.table("coverage_snapshots").insert({
                "session_id": str(session_id),
                "coverage_json": coverage,
            }).execute()

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
    total_inp += inp
    total_out += out

    cost = round(tokens_to_usd(total_inp, total_out), 6)
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
        "tokens_used": (session.get("tokens_used") or 0) + total_inp + total_out,
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
