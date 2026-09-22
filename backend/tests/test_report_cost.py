# =============================================================================
# test_report_cost.py
#
# Task 4b (PLANO_AJUSTES.md) — a estimativa de custo do relatório deve refletir
# o teto real de tokens de saída (REPORT_MAX_OUTPUT_TOKENS), não o valor fixo
# antigo (2500) que subestimava o custo e cegava a parada automática (F7).
#
# Teste unitário puro: sem rede, sem Supabase.
# =============================================================================

import pytest

from app.services.llm import (
    INPUT_COST_PER_1K,
    OUTPUT_COST_PER_1K,
    REPORT_MAX_OUTPUT_TOKENS,
)
from app.services.session_state import REPORT_COST_MARGIN, SessionState


def test_estimated_report_cost_reflects_report_max_tokens():
    """A estimativa usa REPORT_MAX_OUTPUT_TOKENS + margem, não o 2500 antigo."""
    state = SessionState(session_id="t")  # transcript vazio

    cost = state.estimated_report_cost()

    # transcript vazio → transcript_tokens = 0 // 4 + 2000 = 2000
    expected = (
        (2000 / 1000) * INPUT_COST_PER_1K
        + (REPORT_MAX_OUTPUT_TOKENS / 1000) * OUTPUT_COST_PER_1K
    ) * REPORT_COST_MARGIN
    assert cost == pytest.approx(expected)


def test_estimated_report_cost_is_higher_than_old_flawed_estimate():
    """Guarda de regressão: a nova estimativa é bem maior que a antiga (2500 tokens)."""
    state = SessionState(session_id="t")

    old_flawed = (
        (2000 / 1000) * INPUT_COST_PER_1K + (2500 / 1000) * OUTPUT_COST_PER_1K
    )
    # Antiga subestimava em ~6,8x para transcript vazio; exigir ao menos 2x evita
    # que alguém reintroduza um valor de saída pequeno sem quebrar o teste.
    assert state.estimated_report_cost() > old_flawed * 2


def test_estimated_report_cost_grows_with_transcript():
    """Transcrição maior → estimativa maior (o componente de input cresce)."""
    small = SessionState(session_id="a")
    big = SessionState(session_id="b")
    big.transcript_chunks = [{"speaker": None, "text": "x" * 40000}]

    assert big.estimated_report_cost() > small.estimated_report_cost()
