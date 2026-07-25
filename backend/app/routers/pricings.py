# =============================================================================
# routers/pricings.py
#
# Responsabilidade única: roteamento HTTP para o domínio de precificação.
# Sem lógica de negócio. Sem chamadas diretas ao banco. Apenas:
#   1. Receber a requisição
#   2. Instanciar repo + service via Depends factories
#   3. Delegar ao service
#   4. Retornar a resposta
# =============================================================================

import asyncio
import logging
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import Response
from supabase import Client

from app.core.llm_factory import create_llm
from app.database import get_supabase
from app.models.pricing_features import PricingFeatureResponse
from app.models.pricings import (
    ChatMessageResponse,
    ChatRequest,
    ChatResponse,
    PricingCreateBody,
    PricingResponse,
    PricingUpdate,
    PricingWithDetails,
    SuggestedFeature,
)
from app.repositories.pricing_repository import PricingRepository
from app.services.llm_pricing_service import LLMPricingService
from app.services.pricing_chatbot_service import PricingChatbotService
from app.services.pricing_export_service import PricingExportService
from app.services.pricing_service import PricingService

router = APIRouter(tags=["pricings"])
_log = logging.getLogger(__name__)


def _build_area_pricing(pricing: PricingWithDetails) -> dict:
    outputs = pricing.outputs
    if outputs is None:
        return {}
    scope = [
        {"item": f.bloco, "description": f.funcionalidade, "hours": float(f.horas)}
        for f in (pricing.features or [])
    ]
    team = []
    if pricing.num_analysts and pricing.ticket_price:
        team = [
            {
                "role": "Analista de Dados",
                "hours": float(outputs.total_horas),
                "hourlyRate": float(pricing.ticket_price),
            }
        ]
    return {
        "area": "dados",
        "summary": "Precificação gerada pelo Agente Diagnóstico.",
        "scope": scope,
        "team": team,
        "totalHours": float(outputs.total_horas),
        "totalValue": float(outputs.preco_total),
        "timelineWeeks": float(outputs.num_sprints) * 2,
        "assumptions": [],
        "risks": [],
        "confidence": 0.8,
        "pdfUrl": None,
    }


def _get_service(db: Client = Depends(get_supabase)) -> PricingService:
    repo = PricingRepository(db)
    return PricingService(repo)


@router.get("/projects/{project_id}/pricings", response_model=list[PricingResponse])
async def list_pricings(
    project_id: UUID,
    service: PricingService = Depends(_get_service),
) -> list[PricingResponse]:
    return service.list_pricings(str(project_id))


@router.post(
    "/projects/{project_id}/pricings",
    response_model=PricingResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_pricing(
    project_id: UUID,
    body: PricingCreateBody,
    service: PricingService = Depends(_get_service),
) -> PricingResponse:
    return service.create_pricing(str(project_id), body)


@router.get("/pricings/{pricing_id}", response_model=PricingWithDetails)
async def get_pricing(
    pricing_id: UUID,
    service: PricingService = Depends(_get_service),
) -> PricingWithDetails:
    return service.get_pricing(str(pricing_id))


@router.put("/pricings/{pricing_id}", response_model=PricingResponse)
async def update_pricing(
    pricing_id: UUID,
    payload: PricingUpdate,
    service: PricingService = Depends(_get_service),
) -> PricingResponse:
    return service.update_pricing(str(pricing_id), payload)


@router.delete("/pricings/{pricing_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_pricing(
    pricing_id: UUID,
    service: PricingService = Depends(_get_service),
) -> None:
    service.delete_pricing(str(pricing_id))


@router.post("/pricings/{pricing_id}/approve", response_model=PricingResponse)
async def approve_pricing(
    pricing_id: UUID,
    db: Client = Depends(get_supabase),
    service: PricingService = Depends(_get_service),
) -> PricingResponse:
    result = service.approve_pricing(str(pricing_id))
    try:
        from app.services.citiflow_client import post_diagnostic_pricing
        full_pricing: PricingWithDetails = service.get_pricing(str(pricing_id))
        pricing_payload = _build_area_pricing(full_pricing)
        project_res = (
            db.table("projects")
            .select("citi_flow_run_id")
            .eq("id", str(full_pricing.project_id))
            .execute()
        )
        citi_run_id: str | None = (
            project_res.data[0].get("citi_flow_run_id") if project_res.data else None
        )
        if citi_run_id and pricing_payload:
            asyncio.create_task(post_diagnostic_pricing(citi_run_id, pricing_payload))
    except Exception as exc:
        _log.warning("handoff diagnóstico falhou: %s", exc)
    return result


@router.get("/pricings/{pricing_id}/export/pdf")
async def export_pricing_pdf(
    pricing_id: UUID,
    db: Client = Depends(get_supabase),
) -> Response:
    repo = PricingRepository(db)
    svc = PricingExportService(repo)
    pdf_bytes, filename = svc.generate_pdf(str(pricing_id))
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/projects/{project_id}/pricing-history")
async def list_pricing_history(
    project_id: UUID,
    service: PricingService = Depends(_get_service),
) -> list[dict]:
    return service.list_pricing_history(str(project_id))


# ---------------------------------------------------------------------------
# LLM-powered endpoints — factory wires repo + vault + LLM; endpoints forward
# ---------------------------------------------------------------------------


def _get_llm_pricing_service(
    pricing_id: UUID,
    db: Client = Depends(get_supabase),
) -> LLMPricingService:
    """FastAPI Depends factory: resolves repo, vault config and creates LLMPricingService.

    Toda lógica de lookup (tabela projects e Supabase Vault) fica nos métodos
    do repositório — o router não toca o banco diretamente. Isso é infra
    wiring, não lógica de negócio: o padrão é idêntico ao _get_service
    existente, mas com LLM adicional. A factory valida existência do pricing
    antes de criar o service; o service resolve project_id internamente.
    """
    repo = PricingRepository(db)
    pricing = repo.get_pricing(str(pricing_id))
    if not pricing:
        raise HTTPException(status_code=404, detail="Pricing not found")
    project_id = str(pricing["project_id"])
    llm_config = repo.get_project_llm_config(project_id)
    api_key = repo.decrypt_pricing_api_key(llm_config["secret_id"])
    llm = create_llm(llm_config["provider"], llm_config["model"], api_key)
    return LLMPricingService(repo, llm)


@router.post(
    "/pricings/{pricing_id}/import-from-diagnosis",
    response_model=list[PricingFeatureResponse],
    status_code=status.HTTP_201_CREATED,
)
async def import_from_diagnosis(
    pricing_id: UUID,
    svc: LLMPricingService = Depends(_get_llm_pricing_service),
) -> list[PricingFeatureResponse]:
    return await asyncio.to_thread(svc.import_from_diagnosis, str(pricing_id))


@router.post(
    "/pricings/{pricing_id}/suggest-features",
    response_model=list[SuggestedFeature],
)
async def suggest_features(
    pricing_id: UUID,
    svc: LLMPricingService = Depends(_get_llm_pricing_service),
) -> list[SuggestedFeature]:
    return await asyncio.to_thread(svc.suggest_features, str(pricing_id))


# ---------------------------------------------------------------------------
# Chat endpoints — LangGraph agent with tool calls
# ---------------------------------------------------------------------------


def _get_chatbot_service(
    pricing_id: UUID,
    db: Client = Depends(get_supabase),
) -> PricingChatbotService:
    """Depends factory: resolve repo, vault e LLM para o chatbot."""
    repo = PricingRepository(db)
    pricing = repo.get_pricing(str(pricing_id))
    if not pricing:
        raise HTTPException(status_code=404, detail="Pricing not found")
    project_id = str(pricing["project_id"])
    llm_config = repo.get_project_llm_config(project_id)
    api_key = repo.decrypt_pricing_api_key(llm_config["secret_id"])
    llm = create_llm(llm_config["provider"], llm_config["model"], api_key)
    return PricingChatbotService(repo, llm)


@router.get(
    "/pricings/{pricing_id}/chat-history",
    response_model=list[ChatMessageResponse],
)
async def get_chat_history(
    pricing_id: UUID,
    db: Client = Depends(get_supabase),
) -> list[ChatMessageResponse]:
    repo = PricingRepository(db)
    rows = repo.list_chat_messages(str(pricing_id))
    return [ChatMessageResponse(**r) for r in rows]


@router.post("/pricings/{pricing_id}/chat", response_model=ChatResponse)
async def chat(
    pricing_id: UUID,
    body: ChatRequest,
    svc: PricingChatbotService = Depends(_get_chatbot_service),
) -> ChatResponse:
    result = await asyncio.to_thread(svc.chat, str(pricing_id), body.message)
    return ChatResponse(**result)
