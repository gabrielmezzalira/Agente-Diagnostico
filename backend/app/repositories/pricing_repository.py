# =============================================================================
# repositories/pricing_repository.py
#
# Responsabilidade única: todas as chamadas db.table() relacionadas ao domínio
# de precificação. Sem lógica de negócio. Sem HTTPException.
# Retorna dicts ou listas de dicts brutos do Supabase.
# =============================================================================

from supabase import Client


class PricingRepository:
    def __init__(self, db: Client) -> None:
        self._db = db

    # -------------------------------------------------------------------------
    # Projects (lookup)
    # -------------------------------------------------------------------------

    def get_project(self, project_id: str) -> dict | None:
        result = (
            self._db.table("projects")
            .select("id, project_type")
            .eq("id", project_id)
            .execute()
        )
        return result.data[0] if result.data else None

    # -------------------------------------------------------------------------
    # Pricings
    # -------------------------------------------------------------------------

    def list_pricings(self, project_id: str) -> list[dict]:
        result = (
            self._db.table("pricings")
            .select("*")
            .eq("project_id", project_id)
            .order("created_at", desc=True)
            .execute()
        )
        return result.data or []

    def insert_pricing(self, row: dict) -> dict:
        result = self._db.table("pricings").insert(row).execute()
        return result.data[0]

    def get_pricing(self, pricing_id: str) -> dict | None:
        result = (
            self._db.table("pricings")
            .select("*")
            .eq("id", pricing_id)
            .execute()
        )
        return result.data[0] if result.data else None

    def update_pricing(self, pricing_id: str, updates: dict) -> dict | None:
        result = (
            self._db.table("pricings")
            .update(updates)
            .eq("id", pricing_id)
            .execute()
        )
        return result.data[0] if result.data else None

    def delete_pricing(self, pricing_id: str) -> None:
        self._db.table("pricings").delete().eq("id", pricing_id).execute()

    def update_pricing_status(self, pricing_id: str, status: str) -> dict | None:
        result = (
            self._db.table("pricings")
            .update({"status": status})
            .eq("id", pricing_id)
            .execute()
        )
        return result.data[0] if result.data else None

    # -------------------------------------------------------------------------
    # Pricing history
    # -------------------------------------------------------------------------

    def insert_history(self, row: dict) -> dict:
        result = self._db.table("pricing_history").insert(row).execute()
        return result.data[0]

    def list_pricing_history(self, project_id: str) -> list[dict]:
        result = (
            self._db.table("pricing_history")
            .select("*")
            .eq("project_id", project_id)
            .order("approved_at", desc=True)
            .execute()
        )
        return result.data or []

    # -------------------------------------------------------------------------
    # Pricing features
    # -------------------------------------------------------------------------

    def get_pricing_features(self, pricing_id: str) -> list[dict]:
        result = (
            self._db.table("pricing_features")
            .select("*")
            .eq("pricing_id", pricing_id)
            .order("ordem")
            .execute()
        )
        return result.data or []

    def insert_feature(self, row: dict) -> dict:
        result = self._db.table("pricing_features").insert(row).execute()
        return result.data[0]

    def get_feature(self, feature_id: str, pricing_id: str) -> dict | None:
        result = (
            self._db.table("pricing_features")
            .select("*")
            .eq("id", feature_id)
            .eq("pricing_id", pricing_id)
            .execute()
        )
        return result.data[0] if result.data else None

    def update_feature(self, feature_id: str, updates: dict) -> dict | None:
        result = (
            self._db.table("pricing_features")
            .update(updates)
            .eq("id", feature_id)
            .execute()
        )
        return result.data[0] if result.data else None

    def delete_feature(self, feature_id: str) -> None:
        self._db.table("pricing_features").delete().eq("id", feature_id).execute()
