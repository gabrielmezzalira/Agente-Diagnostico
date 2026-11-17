# =============================================================================
# test_pipeline_idle_gating.py
#
# PLANO_CONSUMO_GEMINI_PAUSADO.md — Ação 2. Os laços de fundo do pipeline
# (_coverage_task, a cada 30 s, e _red_flag_task, a cada 15 s) só podem chamar
# o Gemini quando chegou fala nova desde a última análise. Com a TaqCITi
# pausada ou em silêncio a transcrição não muda, e reanalisar a mesma folha
# é gasto à toa.
#
# Teste unitário puro, no padrão de test_two_agent_lens.py: SessionState +
# SessionPipeline + monkeypatch no llm_service. O asyncio.sleep do módulo
# pipeline é trocado por um relógio falso (nada de esperar 15/30 s de
# verdade) e get_supabase vira um fake — sem rede, sem Supabase, sem Gemini.
# =============================================================================

import asyncio

import pytest

from app.services import pipeline as pipeline_mod
from app.services.pipeline import SessionPipeline
from app.services.session_state import SessionState

# laço -> (função do llm_service que ele chama, resposta "vazia" do fake,
#          quantos sleeps ele faz antes de entrar no while)
_LOOPS = {
    "coverage": ("classify_coverage", None, 0),
    "red_flag": ("detect_red_flags", [], 1),
}


class _EndOfScript(Exception):
    """Levantada pelo relógio falso quando o roteiro acaba — encerra o laço
    (o sleep fica fora do try/except do laço, então ela sobe até o teste)."""


class _ScriptedClock:
    """Fica no lugar do asyncio.sleep do módulo pipeline. Cada chamada é um
    tique do laço: devolve na hora, mas antes anota quantas chamadas ao LLM
    já aconteceram e executa o próximo passo do roteiro (por exemplo, chegar
    uma fala nova). Quando o roteiro acaba, levanta _EndOfScript."""

    def __init__(self, llm_calls: dict, steps: list):
        self._llm_calls = llm_calls
        self._steps = list(steps)
        self.llm_calls_at_tick: list[int] = []

    async def __call__(self, seconds):
        self.llm_calls_at_tick.append(self._llm_calls["n"])
        if not self._steps:
            raise _EndOfScript
        step = self._steps.pop(0)
        if step is not None:
            await step()


class _AsyncioWithFakeSleep:
    """Substitui o nome `asyncio` dentro de app.services.pipeline: só o sleep
    é falso; todo o resto delega para o asyncio de verdade (o event loop do
    pytest não é afetado)."""

    def __init__(self, sleep):
        self.sleep = sleep

    def __getattr__(self, name):
        return getattr(asyncio, name)


def _install_fake_llm(monkeypatch, loop_name: str, on_call=None) -> dict:
    """Troca a função do LLM usada pelo laço por um fake que só conta as
    chamadas. A resposta é vazia (sem cobertura, sem red flag), então nada
    é gravado no banco."""
    fn_name, empty_result, _ = _LOOPS[loop_name]
    calls = {"n": 0}

    async def _fake(*args, **kwargs):
        calls["n"] += 1
        if on_call is not None:
            await on_call(calls["n"])
        return empty_result, 0, 0

    monkeypatch.setattr(pipeline_mod.llm_service, fn_name, _fake)
    # Com resposta vazia o banco nem é usado; o fake só garante que nenhum
    # caminho chegue no Supabase de verdade.
    monkeypatch.setattr(pipeline_mod, "get_supabase", lambda: None)
    return calls


def _new_pipeline(initial_texts: list[str] | None = None) -> SessionPipeline:
    state = SessionState(session_id="s", project_type="bi", gemini_api_key="fake-key")
    for text in initial_texts or []:
        state.transcript_chunks.append({"text": text, "speaker": "cliente", "timestamp": ""})
    return SessionPipeline(state)


def _speech(pipe: SessionPipeline, text: str):
    """Passo de roteiro: chega uma fala nova pelo mesmo caminho do webhook."""

    async def _step():
        await pipe.push_chunk(text, speaker="cliente")

    return _step


async def _drive(monkeypatch, pipe, loop_name: str, llm_calls: dict, cycles: list) -> list[int]:
    """Roda o laço `loop_name` por len(cycles) ciclos. cycles[i] é o que
    acontece antes do ciclo i (uma fala nova) ou None (silêncio/pausa).
    Devolve quantas chamadas ao LLM o laço fez em cada ciclo."""
    warmup = _LOOPS[loop_name][2]
    clock = _ScriptedClock(llm_calls, [None] * warmup + list(cycles))
    monkeypatch.setattr(pipeline_mod, "asyncio", _AsyncioWithFakeSleep(clock))
    loop = pipe._coverage_task if loop_name == "coverage" else pipe._red_flag_task

    pipe._running = True
    with pytest.raises(_EndOfScript):
        await loop()

    ticks = clock.llm_calls_at_tick[warmup:]
    return [after - before for before, after in zip(ticks, ticks[1:])]


# =============================================================================
# Caso 1 — sem fala nova (TaqCITi pausada), o laço não chama o LLM
# =============================================================================


@pytest.mark.parametrize("loop_name", ["coverage", "red_flag"])
async def test_paused_capture_does_not_call_llm_again(monkeypatch, loop_name):
    """A fala de antes da pausa é analisada uma vez; nos 5 ciclos seguintes,
    sem nenhuma fala nova, o laço não chama o Gemini de novo."""
    pipe = _new_pipeline(["Hoje a gente consolida tudo numa planilha manual."])
    llm_calls = _install_fake_llm(monkeypatch, loop_name)

    per_cycle = await _drive(monkeypatch, pipe, loop_name, llm_calls, [None] * 6)

    assert per_cycle == [1, 0, 0, 0, 0, 0]
    assert llm_calls["n"] == 1


# =============================================================================
# Caso 2 — uma fala nova gera exatamente uma chamada; o ciclo seguinte sem
# fala não chama
# =============================================================================


@pytest.mark.parametrize("loop_name", ["coverage", "red_flag"])
async def test_each_new_speech_triggers_exactly_one_call(monkeypatch, loop_name):
    pipe = _new_pipeline()
    llm_calls = _install_fake_llm(monkeypatch, loop_name)

    per_cycle = await _drive(
        monkeypatch, pipe, loop_name, llm_calls,
        [
            None,                                         # reunião começou, ninguém falou
            _speech(pipe, "Temos três sistemas que não conversam."),
            None,                                         # pausa
            _speech(pipe, "O prazo é o fim do trimestre."),  # fala volta
            None,                                         # pausa de novo
        ],
    )

    assert per_cycle == [0, 1, 0, 1, 0]
    assert llm_calls["n"] == 2


# =============================================================================
# Caso 3 — force_classify (classificador direto) roda mesmo sem fala nova
# =============================================================================


async def test_force_classify_runs_without_new_speech(monkeypatch):
    """O botão de forçar classificação (routers/ws.py) chama
    _run_coverage_classifier direto, sem passar pela trava do laço: mesmo com
    toda a fala já analisada pelo laço, o classificador roda."""
    pipe = _new_pipeline(["A gente quer um dashboard de vendas."])
    llm_calls = _install_fake_llm(monkeypatch, "coverage")

    per_cycle = await _drive(monkeypatch, pipe, "coverage", llm_calls, [None, None])
    assert per_cycle == [1, 0]  # o laço já consumiu a única fala

    await pipe._run_coverage_classifier()

    assert llm_calls["n"] == 2


# =============================================================================
# Caso 4 — sessão que já tem falas na primeira rodada analisa UMA vez
# (o marcador começa em 0; vale para pipeline recriado a partir do banco)
# =============================================================================


@pytest.mark.parametrize("loop_name", ["coverage", "red_flag"])
async def test_existing_transcript_on_first_round_runs_once(monkeypatch, loop_name):
    pipe = _new_pipeline([
        "Os dados vêm do ERP e de duas planilhas.",
        "A atualização hoje é semanal.",
        "Ninguém confia no número do mês passado.",
    ])
    llm_calls = _install_fake_llm(monkeypatch, loop_name)

    per_cycle = await _drive(monkeypatch, pipe, loop_name, llm_calls, [None, None, None])

    assert per_cycle == [1, 0, 0]


# =============================================================================
# Decisão 3 do plano — o marcador avança ANTES da chamada ao Gemini
# =============================================================================


@pytest.mark.parametrize("loop_name", ["coverage", "red_flag"])
async def test_marker_advances_before_llm_call(monkeypatch, loop_name):
    """Duas consequências da decisão 3, num roteiro só:
    (a) chamada que falha (cota, chave) NÃO é repetida enquanto não houver
        fala nova — evita tempestade de chamadas pagas que falham;
    (b) fala que chega DURANTE uma análise conta como nova no ciclo seguinte."""
    pipe = _new_pipeline(["Primeira fala."])

    async def _on_call(n):
        if n == 1:
            raise RuntimeError("cota do Gemini esgotada")
        if n == 2:
            await pipe.push_chunk("Fala que chegou durante a análise.", speaker="consultor")

    llm_calls = _install_fake_llm(monkeypatch, loop_name, on_call=_on_call)

    per_cycle = await _drive(
        monkeypatch, pipe, loop_name, llm_calls,
        [
            None,                                   # 1ª chamada falha
            None,                                   # sem fala nova: não repete
            _speech(pipe, "Fala nova depois da falha."),  # 2ª chamada; chega fala no meio dela
            None,                                   # a fala do meio é nova: 3ª chamada
            None,                                   # nada novo
        ],
    )

    assert per_cycle == [1, 0, 1, 1, 0]
