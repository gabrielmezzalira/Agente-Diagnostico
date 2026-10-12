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
from pydantic import ValidationError

from app.models.projects import ProjectCreate
from app.routers.projects import create_project


def test_project_mode_default_and_validation():
    """DISC-01: ProjectCreate.mode tem default 'sales', aceita 'discovery' e rejeita valores fora do enum.

    Verifica:
    - ProjectCreate sem mode resolve mode == 'sales' (SC#4: zero regressão para projetos existentes)
    - ProjectCreate com mode='discovery' resolve mode == 'discovery'
    - ProjectCreate com mode='foo' levanta ValidationError (422 na borda da API)
    """
    default_project = ProjectCreate(name="n", client="c", gemini_api_key="k")
    assert default_project.mode == "sales"

    discovery_project = ProjectCreate(name="n", client="c", gemini_api_key="k", mode="discovery")
    assert discovery_project.mode == "discovery"

    with pytest.raises(ValidationError):
        ProjectCreate(name="n", client="c", gemini_api_key="k", mode="foo")


class _FakeResult:
    def __init__(self, data):
        self.data = data


class _FakeInsertQuery:
    def __init__(self, db):
        self._db = db
        self._row = None

    def insert(self, row):
        self._row = row
        return self

    def execute(self):
        self._db.inserted_rows.append(self._row)
        return _FakeResult([{**self._row, "id": "00000000-0000-0000-0000-000000000001"}])


class _FakeRpcCall:
    def __init__(self, db, name, params):
        self._db = db
        self._name = name
        self._params = params

    def execute(self):
        self._db.rpc_calls.append((self._name, self._params))
        return _FakeResult(f"secret-{len(self._db.rpc_calls)}")


class _FakeDb:
    """Fake mínimo do Client do Supabase: registra chamadas ao Vault e linhas inseridas."""

    def __init__(self):
        self.rpc_calls: list[tuple[str, dict]] = []
        self.inserted_rows: list[dict] = []

    def rpc(self, name, params):
        return _FakeRpcCall(self, name, params)

    def table(self, name):
        assert name == "projects"
        return _FakeInsertQuery(self)


def test_project_create_gemini_key_is_optional():
    """D-15: ProjectCreate sem gemini_api_key é válido (None); com chave continua válido."""
    sem_chave = ProjectCreate(name="n", client="c")
    assert sem_chave.gemini_api_key is None

    com_chave = ProjectCreate(name="n", client="c", gemini_api_key="k")
    assert com_chave.gemini_api_key == "k"


@pytest.mark.asyncio
async def test_create_project_without_key_skips_vault():
    """D-15: sem chave -> Vault não é chamado e a linha não tem gemini_api_key_secret_id."""
    db = _FakeDb()

    await create_project(ProjectCreate(name="n", client="c"), db=db)

    assert db.rpc_calls == []
    assert len(db.inserted_rows) == 1
    assert "gemini_api_key_secret_id" not in db.inserted_rows[0]
    assert "gemini_api_key" not in db.inserted_rows[0]


@pytest.mark.asyncio
async def test_create_project_with_key_stores_in_vault():
    """D-15: com chave -> Vault chamado uma vez e a linha guarda o secret_id."""
    db = _FakeDb()

    await create_project(ProjectCreate(name="n", client="c", gemini_api_key="k"), db=db)

    assert len(db.rpc_calls) == 1
    assert db.rpc_calls[0][0] == "vault_create_secret"
    assert db.rpc_calls[0][1]["p_secret"] == "k"
    assert db.inserted_rows[0]["gemini_api_key_secret_id"] == "secret-1"
    assert "gemini_api_key" not in db.inserted_rows[0]


@pytest.mark.asyncio
async def test_create_project_with_empty_key_is_treated_as_absent():
    """D-15: string vazia conta como ausente (nada vai para o Vault)."""
    db = _FakeDb()

    await create_project(ProjectCreate(name="n", client="c", gemini_api_key=""), db=db)

    assert db.rpc_calls == []
    assert "gemini_api_key_secret_id" not in db.inserted_rows[0]


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
