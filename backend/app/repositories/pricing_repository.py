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

    # -------------------------------------------------------------------------
    # Diagnostic reports (for LLM context)
    # -------------------------------------------------------------------------

    def get_project_reports(self, project_id: str) -> list[dict]:
        """Busca relatórios de diagnóstico associados a um projeto via sessions.

        Args:
            project_id: UUID do projeto

        Returns:
            Lista de dicts com id, markdown_content e generated_at, ordenados
            por generated_at desc. Retorna [] se não houver sessões ou relatórios.
        """
        sessions = (
            self._db.table("sessions")
            .select("id")
            .eq("project_id", project_id)
            .execute()
        )
        if not sessions.data:
            return []

        session_ids = [s["id"] for s in sessions.data]
        result = (
            self._db.table("reports")
            .select("id, markdown_content, generated_at")
            .in_("session_id", session_ids)
            .order("generated_at", desc=True)
            .execute()
        )
        return result.data or []

    # -------------------------------------------------------------------------
    # Pricing history lookup (for LLM suggestions context)
    # -------------------------------------------------------------------------

    def get_top_history_by_type(self, project_type: str, limit: int = 3) -> list[dict]:
        """Busca os N pricings aprovados mais recentes de um determinado project_type.

        Usa filtro PostgREST sobre campo JSONB para evitar filtragem Python-side.

        Args:
            project_type: tipo de projeto (ex: "bi", "ml", "data_engineering")
            limit: número máximo de registros retornados (default: 3)

        Returns:
            Lista de dicts de pricing_history ordenados por approved_at desc.
        """
        result = (
            self._db.table("pricing_history")
            .select("*")
            .filter("snapshot->>project_type", "eq", project_type)
            .order("approved_at", desc=True)
            .limit(limit)
            .execute()
        )
        return result.data or []

    # -------------------------------------------------------------------------
    # Bulk feature insert (for LLM suggestion application)
    # -------------------------------------------------------------------------

    def bulk_insert_features(self, pricing_id: str, features: list[dict]) -> list[dict]:
        """Insere múltiplas features em lote com um único request ao Supabase.

        Args:
            pricing_id: UUID do pricing ao qual as features pertencem
            features: lista de dicts com bloco, funcionalidade, horas (e outros campos opcionais)

        Returns:
            Lista de dicts inseridos com ids gerados. Retorna [] se features vazio.
        """
        if not features:
            return []

        rows = [{**f, "pricing_id": pricing_id} for f in features]
        result = self._db.table("pricing_features").insert(rows).execute()
        return result.data or []
