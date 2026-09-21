# =============================================================================
# test_discovery_mode.py
#
# Fase 2 (Discovery Mode + DiscoveryPromptBuilder) / DISC-02, DISC-03 — prova
# ponta a ponta do fork por `mode`: DISCOVERY_AREA_SET (18 areas, Produto 0-7 /
# Dados 8-17), o ramo `mode="discovery"` de `_init_coverage`, o novo campo
# `SessionState.mode`, e o `DiscoveryPromptBuilder` (Task 2) sem o literal
# CITI_PORTFOLIO nos tres prompts realtime.
#
# Teste unitario puro: sem rede, sem Supabase.
# =============================================================================

import pytest

from app.services.coverage_areas import DISCOVERY_AREA_SET, SALES_AREA_SET
from app.services.session_state import SessionState, _init_coverage

_DISCOVERY_KEYS_ORDER = [
    "gargalo", "frente_atuacao", "impacto_usuario", "mapeamento_processos",
    "fluxo_dados", "desenho_solucao", "expectativa_solucao", "viabilidade_solucao",
    "qualidade_fontes", "metricas", "lgpd_seguranca", "quick_wins",
    "ciencia_dados", "analise_dados", "engenharia_dados", "machine_learning",
    "sistemas_nuvem", "automacoes",
]


def test_discovery_area_set_keys_order():
    """DISCOVERY_AREA_SET.keys() preserva a ordem exata de D-06 (Produto 0-7, Dados 8-17)."""
    assert DISCOVERY_AREA_SET.keys() == _DISCOVERY_KEYS_ORDER
    assert len(DISCOVERY_AREA_SET.keys()) == 18


def test_init_coverage_discovery_mode_has_18_keys_no_not_applicable():
    """_init_coverage('', mode='discovery') retorna as 18 chaves de DISCOVERY_AREA_SET,
    todas com status default 'uncovered' (nenhuma not_applicable — D-08)."""
    coverage = _init_coverage("", mode="discovery")

    assert set(coverage.keys()) == set(DISCOVERY_AREA_SET.keys())
    assert len(coverage) == 18
    assert all(c.status == "uncovered" for c in coverage.values())
    assert not any(c.status == "not_applicable" for c in coverage.values())


def test_init_coverage_sales_mode_default_unchanged():
    """_init_coverage('bi') (sem mode) continua com as 8 chaves sales, inalterado
    (regressao SC#4 — ciencia_dados e automacao permanecem not_applicable)."""
    coverage = _init_coverage("bi")

    assert set(coverage.keys()) == set(SALES_AREA_SET.keys())
    assert coverage["ciencia_dados"].status == "not_applicable"
    assert coverage["automacao"].status == "not_applicable"


def test_session_state_discovery_mode_initializes_18_areas():
    """SessionState(mode='discovery') termina __post_init__ com 18 chaves == DISCOVERY_AREA_SET.keys()."""
    state = SessionState(session_id="t", mode="discovery")

    assert len(state.coverage) == 18
    assert set(state.coverage.keys()) == set(DISCOVERY_AREA_SET.keys())


def test_session_state_sales_mode_default_unchanged():
    """SessionState sem mode (default) continua inicializando as 8 chaves sales de hoje."""
    state = SessionState(session_id="t", project_type="bi")

    assert set(state.coverage.keys()) == set(SALES_AREA_SET.keys())


# =============================================================================
# Task 2 — DiscoveryPromptBuilder (D-09/D-10/DISC-03)
# =============================================================================

from app.services.discovery_prompt_builder import DiscoveryPromptBuilder

_CITI_LITERALS = ("CITI_PORTFOLIO", "CITI_SERVICE_CATALOG", "CITI_TECH_REFERENCE")


def test_discovery_module_does_not_import_citi_constants():
    """discovery_prompt_builder.py nunca importa as constantes comerciais de
    prompt_builder.py como nomes do modulo — e o que garante SC#3 por
    construcao para os 3 agentes realtime (coverage_classifier/
    red_flag_detector/question_planner). Verifica os NOMES vinculados no
    namespace do modulo (nao a docstring/comentarios, que podem citar os
    nomes em prosa explicando a ausencia)."""
    import app.services.discovery_prompt_builder as mod

    for literal in _CITI_LITERALS:
        assert not hasattr(mod, literal)


def test_build_coverage_classifier_has_dms_no_citi():
    b = DiscoveryPromptBuilder(dms=3, pre_meeting_context="x")
    prompt = b.build_coverage_classifier()

    assert b._dms_str() in prompt
    assert "CITI_PORTFOLIO" not in prompt
    assert "CITI_SERVICE_CATALOG" not in prompt
    assert DISCOVERY_AREA_SET.schema_json(include_not_applicable=False) in prompt


def test_build_red_flag_detector_has_dms_no_citi():
    b = DiscoveryPromptBuilder(dms=3, pre_meeting_context="x")
    prompt = b.build_red_flag_detector()

    assert b._dms_str() in prompt
    assert "CITI_PORTFOLIO" not in prompt


def test_build_question_planner_has_dms_no_citi_and_block_enum():
    b = DiscoveryPromptBuilder(dms=3, pre_meeting_context="x")
    prompt = b.build_question_planner()

    assert b._dms_str() in prompt
    assert "CITI_PORTFOLIO" not in prompt
    assert DISCOVERY_AREA_SET.block_enum() in prompt


def test_build_all_returns_four_agent_keys():
    b = DiscoveryPromptBuilder(dms=None)
    prompts = b.build_all()

    assert set(prompts.keys()) == {
        "coverage_classifier", "red_flag_detector", "question_planner", "report_generator",
    }


def test_dms_boundary_values_do_not_raise():
    for dms in (1, 5, None):
        b = DiscoveryPromptBuilder(dms=dms)
        prompts = b.build_all()
        assert len(prompts) == 4
    assert DiscoveryPromptBuilder(dms=None)._dms_str().startswith("Não mapeado")


# =============================================================================
# Plano 02-02 / Task 1 — Gate do bloco comercial em generate_report por `mode`
# (DISC-03/SC#3, SC#4). O bloco comercial (Portfólio/Catálogo/Referência de
# tecnologias) hoje e injetado INCONDICIONALMENTE na mensagem `user` de
# generate_report (llm.py:184-186) — este teste captura a mensagem `user` via
# monkeypatch de llm._call (nao o `system`, ver RESEARCH.md Pitfall 1/Pattern 3).
# =============================================================================

from app.services import llm
from app.services.prompt_builder import CITI_PORTFOLIO, CITI_SERVICE_CATALOG, CITI_TECH_REFERENCE

_CITI_HEADER = "## Portfólio CITi (referência comercial)"


def _expected_citi_block() -> str:
    """Reproduz byte-a-byte o bloco comercial hoje incondicional em llm.py:184-186."""
    return (
        f"## Portfólio CITi (referência comercial)\n{CITI_PORTFOLIO}\n\n"
        f"## Catálogo de serviços CITi (referência para sprints)\n{CITI_SERVICE_CATALOG}\n\n"
        f"## Referência de tecnologias\n{CITI_TECH_REFERENCE}\n\n"
    )


async def _capture_report_user(monkeypatch, **kwargs) -> str:
    """Chama generate_report com llm._call monkeypatchado, retornando a mensagem `user` enviada."""
    captured: dict = {}

    async def _fake_call(api_key, system, user, max_output_tokens=None):
        captured["user"] = user
        return "relatorio de teste", 0, 0

    monkeypatch.setattr(llm, "_call", _fake_call)

    await llm.generate_report(
        api_key="x",
        transcript="transcricao de teste",
        coverage={},
        red_flags=[],
        questions_used=[],
        project_type="bi",
        dms=None,
        **kwargs,
    )
    return captured["user"]


@pytest.mark.asyncio
async def test_generate_report_discovery_mode_omits_citi_block(monkeypatch):
    """generate_report(mode='discovery') NAO injeta o bloco comercial na mensagem
    'user' — nem o literal CITI_PORTFOLIO, nem o cabecalho comercial (DISC-03/SC#3)."""
    user = await _capture_report_user(monkeypatch, mode="discovery")

    assert "CITI_PORTFOLIO" not in user
    assert _CITI_HEADER not in user
    assert CITI_PORTFOLIO not in user
    assert CITI_SERVICE_CATALOG not in user
    assert CITI_TECH_REFERENCE not in user


@pytest.mark.asyncio
async def test_generate_report_sales_mode_includes_citi_block(monkeypatch):
    """generate_report(mode='sales') injeta o bloco comercial, na mesma posicao de
    hoje: entre '## Alertas detectados' e '## Transcrição completa' (SC#4)."""
    user = await _capture_report_user(monkeypatch, mode="sales")

    assert _expected_citi_block() in user
    idx_alertas = user.index("## Alertas detectados")
    idx_citi = user.index(_CITI_HEADER)
    idx_transcricao = user.index("## Transcrição completa")
    assert idx_alertas < idx_citi < idx_transcricao


@pytest.mark.asyncio
async def test_generate_report_default_mode_matches_sales_mode(monkeypatch):
    """generate_report(...) com `mode` omitido produz o MESMO texto 'user' que
    mode='sales' — o default preserva 100% das chamadas atuais (SC#4)."""
    user_default = await _capture_report_user(monkeypatch)
    user_sales = await _capture_report_user(monkeypatch, mode="sales")

    assert user_default == user_sales
    assert _expected_citi_block() in user_default
