# =============================================================================
# test_import_from_diagnosis_gate.py
#
# Fase 4 (Discovery Report + Pricing Handoff) — Plano 04-01, Task 3 (TRACER).
#
# REP-02: import_from_diagnosis só extrai features quando o relatório
# discovery vinculado à sessão está com status='Aprovado para build' (D-37).
# REP-03: relatórios sales (status=None) continuam passando sem gate — a
# checagem trata `None` como "sem gate" (nunca consulta projects.mode).
#
# Teste de integração com stubs simples (FakeRepo/FakeLLM) — sem Supabase real,
# sem rede, sem chamada LLM real. Estilo de injeção por construtor igual ao
# usado em LLMPricingService(repo, llm) e nos fakes de test_two_agent_lens.py.
# =============================================================================

from datetime import datetime, timezone
from uuid import uuid4

import pytest
from fastapi import HTTPException

from app.services.llm_pricing_service import ExtractedFeature, ExtractedFeatureList, LLMPricingService

PRICING_ID = str(uuid4())
PROJECT_ID = str(uuid4())
SESSION_ID = str(uuid4())


class FakeRepo:
    """Stub de PricingRepository — só implementa o que import_from_diagnosis usa.

    `project_reports`, quando informado, alimenta get_project_reports com uma
    lista arbitrária de relatórios (caminho sem session_id — import contínuo
    de projeto). Quando None, cai no comportamento legado de espelhar
    `report` (compatibilidade com os testes existentes deste arquivo)."""

    def __init__(self, report: dict | None, project_reports: list[dict] | None = None):
        self._report = report
        self._project_reports = project_reports
        self.update_pricing_calls: list[tuple[str, dict]] = []
        self.bulk_insert_calls: list[tuple[str, list[dict]]] = []

    def get_pricing(self, pricing_id: str) -> dict | None:
        return {"id": pricing_id, "project_id": PROJECT_ID}

    def get_session(self, session_id: str) -> dict | None:
        return {"id": session_id, "project_id": PROJECT_ID}

    def get_session_report(self, session_id: str) -> dict | None:
        return self._report

    def get_project_reports(self, project_id: str) -> list[dict]:
        if self._project_reports is not None:
            return self._project_reports
        return [self._report] if self._report else []

    def get_recent_history(self, limit: int = 7) -> list[dict]:
        return []

    def update_pricing(self, pricing_id: str, updates: dict) -> dict | None:
        self.update_pricing_calls.append((pricing_id, updates))
        return {"id": pricing_id, **updates}

    def bulk_insert_features(self, pricing_id: str, features: list[dict]) -> list[dict]:
        self.bulk_insert_calls.append((pricing_id, features))
        return [
            {
                **f,
                "id": str(uuid4()),
                "pricing_id": pricing_id,
                "citi_responsible": True,
                "created_at": datetime.now(timezone.utc).isoformat(),
            }
            for f in features
        ]


class _FakeStructuredLLM:
    def __init__(self, result: ExtractedFeatureList, owner: "FakeLLM"):
        self._result = result
        self._owner = owner

    def invoke(self, messages):
        self._owner.last_messages = messages
        return self._result


class FakeLLM:
    """Stub de BaseChatModel — with_structured_output(...).invoke(...) devolve
    uma ExtractedFeatureList fixa com >=1 feature. Guarda as mensagens da
    última chamada (`last_messages`) para os testes inspecionarem o
    `combined_md` (HumanMessage) que de fato chegou ao LLM."""

    def __init__(self):
        self._result = ExtractedFeatureList(
            features=[
                ExtractedFeature(bloco="Engenharia de Dados", funcionalidade="Pipeline de ingestão", horas=20.0),
            ]
        )
        self.last_messages = None

    def with_structured_output(self, schema):
        return _FakeStructuredLLM(self._result, self)


def test_import_blocks_when_status_not_approved():
    """REP-02: status 'Em revisão' (nem None, nem 'Aprovado para build') rejeita com 422."""
    repo = FakeRepo(report={"id": str(uuid4()), "markdown_content": "conteudo", "status": "Em revisão"})
    service = LLMPricingService(repo=repo, llm=FakeLLM())

    with pytest.raises(HTTPException) as exc_info:
        service.import_from_diagnosis(pricing_id=PRICING_ID, session_id=SESSION_ID)

    assert exc_info.value.status_code == 422
    assert not repo.bulk_insert_calls


def test_import_succeeds_when_approved():
    """REP-02: status 'Aprovado para build' libera o import — extrai >=1 feature
    e vincula pricings.session_id."""
    repo = FakeRepo(report={"id": str(uuid4()), "markdown_content": "conteudo", "status": "Aprovado para build"})
    service = LLMPricingService(repo=repo, llm=FakeLLM())

    features = service.import_from_diagnosis(pricing_id=PRICING_ID, session_id=SESSION_ID)

    assert len(features) >= 1
    assert repo.update_pricing_calls == [(PRICING_ID, {"session_id": SESSION_ID})]


def test_import_allows_sales_report_with_null_status():
    """REP-03: relatório sales (status=None) importa normalmente — gate é no-op
    quando não há status gravado (nunca consulta projects.mode)."""
    repo = FakeRepo(report={"id": str(uuid4()), "markdown_content": "conteudo", "status": None})
    service = LLMPricingService(repo=repo, llm=FakeLLM())

    features = service.import_from_diagnosis(pricing_id=PRICING_ID, session_id=SESSION_ID)

    assert len(features) >= 1


# ---------------------------------------------------------------------------
# Gap-fix (review Blocker 2 / CR-02): caminho de projeto (sem session_id).
# O PRD de discovery é contínuo e cumulativo — todo relatório pós-reunião
# aprovado ("Aprovado para build") entra na extração, junto com relatórios
# sales (status=None); só rascunhos/em revisão são excluídos.
# ---------------------------------------------------------------------------


def test_import_project_path_excludes_unapproved_discovery():
    """CR-02: sem session_id, com [aprovado, não aprovado, sales(None)] no
    projeto, a extração roda só sobre aprovado + sales — o rascunho não
    aprovado não entra no combined_md enviado ao LLM."""
    approved = {
        "id": str(uuid4()),
        "markdown_content": "## Relatório aprovado da reunião 2",
        "status": "Aprovado para build",
    }
    unapproved = {
        "id": str(uuid4()),
        "markdown_content": "## Rascunho ainda em revisão",
        "status": "Em revisão",
    }
    sales = {
        "id": str(uuid4()),
        "markdown_content": "## Relatório comercial legado",
        "status": None,
    }
    repo = FakeRepo(report=None, project_reports=[approved, unapproved, sales])
    fake_llm = FakeLLM()
    service = LLMPricingService(repo=repo, llm=fake_llm)

    features = service.import_from_diagnosis(pricing_id=PRICING_ID, session_id=None)

    assert len(features) >= 1
    combined_md = fake_llm.last_messages[1].content  # HumanMessage(content=combined_md)
    assert approved["markdown_content"] in combined_md
    assert sales["markdown_content"] in combined_md
    assert unapproved["markdown_content"] not in combined_md
    # caminho sem session_id nunca vincula pricings.session_id
    assert repo.update_pricing_calls == []


def test_import_project_path_all_unapproved_raises_422():
    """CR-02: sem session_id, com relatórios existentes mas todos não
    aprovados (Rascunho/Em revisão) — 422, sem chamar o LLM/insert."""
    rascunho = {"id": str(uuid4()), "markdown_content": "rascunho 1", "status": "Rascunho"}
    em_revisao = {"id": str(uuid4()), "markdown_content": "rascunho 2", "status": "Em revisão"}
    repo = FakeRepo(report=None, project_reports=[rascunho, em_revisao])
    service = LLMPricingService(repo=repo, llm=FakeLLM())

    with pytest.raises(HTTPException) as exc_info:
        service.import_from_diagnosis(pricing_id=PRICING_ID, session_id=None)

    assert exc_info.value.status_code == 422
    assert not repo.bulk_insert_calls


def test_import_project_path_multiple_approved_reports_combined():
    """CR-02 / continuous-PRD: sem session_id, dois relatórios aprovados de
    reuniões diferentes — ambos contribuem para o combined_md (PRD contínuo
    e cumulativo entre reuniões)."""
    meeting_1 = {
        "id": str(uuid4()),
        "markdown_content": "## Reunião 1 — gargalo mapeado",
        "status": "Aprovado para build",
    }
    meeting_2 = {
        "id": str(uuid4()),
        "markdown_content": "## Reunião 2 — fluxo de dados detalhado",
        "status": "Aprovado para build",
    }
    repo = FakeRepo(report=None, project_reports=[meeting_2, meeting_1])
    fake_llm = FakeLLM()
    service = LLMPricingService(repo=repo, llm=fake_llm)

    features = service.import_from_diagnosis(pricing_id=PRICING_ID, session_id=None)

    assert len(features) >= 1
    combined_md = fake_llm.last_messages[1].content
    assert meeting_1["markdown_content"] in combined_md
    assert meeting_2["markdown_content"] in combined_md
