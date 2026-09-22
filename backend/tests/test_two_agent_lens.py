# =============================================================================
# test_two_agent_lens.py
#
# Fase 3 (Two-Agent Questions + Lens Tagging) — Plano 03-01.
#
# Task 1 (TRACER): dois agentes de perguntas (Produto/Dados) inserindo na
# MESMA fila `state.questions`, cada um com sua lente (`lens`), com o Dados
# rodando só em gatilhos pares (D-13/D-21/LENS-01/LENS-02/LENS-03).
#
# Teste unitário puro: get_supabase e llm_service.generate_questions são
# substituídos por fakes/monkeypatch — sem rede, sem Supabase, sem Gemini.
# =============================================================================

from app.services import pipeline as pipeline_mod
from app.services.coverage_areas import DISCOVERY_AREA_SET, SALES_AREA_SET
from app.services.discovery_prompt_builder import DiscoveryPromptBuilder
from app.services.pipeline import SessionPipeline, _normalize_question_text
from app.services.session_state import SessionState


# -----------------------------------------------------------------------------
# Fake DB — copiado/estendido de test_expire_questions.py:31-64 (Wave 0 Gaps
# do RESEARCH.md pede reuso, não recriação do zero). Estendido com insert()
# que acumula os payloads numa lista, para inspecionar o que cada agente
# gravou.
# -----------------------------------------------------------------------------


class _FakeQuery:
    def __init__(self, calls: dict):
        self._calls = calls

    def insert(self, payload):
        self._calls.setdefault("inserts", []).append(payload)
        return self

    def update(self, payload):
        self._calls["payload"] = payload
        return self

    def in_(self, col, ids):
        self._calls["in_"] = (col, list(ids))
        return self

    def eq(self, col, val):
        self._calls["eq"] = (col, val)
        return self

    def execute(self):
        self._calls["executed"] = True
        return type("R", (), {"data": []})()


class _FakeDB:
    def __init__(self, calls: dict):
        self._calls = calls

    def table(self, name):
        self._calls["table"] = name
        return _FakeQuery(self._calls)


def _install_fake_db(monkeypatch) -> dict:
    calls: dict = {}
    monkeypatch.setattr(pipeline_mod, "get_supabase", lambda: _FakeDB(calls))
    return calls


async def _fake_coro(questions, inp=0, out=0):
    return questions, inp, out


def _install_fake_generate_questions(monkeypatch, texts_by_call: list[list[str]]):
    """Substitui llm_service.generate_questions por um fake que devolve, a
    cada chamada sucessiva, o próximo lote de textos da lista `texts_by_call`
    (um lote por chamada, na ordem em que forem feitas)."""
    calls: dict = {"n": 0, "recent_per_call": [], "system_prompt_per_call": []}

    async def _fake(
        api_key, transcript, coverage, recent_questions, project_type, dms,
        bank_questions=None, system_prompt=None, pre_meeting_context="",
    ):
        idx = calls["n"]
        calls["n"] += 1
        calls["recent_per_call"].append(list(recent_questions))
        calls["system_prompt_per_call"].append(system_prompt)
        texts = texts_by_call[idx] if idx < len(texts_by_call) else []
        questions = [{"text": t, "block": "negocio"} for t in texts]
        return questions, 0, 0

    monkeypatch.setattr(pipeline_mod.llm_service, "generate_questions", _fake)
    return calls


# =============================================================================
# by_lens — registro de áreas (coverage_areas.py)
# =============================================================================


def test_by_lens_discovery_produto_returns_first_eight_keys_in_order():
    keys = DISCOVERY_AREA_SET.by_lens("produto").keys()
    assert keys == [
        "gargalo", "frente_atuacao", "impacto_usuario", "mapeamento_processos",
        "fluxo_dados", "desenho_solucao", "expectativa_solucao", "viabilidade_solucao",
    ]


def test_by_lens_discovery_dados_returns_ten_keys():
    keys = DISCOVERY_AREA_SET.by_lens("dados").keys()
    assert len(keys) == 10
    assert keys == [
        "qualidade_fontes", "metricas", "lgpd_seguranca", "quick_wins",
        "ciencia_dados", "analise_dados", "engenharia_dados", "machine_learning",
        "sistemas_nuvem", "automacoes",
    ]


def test_by_lens_sales_area_set_has_no_lens():
    """SALES_AREA_SET tem todas as áreas com lens=None (D-19) — by_lens de
    qualquer lente devolve conjunto vazio."""
    assert SALES_AREA_SET.by_lens("produto").keys() == []
    assert SALES_AREA_SET.by_lens("dados").keys() == []
    assert all(a.lens is None for a in SALES_AREA_SET.areas)


# =============================================================================
# build_all / build_question_planner escopado por lente (discovery_prompt_builder.py)
# =============================================================================


def test_build_all_has_two_planner_keys_scoped_by_lens():
    prompts = DiscoveryPromptBuilder(dms=3).build_all()

    assert "question_planner_produto" in prompts
    assert "question_planner_dados" in prompts
    assert DISCOVERY_AREA_SET.by_lens("produto").block_enum() in prompts["question_planner_produto"]
    assert DISCOVERY_AREA_SET.by_lens("dados").block_enum() in prompts["question_planner_dados"]
    # cada prompt mantém a calibração por DMS
    builder = DiscoveryPromptBuilder(dms=3)
    assert builder._dms_str() in prompts["question_planner_produto"]
    assert builder._dms_str() in prompts["question_planner_dados"]
    # nunca contém o portfólio comercial CITi (DISC-03, herdado da Fase 2)
    assert "CITI_PORTFOLIO" not in prompts["question_planner_produto"]
    assert "CITI_PORTFOLIO" not in prompts["question_planner_dados"]


# =============================================================================
# Pipeline discovery — fila única com lens correto + cadência do Dados (SC#1/#3)
# =============================================================================


async def test_two_triggers_discovery_populate_shared_queue_with_both_lenses(monkeypatch):
    calls = _install_fake_db(monkeypatch)
    # Teto compartilhado de 5 (D-14) — dimensionado para deixar espaço para o
    # Dados inserir no gatilho 2 (2 Produto no gatilho 1 + 1 Produto no
    # gatilho 2 = 3 queued; sobra espaço para as 2 do Dados = 5 no total).
    gen_calls = _install_fake_generate_questions(
        monkeypatch,
        texts_by_call=[
            ["Qual o gargalo principal?", "Quem sente o impacto?"],  # Produto, gatilho 1
            ["Como é o fluxo hoje?"],  # Produto, gatilho 2
            ["Quantas fontes de dados existem?", "Existe LGPD mapeado?"],  # Dados, gatilho 2
        ],
    )
    state = SessionState(session_id="s", mode="discovery", data_maturity_score=3)
    state.prompts = DiscoveryPromptBuilder(dms=3).build_all()
    pipe = SessionPipeline(state)
    pipe._resolve_gemini_key = lambda: "fake-key"

    # Gatilho 1 (ímpar): só Produto roda.
    await pipe._run_question_planner()
    assert state.question_trigger_count == 1
    assert all(q.lens == "produto" for q in state.questions)
    assert not any(q.lens == "dados" for q in state.questions)

    # Gatilho 2 (par): Produto + Dados rodam.
    await pipe._run_question_planner()
    assert state.question_trigger_count == 2
    lenses = [q.lens for q in state.questions]
    assert "produto" in lenses
    assert "dados" in lenses
    # Ordering (D-16): dentro do gatilho par, a última pergunta 'dados' vem
    # depois de todas as perguntas 'produto' já na fila até aquele ponto.
    last_dados_idx = max(i for i, l in enumerate(lenses) if l == "dados")
    produto_indices = [i for i, l in enumerate(lenses) if l == "produto"]
    assert all(i < last_dados_idx for i in produto_indices)

    # O Dados (3ª chamada ao generate_questions) enxergou os textos do
    # Produto no seu `recent` — prova a ordem sequencial (D-16, Pitfall 5).
    dados_recent = gen_calls["recent_per_call"][2]
    produto_texts_gatilho_2 = [
        q.text for q in state.questions if q.lens == "produto"
    ]
    assert any(t in dados_recent for t in produto_texts_gatilho_2)


async def test_sales_mode_uses_single_unscoped_planner_key(monkeypatch):
    """Confirma que, no sales, `_run_single_planner` é chamado com
    prompt_key='question_planner' (não '_produto'/'_dados')."""
    calls = _install_fake_db(monkeypatch)
    gen_calls = _install_fake_generate_questions(monkeypatch, texts_by_call=[["Quantas fontes?"]])
    state = SessionState(session_id="s", mode="sales")
    state.prompts = {"question_planner": "PROMPT SALES ÚNICO"}
    pipe = SessionPipeline(state)
    pipe._resolve_gemini_key = lambda: "fake-key"

    await pipe._run_question_planner()

    assert gen_calls["n"] == 1
    assert state.question_trigger_count == 0
    assert all(q.lens is None for q in state.questions)


# =============================================================================
# Task 2 (EXPANSÃO): trava de dedup por texto normalizado entre agentes
# (SC#5/LENS-05, D-17)
# =============================================================================


def test_normalize_question_text_collapses_case_trim_and_spaces():
    assert _normalize_question_text(" Qual  o Gargalo? ") == "qual o gargalo?"
    assert _normalize_question_text("A  B") == _normalize_question_text("a b")


async def test_sc5_dados_duplicate_of_produto_text_is_discarded(monkeypatch):
    """SC#5/D-17: Produto insere um texto; Dados devolve o MESMO texto (caixa/
    espaços diferentes) no mesmo gatilho par — a pergunta do Dados é
    descartada, a fila fica com ocorrência única do texto normalizado."""
    calls = _install_fake_db(monkeypatch)
    gen_calls = _install_fake_generate_questions(
        monkeypatch,
        texts_by_call=[
            ["Qual o gargalo?"],  # Produto, gatilho 1 (ímpar — Dados não roda)
            ["Qual o gargalo?"],  # Produto, gatilho 2
            ["  qual o GARGALO? ", "Existe LGPD mapeado?"],  # Dados, gatilho 2 — 1ª é duplicata normalizada
        ],
    )
    state = SessionState(session_id="s", mode="discovery", data_maturity_score=3)
    state.prompts = DiscoveryPromptBuilder(dms=3).build_all()
    pipe = SessionPipeline(state)
    pipe._resolve_gemini_key = lambda: "fake-key"

    await pipe._run_question_planner()  # gatilho 1
    await pipe._run_question_planner()  # gatilho 2

    normalized_texts = [_normalize_question_text(q.text) for q in state.questions]
    # Nenhuma dupla de texto normalizado, mesmo entre Produto e Dados.
    assert len(normalized_texts) == len(set(normalized_texts))
    assert normalized_texts.count("qual o gargalo?") == 1
    # A pergunta não-duplicada do Dados ("Existe LGPD mapeado?") entrou normalmente.
    assert any(q.lens == "dados" and "lgpd" in q.text.lower() for q in state.questions)


async def test_dedup_within_same_batch_keeps_only_first_occurrence(monkeypatch):
    """Duas perguntas normalizadas iguais no MESMO lote do LLM — só a
    primeira entra."""
    calls = _install_fake_db(monkeypatch)
    _install_fake_generate_questions(
        monkeypatch,
        texts_by_call=[
            ["Qual o gargalo?", "qual o gargalo?", "Quem sente o impacto?"],  # Produto, gatilho 1
        ],
    )
    state = SessionState(session_id="s", mode="discovery", data_maturity_score=3)
    state.prompts = DiscoveryPromptBuilder(dms=3).build_all()
    pipe = SessionPipeline(state)
    pipe._resolve_gemini_key = lambda: "fake-key"

    await pipe._run_question_planner()

    normalized_texts = [_normalize_question_text(q.text) for q in state.questions]
    assert normalized_texts.count("qual o gargalo?") == 1
    assert len(state.questions) == 2  # "qual o gargalo?" (1x) + "quem sente o impacto?"


async def test_sales_mode_does_not_apply_normalized_dedup(monkeypatch):
    """No sales (lens=None), a trava normalizada NÃO roda — duas perguntas de
    texto normalizado igual no mesmo lote são ambas inseridas, preservando o
    comportamento de hoje (só o teto de 5 se aplica, D-24)."""
    calls = _install_fake_db(monkeypatch)
    _install_fake_generate_questions(
        monkeypatch,
        texts_by_call=[["Quantas fontes?", "quantas fontes?"]],
    )
    state = SessionState(session_id="s", mode="sales")
    state.prompts = {"question_planner": "PROMPT SALES ÚNICO"}
    pipe = SessionPipeline(state)
    pipe._resolve_gemini_key = lambda: "fake-key"

    await pipe._run_question_planner()

    assert len(state.questions) == 2
    assert all(q.lens is None for q in state.questions)


async def test_sc3_dados_runs_only_on_even_triggers_across_n_cycles(monkeypatch):
    """SC#3 explícito: dirige 4 gatilhos e assere que o Dados só rodou nos
    pares (2, 4) e o Produto rodou em todos (1, 2, 3, 4). O fake devolve lista
    vazia de perguntas em todo call (nenhum insert, teto de 5 nunca entra em
    jogo) — o teste foca só na CADÊNCIA de chamadas por lente, identificada
    pelo `system_prompt` recebido em cada chamada a generate_questions."""
    calls = _install_fake_db(monkeypatch)
    gen_calls = _install_fake_generate_questions(monkeypatch, texts_by_call=[])
    state = SessionState(session_id="s", mode="discovery", data_maturity_score=3)
    state.prompts = DiscoveryPromptBuilder(dms=3).build_all()
    pipe = SessionPipeline(state)
    pipe._resolve_gemini_key = lambda: "fake-key"

    for _ in range(4):
        await pipe._run_question_planner()

    assert state.question_trigger_count == 4
    assert gen_calls["n"] == 6  # Produto em todo gatilho (4) + Dados só nos pares (2)
    produto_prompt = state.prompts["question_planner_produto"]
    dados_prompt = state.prompts["question_planner_dados"]
    produto_calls = sum(1 for sp in gen_calls["system_prompt_per_call"] if sp == produto_prompt)
    dados_calls = sum(1 for sp in gen_calls["system_prompt_per_call"] if sp == dados_prompt)
    assert produto_calls == 4
    assert dados_calls == 2
    # Ordem por gatilho: [produto], [produto, dados], [produto], [produto, dados]
    assert gen_calls["system_prompt_per_call"] == [
        produto_prompt, produto_prompt, dados_prompt, produto_prompt, produto_prompt, dados_prompt,
    ]


# =============================================================================
# Task 3 (EXPANSÃO): teste-semente de regressão sales (D-24) — 1 planner,
# lens None, sem contador
# =============================================================================


async def test_sales_mode_single_planner_no_lens_no_counter(monkeypatch):
    """D-24: sessão sales usa um único planner (sem sufixo de lente), nunca
    incrementa question_trigger_count, e toda pergunta gerada tem lens=None
    — tanto em memória quanto no payload inserido no banco (nullable)."""
    calls = _install_fake_db(monkeypatch)
    gen_calls = _install_fake_generate_questions(
        monkeypatch, texts_by_call=[[" Quantas fontes existem?"]],
    )
    state = SessionState(session_id="s", mode="sales")
    pipe = SessionPipeline(state)
    pipe._resolve_gemini_key = lambda: "fake-key"

    await pipe._run_question_planner()

    assert state.question_trigger_count == 0
    assert gen_calls["n"] == 1
    assert all(q.lens is None for q in state.questions)
    inserted = calls["inserts"][-1]
    assert inserted.get("lens") is None


# =============================================================================
# Plano 03-03 / Task 1: lente nos red flags — contrato JSON + allowlist/
# fallback produto (D-22), gateado por mode (LENS-04, SC#2)
# =============================================================================


def _install_fake_detect_red_flags(monkeypatch, flags: list[dict]):
    """Substitui llm_service.detect_red_flags por um fake que sempre devolve
    `flags` na primeira chamada e conta quantas vezes foi chamado."""
    calls: dict = {"n": 0}

    async def _fake(api_key, transcript, context, dms, system_prompt=None):
        calls["n"] += 1
        return flags, 0, 0

    monkeypatch.setattr(pipeline_mod.llm_service, "detect_red_flags", _fake)
    return calls


async def test_red_flag_discovery_lens_from_llm_is_persisted(monkeypatch):
    """Discovery: LLM devolve lens='dados' válida → RedFlag.lens == 'dados' e
    o insert de red_flags leva 'lens':'dados' (D-15/D-22)."""
    calls = _install_fake_db(monkeypatch)
    det_calls = _install_fake_detect_red_flags(
        monkeypatch,
        [{"text": "Sem qualidade de fonte mapeada", "severity": "warning", "evidence": "trecho", "lens": "dados"}],
    )
    state = SessionState(session_id="s", mode="discovery", data_maturity_score=3)
    pipe = SessionPipeline(state)
    pipe._resolve_gemini_key = lambda: "fake-key"

    await pipe._run_red_flag_detector()

    assert det_calls["n"] == 1
    assert len(state.red_flags) == 1
    assert state.red_flags[0].lens == "dados"
    inserted = calls["inserts"][-1]
    assert inserted.get("lens") == "dados"


async def test_red_flag_discovery_lens_fallback_to_produto_when_missing_or_invalid(monkeypatch):
    """Discovery: lens ausente/vazia/inválida → fallback 'produto' via
    allowlist fechada (D-22) — o valor bruto do LLM nunca entra sem passar
    pela allowlist."""
    calls = _install_fake_db(monkeypatch)
    _install_fake_detect_red_flags(
        monkeypatch,
        [{"text": "Prazo incompatível com o escopo", "severity": "critical", "evidence": "trecho"}],  # lens ausente
    )
    state = SessionState(session_id="s", mode="discovery", data_maturity_score=3)
    pipe = SessionPipeline(state)
    pipe._resolve_gemini_key = lambda: "fake-key"

    await pipe._run_red_flag_detector()

    assert state.red_flags[0].lens == "produto"
    inserted = calls["inserts"][-1]
    assert inserted.get("lens") == "produto"


async def test_red_flag_discovery_lens_invalid_value_falls_back_to_produto(monkeypatch):
    calls = _install_fake_db(monkeypatch)
    _install_fake_detect_red_flags(
        monkeypatch,
        [{"text": "Risco genérico", "severity": "warning", "evidence": "trecho", "lens": "xyz"}],
    )
    state = SessionState(session_id="s", mode="discovery", data_maturity_score=3)
    pipe = SessionPipeline(state)
    pipe._resolve_gemini_key = lambda: "fake-key"

    await pipe._run_red_flag_detector()

    assert state.red_flags[0].lens == "produto"
    inserted = calls["inserts"][-1]
    assert inserted.get("lens") == "produto"


async def test_red_flag_sales_lens_is_none_and_detector_called_once(monkeypatch):
    """Sales (mode != discovery): RedFlag.lens is None sempre; o insert NÃO
    grava lens não-nula; o detector continua sendo chamado UMA única vez
    (não cria 2º detector)."""
    calls = _install_fake_db(monkeypatch)
    det_calls = _install_fake_detect_red_flags(
        monkeypatch,
        [{"text": "Cliente quer ML sem dados organizados", "severity": "critical", "evidence": "trecho", "lens": "dados"}],
    )
    state = SessionState(session_id="s", project_type="bi")
    pipe = SessionPipeline(state)
    pipe._resolve_gemini_key = lambda: "fake-key"

    await pipe._run_red_flag_detector()

    assert det_calls["n"] == 1
    assert state.red_flags[0].lens is None
    inserted = calls["inserts"][-1]
    assert inserted.get("lens") is None


def test_build_red_flag_detector_discovery_has_lens_contract_no_citi_portfolio():
    prompt = DiscoveryPromptBuilder(dms=3).build_red_flag_detector()
    assert "lens" in prompt
    assert "produto|dados" in prompt
    assert "CITI_PORTFOLIO" not in prompt


# =============================================================================
# Plano 03-03 / Task 2: lente nas coverage areas — coverage_to_dict deriva
# lens do registro por mode (D-19, LENS-04, SC#2)
# =============================================================================


def test_coverage_to_dict_discovery_lens_matches_registry_partition():
    d = SessionState(session_id="s", mode="discovery").coverage_to_dict()
    assert len(d) == 18
    for key in DISCOVERY_AREA_SET.by_lens("produto").keys():
        assert d[key]["lens"] == "produto"
    for key in DISCOVERY_AREA_SET.by_lens("dados").keys():
        assert d[key]["lens"] == "dados"
    # Campos existentes continuam presentes e inalterados.
    sample = d[DISCOVERY_AREA_SET.keys()[0]]
    assert set(["status", "score", "notes", "name", "lens"]) <= set(sample.keys())


def test_coverage_to_dict_sales_lens_is_none_for_all_areas():
    s = SessionState(session_id="s", project_type="bi").coverage_to_dict()
    assert len(s) == len(SALES_AREA_SET.keys())
    assert all(v["lens"] is None for v in s.values())


def test_coverage_to_dict_custom_area_lens_is_none_without_crash():
    state = SessionState(
        session_id="s", project_type="bi",
        custom_areas=[{"key": "x", "name": "X"}],
    )
    d = state.coverage_to_dict()
    assert d["x"]["lens"] is None
    assert d["x"]["name"] == "X"


def test_coverage_to_dict_discovery_specific_keys_lens_smoke():
    d = SessionState(session_id="s", mode="discovery").coverage_to_dict()
    assert d["gargalo"]["lens"] == "produto"
    assert d["metricas"]["lens"] == "dados"


def test_discovery_area_golden_unchanged():
    """Confirma que adicionar o campo `lens` (Task 1) não mudou a saída do
    registro sales: SALES_AREA_SET.keys()/labels()/block_enum() continuam
    idênticos ao golden congelado em test_coverage_areas_golden.py — rede de
    proteção adicional para este arquivo, sem duplicar as asserções lá."""
    from app.services.coverage_areas import AREAS_BY_PROJECT_TYPE

    _SALES_KEYS_ORDER = [
        "negocio", "eng_dados", "visualizacao", "ciencia_dados",
        "automacao", "integracao", "consumo", "parceria",
    ]
    _AREA_LABELS = {
        "negocio": "Negócio", "eng_dados": "Eng. de Dados", "visualizacao": "Visualização",
        "ciencia_dados": "Ciência de Dados", "automacao": "Automação", "integracao": "Integração",
        "consumo": "Consumo", "parceria": "Parceria",
    }
    _BLOCK_ENUM = "negocio|eng_dados|visualizacao|ciencia_dados|automacao|integracao|consumo|parceria"

    assert SALES_AREA_SET.keys() == _SALES_KEYS_ORDER
    assert SALES_AREA_SET.labels() == _AREA_LABELS
    assert SALES_AREA_SET.block_enum() == _BLOCK_ENUM
    assert all(a.lens is None for a in SALES_AREA_SET.areas)
    referenced = {
        key
        for cfg in AREAS_BY_PROJECT_TYPE.values()
        for keys in cfg.values()
        for key in keys
    }
    assert referenced <= set(SALES_AREA_SET.keys())
