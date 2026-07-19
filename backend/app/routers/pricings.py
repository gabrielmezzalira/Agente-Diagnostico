# =============================================================================
# routers/pricings.py
#
# Responsabilidade única: roteamento HTTP para o domínio de precificação.
# Sem lógica de negócio. Sem chamadas db.table(). Apenas:
#   1. Receber a requisição
#   2. Instanciar repo + service
#   3. Delegar ao service
#   4. Retornar a resposta
# =============================================================================

from uuid import UUID

from fastapi import APIRouter, Depends, status
from supabase import Client

from app.database import get_supabase
from app.models.pricings import (
    PricingCreateBody,
    PricingResponse,
    PricingUpdate,
    PricingWithDetails,
)
from app.repositories.pricing_repository import PricingRepository
from app.services.pricing_service import PricingService

router = APIRouter(tags=["pricings"])


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
    service: PricingService = Depends(_get_service),
) -> PricingResponse:
    return service.approve_pricing(str(pricing_id))


@router.get("/projects/{project_id}/pricing-history")
async def list_pricing_history(
    project_id: UUID,
    service: PricingService = Depends(_get_service),
) -> list[dict]:
    return service.list_pricing_history(str(project_id))
