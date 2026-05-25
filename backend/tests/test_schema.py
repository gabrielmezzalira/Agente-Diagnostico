# =============================================================================
# test_schema.py
#
# Smoke test: verifica que as 9 tabelas do schema existem no Supabase.
#
# Cobre: PROJ-05 — Supabase schema initialized: all 9 tables.
#
# Requer:
#   - backend/.env com SUPABASE_URL e SUPABASE_KEY configurados
#   - Migration supabase/migrations/20260524000000_initial_schema.sql aplicada
# =============================================================================

EXPECTED_TABLES = {
    "projects",
    "sessions",
    "questions",
    "red_flags",
    "coverage_snapshots",
    "reports",
    "question_bank",
    "session_prompts",
    "transcript_chunks",
}


def test_tables_exist(supabase_client):
    """Verifica que as 9 tabelas do schema existem no Supabase.

    Consulta information_schema.tables filtrando pelo schema 'public' e
    pelos nomes esperados. Falha se alguma tabela estiver faltando.
    """
    result = supabase_client.table("information_schema.tables").select(
        "table_name"
    ).eq("table_schema", "public").in_(
        "table_name", list(EXPECTED_TABLES)
    ).execute()

    found_tables = {row["table_name"] for row in result.data}
    missing = EXPECTED_TABLES - found_tables

    assert len(result.data) == 9, (
        f"Expected 9 tables, found {len(result.data)}. "
        f"Missing: {missing or 'none'}. "
        f"Found: {found_tables}"
    )
