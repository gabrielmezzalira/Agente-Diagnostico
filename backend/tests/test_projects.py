# =============================================================================
# test_projects.py
#
# Stubs de testes para os requisitos PROJ-01 a PROJ-04.
#
# Cada função está marcada com pytest.skip() — serão implementadas no Plan 02
# quando os routers FastAPI de projects estiverem prontos.
#
# Cobre:
#   PROJ-01 — Criar projeto com todos os 11 campos
#   PROJ-02 — Editar projeto; sessões encerradas não afetadas
#   PROJ-03 — Badge "ao vivo" em projetos com sessão ativa
#   PROJ-04 — Chave de API nunca exposta na resposta
# =============================================================================

import pytest


def test_create_project():
    """PROJ-01: POST /projects cria linha no Supabase e armazena UUID do Vault.

    Verifica:
    - Projeto criado com todos os 11 campos da F1
    - gemini_api_key_secret_id está preenchido (não nulo) no banco
    - Resposta não contém gemini_api_key em texto plano
    """
    pytest.skip("stub — implement in Plan 02")


def test_edit_project():
    """PROJ-02: PUT /projects/:id atualiza projeto; sessões encerradas não são afetadas.

    Verifica:
    - Campos atualizados refletem no banco
    - Sessão com status 'finished' não é alterada pela edição do projeto
    """
    pytest.skip("stub — implement in Plan 02")


def test_active_session_badge():
    """PROJ-03: GET /projects retorna has_active_session=True para projetos com sessão ativa.

    Verifica:
    - Projeto com sessão status='active' → has_active_session: True
    - Projeto sem sessão ativa → has_active_session: False
    """
    pytest.skip("stub — implement in Plan 02")


def test_api_key_not_exposed():
    """PROJ-04: Chave de API Gemini nunca aparece em texto plano na resposta da API.

    Verifica:
    - GET /projects/:id não retorna gemini_api_key
    - Resposta contém has_api_key: bool (True se chave salva, False se não)
    - gemini_api_key_secret_id (UUID) não aparece na resposta pública
    """
    pytest.skip("stub — implement in Plan 02")
