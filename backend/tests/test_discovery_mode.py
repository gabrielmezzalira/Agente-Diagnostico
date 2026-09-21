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
