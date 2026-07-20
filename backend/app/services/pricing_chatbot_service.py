# =============================================================================
# services/pricing_chatbot_service.py
#
# Responsabilidade única: agente LLM de chat do Precificador.
# Usa LangGraph create_react_agent com 4 ferramentas de mutação de banco.
# Segue exatamente o mesmo padrão de injeção de dependências do
# LLMPricingService — repositório e BaseChatModel por injeção, sem
# referências a providers concretos neste módulo.
# =============================================================================

from __future__ import annotations

import datetime
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from langchain_core.language_models import BaseChatModel

from app.models.pricing_features import PricingFeatureResponse
from app.repositories.pricing_repository import PricingRepository

# Singleton: preserva histórico de conversa entre requests no mesmo processo.
# Cada pricing_id é um thread_id separado — sem vazamento entre precificações.
from langgraph.checkpoint.memory import InMemorySaver

_CHECKPOINTER = InMemorySaver()


def make_pricing_tools(pricing_id: str, repo: PricingRepository) -> list:
    """Cria as 4 ferramentas do agente como closures sobre pricing_id e repo.

    pricing_id e repo são capturados pelo closure — nunca aparecem no schema
    LLM. O LLM vê apenas os argumentos de negócio.
    """
    from langchain_core.tools import tool  # lazy import

    @tool
    def add_feature(bloco: str, funcionalidade: str, horas: float) -> str:
        """Adiciona nova funcionalidade à tabela de precificação.
        Use quando o usuário pedir para adicionar uma feature, funcionalidade ou tarefa."""
        row = {
            "pricing_id": pricing_id,
            "bloco": bloco,
            "funcionalidade": funcionalidade,
            "horas": str(horas),
            "citi_responsible": True,
        }
        inserted = repo.insert_feature(row)
        return f'Funcionalidade "{funcionalidade}" adicionada ao bloco "{bloco}" com {horas}h (id: {inserted["id"]})'

    @tool
    def remove_feature(feature_id: str) -> str:
        """Remove uma funcionalidade da tabela pelo seu ID.
        Use quando o usuário pedir para remover ou excluir uma feature.
        O ID da funcionalidade está listado no contexto do sistema."""
        existing = repo.get_feature(feature_id, pricing_id)
        if not existing:
            return f"Funcionalidade com ID {feature_id} não encontrada nesta precificação."
        repo.delete_feature(feature_id)
        return f'Funcionalidade "{existing.get("funcionalidade", feature_id)}" removida com sucesso.'

    @tool
    def update_feature(
        feature_id: str,
        bloco: str | None = None,
        funcionalidade: str | None = None,
        horas: float | None = None,
    ) -> str:
        """Atualiza bloco, nome ou horas de uma funcionalidade existente.
        Forneça apenas os campos que devem ser alterados.
        Use quando o usuário pedir para editar ou modificar uma feature existente."""
        existing = repo.get_feature(feature_id, pricing_id)
        if not existing:
            return f"Funcionalidade com ID {feature_id} não encontrada nesta precificação."
        updates: dict = {}
        if bloco is not None:
            updates["bloco"] = bloco
        if funcionalidade is not None:
            updates["funcionalidade"] = funcionalidade
        if horas is not None:
            updates["horas"] = str(horas)
        if not updates:
            return "Nenhum campo para atualizar foi fornecido."
        repo.update_feature(feature_id, updates)
        return f'Funcionalidade "{existing.get("funcionalidade", feature_id)}" atualizada: {list(updates.keys())}'

    @tool
    def update_inputs(
        num_analysts: int | None = None,
        hours_per_day: float | None = None,
        ticket_price: float | None = None,
        extra_calendar_days: int | None = None,
    ) -> str:
        """Atualiza os parâmetros de entrada da precificação.
        Use quando o usuário pedir para alterar número de analistas,
        horas por dia, ticket mensal ou dias extras no calendário."""
        updates: dict = {}
        if num_analysts is not None:
            updates["num_analysts"] = num_analysts
        if hours_per_day is not None:
            updates["hours_per_day"] = str(hours_per_day)
        if ticket_price is not None:
            updates["ticket_price"] = str(ticket_price)
        if extra_calendar_days is not None:
            updates["extra_calendar_days"] = extra_calendar_days
        if not updates:
            return "Nenhum parâmetro para atualizar foi fornecido."
        updates["updated_at"] = datetime.datetime.now(datetime.timezone.utc).isoformat()
        repo.update_pricing(pricing_id, updates)
        return f"Parâmetros atualizados: {list(updates.keys())}"

    return [add_feature, remove_feature, update_feature, update_inputs]


class PricingChatbotService:
    """Agente LLM de chat para o Precificador.

    Princípios SOLID:
    - S: lida apenas com a conversa do chatbot; sem routing, sem formatação HTTP
    - D: depende de PricingRepository e BaseChatModel por injeção — sem providers concretos
    """

    def __init__(self, repo: PricingRepository, llm: "BaseChatModel") -> None:
        self._repo = repo
        self._llm = llm

    def chat(self, pricing_id: str, user_message: str) -> dict:
        """Executa uma rodada de chat e retorna resposta + features atualizadas.

        Args:
            pricing_id: UUID da precificação sendo discutida
            user_message: mensagem do usuário

        Returns:
            Dict com 'reply' (str) e 'features' (list[PricingFeatureResponse])
        """
        from langgraph.prebuilt import create_react_agent  # lazy import

        # Persiste mensagem do usuário
        self._repo.insert_chat_message({
            "pricing_id": pricing_id,
            "role": "user",
            "content": user_message,
        })

        tools = make_pricing_tools(pricing_id, self._repo)
        system_prompt = self._build_system_prompt(pricing_id)
        graph = create_react_agent(
            self._llm,
            tools=tools,
            prompt=system_prompt,
            checkpointer=_CHECKPOINTER,
        )
        config = {"configurable": {"thread_id": pricing_id}}

        # Se o processo foi reiniciado, recarrega histórico do Supabase
        state = graph.get_state(config)
        if not state.values.get("messages"):
            self._replay_history(graph, pricing_id, config)

        result = graph.invoke({"messages": [("user", user_message)]}, config=config)

        # Último AIMessage contém a resposta final do agente
        from langchain_core.messages import AIMessage  # lazy import
        reply = ""
        for msg in reversed(result["messages"]):
            if isinstance(msg, AIMessage) and msg.content:
                reply = msg.content if isinstance(msg.content, str) else str(msg.content)
                break

        # Persiste resposta do assistente
        self._repo.insert_chat_message({
            "pricing_id": pricing_id,
            "role": "assistant",
            "content": reply,
        })

        # Retorna features atualizadas para refresh imediato na UI
        raw_features = self._repo.get_pricing_features(pricing_id)
        features = [PricingFeatureResponse(**f) for f in raw_features]
        return {"reply": reply, "features": features}

    def _replay_history(self, graph, pricing_id: str, config: dict) -> None:
        """Restaura contexto de conversa do Supabase no checkpointer."""
        db_msgs = self._repo.list_chat_messages(pricing_id)
        history = [
            (m["role"], m["content"])
            for m in db_msgs
            if m.get("content") and m["role"] in ("user", "assistant")
        ]
        if history:
            graph.invoke({"messages": history}, config=config)

    def _build_system_prompt(self, pricing_id: str) -> str:
        """Monta prompt de sistema com contexto completo da precificação atual.

        Inclui os 4 contextos obrigatórios do PREC-12:
        A) Lista de funcionalidades atuais com IDs
        B) Parâmetros de entrada atuais
        C) Relatórios de diagnóstico (truncados em 2000 chars)
        D) Histórico de precificações aprovadas (top 3)
        """
        pricing = self._repo.get_pricing(pricing_id)
        if not pricing:
            return "Você é um assistente de precificação da CITi."

        features = self._repo.get_pricing_features(pricing_id)
        project_id = str(pricing["project_id"])
        reports = self._repo.get_project_reports(project_id)
        history = self._repo.get_recent_history(limit=3)

        # A) Funcionalidades com IDs (essencial para remove/update)
        features_text = "\n".join(
            f"- ID: {f['id']} | [{f.get('bloco', '')}] {f.get('funcionalidade', '')} — {f.get('horas', '?')}h"
            for f in features
        ) or "Nenhuma funcionalidade cadastrada ainda."

        # B) Parâmetros
        inputs_text = (
            f"Analistas: {pricing.get('num_analysts')}, "
            f"Horas/dia: {pricing.get('hours_per_day')}, "
            f"Ticket mensal: R${pricing.get('ticket_price')}, "
            f"Dias extras: {pricing.get('extra_calendar_days', 0)}"
        )

        # C) Relatórios de diagnóstico (truncado)
        reports_text = "\n\n---\n\n".join(
            r["markdown_content"][:1000]
            for r in reports
            if r.get("markdown_content")
        )[:2000] or "Nenhum relatório de diagnóstico disponível."

        # D) Histórico aprovado
        history_lines = []
        for h in history:
            snap = h.get("snapshot", {})
            for f in snap.get("features", [])[:5]:
                history_lines.append(
                    f"  [{f.get('bloco', '')}] {f.get('funcionalidade', '')} → {f.get('horas', '?')}h"
                )
        history_text = "\n".join(history_lines) or "Sem histórico disponível."

        return (
            "Você é um assistente de precificação técnica da CITi. "
            "Ajude o comercial a refinar a precificação conversando em português. "
            "Quando solicitado a adicionar, remover ou editar funcionalidades, use as ferramentas disponíveis. "
            "Ao usar remove_feature ou update_feature, use os IDs listados em 'Funcionalidades Atuais'. "
            "Responda de forma concisa e direta. Não use markdown desnecessário.\n\n"
            f"## Funcionalidades Atuais (IDs para editar/remover)\n{features_text}\n\n"
            f"## Parâmetros da Precificação\n{inputs_text}\n\n"
            f"## Relatório de Diagnóstico\n{reports_text}\n\n"
            f"## Histórico de Precificações Aprovadas\n{history_text}"
        )
