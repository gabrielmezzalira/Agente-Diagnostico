# =============================================================================
# conftest.py
#
# Fixtures compartilhadas para os testes de integração do backend.
#
# Requer:
#   - backend/.env com SUPABASE_URL e SUPABASE_KEY configurados
#   - Schema aplicado no Supabase (via supabase/migrations/...initial_schema.sql)
# =============================================================================

import os
import pytest
from dotenv import load_dotenv

# Carrega .env antes de qualquer importação que precise das variáveis
load_dotenv()


@pytest.fixture(scope="session")
def supabase_client():
    """Retorna o cliente Supabase singleton para os testes.

    Scope 'session' significa que o cliente é criado uma vez por run de testes.
    Falha com RuntimeError se SUPABASE_URL ou SUPABASE_KEY não estiver definido.
    """
    from app.database import get_supabase
    return get_supabase()


@pytest.fixture
def cleanup_test_project(supabase_client):
    """Fixture que limpa projetos criados durante os testes.

    Uso:
        def test_algo(cleanup_test_project):
            project_id = criar_projeto(...)
            cleanup_test_project(project_id)

    Garante que projetos de teste não poluem o banco após o teste.
    """
    created_ids: list[str] = []

    def register(project_id: str) -> None:
        created_ids.append(project_id)

    yield register

    # Teardown: deleta todos os projetos registrados
    for pid in created_ids:
        try:
            supabase_client.table("projects").delete().eq("id", pid).execute()
        except Exception:
            pass  # Best-effort cleanup — não falha o teste se delete falhar
