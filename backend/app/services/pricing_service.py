# =============================================================================
# services/pricing_service.py
#
# Responsabilidade única: lógica de negócio do domínio de precificação.
# Orquestra o PricingRepository e o PricingCalculator.
# Sem chamadas diretas a db.table(). Levanta HTTPException quando necessário.
# =============================================================================

from datetime import datetime, timezone
from decimal import Decimal

from fastapi import HTTPException

from app.core.pricing_calculator import PricingCalculator, PricingInputs
from app.models.pricing_features import (
    PricingFeatureCreate,
    PricingFeatureResponse,
    PricingFeatureUpdate,
)
from app.models.pricings import (
    PricingCreateBody,
    PricingOutputs,
    PricingResponse,
    PricingWithDetails,
    PricingUpdate,
)
from app.repositories.pricing_repository import PricingRepository


class PricingService:
    def __init__(self, repo: PricingRepository) -> None:
        self._repo = repo

    # -------------------------------------------------------------------------
    # Pricings CRUD
    # -------------------------------------------------------------------------

    def list_pricings(self, project_id: str) -> list[PricingResponse]:
        rows = self._repo.list_pricings(project_id)
        return [PricingResponse(**r) for r in rows]

    def create_pricing(self, project_id: str, body: PricingCreateBody) -> PricingResponse:
        project = self._repo.get_project(project_id)
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")

        row = {
            "project_id": project_id,
            "status": "draft",
            "start_date": body.start_date.isoformat(),
            "num_analysts": body.num_analysts,
            "hours_per_day": str(body.hours_per_day),
            "ticket_price": str(body.ticket_price),
            "extra_calendar_days": body.extra_calendar_days,
        }
        result = self._repo.insert_pricing(row)
        return PricingResponse(**result)

    def get_pricing(self, pricing_id: str) -> PricingWithDetails:
        pricing = self._repo.get_pricing(pricing_id)
        if not pricing:
            raise HTTPException(status_code=404, detail="Pricing not found")

        features = self._repo.get_pricing_features(pricing_id)
        feature_responses = [PricingFeatureResponse(**f) for f in features]

        outputs: PricingOutputs | None = None
        if (
            pricing.get("start_date")
            and pricing.get("num_analysts")
            and pricing.get("hours_per_day")
            and pricing.get("ticket_price")
        ):
            inputs = _build_pricing_inputs(pricing)
            calc_outputs = PricingCalculator.calculate(features, inputs)
            outputs = PricingOutputs(**calc_outputs.model_dump())

        return PricingWithDetails(
            **pricing,
            features=feature_responses,
            outputs=outputs,
        )

    def update_pricing(self, pricing_id: str, payload: PricingUpdate) -> PricingResponse:
        pricing = self._repo.get_pricing(pricing_id)
        if not pricing:
            raise HTTPException(status_code=404, detail="Pricing not found")
        if pricing.get("status") == "approved":
            raise HTTPException(status_code=409, detail="Cannot modify an approved pricing")

        updates = payload.model_dump(exclude_none=True)
        if "start_date" in updates:
            updates["start_date"] = updates["start_date"].isoformat()
        if "hours_per_day" in updates:
            updates["hours_per_day"] = str(updates["hours_per_day"])
        if "ticket_price" in updates:
            updates["ticket_price"] = str(updates["ticket_price"])
        if "session_id" in updates:
            updates["session_id"] = str(updates["session_id"])

        updates["updated_at"] = datetime.now(timezone.utc).isoformat()

        result = self._repo.update_pricing(pricing_id, updates)
        if not result:
            raise HTTPException(status_code=404, detail="Pricing not found after update")
        return PricingResponse(**result)

    def delete_pricing(self, pricing_id: str) -> None:
        pricing = self._repo.get_pricing(pricing_id)
        if not pricing:
            raise HTTPException(status_code=404, detail="Pricing not found")
        if pricing.get("status") == "approved":
            raise HTTPException(status_code=409, detail="Cannot delete an approved pricing")
        self._repo.delete_pricing(pricing_id)

    # -------------------------------------------------------------------------
    # Approve
    # -------------------------------------------------------------------------

    def approve_pricing(self, pricing_id: str) -> PricingResponse:
        pricing = self._repo.get_pricing(pricing_id)
        if not pricing:
            raise HTTPException(status_code=404, detail="Pricing not found")
        if pricing.get("status") == "approved":
            raise HTTPException(status_code=409, detail="Already approved")

        features = self._repo.get_pricing_features(pricing_id)
        inputs = _build_pricing_inputs(pricing)
        outputs = PricingCalculator.calculate(features, inputs)

        project = self._repo.get_project(str(pricing.get("project_id", "")))

        snapshot = {
            "project_type": (project or {}).get("project_type") or "",
            "inputs": {
                "start_date": str(pricing.get("start_date") or ""),
                "num_analysts": pricing.get("num_analysts"),
                "hours_per_day": float(pricing.get("hours_per_day") or 0),
                "ticket_price": float(pricing.get("ticket_price") or 0),
                "extra_calendar_days": pricing.get("extra_calendar_days", 0),
            },
            "features": [
                {
                    "bloco": f.get("bloco", ""),
                    "funcionalidade": f.get("funcionalidade", ""),
                    "horas": float(f.get("horas") or 0),
                }
                for f in features
            ],
            "outputs": {k: str(v) for k, v in outputs.model_dump().items()},
        }

        self._repo.insert_history(
            {
                "project_id": str(pricing.get("project_id", "")),
                "pricing_id": pricing_id,
                "snapshot": snapshot,
            }
        )
        result = self._repo.update_pricing_status(pricing_id, "approved")
        if not result:
            raise HTTPException(status_code=500, detail="Failed to update pricing status")
        return PricingResponse(**result)

    # -------------------------------------------------------------------------
    # History
    # -------------------------------------------------------------------------

    def list_pricing_history(self, project_id: str) -> list[dict]:
        return self._repo.list_pricing_history(project_id)

    # -------------------------------------------------------------------------
    # Features
    # -------------------------------------------------------------------------

    def list_features(self, pricing_id: str) -> list[PricingFeatureResponse]:
        pricing = self._repo.get_pricing(pricing_id)
        if not pricing:
            raise HTTPException(status_code=404, detail="Pricing not found")
        rows = self._repo.get_pricing_features(pricing_id)
        return [PricingFeatureResponse(**r) for r in rows]

    def create_feature(
        self, pricing_id: str, body: PricingFeatureCreate
    ) -> PricingFeatureResponse:
        pricing = self._repo.get_pricing(pricing_id)
        if not pricing:
            raise HTTPException(status_code=404, detail="Pricing not found")

        row = {
            "pricing_id": pricing_id,
            "bloco": body.bloco,
            "funcionalidade": body.funcionalidade,
            "horas": str(body.horas),
            "citi_responsible": body.citi_responsible,
            "ordem": body.ordem,
        }
        result = self._repo.insert_feature(row)
        return PricingFeatureResponse(**result)

    def update_feature(
        self, pricing_id: str, feature_id: str, payload: PricingFeatureUpdate
    ) -> PricingFeatureResponse:
        feature = self._repo.get_feature(feature_id, pricing_id)
        if not feature:
            raise HTTPException(status_code=404, detail="Feature not found")

        updates = payload.model_dump(exclude_none=True)
        if "horas" in updates:
            updates["horas"] = str(updates["horas"])

        result = self._repo.update_feature(feature_id, updates)
        if not result:
            raise HTTPException(status_code=404, detail="Feature not found after update")
        return PricingFeatureResponse(**result)

    def delete_feature(self, pricing_id: str, feature_id: str) -> None:
        feature = self._repo.get_feature(feature_id, pricing_id)
        if not feature:
            raise HTTPException(status_code=404, detail="Feature not found")
        self._repo.delete_feature(feature_id)


# -------------------------------------------------------------------------
# Internal helpers
# -------------------------------------------------------------------------

def _build_pricing_inputs(pricing: dict) -> PricingInputs:
    """Build a PricingInputs dataclass from a Supabase pricing row dict."""
    from datetime import date as date_type

    raw_start = pricing.get("start_date")
    if isinstance(raw_start, date_type):
        start_date = raw_start
    else:
        start_date = date_type.fromisoformat(str(raw_start))

    return PricingInputs(
        start_date=start_date,
        num_analysts=int(pricing.get("num_analysts") or 1),
        hours_per_day=Decimal(str(pricing.get("hours_per_day") or 0)),
        ticket_price=Decimal(str(pricing.get("ticket_price") or 0)),
        extra_calendar_days=int(pricing.get("extra_calendar_days") or 0),
    )
