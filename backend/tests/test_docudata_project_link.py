import pytest
from pydantic import ValidationError

from app.models.projects import ProjectCreate, ProjectResponse, ProjectUpdate


def test_vinculo_com_o_docudata_e_opcional_e_aceito():
    sem = ProjectCreate(name="P", client="C", gemini_api_key="k")
    assert sem.docudata_project_id is None
    com = ProjectCreate(name="P", client="C", gemini_api_key="k", docudata_project_id="b3a1c2d4-0000-4000-8000-000000000001")
    assert com.docudata_project_id == "b3a1c2d4-0000-4000-8000-000000000001"
    assert ProjectUpdate(docudata_project_id="x").docudata_project_id == "x"


def test_vinculo_vai_no_dump_que_o_router_grava():
    dump = ProjectCreate(name="P", client="C", gemini_api_key="k", docudata_project_id="abc").model_dump(mode="json")
    assert dump["docudata_project_id"] == "abc"


def test_vinculo_remove_espacos_e_vazio_vira_none():
    com_espacos = ProjectCreate(name="P", client="C", gemini_api_key="k", docudata_project_id="  abc  ")
    assert com_espacos.docudata_project_id == "abc"
    assert ProjectCreate(name="P", client="C", gemini_api_key="k", docudata_project_id="   ").docudata_project_id is None
    assert ProjectUpdate(docudata_project_id="").docudata_project_id is None


def test_vinculo_tem_tamanho_maximo():
    with pytest.raises(ValidationError):
        ProjectUpdate(docudata_project_id="x" * 101)


def test_update_sem_o_campo_nao_entra_no_dump_do_router():
    # O router usa exclude_none=True: omitir o campo não pode zerar o vínculo.
    dump = ProjectUpdate(name="Novo").model_dump(mode="json", exclude_none=True)
    assert "docudata_project_id" not in dump
    dump = ProjectUpdate(docudata_project_id="abc").model_dump(mode="json", exclude_none=True)
    assert dump["docudata_project_id"] == "abc"


def test_resposta_expoe_o_vinculo():
    assert "docudata_project_id" in ProjectResponse.model_fields
