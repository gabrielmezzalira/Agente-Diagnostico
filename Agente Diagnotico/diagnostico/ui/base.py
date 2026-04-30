# =============================================================================
# ui/base.py
#
# BaseRenderer: interface abstrata para qualquer renderizador de UI.
#
# Por que abstrair o renderizador?
# O RealtimeOrchestrator não deve saber se está exibindo num terminal ou
# num navegador — ele só sabe que pode chamar add_alert(), set_suggestions()
# etc. Quem decide COMO exibir é a implementação concreta (CLIRenderer ou
# WebRenderer). Isso é o princípio da Inversão de Dependência (SOLID):
# o orchestrator depende da abstração, não de uma implementação específica.
#
# Implementações:
#   CLIRenderer → ui/renderer.py  (painel Rich no terminal)
#   WebRenderer → ui/web_renderer.py (WebSocket + frontend HTML)
# =============================================================================

import asyncio
from abc import ABC, abstractmethod


class BaseRenderer(ABC):
    """Contrato que qualquer renderizador de UI deve implementar.

    O orchestrator chama estes métodos para atualizar o estado da UI.
    Cada implementação decide como traduzir essas chamadas para sua plataforma:
    - CLIRenderer redesenha painéis no terminal via Rich
    - WebRenderer serializa o estado como JSON e envia via WebSocket
    """

    @abstractmethod
    def start(self) -> None:
        """Inicializa o renderizador (abre terminal, sobe servidor, etc.)."""

    @abstractmethod
    def stop(self) -> None:
        """Encerra o renderizador e libera recursos."""

    def refresh(self) -> None:
        """Re-renderiza com o estado atual.

        Implementação padrão: no-op. O CLIRenderer sobrescreve para redesenhar
        os painéis Rich. O WebRenderer não precisa: ele já envia o estado
        completo a cada mudança via broadcast, então um refresh periódico
        seria redundante.
        """

    @abstractmethod
    def add_alert(self, level: str, text: str) -> None:
        """Adiciona um alerta de risco ao painel.

        Args:
            level: "warning" (⚠️) ou "critical" (🚨)
            text:  descrição do risco
        """

    @abstractmethod
    def set_suggestions(self, questions: list[dict]) -> None:
        """Define as perguntas sugeridas e as torna visíveis."""

    @abstractmethod
    def toggle_suggestions(self) -> None:
        """Alterna visibilidade do painel de sugestões."""

    @abstractmethod
    def set_stream_paused(self, paused: bool) -> None:
        """Atualiza o indicador de stream pausado."""

    @abstractmethod
    def set_saturated(self, saturated: bool) -> None:
        """Atualiza o indicador de saturação atingida."""

    @property
    def suggestions_visible(self) -> bool:
        """Retorna True se as sugestões estão visíveis no momento.

        Usado pelo orchestrator para decidir se um P deve mostrar ou esconder.
        Implementação padrão retorna False — subclasses sobrescrevem.
        """
        return False

    @property
    def command_queue(self) -> asyncio.Queue | None:
        """Fila de comandos recebidos de fora (ex: frontend web).

        Retorna None para renderizadores sem canal de comando externo (CLI).
        O WebRenderer retorna a fila de comandos do WebSocket — o orchestrator
        lê dessa fila para despachar os mesmos handlers de P/R/S/Q.
        """
        return None

    async def serve(self) -> None:
        """Inicia qualquer servidor assíncrono que este renderizador precise.

        Implementação padrão: no-op imediato. O orchestrator sempre cria uma
        task para este método — para CLIRenderer, a task termina instantaneamente
        (sem efeito colateral). O WebRenderer sobrescreve para iniciar o servidor
        aiohttp e manter a task viva enquanto a sessão estiver ativa.
        """
