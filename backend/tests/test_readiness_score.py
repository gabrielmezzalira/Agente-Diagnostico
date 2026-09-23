# =============================================================================
# test_readiness_score.py
#
# Fase 4 (Discovery Report + Pricing Handoff) / Plano 03 — Task 2 (TDD).
#
# readiness_score() e uma funcao pura em SessionState (D-33/D-34, analoga a
# estimated_report_cost()) que combina 4 sinais por score ponderado + limiar
# e expoe quais sinais estao baixos. Teste unitario puro: sem rede, sem
# Supabase, sem LLM — so estado em memoria (prova a pureza do metodo).
# =============================================================================

from app.services.session_state import (
    CoverageArea,
    Question,
    ReadinessScore,
    RedFlag,
    SessionState,
)


def _covered() -> CoverageArea:
    return CoverageArea(status="covered", score=100)


def test_readiness_score_empty_session_is_low_and_not_ready():
    """Sessao discovery recem-criada (todas as 18 areas 'uncovered', sem
    perguntas, sem red flags, sem transcricao) tem score baixo, ready=False
    e reporta ao menos um sinal como baixo."""
    state = SessionState(session_id="s1", mode="discovery")

    result = state.readiness_score()

    assert isinstance(result, ReadinessScore)
    assert 0.0 <= result.score <= 1.0
    assert result.score < 0.65
    assert result.ready is False
    assert len(result.low_signals) > 0


def test_readiness_score_well_covered_session_is_high_and_ready():
    """Sessao discovery com cobertura completa nas duas lentes, perguntas
    respondidas, transcricao substancial e red flags detectados tem score
    alto e ready=True, sem sinais baixos."""
    state = SessionState(session_id="s2", mode="discovery")
    for key in state.coverage:
        state.coverage[key] = _covered()
    state.questions = [
        Question(
            id=f"q{i}",
            text=f"Pergunta {i}",
            block="negocio",
            source="auto",
            status="used",
            generated_at="2026-01-01T00:00:00Z",
            expires_at="2026-01-01T00:01:00Z",
        )
        for i in range(3)
    ]
    state.red_flags = [
        RedFlag(
            id="rf1",
            text="Exemplo de red flag",
            severity="warning",
            evidence="trecho da transcricao",
            detected_at="2026-01-01T00:00:00Z",
        )
    ]
    state.transcript_chunks = [{"speaker": "cliente", "text": "x" * 3000}]

    result = state.readiness_score()

    assert isinstance(result, ReadinessScore)
    assert result.score >= 0.65
    assert result.ready is True
    assert result.low_signals == []


def test_readiness_score_is_pure_no_io_side_effects():
    """readiness_score() nao muda nenhum campo do estado — funcao pura,
    analoga a estimated_report_cost() (sem I/O, sem await, sem chamada a
    LLM/db)."""
    state = SessionState(session_id="s3", mode="discovery")
    before = dict(state.coverage)

    state.readiness_score()

    assert state.coverage == before
    assert state.questions == []
    assert state.red_flags == []
