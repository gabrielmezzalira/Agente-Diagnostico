# =============================================================================
# test_session_state_custom_areas.py
#
# Phase 1 (Area-Set Registry) / D-04 — regression guard: _init_coverage's first
# loop now sources its standard keys from SALES_AREA_SET.keys() instead of the
# removed COVERAGE_AREAS list, but the second loop (the dormant custom_areas
# merge/overlay) must keep working byte-unchanged. This test proves both the
# standard-set init and the custom_areas coexistence still behave exactly as
# before the rewire.
#
# Teste unitário puro: sem rede, sem Supabase.
# =============================================================================

from app.services.coverage_areas import SALES_AREA_SET
from app.services.session_state import _init_coverage


def test_init_coverage_standard_set_bi():
    """_init_coverage('bi') retorna exatamente as 8 chaves padrão, com
    ciencia_dados e automacao marcadas not_applicable (AREAS_BY_PROJECT_TYPE['bi']['inactive'])."""
    coverage = _init_coverage("bi")

    assert set(coverage.keys()) == set(SALES_AREA_SET.keys())
    assert coverage["ciencia_dados"].status == "not_applicable"
    assert coverage["automacao"].status == "not_applicable"
    for key in ("negocio", "eng_dados", "visualizacao", "integracao", "consumo", "parceria"):
        assert coverage[key].status == "uncovered"


def test_init_coverage_merges_custom_area():
    """Uma custom_area com chave nova é adicionada ao lado das 8 padrão (merge, D-04)."""
    coverage = _init_coverage("bi", custom_areas=[{"key": "custom_x", "name": "X"}])

    assert set(SALES_AREA_SET.keys()) <= set(coverage.keys())
    assert "custom_x" in coverage
    assert coverage["custom_x"].name == "X"


def test_init_coverage_custom_area_overwrites_standard_key():
    """Uma custom_area cuja chave colide com uma área padrão SOBRESCREVE a entrada
    padrão (comportamento de overwrite do segundo laço, inalterado)."""
    coverage = _init_coverage("bi", custom_areas=[{"key": "negocio", "name": "Y"}])

    assert coverage["negocio"].name == "Y"
    # Overwrite substitui a entrada inteira por um CoverageArea() novo (status default).
    assert coverage["negocio"].status == "uncovered"


def test_init_coverage_empty_or_none_custom_areas_are_equivalent():
    """custom_areas=None se comporta exatamente como não passar o argumento (input vazio)."""
    default_call = _init_coverage("bi")
    none_call = _init_coverage("bi", custom_areas=None)
    empty_call = _init_coverage("bi", custom_areas=[])

    assert {k: (v.status, v.name) for k, v in default_call.items()} == {
        k: (v.status, v.name) for k, v in none_call.items()
    }
    assert {k: (v.status, v.name) for k, v in default_call.items()} == {
        k: (v.status, v.name) for k, v in empty_call.items()
    }
