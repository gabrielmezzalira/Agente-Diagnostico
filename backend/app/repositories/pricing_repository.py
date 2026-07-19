# =============================================================================
# repositories/pricing_repository.py
#
# Responsabilidade única: todas as chamadas db.table() relacionadas ao domínio
# de precificação. Sem lógica de negócio.
# Retorna dicts ou listas de dicts brutos do Supabase.
# =============================================================================

from fastapi import HTTPException
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

    # -------------------------------------------------------------------------
    # LLM config (Vault lookup for Precificador)
    # -------------------------------------------------------------------------

    def get_project_llm_config(self, project_id: str) -> dict:
        """Retorna configuração LLM do Precificador para um projeto.

        Lê pricing_llm_provider, pricing_llm_model e pricing_api_key_secret_id
        da tabela projects. Lança 422 se a chave de API não estiver configurada.

        Args:
            project_id: UUID do projeto

        Returns:
            Dict com chaves: provider, model, secret_id
        """
        result = (
            self._db.table("projects")
            .select("pricing_llm_provider, pricing_llm_model, pricing_api_key_secret_id")
            .eq("id", project_id)
            .execute()
        )
        if not result.data:
            raise HTTPException(status_code=404, detail="Project not found")
        row = result.data[0]
        if not row.get("pricing_api_key_secret_id"):
            raise HTTPException(
                status_code=422,
                detail=(
                    "Chave de API do Precificador não configurada neste projeto. "
                    "Configure em Configurações do Projeto."
                ),
            )
        return {
            "provider": row.get("pricing_llm_provider") or "",
            "model": row.get("pricing_llm_model") or "",
            "secret_id": str(row["pricing_api_key_secret_id"]),
        }

    def decrypt_pricing_api_key(self, secret_id: str) -> str:
        """Descriptografa a chave de API do Precificador via Supabase Vault.

        A chave plaintext fica em memória apenas durante o request e nunca é
        incluída em logs ou respostas de erro (T-12-03).

        Args:
            secret_id: UUID do segredo no Supabase Vault

        Returns:
            Chave de API plaintext

        Raises:
            HTTPException 500 se o segredo não for encontrado
        """
        result = (
            self._db.table("vault.decrypted_secrets")
            .select("secret")
            .eq("id", secret_id)
            .execute()
        )
        if not result.data:
            raise HTTPException(
                status_code=500,
                detail="Falha ao descriptografar chave de API do Precificador.",
            )
        return result.data[0]["secret"]
