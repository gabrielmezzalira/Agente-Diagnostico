# =============================================================================
# routers/pricing_features.py
#
# Responsabilidade única: roteamento HTTP para o sub-domínio de features
# de precificação. Thin router — sem lógica de negócio, sem db.table().
# =============================================================================

from uuid import UUID

from fastapi import APIRouter, Depends, status
from supabase import Client

from app.database import get_supabase
from app.models.pricing_features import (
    PricingFeatureCreate,
    PricingFeatureResponse,
    PricingFeatureUpdate,
)
from app.repositories.pricing_repository import PricingRepository
from app.services.pricing_service import PricingService

router = APIRouter(tags=["pricing-features"])


def _get_service(db: Client = Depends(get_supabase)) -> PricingService:
    repo = PricingRepository(db)
    return PricingService(repo)


@router.get(
    "/pricings/{pricing_id}/features",
    response_model=list[PricingFeatureResponse],
)
async def list_features(
    pricing_id: UUID,
    service: PricingService = Depends(_get_service),
) -> list[PricingFeatureResponse]:
    return service.list_features(str(pricing_id))


@router.post(
    "/pricings/{pricing_id}/features",
    response_model=PricingFeatureResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_feature(
    pricing_id: UUID,
    body: PricingFeatureCreate,
    service: PricingService = Depends(_get_service),
) -> PricingFeatureResponse:
    return service.create_feature(str(pricing_id), body)


@router.put(
    "/pricings/{pricing_id}/features/{feature_id}",
    response_model=PricingFeatureResponse,
)
async def update_feature(
    pricing_id: UUID,
    feature_id: UUID,
    payload: PricingFeatureUpdate,
    service: PricingService = Depends(_get_service),
) -> PricingFeatureResponse:
    return service.update_feature(str(pricing_id), str(feature_id), payload)


@router.delete(
    "/pricings/{pricing_id}/features/{feature_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_feature(
    pricing_id: UUID,
    feature_id: UUID,
    service: PricingService = Depends(_get_service),
) -> None:
    service.delete_feature(str(pricing_id), str(feature_id))
