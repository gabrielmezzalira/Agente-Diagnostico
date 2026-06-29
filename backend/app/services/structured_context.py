"""
StructuredContext — schema de contexto pré-reunião e extrator LLM.

Todos os campos são Optional. O extrator instrui o LLM a retornar null
quando a informação não está no documento — sem inferência, sem alucinação.
"""
from __future__ import annotations

import json
import re
from typing import Literal, Optional

import google.genai as genai
from google.genai import types as genai_types
from pydantic import BaseModel

_JSON_RE = re.compile(r"```(?:json)?\s*([\s\S]*?)```")
_MODEL = "gemini-2.5-flash"


class StackItem(BaseModel):
    name: str
    purpose: str = ""
    known_limitations: list[str] = []


class KnownRedFlag(BaseModel):
    text: str
    severity: Literal["warning", "critical"] = "warning"
    # true  = discutido com o cliente em reunião anterior
    # false = gap identificado pela CITi internamente, ainda não levantado com o cliente
    already_raised: bool = False


class StructuredContext(BaseModel):
    main_pain: Optional[str] = None
    secondary_pains: list[str] = []
    current_stack: list[StackItem] = []
    known_constraints: list[str] = []         # restrições técnicas confirmadas antes da reunião
    known_red_flags: list[KnownRedFlag] = []  # riscos pré-mapeados pela equipe CITi
    client_biases: list[str] = []             # vieses e expectativas do cliente
    what_already_tried: Optional[str] = None  # tentativas anteriores que falharam
    lgpd_addressed: bool = False              # LGPD foi explicitamente discutida com o cliente?
    recommended_questions: dict[str, list[str]] = {}  # bloco → perguntas pré-mapeadas

    def is_empty(self) -> bool:
        return not any([
            self.main_pain,
            self.secondary_pains,
            self.current_stack,
            self.known_constraints,
            self.known_red_flags,
            self.client_biases,
            self.what_already_tried,
            self.recommended_questions,
        ])

    # -------------------------------------------------------------------------
    # Bloco para o relatório final (user message de generate_report)
    # -------------------------------------------------------------------------

    def to_report_block(self) -> str:
        """Formata o contexto estruturado para inclusão no relatório final."""
        if self.is_empty():
            return ""
        lines: list[str] = []

        if self.main_pain:
            lines.append(f"**Dor principal mapeada antes da reunião:** {self.main_pain}")

        if self.secondary_pains:
            lines.append("\n**Dores secundárias mapeadas:**")
            for p in self.secondary_pains:
                lines.append(f"- {p}")

        if self.current_stack:
            lines.append("\n**Stack atual e limitações conhecidas:**")
            for item in self.current_stack:
                label = f"**{item.name}**"
                if item.purpose:
                    label += f" — {item.purpose}"
                lines.append(f"- {label}")
                for lim in item.known_limitations:
                    lines.append(f"  - ⚠️ {lim}")

        if self.known_constraints:
            lines.append("\n**Restrições técnicas confirmadas:**")
            for c in self.known_constraints:
                lines.append(f"- {c}")

        not_raised = [f for f in self.known_red_flags if not f.already_raised]
        raised = [f for f in self.known_red_flags if f.already_raised]

        if not_raised:
            lines.append(
                "\n**Riscos pré-mapeados NÃO discutidos com o cliente**"
                " (endereçar como próximos passos obrigatórios):"
            )
            for f in not_raised:
                icon = "🚨" if f.severity == "critical" else "⚠️"
                lines.append(f"- {icon} {f.text}")

        if raised:
            lines.append("\n**Riscos já levantados com o cliente:**")
            for f in raised:
                icon = "🚨" if f.severity == "critical" else "⚠️"
                lines.append(f"- {icon} {f.text}")

        if self.client_biases:
            lines.append("\n**Vieses e expectativas do cliente:**")
            for b in self.client_biases:
                lines.append(f"- {b}")

        if self.what_already_tried:
            lines.append(f"\n**O que já foi tentado:** {self.what_already_tried}")

        if not self.lgpd_addressed:
            lines.append(
                "\n⚠️ **LGPD/privacidade ainda não foi discutida com o cliente**"
                " — incluir como risco obrigatório no relatório e nos próximos passos."
            )

        return "\n".join(lines)

    # -------------------------------------------------------------------------
    # Hints por agente (injetados nos system prompts via build_* do PromptBuilder)
    # -------------------------------------------------------------------------

    def to_stack_hint(self) -> str:
        """Stack e restrições para o CoverageClassifier."""
        if not self.current_stack and not self.known_constraints:
            return ""
        lines: list[str] = []
        if self.current_stack:
            lines.append("STACK ATUAL DO CLIENTE (mapeado antes da reunião — use para calibrar cobertura):")
            for item in self.current_stack:
                label = f"- {item.name}"
                if item.purpose:
                    label += f" ({item.purpose})"
                lines.append(label)
                for lim in item.known_limitations:
                    lines.append(f"  ⚠️ limitação conhecida: {lim}")
        if self.known_constraints:
            lines.append("\nRESTRIÇÕES TÉCNICAS CONFIRMADAS (não precisam ser descobertas na reunião):")
            for c in self.known_constraints:
                lines.append(f"- {c}")
        return "\n".join(lines)

    def to_flag_hint(self) -> str:
        """Red flags pré-mapeados para o RedFlagDetector."""
        lines: list[str] = []
        not_raised = [f for f in self.known_red_flags if not f.already_raised]
        raised = [f for f in self.known_red_flags if f.already_raised]

        if not_raised:
            lines.append(
                "RISCOS PRÉ-MAPEADOS (não discutidos com o cliente):\n"
                "Emita alerta quando surgir evidência na transcrição — "
                "o cliente ainda não sabe que são um problema."
            )
            for f in not_raised:
                icon = "🚨" if f.severity == "critical" else "⚠️"
                lines.append(f"- {icon} {f.text}")

        if raised:
            lines.append(
                "\nRISCOS JÁ DISCUTIDOS COM O CLIENTE:\n"
                "Só emita alerta se surgir nova evidência ou agravante na transcrição."
            )
            for f in raised:
                lines.append(f"- {f.text}")

        if not self.lgpd_addressed:
            lines.append(
                "\n⚠️ LGPD não foi discutida com o cliente. "
                "Emita alerta se dados pessoais, acesso a sistemas ou "
                "compartilhamento de dados forem mencionados."
            )
        return "\n".join(lines)

    def to_question_hint(self) -> str:
        """Perguntas recomendadas e o que já foi tentado para o QuestionPlanner."""
        lines: list[str] = []
        if self.what_already_tried:
            lines.append(
                f"O QUE JÁ FOI TENTADO (não sugira novamente): {self.what_already_tried}"
            )
        if self.recommended_questions:
            lines.append(
                "\nPERGUNTAS PRÉ-MAPEADAS PELO COMERCIAL (referência, não roteiro):\n"
                "Use como ponto de partida para áreas descobertas. "
                "Reformule, combine ou ignore completamente. "
                "Gere perguntas ALÉM destas baseadas no que está sendo discutido ao vivo."
            )
            for block, questions in self.recommended_questions.items():
                lines.append(f"[{block}]")
                for q in questions:
                    lines.append(f"  - {q}")
        return "\n".join(lines)


# -------------------------------------------------------------------------
# Extrator LLM
# -------------------------------------------------------------------------

_EXTRACTOR_SYSTEM = """\
Você extrai informações estruturadas de documentos de contexto pré-reunião comercial.

REGRA ABSOLUTA: se a informação NÃO estiver explicitamente escrita no documento,
retorne null ou lista vazia. NUNCA infira, suponha ou complete com informação ausente.

Para "already_raised" em red_flags:
  - true  → o risco foi explicitamente discutido com o cliente em reunião anterior
  - false → a equipe identificou internamente mas ainda não comunicou ao cliente

Para "lgpd_addressed":
  - true  → LGPD foi discutida explicitamente com o cliente
  - false → não foi mencionada ou o documento identifica como gap não endereçado

Para "recommended_questions", use apenas os blocos:
  negocio | eng_dados | visualizacao | ciencia_dados | automacao | integracao | consumo | parceria

Retorne APENAS JSON válido, sem markdown fences:
{
  "main_pain": "string | null",
  "secondary_pains": ["string"],
  "current_stack": [
    {"name": "string", "purpose": "string", "known_limitations": ["string"]}
  ],
  "known_constraints": ["string"],
  "known_red_flags": [
    {"text": "string", "severity": "warning|critical", "already_raised": true|false}
  ],
  "client_biases": ["string"],
  "what_already_tried": "string | null",
  "lgpd_addressed": true|false,
  "recommended_questions": {
    "bloco": ["pergunta 1", "pergunta 2"]
  }
}\
"""


async def extract_structured_context(
    api_key: str,
    raw_context: str,
) -> tuple[StructuredContext, int, int]:
    """Extrai contexto estruturado de um documento de contexto livre.

    Retorna (StructuredContext, input_tokens, output_tokens).
    Em caso de falha no parse, retorna StructuredContext vazio — nunca lança exceção.
    """
    client = genai.Client(api_key=api_key)
    config = genai_types.GenerateContentConfig(
        system_instruction=_EXTRACTOR_SYSTEM,
        temperature=0.1,
    )
    response = await client.aio.models.generate_content(
        model=_MODEL,
        contents=f"Documento de contexto pré-reunião:\n\n{raw_context}",
        config=config,
    )

    text = ""
    if response.candidates and response.candidates[0].content.parts:
        for part in response.candidates[0].content.parts:
            if not getattr(part, "thought", False):
                text += part.text or ""
    if not text:
        text = response.text or ""

    usage = response.usage_metadata
    inp = usage.prompt_token_count or 0
    out = usage.candidates_token_count or 0

    m = _JSON_RE.search(text)
    raw = m.group(1) if m else text.strip()
    try:
        data = json.loads(raw)
        return StructuredContext.model_validate(data), inp, out
    except Exception:
        return StructuredContext(), inp, out
