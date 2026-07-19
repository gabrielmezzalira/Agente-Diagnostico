# =============================================================================
# services/llm_pricing_service.py
#
# Responsabilidade única: lógica de negócio LLM do Precificador.
# Recebe PricingRepository e BaseChatModel por injeção — sem imports de
# providers concretos e sem chamadas diretas ao banco.
# Toda persistência vai por self._repo.*.
# =============================================================================

from __future__ import annotations

from decimal import Decimal
from typing import TYPE_CHECKING

from fastapi import HTTPException
from pydantic import BaseModel

if TYPE_CHECKING:
    # These are only needed for type annotations — lazy-imported at runtime
    # inside methods to keep the module importable before `pip install`.
    from langchain_core.language_models import BaseChatModel

from app.models.pricing_features import PricingFeatureResponse
from app.models.pricings import SuggestedFeature
from app.repositories.pricing_repository import PricingRepository


# ---------------------------------------------------------------------------
# Schemas de saída estruturada para with_structured_output (T-12-04)
# Pydantic garante que o LLM devolva JSON com o schema correto antes de
# qualquer insert no banco.
# ---------------------------------------------------------------------------


class ExtractedFeature(BaseModel):
    bloco: str
    funcionalidade: str
    horas: float


class ExtractedFeatureList(BaseModel):
    features: list[ExtractedFeature]


class SuggestionList(BaseModel):
    sugestoes: list[SuggestedFeature]


# ---------------------------------------------------------------------------
# Service
# ---------------------------------------------------------------------------


class LLMPricingService:
    """Serviço LLM do Precificador.

    Princípios SOLID aplicados:
    - S: faz apenas operações LLM de precificação; sem routing, sem formatação HTTP
    - D: depende de PricingRepository (abstração de DB) e BaseChatModel (abstração LLM)
         — nunca instancia providers concretos diretamente
    """

    def __init__(self, repo: PricingRepository, llm: BaseChatModel) -> None:
        self._repo = repo
        self._llm = llm

    # -------------------------------------------------------------------------
    # import_from_diagnosis
    # -------------------------------------------------------------------------

    def import_from_diagnosis(self, pricing_id: str) -> list[PricingFeatureResponse]:
        """Extrai funcionalidades dos relatórios de diagnóstico via LLM e as insere.

        Resolve project_id internamente a partir de pricing_id — o chamador
        não precisa conhecer o project_id.

        Args:
            pricing_id: UUID do pricing de destino

        Returns:
            Lista de PricingFeatureResponse inseridas

        Raises:
            HTTPException 404 se o pricing não existir
            HTTPException 422 se não houver relatórios ou se o LLM não extrair features
        """
        pricing = self._repo.get_pricing(pricing_id)
        if not pricing:
            raise HTTPException(status_code=404, detail="Pricing not found")
        project_id = str(pricing["project_id"])

        reports = self._repo.get_project_reports(project_id)
        if not reports:
            raise HTTPException(
                status_code=422,
                detail=(
                    "Nenhum relatório de diagnóstico encontrado para este projeto. "
                    "Gere um relatório de sessão primeiro."
                ),
            )

        combined_md = "\n\n---\n\n".join(
            r["markdown_content"] for r in reports if r.get("markdown_content")
        )

        system_prompt = (
            "Você é um assistente de precificação técnica. Analise o relatório de diagnóstico "
            "a seguir e extraia uma lista de funcionalidades técnicas que precisarão ser desenvolvidas. "
            "Para cada funcionalidade, identifique: o bloco temático (ex: Engenharia de Dados, "
            "Visualização, Ciência de Dados, Automação, Integração, Consumo/Interface, Geral), "
            "o nome da funcionalidade em português, e uma estimativa de horas (valor entre 4 e 80). "
            "Retorne apenas funcionalidades concretas e implementáveis."
        )

        from langchain_core.messages import HumanMessage, SystemMessage  # lazy import

        structured_llm = self._llm.with_structured_output(ExtractedFeatureList)
        result: ExtractedFeatureList = structured_llm.invoke([
            SystemMessage(content=system_prompt),
            HumanMessage(content=combined_md),
        ])

        if not result.features:
            raise HTTPException(
                status_code=422,
                detail="O LLM não extraiu funcionalidades do relatório.",
            )

        rows = [
            {
                "bloco": f.bloco,
                "funcionalidade": f.funcionalidade,
                "horas": str(f.horas),
            }
            for f in result.features
        ]
        inserted = self._repo.bulk_insert_features(pricing_id, rows)
        return [PricingFeatureResponse(**r) for r in inserted]

    # -------------------------------------------------------------------------
    # suggest_features
    # -------------------------------------------------------------------------

    def suggest_features(self, pricing_id: str) -> list[SuggestedFeature]:
        """Sugere funcionalidades adicionais para um pricing via LLM.

        NÃO insere nada no banco — o usuário decide o que aceitar na UI.
        Resolve project_id internamente a partir de pricing_id.

        O prompt inclui 4 contextos obrigatórios (PREC-11):
          A) Relatórios de diagnóstico
          B) Funcionalidades atuais na precificação (anti-repetição)
          C) Top-3 pricings aprovados de tipo similar (histórico)
          D) Instrução explícita anti-repetição

        Args:
            pricing_id: UUID do pricing de origem

        Returns:
            Lista de SuggestedFeature (não persistida)
        """
        pricing = self._repo.get_pricing(pricing_id)
        if not pricing:
            raise HTTPException(status_code=404, detail="Pricing not found")
        project_id = str(pricing["project_id"])

        current_features = self._repo.get_pricing_features(pricing_id)
        project = self._repo.get_project(project_id)
        project_type = (project or {}).get("project_type") or ""
        reports = self._repo.get_project_reports(project_id)
        history = self._repo.get_top_history_by_type(project_type, limit=3)

        # Part A: diagnosis reports
        reports_text = (
            "\n\n---\n\n".join(
                r["markdown_content"] for r in reports if r.get("markdown_content")
            )
            if reports
            else "Nenhum relatório de diagnóstico disponível."
        )

        # Part B: current features (anti-repetition context)
        current_text = (
            "\n".join(
                f"- [{f.get('bloco', '')}] {f.get('funcionalidade', '')} ({f.get('horas', '?')}h)"
                for f in current_features
            )
            if current_features
            else "Nenhuma funcionalidade cadastrada ainda."
        )

        # Part C: approved history of similar projects
        history_parts = []
        for h in history:
            snapshot = h.get("snapshot", {})
            feats = snapshot.get("features", [])
            feats_text = "\n".join(
                f"  - [{f.get('bloco', '')}] {f.get('funcionalidade', '')} ({f.get('horas', '?')}h)"
                for f in feats
            )
            history_parts.append(
                f"Projeto aprovado ({snapshot.get('project_type', '')}):\n{feats_text}"
            )
        history_text = (
            "\n\n".join(history_parts)
            if history_parts
            else "Nenhum histórico de precificações aprovadas disponível."
        )

        # Part D: explicit anti-repetition instruction embedded in human message
        human_message = (
            f"## Relatórios de Diagnóstico\n{reports_text}\n\n"
            f"## Funcionalidades Atuais na Precificação\n{current_text}\n\n"
            f"## Histórico de Projetos Similares Aprovados\n{history_text}\n\n"
            f"## Instrução\n"
            f"Sugira funcionalidades adicionais para este projeto do tipo '{project_type}'. "
            f"NÃO sugira funcionalidades já presentes na lista atual. "
            f"Baseie-se nos relatórios de diagnóstico e no histórico aprovado. "
            f"Para cada sugestão, forneça uma justificativa clara."
        )

        system_prompt = (
            "Você é um consultor técnico de precificação de projetos de dados. "
            "Analise o contexto fornecido e sugira funcionalidades adicionais relevantes "
            "que provavelmente são necessárias mas ainda não estão na lista atual. "
            "Use blocos temáticos como: Engenharia de Dados, Visualização, Ciência de Dados, "
            "Automação, Integração, Consumo/Interface, Geral. "
            "Estime horas realistas entre 4 e 80 por funcionalidade."
        )

        from langchain_core.messages import HumanMessage, SystemMessage  # lazy import

        structured_llm = self._llm.with_structured_output(SuggestionList)
        result: SuggestionList = structured_llm.invoke([
            SystemMessage(content=system_prompt),
            HumanMessage(content=human_message),
        ])

        return result.sugestoes
