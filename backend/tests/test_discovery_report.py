# =============================================================================
# test_discovery_report.py
#
# Fase 4 (Discovery Report + Pricing Handoff) / Plano 04-02.
#
# Task 1 (REP-03, golden): congela a mensagem 'user' de generate_report(mode=
# "sales") ANTES de qualquer edição em llm.py — a linha de defesa de
# byte-identidade que garante que o relatório sales nunca regride quando o
# ramo discovery (esqueleto PRD de 16 seções, D-25/D-26/D-27/D-28/D-40) for
# adicionado nas Tasks 2/3.
#
# Task 2/3 (REP-01): asserts sobre o esqueleto PRD de 16 seções e as duas
# tabelas de cobertura (Produto/Dados) particionadas por lens.
#
# Teste unitario puro: sem rede, sem Supabase — helper `_capture_report_user`
# copiado de test_discovery_mode.py, monkeypatch de llm._call.
# =============================================================================

import pytest

from app.services import llm
from app.services.prompt_builder import CITI_PORTFOLIO, CITI_SERVICE_CATALOG, CITI_TECH_REFERENCE

_CITI_HEADER = "## Portfólio CITi (referência comercial)"


def _expected_citi_block() -> str:
    """Reproduz byte-a-byte o bloco comercial hoje presente em llm.py:179-183
    (gated por `mode == "sales"`)."""
    return (
        f"## Portfólio CITi (referência comercial)\n{CITI_PORTFOLIO}\n\n"
        f"## Catálogo de serviços CITi (referência para sprints)\n{CITI_SERVICE_CATALOG}\n\n"
        f"## Referência de tecnologias\n{CITI_TECH_REFERENCE}\n\n"
    )


async def _capture_report_user(monkeypatch, **kwargs) -> str:
    """Chama generate_report com llm._call monkeypatchado, retornando a mensagem
    `user` enviada. Copiado verbatim do helper de test_discovery_mode.py."""
    captured: dict = {}

    async def _fake_call(api_key, system, user, max_output_tokens=None):
        captured["user"] = user
        return "relatorio de teste", 0, 0

    monkeypatch.setattr(llm, "_call", _fake_call)

    kwargs.setdefault("coverage", {})
    kwargs.setdefault("red_flags", [])
    kwargs.setdefault("questions_used", [])

    await llm.generate_report(
        api_key="x",
        transcript="transcricao de teste",
        project_type="bi",
        dms=None,
        **kwargs,
    )
    return captured["user"]


# =============================================================================
# Task 1 — Golden sales (REP-03), congelado ANTES de qualquer edição em llm.py
# =============================================================================


def _golden_sales_fixture() -> str:
    """Fixture congelada da mensagem 'user' sales de HOJE (pré-fase). Reproduz
    exatamente a montagem de generate_report em llm.py:185-193 com os inputs
    default de _capture_report_user (coverage={}, red_flags=[], questions_used=[],
    project_type='bi', dms=None, pre_meeting_context='', structured_context=None)."""
    context_block = "Contexto pré-reunião: não fornecido\n\n"
    coverage_table = "_Nenhuma área classificada ainda._"
    flags_text = "Nenhum alerta detectado."
    return (
        "Tipo de projeto: bi\n"
        "Data Maturity Score: Não mapeado\n"
        f"{context_block}"
        f"## Cobertura final\n{coverage_table}\n\n"
        f"## Alertas detectados\n{flags_text}\n\n"
        f"{_expected_citi_block()}"
        "## Transcrição completa\ntranscricao de teste"
    )


@pytest.mark.asyncio
async def test_sales_mode_unchanged(monkeypatch):
    """REP-03: generate_report(mode='sales') é byte-idêntico ao golden congelado
    ANTES de qualquer edição em llm.py — inclui o bloco comercial CITi e a
    ordem: '## Alertas detectados' < bloco CITi < '## Transcrição completa'."""
    user = await _capture_report_user(monkeypatch, mode="sales")

    assert user == _golden_sales_fixture()
    assert _expected_citi_block() in user
    idx_alertas = user.index("## Alertas detectados")
    idx_citi = user.index(_CITI_HEADER)
    idx_transcricao = user.index("## Transcrição completa")
    assert idx_alertas < idx_citi < idx_transcricao


@pytest.mark.asyncio
async def test_sales_default_mode_equals_sales(monkeypatch):
    """`mode` omitido é igual a `mode='sales'` — o default preserva 100% das
    chamadas atuais (nenhum caller existente passa mode= explicitamente)."""
    user_default = await _capture_report_user(monkeypatch)
    user_sales = await _capture_report_user(monkeypatch, mode="sales")

    assert user_default == user_sales
    assert user_default == _golden_sales_fixture()
