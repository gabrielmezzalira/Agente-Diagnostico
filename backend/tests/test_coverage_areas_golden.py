# =============================================================================
# test_coverage_areas_golden.py
#
# Phase 1 (Area-Set Registry) / D-03 — o refactor de "mudanca zero" que extrai
# as 8 areas de cobertura hardcoded para um registro unico (coverage_areas.py)
# so e seguro se a saida pre-refactor estiver congelada como fixture ANTES de
# qualquer mudanca de producao. Este arquivo e commitado GREEN contra o codigo
# atual (sem coverage_areas.py) como a rede de protecao do refactor que segue.
#
# Teste unitario puro: sem rede, sem Supabase. O monkeypatch de llm._call
# captura o argumento "system" em vez de chamar o Gemini de verdade.
# =============================================================================

import pytest

from app.services import llm
from app.services.coverage_areas import AREAS_BY_PROJECT_TYPE, SALES_AREA_SET
from app.services.prompt_builder import PromptBuilder

# Literal exato de llm.py:70-77 (schema da classify_coverage, SEM not_applicable).
_CLASSIFY_COVERAGE_SCHEMA = (
    '{"areas":{"negocio":{"status":"covered|partial|uncovered","score":0-100,"notes":""},'
    '"eng_dados":{"status":"covered|partial|uncovered","score":0-100,"notes":""},'
    '"visualizacao":{"status":"covered|partial|uncovered","score":0-100,"notes":""},'
    '"ciencia_dados":{"status":"covered|partial|uncovered","score":0-100,"notes":""},'
    '"automacao":{"status":"covered|partial|uncovered","score":0-100,"notes":""},'
    '"integracao":{"status":"covered|partial|uncovered","score":0-100,"notes":""},'
    '"consumo":{"status":"covered|partial|uncovered","score":0-100,"notes":""},'
    '"parceria":{"status":"covered|partial|uncovered","score":0-100,"notes":""}}}'
)

# Literal exato de prompt_builder.py:367-374 (schema COM not_applicable).
_BUILD_COVERAGE_CLASSIFIER_SCHEMA = (
    '{"areas":{"negocio":{"status":"covered|partial|uncovered|not_applicable","score":0-100,"notes":""},'
    '"eng_dados":{"status":"covered|partial|uncovered|not_applicable","score":0-100,"notes":""},'
    '"visualizacao":{"status":"covered|partial|uncovered|not_applicable","score":0-100,"notes":""},'
    '"ciencia_dados":{"status":"covered|partial|uncovered|not_applicable","score":0-100,"notes":""},'
    '"automacao":{"status":"covered|partial|uncovered|not_applicable","score":0-100,"notes":""},'
    '"integracao":{"status":"covered|partial|uncovered|not_applicable","score":0-100,"notes":""},'
    '"consumo":{"status":"covered|partial|uncovered|not_applicable","score":0-100,"notes":""},'
    '"parceria":{"status":"covered|partial|uncovered|not_applicable","score":0-100,"notes":""}}}'
)

# Literal exato de llm.py:125-129 (area_labels).
_AREA_LABELS = {
    "negocio": "Negócio", "eng_dados": "Eng. de Dados", "visualizacao": "Visualização",
    "ciencia_dados": "Ciência de Dados", "automacao": "Automação", "integracao": "Integração",
    "consumo": "Consumo", "parceria": "Parceria",
}

# Literal exato de llm.py:304 / prompt_builder.py:493 (block enum, identico nos dois).
_BLOCK_ENUM = "negocio|eng_dados|visualizacao|ciencia_dados|automacao|integracao|consumo|parceria"

_SALES_KEYS_ORDER = [
    "negocio", "eng_dados", "visualizacao", "ciencia_dados",
    "automacao", "integracao", "consumo", "parceria",
]


def test_keys_order():
    """SALES_AREA_SET.keys() preserva a ordem exata das 8 areas atuais."""
    assert SALES_AREA_SET.keys() == _SALES_KEYS_ORDER


def test_labels_match():
    """SALES_AREA_SET.labels() reproduz o dict area_labels de llm.py:125-129."""
    assert SALES_AREA_SET.labels() == _AREA_LABELS


def test_schema_json_false_matches_classify_literal():
    """schema_json(include_not_applicable=False) == literal de llm.py:70-77."""
    assert SALES_AREA_SET.schema_json(include_not_applicable=False) == _CLASSIFY_COVERAGE_SCHEMA


def test_schema_json_true_matches_builder_literal():
    """schema_json(include_not_applicable=True) == literal de prompt_builder.py:367-374."""
    assert SALES_AREA_SET.schema_json(include_not_applicable=True) == _BUILD_COVERAGE_CLASSIFIER_SCHEMA


def test_block_enum_match():
    """block_enum() == literal de llm.py:304 / prompt_builder.py:493."""
    assert SALES_AREA_SET.block_enum() == _BLOCK_ENUM


def test_areas_by_project_type_keys_are_valid():
    """Nenhuma chave em AREAS_BY_PROJECT_TYPE referencia uma area fora do registro
    (RESEARCH.md Open Question 2 — guarda contra typo silencioso)."""
    referenced = {
        key
        for cfg in AREAS_BY_PROJECT_TYPE.values()
        for keys in cfg.values()
        for key in keys
    }
    assert referenced <= set(SALES_AREA_SET.keys())


def _read_fixture(name: str) -> str:
    with open(f"tests/fixtures/{name}", encoding="utf-8") as f:
        return f.read()


def test_build_coverage_classifier_golden():
    """build_coverage_classifier() (agora via SALES_AREA_SET.schema_json(True))
    == a fixture congelada pre-refactor (dms=None, project_type='bi')."""
    pb = PromptBuilder(dms=None, project_type="bi", pre_meeting_context="", custom_areas=[])

    assert pb.build_coverage_classifier() == _read_fixture("coverage_classifier_bi_dms_none.txt")


def test_prompt_builder_golden_snapshot():
    """PromptBuilder(dms=None, project_type='bi') gera o mesmo texto congelado hoje."""
    pb = PromptBuilder(dms=None, project_type="bi", pre_meeting_context="", custom_areas=[])

    coverage_classifier = pb.build_coverage_classifier()
    question_planner = pb.build_question_planner()

    assert coverage_classifier == _read_fixture("coverage_classifier_bi_dms_none.txt")
    assert question_planner == _read_fixture("question_planner_bi_dms_none.txt")


@pytest.mark.asyncio
async def test_classify_coverage_default_schema_frozen(monkeypatch):
    """classify_coverage, sem system_prompt, envia o schema exato de llm.py:70-77."""
    captured: dict = {}

    async def _fake_call(api_key, system, user, max_output_tokens=None):
        captured["system"] = system
        return "{}", 0, 0

    monkeypatch.setattr(llm, "_call", _fake_call)

    await llm.classify_coverage(api_key="x", transcript="t", project_type="bi", dms=None)

    assert _CLASSIFY_COVERAGE_SCHEMA in captured["system"]


@pytest.mark.asyncio
async def test_question_block_enum_frozen(monkeypatch):
    """generate_questions, sem system_prompt, envia o block enum exato de llm.py:304."""
    captured: dict = {}

    async def _fake_call(api_key, system, user, max_output_tokens=None):
        captured["system"] = system
        return "{}", 0, 0

    monkeypatch.setattr(llm, "_call", _fake_call)

    await llm.generate_questions(
        api_key="x",
        transcript="t",
        coverage={},
        recent_questions=[],
        project_type="bi",
        dms=None,
    )

    assert _BLOCK_ENUM in captured["system"]


def test_structured_context_block_line_unchanged():
    """A linha do enum de blocos em structured_context._EXTRACTOR_SYSTEM continua
    exatamente '  negocio | eng_dados | ... | parceria' (indent de 2 espacos,
    montada por concatenacao via SALES_AREA_SET.keys(), nao f-string)."""
    from app.services import structured_context

    expected_line = "  " + " | ".join(SALES_AREA_SET.keys())
    assert expected_line == "  negocio | eng_dados | visualizacao | ciencia_dados | automacao | integracao | consumo | parceria"
    assert expected_line in structured_context._EXTRACTOR_SYSTEM


def test_generate_report_area_labels_unchanged():
    """SALES_AREA_SET.labels() reproduz exatamente o dict area_labels que
    generate_report usava (llm.py:120-124, pre-refactor)."""
    assert SALES_AREA_SET.labels() == _AREA_LABELS


@pytest.mark.asyncio
async def test_generate_questions_block_enum_unchanged(monkeypatch):
    """generate_questions interpola SALES_AREA_SET.block_enum() no mesmo formato
    JSON-shape de antes (llm.py:304, pre-refactor)."""
    captured: dict = {}

    async def _fake_call(api_key, system, user, max_output_tokens=None):
        captured["system"] = system
        return "{}", 0, 0

    monkeypatch.setattr(llm, "_call", _fake_call)

    await llm.generate_questions(
        api_key="x",
        transcript="t",
        coverage={},
        recent_questions=[],
        project_type="bi",
        dms=None,
    )

    assert (
        '{"questions":[{"text":"...","block":"' + SALES_AREA_SET.block_enum() + '"}]}'
        in captured["system"]
    )
