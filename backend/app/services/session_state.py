import asyncio
from dataclasses import dataclass, field
from typing import Dict, List, Optional

from app.services.llm import INPUT_COST_PER_1K, OUTPUT_COST_PER_1K
from app.services.prompt_builder import AREAS_BY_PROJECT_TYPE

COVERAGE_AREAS = [
    "negocio", "eng_dados", "visualizacao", "ciencia_dados",
    "automacao", "integracao", "consumo", "parceria",
]


def _init_coverage(
    project_type: str, custom_areas: "Optional[List[dict]]" = None
) -> "Dict[str, CoverageArea]":
    inactive = set(AREAS_BY_PROJECT_TYPE.get(project_type, {}).get("inactive", []))
    coverage = {
        a: CoverageArea(status="not_applicable") if a in inactive else CoverageArea()
        for a in COVERAGE_AREAS
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


@dataclass
class Question:
    id: str
    text: str
    block: str
    source: str  # auto | manual
    status: str  # queued | pinned | dismissed | used
    generated_at: str
    expires_at: str


@dataclass
class SessionState:
    session_id: str
    project_id: str = ""
    project_type: str = ""
    data_maturity_score: int = 3
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

    chunk_queue: asyncio.Queue = field(default_factory=asyncio.Queue)

    def __post_init__(self) -> None:
        if not self.coverage:
            self.coverage = _init_coverage(self.project_type, self.custom_areas)

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
        transcript_tokens = len(self.get_transcript_text()) // 4 + 2000
        return (transcript_tokens / 1000) * INPUT_COST_PER_1K + (2500 / 1000) * OUTPUT_COST_PER_1K

    def budget_remaining(self) -> Optional[float]:
        if self.budget_usd is None:
            return None
        return self.budget_usd - self.cost_usd

    def coverage_to_dict(self) -> dict:
        return {
            area: {"status": c.status, "score": c.score, "notes": c.notes, "name": c.name}
            for area, c in self.coverage.items()
        }
