import asyncio
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

from app.services.coverage_areas import (
    AREAS_BY_PROJECT_TYPE,
    DISCOVERY_AREA_SET,
    SALES_AREA_SET,
)
from app.services.llm import (
    INPUT_COST_PER_1K,
    OUTPUT_COST_PER_1K,
    REPORT_MAX_OUTPUT_TOKENS,
)

# Margem de segurança sobre o custo estimado do relatório (F7 do SDD): 20%.
REPORT_COST_MARGIN = 1.2


def _init_coverage(
    project_type: str,
    mode: str = "sales",
    custom_areas: "Optional[List[dict]]" = None,
) -> "Dict[str, CoverageArea]":
    # Fase 2 (Discovery Mode) / D-08: no discovery as 18 areas ficam SEMPRE
    # ativas — sem o esquema critical/optional/inactive por project_type que
    # o sales usa. `mode` fica como kwarg novo com default "sales" (NAO
    # promover a 1o parametro posicional — quebraria test_session_state_custom_areas.py,
    # que chama _init_coverage("bi") posicionalmente. Pitfall 2 do RESEARCH.md).
    if mode == "discovery":
        coverage = {a: CoverageArea() for a in DISCOVERY_AREA_SET.keys()}
    else:
        inactive = set(AREAS_BY_PROJECT_TYPE.get(project_type, {}).get("inactive", []))
        coverage = {
            a: CoverageArea(status="not_applicable") if a in inactive else CoverageArea()
            for a in SALES_AREA_SET.keys()
        }
    for area in custom_areas or []:
        key = area.get("key")
        if key:
            coverage[key] = CoverageArea(name=area.get("name", ""))
    return coverage


@dataclass
class CoverageArea:
    status: str = "uncovered"  # uncovered | partial | covered
    score: int = 0
    notes: str = ""
    name: str = ""  # nome legível (preenchido só para áreas específicas do projeto)


@dataclass
class RedFlag:
    id: str
    text: str
    severity: str  # warning | critical
    evidence: str
    detected_at: str
    # Fase 3 (Two-Agent Questions + Lens Tagging) / D-22: lente do red flag
    # ("produto" | "dados"), classificada pelo LLM no discovery com fallback
    # "produto" via allowlist quando ausente/vazia/inválida. ÚLTIMO campo,
    # default None (None no sales, D-24).
    lens: "str | None" = None


@dataclass
class Question:
    id: str
    text: str
    block: str
    source: str  # auto | manual
    status: str  # queued | pinned | dismissed | used
    generated_at: str
    expires_at: str
    # Fase 3 (Two-Agent Questions + Lens Tagging) / D-21: lente do agente que
    # gerou a pergunta ("produto" | "dados"), setada pelo orquestrador — nunca
    # derivada de `block`. ÚLTIMO campo, default None (None no sales, D-24).
    lens: "str | None" = None


@dataclass
class SessionState:
    session_id: str
    project_id: str = ""
    project_type: str = ""
    mode: str = "sales"
    data_maturity_score: Optional[int] = None
    pre_meeting_context: str = ""
    budget_usd: Optional[float] = None
    gemini_api_key: str = ""
    question_ttl_seconds: int = 30
    bank_questions: List[dict] = field(default_factory=list)
    prompts: Dict[str, str] = field(default_factory=dict)
    custom_areas: List[dict] = field(default_factory=list)

    transcript_chunks: List[dict] = field(default_factory=list)
    coverage: Dict[str, CoverageArea] = field(default_factory=dict)
    red_flags: List[RedFlag] = field(default_factory=list)
    questions: List[Question] = field(default_factory=list)

    tokens_used: int = 0
    cost_usd: float = 0.0
    # Fase 3 / D-13: contador determinístico de gatilhos de geração de
    # perguntas no discovery. Estado em memória da sessão (não persistido,
    # D-13); nunca incrementado no sales (D-24).
    question_trigger_count: int = 0
    structured_context: Optional[Any] = None  # StructuredContext | None

    chunk_queue: asyncio.Queue = field(default_factory=asyncio.Queue)

    def __post_init__(self) -> None:
        if not self.coverage:
            self.coverage = _init_coverage(self.project_type, mode=self.mode, custom_areas=self.custom_areas)

    def get_transcript_text(self, last_n: int = 0) -> str:
        chunks = self.transcript_chunks[-last_n:] if last_n else self.transcript_chunks
        # Deduplicate: if chunk[i].text is a prefix of chunk[i+1].text (same speaker),
        # skip chunk[i] — the extension sends growing sentences word-by-word.
        deduped = []
        for i, c in enumerate(chunks):
            if i < len(chunks) - 1:
                nxt = chunks[i + 1]
                same_speaker = c.get("speaker") == nxt.get("speaker")
                if same_speaker and nxt["text"].startswith(c["text"]):
                    continue
            deduped.append(c)
        parts = []
        for c in deduped:
            prefix = f"{c['speaker']}: " if c.get("speaker") else ""
            parts.append(f"{prefix}{c['text']}")
        return "\n".join(parts)

    def add_token_cost(self, input_tokens: int, output_tokens: int) -> None:
        cost = (input_tokens / 1000) * INPUT_COST_PER_1K + (output_tokens / 1000) * OUTPUT_COST_PER_1K
        self.tokens_used += input_tokens + output_tokens
        self.cost_usd += cost

    def estimated_report_cost(self) -> float:
        # Saída estimada = teto real de tokens do relatório (mesma constante que
        # generate_report usa), não um chute fixo. Sem isto o custo era
        # subestimado em ~6× e a parada automática por budget (F7) ficava
        # cega. Aplica margem de 20% conforme o SDD.
        transcript_tokens = len(self.get_transcript_text()) // 4 + 2000
        raw = (
            (transcript_tokens / 1000) * INPUT_COST_PER_1K
            + (REPORT_MAX_OUTPUT_TOKENS / 1000) * OUTPUT_COST_PER_1K
        )
        return raw * REPORT_COST_MARGIN

    def budget_remaining(self) -> Optional[float]:
        if self.budget_usd is None:
            return None
        return self.budget_usd - self.cost_usd

    def coverage_to_dict(self) -> dict:
        # Fase 3 (Two-Agent Questions + Lens Tagging) / D-19: a lente de cada
        # área vem do REGISTRO estático (AreaDefinition.lens) por lookup de
        # chave conforme `mode` — nunca do CoverageArea runtime (Pitfall 3).
        # Áreas custom (sem AreaDefinition correspondente) caem no .get(area)
        # → None, sem tratamento especial nem crash.
        area_set = DISCOVERY_AREA_SET if self.mode == "discovery" else SALES_AREA_SET
        lens_by_key = {a.key: a.lens for a in area_set.areas}
        return {
            area: {
                "status": c.status,
                "score": c.score,
                "notes": c.notes,
                "name": c.name,
                "lens": lens_by_key.get(area),
            }
            for area, c in self.coverage.items()
        }
