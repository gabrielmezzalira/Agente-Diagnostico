import json
import re
from typing import Any, Optional

import google.genai as genai
from google.genai import types as genai_types

MODEL = "gemini-2.5-flash"
_JSON_RE = re.compile(r"```(?:json)?\s*([\s\S]*?)```")

# Gemini 2.5 Flash pricing (USD per 1 000 tokens)
INPUT_COST_PER_1K  = 0.00015   # $0.15 / 1M
OUTPUT_COST_PER_1K = 0.00060   # $0.60 / 1M


def tokens_to_usd(input_tokens: int, output_tokens: int) -> float:
    return (input_tokens / 1000) * INPUT_COST_PER_1K + (output_tokens / 1000) * OUTPUT_COST_PER_1K


def _parse_json(text: str) -> Any:
    m = _JSON_RE.search(text)
    raw = m.group(1) if m else text.strip()
    # Strip any leading/trailing non-JSON characters
    raw = raw.strip()
    return json.loads(raw)


async def _call(api_key: str, system: str, user: str) -> tuple[str, int, int]:
    client = genai.Client(api_key=api_key)
    config = genai_types.GenerateContentConfig(
        system_instruction=system,
        temperature=0.3,
    )
    response = await client.aio.models.generate_content(
        model=MODEL,
        contents=user,
        config=config,
    )
    text = response.text or ""
    usage = response.usage_metadata
    return text, usage.prompt_token_count or 0, usage.candidates_token_count or 0


async def classify_coverage(
    api_key: str, transcript: str, project_type: str, dms: int,
    system_prompt: str | None = None,
) -> tuple[Optional[dict], int, int]:
    system = system_prompt or (
        f"You are a CoverageClassifier for a data/tech project diagnostic.\n"
        f"Project type: {project_type or 'unknown'}, Data Maturity Score: {dms}/5.\n"
        "Analyze the transcript and classify coverage for each area.\n"
        "Return ONLY valid JSON (no markdown fences, no extra text):\n"
        '{"areas":{"negocio":{"status":"covered|partial|uncovered","score":0-100,"notes":""},'
        '"eng_dados":{"status":"covered|partial|uncovered","score":0-100,"notes":""},'
        '"visualizacao":{"status":"covered|partial|uncovered","score":0-100,"notes":""},'
        '"ciencia_dados":{"status":"covered|partial|uncovered","score":0-100,"notes":""},'
        '"automacao":{"status":"covered|partial|uncovered","score":0-100,"notes":""},'
        '"integracao":{"status":"covered|partial|uncovered","score":0-100,"notes":""},'
        '"consumo":{"status":"covered|partial|uncovered","score":0-100,"notes":""},'
        '"parceria":{"status":"covered|partial|uncovered","score":0-100,"notes":""}}}'
    )
    text, inp, out = await _call(api_key, system, f"Transcrição:\n{transcript}")
    try:
        data = _parse_json(text)
        return data, inp, out
    except Exception:
        return None, inp, out


async def detect_red_flags(
    api_key: str, transcript: str, context: str, dms: int,
    system_prompt: str | None = None,
) -> tuple[list, int, int]:
    system = system_prompt or (
        f"You are a RedFlagDetector for a data/tech project diagnostic.\n"
        f"Pre-meeting context: {context or 'none'}. Data Maturity Score: {dms}/5.\n"
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


async def generate_report(
    api_key: str,
    transcript: str,
    coverage: dict,
    red_flags: list,
    questions_used: list[str],
    project_type: str,
    dms: int,
    pre_meeting_context: str = "",
    system_prompt: str | None = None,
) -> tuple[str, int, int]:
    dms_levels = {1: "Inicial", 2: "Gerenciado", 3: "Definido", 4: "Quantificado", 5: "Otimizado"}
    dms_label = dms_levels.get(dms, str(dms))

    coverage_text = "\n".join(
        f"- {area}: {info['status']} ({info['score']}%) — {info.get('notes', '')}".rstrip(" — ")
        for area, info in coverage.items()
    )
    flags_text = "\n".join(
        f"- [{f.get('severity', 'warning').upper()}] {f.get('text', '')} | evidência: {f.get('evidence', '')}"
        for f in red_flags
    ) or "Nenhum alerta detectado."
    questions_text = "\n".join(f"- {q}" for q in questions_used) or "Nenhuma pergunta registrada."

    system = system_prompt or (
        "You are a senior data tech lead generating a diagnostic report in Brazilian Portuguese.\n"
        "Write in clear, professional Markdown. Be specific and actionable. No filler text.\n"
        "Structure the report with these sections:\n"
        "## Resumo Executivo\n"
        "## Cobertura por Área (table: Área | Status | Score | Observações)\n"
        "## Alertas Detectados\n"
        "## Perguntas Realizadas\n"
        "## Riscos e Recomendações\n"
        "## Maturidade de Dados\n"
        "  - Score atual e nível\n"
        "  - Maturidade mínima necessária para o tipo de projeto\n"
        "  - Gap e impacto no projeto\n"
        "  - Recomendações para elevar maturidade\n"
    )
    user = (
        f"Tipo de projeto: {project_type or 'não especificado'}\n"
        f"Data Maturity Score: {dms}/5 ({dms_label})\n"
        f"Contexto pré-reunião: {pre_meeting_context or 'não fornecido'}\n\n"
        f"## Cobertura final\n{coverage_text}\n\n"
        f"## Alertas detectados\n{flags_text}\n\n"
        f"## Perguntas realizadas\n{questions_text}\n\n"
        f"## Transcrição completa\n{transcript}"
    )
    text, inp, out = await _call(api_key, system, user)
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


async def generate_questions(
    api_key: str,
    transcript: str,
    coverage: dict,
    recent_questions: list,
    project_type: str,
    dms: int,
    bank_questions: list[dict] | None = None,
    system_prompt: str | None = None,
    pre_meeting_context: str = "",
) -> tuple[list, int, int]:
    coverage_text = "\n".join(
        f"- {area}: {info['status']} ({info['score']}%)"
        for area, info in coverage.items()
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

    system = system_prompt or (
        "Você é um QuestionPlanner para diagnóstico de projetos de dados/tecnologia.\n"
        f"Data Maturity Score do cliente: {dms}/5.\n\n"
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
        '{"questions":[{"text":"...","block":"negocio|eng_dados|visualizacao|ciencia_dados|automacao|integracao|consumo|parceria"}]}'
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
