import json
import re
from typing import Any, Optional

import google.genai as genai
from google.genai import types as genai_types

from app.services.coverage_areas import DISCOVERY_AREA_SET, SALES_AREA_SET

MODEL = "gemini-flash-latest"
_JSON_RE = re.compile(r"```(?:json)?\s*([\s\S]*?)```")

# Gemini 2.5 Flash pricing (USD per 1 000 tokens)
INPUT_COST_PER_1K  = 0.00015   # $0.15 / 1M
OUTPUT_COST_PER_1K = 0.00060   # $0.60 / 1M

# Teto de tokens de saída do relatório. Fonte única de verdade: usada tanto no
# max_output_tokens de generate_report quanto na estimativa de custo em
# session_state.estimated_report_cost — mantê-las alinhadas evita subestimar o
# custo e cortar a sessão sem saldo (F7). Ver PLANO_AJUSTES.md, Task 4b.
REPORT_MAX_OUTPUT_TOKENS = 16384


def tokens_to_usd(input_tokens: int, output_tokens: int) -> float:
    return (input_tokens / 1000) * INPUT_COST_PER_1K + (output_tokens / 1000) * OUTPUT_COST_PER_1K


def _parse_json(text: str) -> Any:
    m = _JSON_RE.search(text)
    raw = m.group(1) if m else text.strip()
    # Strip any leading/trailing non-JSON characters
    raw = raw.strip()
    return json.loads(raw)


async def _call(api_key: str, system: str, user: str, max_output_tokens: int | None = None) -> tuple[str, int, int]:
    client = genai.Client(api_key=api_key)
    config = genai_types.GenerateContentConfig(
        system_instruction=system,
        temperature=0.3,
        max_output_tokens=max_output_tokens,
    )
    response = await client.aio.models.generate_content(
        model=MODEL,
        contents=user,
        config=config,
    )
    # gemini-2.5-* has thinking enabled by default. response.text concatenates ALL
    # candidate parts — including thought parts (drafts) — producing repeated sections
    # and ~1.8MB of whitespace padding. Collect only non-thought output parts.
    text = ""
    if response.candidates and response.candidates[0].content.parts:
        for part in response.candidates[0].content.parts:
            if not getattr(part, "thought", False):
                text += part.text or ""
    if not text:
        text = response.text or ""
    usage = response.usage_metadata
    return text, usage.prompt_token_count or 0, usage.candidates_token_count or 0


async def classify_coverage(
    api_key: str, transcript: str, project_type: str, dms: Optional[int],
    system_prompt: str | None = None,
) -> tuple[Optional[dict], int, int]:
    dms_str = f"{dms}/5" if dms is not None else "not mapped"
    system = system_prompt or (
        f"You are a CoverageClassifier for a data/tech project diagnostic.\n"
        f"Project type: {project_type or 'unknown'}, Data Maturity Score: {dms_str}.\n"
        "Analyze the transcript and classify coverage for each area.\n"
        "Return ONLY valid JSON (no markdown fences, no extra text):\n"
        + SALES_AREA_SET.schema_json(include_not_applicable=False)
    )
    text, inp, out = await _call(api_key, system, f"Transcrição:\n{transcript}")
    try:
        data = _parse_json(text)
        return data, inp, out
    except Exception:
        return None, inp, out


async def detect_red_flags(
    api_key: str, transcript: str, context: str, dms: Optional[int],
    system_prompt: str | None = None,
) -> tuple[list, int, int]:
    dms_str = f"{dms}/5" if dms is not None else "not mapped"
    system = system_prompt or (
        f"You are a RedFlagDetector for a data/tech project diagnostic.\n"
        f"Pre-meeting context: {context or 'none'}. Data Maturity Score: {dms_str}.\n"
        "Identify up to 2 critical risks or red flags in the transcript.\n"
        "Return ONLY valid JSON:\n"
        '{"red_flags":[{"text":"...","severity":"warning|critical","evidence":"..."}]}'
    )
    text, inp, out = await _call(api_key, system, f"Transcrição:\n{transcript}")
    try:
        data = _parse_json(text)
        return data.get("red_flags", []), inp, out
    except Exception:
        return [], inp, out


def _coverage_table_for_lens(coverage: dict, lens: str) -> str:
    """Fase 4 (Discovery Report + Pricing Handoff) / D-27/D-28: pré-montagem
    determinística de UMA tabela de cobertura, filtrada por `lens`
    ("produto" | "dados"). `coverage` já chega com "lens" embutido por item
    (session_state.coverage_to_dict() injeta a lente do REGISTRO estático,
    nunca do runtime) — filtrar por `info["lens"] == lens` é mais barato que
    recalcular DISCOVERY_AREA_SET.by_lens(lens) a cada chamada.

    Label: usa `info["name"]` quando presente (áreas custom do projeto);
    cai para o label legível do registro (DISCOVERY_AREA_SET) quando `name`
    vier vazio (áreas padrão, D-28 — nunca usar SALES_AREA_SET aqui)."""
    labels = DISCOVERY_AREA_SET.labels()
    status_labels = {"covered": "Coberto", "partial": "Parcial", "uncovered": "Não coberto"}
    rows = [
        (
            info.get("name") or labels.get(area, area),
            status_labels.get(info.get("status", ""), info.get("status", "")),
            info.get("score", 0),
            info.get("notes", ""),
        )
        for area, info in coverage.items()
        if isinstance(info, dict) and info.get("lens") == lens
    ]
    if not rows:
        return "_Nenhuma área classificada ainda._"
    return (
        "| Área | Status | Score | Observações |\n"
        "| --- | --- | --- | --- |\n"
        + "\n".join(f"| {label} | {status} | {score}% | {notes} |" for label, status, score, notes in rows)
    )


def _lens_bucket(item: Any) -> str:
    """Fase 4 / D-27/D-39: extrai a lente de UM item (red flag ou pergunta) de
    forma DEFENSIVA — nunca confia que `item` é um dict com a chave "lens".
    Tolera o shape lens-less real de `upload_pdf_transcript` (sessions.py
    ~440-455, não modificado por nenhum plano): questions_used como list[str]
    e red_flags como list[dict] SEM a coluna lens. Itens que não são dict, ou
    dicts sem "lens"/com lens inválida, caem no bucket "não classificado" —
    NUNCA um AttributeError."""
    lens = item.get("lens") if isinstance(item, dict) else None
    return lens if lens in ("produto", "dados") else "não classificado"


async def generate_report(
    api_key: str,
    transcript: str,
    coverage: dict,
    red_flags: list,
    questions_used: list,
    project_type: str,
    dms: Optional[int],
    pre_meeting_context: str = "",
    system_prompt: str | None = None,
    structured_context: Any = None,
    mode: str = "sales",
) -> tuple[str, int, int]:
    from app.services.prompt_builder import CITI_PORTFOLIO, CITI_SERVICE_CATALOG, CITI_TECH_REFERENCE

    dms_levels = {1: "Inicial", 2: "Gerenciado", 3: "Definido", 4: "Quantificado", 5: "Otimizado"}
    dms_label = dms_levels.get(dms, "Não mapeado") if dms is not None else "Não mapeado"
    dms_str = f"{dms}/5 ({dms_label})" if dms is not None else "Não mapeado"

    sc = structured_context
    if sc and not sc.is_empty():
        context_block = (
            f"## Contexto pré-reunião estruturado\n{sc.to_report_block()}\n\n"
            + (f"Contexto pré-reunião completo:\n{pre_meeting_context}\n\n" if pre_meeting_context else "")
        )
    else:
        context_block = f"Contexto pré-reunião: {pre_meeting_context or 'não fornecido'}\n\n"

    citi_block = (
        f"## Portfólio CITi (referência comercial)\n{CITI_PORTFOLIO}\n\n"
        f"## Catálogo de serviços CITi (referência para sprints)\n{CITI_SERVICE_CATALOG}\n\n"
        f"## Referência de tecnologias\n{CITI_TECH_REFERENCE}\n\n"
    ) if mode == "sales" else ""

    if mode == "discovery":
        # D-27/D-28: pré-montagem híbrida — duas tabelas de cobertura por
        # lens (DISCOVERY_AREA_SET, NUNCA SALES_AREA_SET dentro deste ramo),
        # red flags e perguntas particionados por lens (D-40, seção 12.4 do
        # PRD). O LLM NUNCA decide a lente de um item já classificado — a
        # partição é determinística no código (registro autoritário).
        coverage_table_produto = _coverage_table_for_lens(coverage, "produto")
        coverage_table_dados = _coverage_table_for_lens(coverage, "dados")

        flags_by_bucket: dict[str, list[str]] = {"produto": [], "dados": [], "não classificado": []}
        for f in red_flags:
            is_dict = isinstance(f, dict)
            text = f.get("text", "") if is_dict else str(f)
            severity = (f.get("severity", "warning") if is_dict else "warning") or "warning"
            evidence = f.get("evidence", "") if is_dict else ""
            flags_by_bucket[_lens_bucket(f)].append(
                f"- [{severity.upper()}] {text} | evidência: {evidence}"
            )

        questions_by_bucket: dict[str, list[str]] = {"produto": [], "dados": [], "não classificado": []}
        for q in questions_used:
            is_dict = isinstance(q, dict)
            text = q.get("text", "") if is_dict else str(q)
            if not text:
                continue
            questions_by_bucket[_lens_bucket(q)].append(f"- {text}")

        def _block(buckets: dict[str, list[str]], key: str, empty: str) -> str:
            return "\n".join(buckets[key]) or empty

        user = (
            f"Tipo de projeto: {project_type or 'não especificado'}\n"
            f"Data Maturity Score: {dms_str}\n"
            f"{context_block}"
            f"## Cobertura final — Produto\n{coverage_table_produto}\n\n"
            f"## Cobertura final — Dados\n{coverage_table_dados}\n\n"
            f"## Alertas detectados — Produto\n{_block(flags_by_bucket, 'produto', 'Nenhum alerta detectado.')}\n\n"
            f"## Alertas detectados — Dados\n{_block(flags_by_bucket, 'dados', 'Nenhum alerta detectado.')}\n\n"
            f"## Alertas detectados — Não classificado\n{_block(flags_by_bucket, 'não classificado', 'Nenhum alerta detectado.')}\n\n"
            f"## Dúvidas em aberto — Produto\n{_block(questions_by_bucket, 'produto', 'Nenhuma pergunta em aberto.')}\n\n"
            f"## Dúvidas em aberto — Dados\n{_block(questions_by_bucket, 'dados', 'Nenhuma pergunta em aberto.')}\n\n"
            f"## Dúvidas em aberto — Não classificado\n{_block(questions_by_bucket, 'não classificado', 'Nenhuma pergunta em aberto.')}\n\n"
            f"## Transcrição completa\n{transcript}"
        )
    else:
        # Sales: caminho de hoje, byte-idêntico (D-25/REP-03) — NÃO tocar.
        # `questions_used` (agora list[dict] por D-40) nunca é lido aqui,
        # exatamente como hoje (o parâmetro já era ignorado pelo ramo sales
        # antes desta fase).
        area_labels = SALES_AREA_SET.labels()
        status_labels = {"covered": "Coberto", "partial": "Parcial", "uncovered": "Não coberto"}
        coverage_rows = [
            (area_labels.get(area, area), status_labels.get(info.get("status", ""), info.get("status", "")),
             info.get("score", 0), info.get("notes", ""))
            for area, info in coverage.items()
            if isinstance(info, dict) and info.get("status") != "not_applicable"
        ]
        if coverage_rows:
            coverage_table = (
                "| Área | Status | Score | Observações |\n"
                "| --- | --- | --- | --- |\n"
                + "\n".join(
                    f"| {label} | {status} | {score}% | {notes} |"
                    for label, status, score, notes in coverage_rows
                )
            )
        else:
            coverage_table = "_Nenhuma área classificada ainda._"

        flags_text = "\n".join(
            f"- [{f.get('severity', 'warning').upper()}] {f.get('text', '')} | evidência: {f.get('evidence', '')}"
            for f in red_flags
        ) or "Nenhum alerta detectado."

        user = (
            f"Tipo de projeto: {project_type or 'não especificado'}\n"
            f"Data Maturity Score: {dms_str}\n"
            f"{context_block}"
            f"## Cobertura final\n{coverage_table}\n\n"
            f"## Alertas detectados\n{flags_text}\n\n"
            f"{citi_block}"
            f"## Transcrição completa\n{transcript}"
        )

    if system_prompt:
        system = system_prompt
    elif mode == "discovery":
        # D-25: prompt/estrutura irmão — esqueleto PRD de 16 seções (D-26),
        # reaproveitado de discovery_prompt_builder.py em vez de duplicado
        # aqui. Import tardio (mesmo padrão do import de CITI_* acima) evita
        # ciclo de import (discovery_prompt_builder não importa llm.py).
        from app.services.discovery_prompt_builder import DiscoveryPromptBuilder

        system = DiscoveryPromptBuilder(dms=dms).build_report_generator()
    else:
        system = (
            "Você é um tech lead sênior da CITi gerando um relatório de diagnóstico técnico-comercial "
            "em português brasileiro.\n"
            "Escreva em Markdown claro e profissional. Seja específico, direto e orientado a ações. "
            "Sem texto de preenchimento. Quando houver risco ou expectativa irreal, diga claramente.\n\n"
            "Estruture o relatório com estas seções na ordem exata:\n"
            "## Nível de Complexidade\n"
            "  - Classificação: Simples | Médio | Complexo | Bomba\n"
            "  - Justificativa\n"
            "## Cobertura por Área\n"
            "  Copie EXATAMENTE a tabela markdown fornecida em '## Cobertura final' no prompt. Não altere, não resuma, não omita linhas.\n"
            "## Riscos e Alertas\n"
            "  - 🚨 ALERTA CRÍTICO | ⚠️ RED FLAG\n"
            "## Arquitetura Recomendada\n"
            "  ### Stack por Camada (tabela: Camada | Tecnologia | Justificativa)\n"
            "  ### Componentes e Fluxo de Dados\n"
            "  ### Possíveis Armadilhas\n"
            "## Estrutura de Sprints Recomendada\n"
            "  Tabela: Sprint | Módulo CITi | Atividades | Duração (semanas) + linha Total\n"
            "## Perguntas Ainda Sem Resposta\n"
            "## Recomendação Final\n"
            "  ✅ Fechar | ⚠️ Fechar com condições | ❌ Não fechar sem antes resolver X\n"
            "## Maturidade de Dados\n"
        )

    text, inp, out = await _call(api_key, system, user, max_output_tokens=REPORT_MAX_OUTPUT_TOKENS)
    return text, inp, out


async def infer_project_type(api_key: str, context: str) -> tuple[str, int, int]:
    system = (
        "You are classifying a data/tech project into exactly one category.\n"
        "Return ONLY the category string, nothing else.\n"
        "Valid categories: bi, ml, data_engineering, automation, integration, science\n\n"
        "bi            — BI, analytics, dashboards, KPIs, reports\n"
        "ml            — machine learning, predictive models, classification, regression\n"
        "data_engineering — data pipelines, ETL, data warehouse, lakehouse\n"
        "automation    — workflow automation, RPA, n8n, task orchestration\n"
        "integration   — API integration, system connectors, data sync between platforms\n"
        "science       — exploratory data analysis, statistical analysis, AI agents, NLP"
    )
    text, inp, out = await _call(api_key, system, f"Project context:\n{context or 'not provided'}")
    inferred = text.strip().lower().split()[0] if text.strip() else ""
    valid = {"bi", "ml", "data_engineering", "automation", "integration", "science"}
    return (inferred if inferred in valid else "bi"), inp, out


async def generate_custom_areas(
    api_key: str, project_type: str, pre_meeting_context: str, dms: Optional[int]
) -> tuple[list[dict], int, int]:
    """Gera 2-4 áreas de cobertura específicas deste projeto a partir do contexto.

    Retorna lista de {"key", "name"} — áreas que complementam as padrão do tipo.
    """
    system = (
        "Você define áreas de risco/cobertura ESPECÍFICAS para um projeto de dados/tecnologia, "
        "que serão monitoradas durante a reunião de diagnóstico.\n"
        "As áreas PADRÃO (negócio, eng. de dados, visualização, ciência de dados, automação, "
        "integração, consumo, parceria) JÁ existem — NÃO as repita.\n"
        "Gere de 2 a 4 áreas adicionais que sejam particulares deste projeto e que NÃO estejam "
        "cobertas pelas padrão. Exemplos: 'Qualidade da base documental', 'Latência de resposta', "
        "'Confiabilidade jurídica', 'Conformidade LGPD', 'Custo por consulta'.\n"
        "Se o contexto não sugerir nada específico, retorne lista vazia.\n"
        "Retorne APENAS JSON válido:\n"
        '{"areas":[{"key":"slug_curto_sem_espacos","name":"Nome Legível"}]}'
    )
    dms_display = f"{dms}/5" if dms is not None else "não mapeado"
    user = (
        f"Tipo de projeto: {project_type or 'não especificado'}\n"
        f"Data Maturity Score: {dms_display}\n"
        f"Contexto pré-reunião:\n{pre_meeting_context or 'não fornecido'}"
    )
    text, inp, out = await _call(api_key, system, user)
    try:
        data = _parse_json(text)
        areas = []
        for a in data.get("areas", [])[:4]:
            key = str(a.get("key", "")).strip().lower().replace(" ", "_")
            name = str(a.get("name", "")).strip()
            if key and name:
                areas.append({"key": f"custom_{key}"[:40], "name": name[:60]})
        return areas, inp, out
    except Exception:
        return [], inp, out


async def generate_questions(
    api_key: str,
    transcript: str,
    coverage: dict,
    recent_questions: list,
    project_type: str,
    dms: Optional[int],
    bank_questions: list[dict] | None = None,
    system_prompt: str | None = None,
    pre_meeting_context: str = "",
) -> tuple[list, int, int]:
    coverage_text = "\n".join(
        f"- {area}: {info.get('status', '?')} ({info.get('score', 0)}%)"
        for area, info in coverage.items()
        if isinstance(info, dict)
    )
    recent_text = "\n".join(f"- {q}" for q in recent_questions) or "none"

    bank_text = ""
    if bank_questions:
        by_block: dict[str, list[str]] = {}
        for q in bank_questions:
            by_block.setdefault(q["block"], []).append(q["text"])
        lines = []
        for block, texts in by_block.items():
            lines.append(f"[{block}]")
            lines.extend(f"  - {t}" for t in texts)
        bank_text = "\n".join(lines)

    dms_display = f"{dms}/5" if dms is not None else "não mapeado"
    system = system_prompt or (
        "Você é um QuestionPlanner para diagnóstico de projetos de dados/tecnologia.\n"
        f"Data Maturity Score do cliente: {dms_display}.\n\n"
        "Sua tarefa: gerar exatamente 3 perguntas em português para o comercial fazer ao cliente.\n\n"
        "ESTILO OBRIGATÓRIO — curtas, diretas, interrogativas:\n"
        "✅ BOM: 'Quantas fontes de dados?', 'Precisa de IA?', 'Prazo do projeto?', 'Já tem DW?'\n"
        "❌ RUIM: 'Poderia nos contar mais sobre como os dados chegam atualmente ao sistema?'\n"
        "Máximo 10 palavras por pergunta. Sem introduções, sem contexto embutido — só a pergunta.\n\n"
        "PRIORIDADE:\n"
        "1. Analise a transcrição — identifique o que já foi dito e o que está sendo discutido agora.\n"
        "2. Olhe a cobertura — priorize áreas ainda descobertas ou com score baixo.\n"
        "3. Use o banco de perguntas apenas como REFERÊNCIA de temas. "
        "Adapte, combine, reformule ou ignore completamente — use o que fizer sentido para a conversa atual.\n"
        "4. Não repita perguntas recentes.\n\n"
        "Retorne APENAS JSON válido:\n"
        '{"questions":[{"text":"...","block":"' + SALES_AREA_SET.block_enum() + '"}]}'
    )
    user = (
        (f"Contexto pré-reunião: {pre_meeting_context}\n\n" if pre_meeting_context else "")
        + f"Cobertura atual:\n{coverage_text}\n\n"
        + f"Perguntas recentes (não repetir):\n{recent_text}\n\n"
        + (f"Banco de perguntas (referência — use com liberdade):\n{bank_text}\n\n" if bank_text else "")
        + f"Transcrição recente:\n{transcript[-2000:]}"
    )
    text, inp, out = await _call(api_key, system, user)
    try:
        data = _parse_json(text)
        return data.get("questions", []), inp, out
    except Exception:
        return [], inp, out
