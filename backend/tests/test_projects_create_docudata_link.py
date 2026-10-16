import pytest

from app.models.projects import ProjectCreate
from app.routers import projects as projects_mod


class _Db:
    def __init__(self):
        self.inseridos = []

    def table(self, _nome):
        return self

    def insert(self, row):
        self.inseridos.append(row)
        return self

    def execute(self):
        class _R:
            data = [{"id": "p1"}]
        return _R()


@pytest.fixture(autouse=True)
def _sem_vault(monkeypatch):
    monkeypatch.setattr(projects_mod, "_vault_store", lambda *_a, **_k: "segredo-1")


async def test_criar_sem_vinculo_nao_envia_a_coluna():
    db = _Db()
    await projects_mod.create_project(ProjectCreate(name="P", client="C", gemini_api_key="k"), db)
    assert "docudata_project_id" not in db.inseridos[0]
    db2 = _Db()
    await projects_mod.create_project(ProjectCreate(name="P", client="C", gemini_api_key="k", docudata_project_id="   "), db2)
    assert "docudata_project_id" not in db2.inseridos[0]


async def test_criar_com_vinculo_envia_a_coluna():
    db = _Db()
    await projects_mod.create_project(ProjectCreate(name="P", client="C", gemini_api_key="k", docudata_project_id="abc"), db)
    assert db.inseridos[0]["docudata_project_id"] == "abc"
