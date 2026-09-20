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

# Literal exato de llm.py:304 / prompt_builder.py:493 (block enum, identico nos dois).
_BLOCK_ENUM = "negocio|eng_dados|visualizacao|ciencia_dados|automacao|integracao|consumo|parceria"


def _read_fixture(name: str) -> str:
    with open(f"tests/fixtures/{name}", encoding="utf-8") as f:
        return f.read()


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
