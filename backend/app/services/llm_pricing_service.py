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

    def import_from_diagnosis(
        self, pricing_id: str, session_id: str | None = None
    ) -> list[PricingFeatureResponse]:
        """Extrai funcionalidades dos relatórios de diagnóstico via LLM e as insere.

        Resolve project_id internamente a partir de pricing_id — o chamador
        não precisa conhecer o project_id.

        Args:
            pricing_id: UUID do pricing de destino
            session_id: se informado, vincula a precificação a esse diagnóstico
                específico (persiste em pricings.session_id) e usa apenas o
                relatório dessa sessão. Se None, mantém o comportamento legado
                de usar todos os relatórios do projeto.

        Returns:
            Lista de PricingFeatureResponse inseridas

        Raises:
            HTTPException 404 se o pricing (ou a sessão informada) não existir
            HTTPException 422 se não houver relatórios ou se o LLM não extrair features
        """
        pricing = self._repo.get_pricing(pricing_id)
        if not pricing:
            raise HTTPException(status_code=404, detail="Pricing not found")
        project_id = str(pricing["project_id"])

        if session_id:
            session = self._repo.get_session(session_id)
            if not session or str(session["project_id"]) != project_id:
                raise HTTPException(
                    status_code=404, detail="Sessão não encontrada neste projeto"
                )
            report = self._repo.get_session_report(session_id)
            reports = [report] if report else []
        else:
            reports = self._repo.get_project_reports(project_id)

        if not reports:
            raise HTTPException(
                status_code=422,
                detail=(
                    "Nenhum relatório de diagnóstico encontrado para este projeto. "
                    "Gere um relatório de sessão primeiro."
                ),
            )

        if session_id:
            self._repo.update_pricing(pricing_id, {"session_id": session_id})

        combined_md = "\n\n---\n\n".join(
            r["markdown_content"] for r in reports if r.get("markdown_content")
        )

        history = self._repo.get_recent_history(limit=7)

        history_lines = []
        for h in history:
            snapshot = h.get("snapshot", {})
            for f in snapshot.get("features", []):
                history_lines.append(
                    f"  - [{f.get('bloco', '')}] {f.get('funcionalidade', '')} → {f.get('horas', '?')}h"
                )
        history_context = (
            "Histórico de funcionalidades aprovadas pela CITi (use como referência de horas):\n"
            + "\n".join(history_lines)
            if history_lines
            else ""
        )

        system_prompt = (
            "Você é um assistente de precificação técnica de projetos de dados da empresa CITi. "
            "Analise o relatório de diagnóstico e extraia funcionalidades técnicas concretas e implementáveis. "
            "Para cada funcionalidade, identifique:\n"
            "- bloco temático (Engenharia de Dados, Visualização, Ciência de Dados, Automação, Integração, Consumo/Interface, Geral)\n"
            "- nome da funcionalidade em português (conciso, máximo 10 palavras)\n"
            "- estimativa de horas de desenvolvimento\n\n"
            "REGRAS CRÍTICAS para estimativa de horas:\n"
            "- Horas representam esforço de desenvolvimento técnico de um analista, NÃO tempo de projeto total\n"
            "- NUNCA ultrapasse 80h por funcionalidade — divida em duas se necessário\n"
            "- Use o histórico abaixo como âncora principal: encontre funcionalidades similares e baseie a estimativa no que foi aprovado antes\n"
            "- Se não houver similar no histórico, use: 4-12h (tarefa simples), 12-30h (módulo médio), 30-60h (módulo complexo)\n\n"
            + (f"{history_context}\n" if history_context else "")
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
                "horas": str(min(f.horas, 80.0)),
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
        reports = self._repo.get_project_reports(project_id)
        history = self._repo.get_recent_history(limit=7)

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

        # Part C: all recent approved history (all types — calibrate by feature similarity)
        history_lines = []
        for h in history:
            snapshot = h.get("snapshot", {})
            for f in snapshot.get("features", []):
                history_lines.append(
                    f"  - [{f.get('bloco', '')}] {f.get('funcionalidade', '')} → {f.get('horas', '?')}h"
                )
        history_text = (
            "\n".join(history_lines)
            if history_lines
            else "Nenhum histórico de precificações aprovadas disponível."
        )

        human_message = (
            f"## Relatórios de Diagnóstico\n{reports_text}\n\n"
            f"## Funcionalidades Atuais na Precificação\n{current_text}\n\n"
            f"## Histórico de Funcionalidades Aprovadas pela CITi\n{history_text}\n\n"
            f"## Instrução\n"
            f"Sugira funcionalidades adicionais que provavelmente são necessárias mas ainda não estão na lista atual. "
            f"NÃO repita funcionalidades já presentes. "
            f"Use o histórico acima como âncora para as horas: encontre funcionalidades similares e baseie a estimativa no que foi aprovado. "
            f"Para cada sugestão, forneça uma justificativa clara."
        )

        system_prompt = (
            "Você é um consultor técnico de precificação de projetos de dados da CITi. "
            "Sugira funcionalidades adicionais relevantes baseando-se no diagnóstico e no histórico aprovado. "
            "Use blocos: Engenharia de Dados, Visualização, Ciência de Dados, Automação, Integração, Consumo/Interface, Geral. "
            "Para horas: use o histórico como referência principal — funcionalidades similares devem ter horas similares. "
            "Máximo 80h por funcionalidade."
        )

        from langchain_core.messages import HumanMessage, SystemMessage  # lazy import

        structured_llm = self._llm.with_structured_output(SuggestionList)
        result: SuggestionList = structured_llm.invoke([
            SystemMessage(content=system_prompt),
            HumanMessage(content=human_message),
        ])

        return result.sugestoes
