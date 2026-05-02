# =============================================================================
# ui/renderer.py
#
# CLIRenderer: painel visual da reunião em tempo real.
#
# Usa a biblioteca Rich para desenhar um layout de múltiplos painéis no
# terminal, atualizando-os sem apagar e re-imprimir tudo (sem flicker).
#
# Layout visual:
# ┌─────────────────────────────────────────────────────┐
# │  DIAGNÓSTICO EM TEMPO REAL   [████░░░░░░] 40%       │  ← header
# ├─────────────────────────────────────────────────────┤
# │ COBERTURA                                           │
# │ 🔴 Clareza do cliente   🟡 Inputs e Dados           │  ← coverage
# │ 🟢 Integrações          🔴 Auth / Segurança         │
# │ ...                                                 │
# ├─────────────────────────────────────────────────────┤
# │ ALERTAS                                             │
# │ 🚨 Prazo de 3 semanas para sistema complexo         │  ← alerts
# ├─────────────────────────────────────────────────────┤
# │ SUGESTÕES                                           │
# │ 1. [auth_seguranca] Como será feito o login?        │  ← suggestions
# ├─────────────────────────────────────────────────────┤
# │ [P] perguntas  [R] relatório  [S] sync  [Q] sair    │  ← footer
# └─────────────────────────────────────────────────────┘
# =============================================================================

from dataclasses import dataclass, field
from datetime import datetime

# Rich é a biblioteca que permite texto colorido e formatado no terminal
from rich import box                   # estilos de bordas para tabelas
from rich.layout import Layout         # divide a tela em regiões nomeadas
from rich.live import Live             # atualiza a tela sem flicker
from rich.panel import Panel           # caixa com borda e título
from rich.table import Table           # tabela para o grid de cobertura
from rich.text import Text             # texto com formatação/cores inline

from coverage.tracker import CoverageTracker
from coverage.area import Status
from ui.base import BaseRenderer


# Mapeia cada status para o emoji correspondente exibido no painel
_STATUS_ICON: dict[Status, str] = {
    Status.RED: "🔴",
    Status.YELLOW: "🟡",
    Status.GREEN: "🟢",
}


@dataclass
class Alert:
    """Representa um alerta de red flag exibido no painel de alertas.

    level → "warning" (⚠️) para riscos moderados
             "critical" (🚨) para riscos graves que podem inviabilizar o projeto
    text  → descrição curta do alerta
    ts    → quando o alerta foi gerado (para expiração futura, se necessário)
    """
    level: str
    text: str
    ts: datetime = field(default_factory=datetime.now)


class CLIRenderer(BaseRenderer):
    """Gerencia o painel visual completo da reunião em tempo real.

    Responsabilidades:
    - Construir e atualizar o layout de 5 painéis com Rich
    - Receber dados de fora (alertas, sugestões, status) e re-renderizar
    - NÃO tomar decisões — só exibir o que recebe

    O renderer não faz polling nem tem loop próprio. Quem chama refresh()
    periodicamente é o _render_task do RealtimeOrchestrator (a cada 250ms).
    Mudanças urgentes (novo alerta, tecla pressionada) também chamam refresh()
    diretamente para atualização imediata.
    """

    def __init__(self, tracker: CoverageTracker) -> None:
        self._tracker = tracker            # fonte dos dados de cobertura
        self._alerts: list[Alert] = []     # lista de alertas ativos (máx 5)
        self._suggestions: list[dict] = [] # perguntas sugeridas pelo QuestionPlanner
        self._suggestions_visible = False  # toggle: mostra/esconde as sugestões
        self._stream_paused = False        # True quando o Recall.ai parou de mandar chunks
        self._saturated = False            # True quando atingiu o threshold de cobertura

        # Constrói a estrutura de painéis (ainda sem conteúdo)
        self._layout = self._build_layout()

        # Live é o objeto do Rich que mantém a tela atualizada.
        # auto_refresh=False → NÃO atualiza sozinho em background.
        # Preferimos controle manual via refresh() para sincronizar com o
        # event loop do asyncio e evitar conflitos de thread.
        #
        # screen=True → ativa o "alternate screen buffer" do terminal.
        # O terminal tem dois buffers: o "normal" (onde você digita comandos)
        # e o "alternate" (usado por editores como vim, less, etc.).
        # Com screen=True, o Rich ocupa o alternate buffer durante a sessão:
        #   - A tela é limpa e o painel ocupa 100% dela → sem artefatos
        #   - Quando live.stop() é chamado, o alternate buffer fecha e o
        #     terminal volta ao estado anterior automaticamente
        # Sem screen=True (screen=False), o Rich imprime inline no terminal
        # normal, o que causa artefatos quando o layout é redesenhado.
        self._live = Live(self._layout, auto_refresh=False, screen=True)

    def _build_layout(self) -> Layout:
        """Define a estrutura em colunas do painel.

        split_column() divide o Layout em seções verticais empilhadas.
        Cada seção tem um nome (para referenciar depois) e um tamanho:
        - size=N      → altura fixa em linhas
        - minimum_size=N → altura mínima (cresce se tiver espaço)
        """
        layout = Layout()
        layout.split_column(
            Layout(name="header",      size=3),          # título + barra de saturação
            Layout(name="coverage",    minimum_size=5),  # grid das áreas de risco
            Layout(name="alerts",      size=5),          # alertas/red flags
            Layout(name="suggestions", size=6),          # perguntas sugeridas
            Layout(name="footer",      size=3),          # atalhos de teclado
        )
        return layout

    # ── Métodos de ciclo de vida ──────────────────────────────────────────────

    def start(self) -> None:
        """Inicia o Live e faz o primeiro render."""
        # refresh=False no start() porque chamamos refresh() logo em seguida
        # de forma controlada. Sem isso, poderia haver um flash vazio.
        self._live.start(refresh=False)
        self._redraw()
        self._live.refresh()

    def stop(self) -> None:
        """Encerra o Live e restaura o terminal ao estado normal."""
        self._live.stop()

    def refresh(self) -> None:
        """Re-renderiza todos os painéis com os dados atuais."""
        self._redraw()
        self._live.refresh()

    # ── Métodos de atualização de estado ─────────────────────────────────────

    def add_alert(self, level: str, text: str) -> None:
        """Adiciona um novo alerta ao painel e atualiza imediatamente.

        insert(0, ...) coloca o mais novo no topo da lista.
        Mantemos no máximo 5 alertas para não estourar o painel.
        """
        self._alerts.insert(0, Alert(level=level, text=text))
        self._alerts = self._alerts[:5]  # descarta os mais antigos
        self.refresh()

    def set_suggestions(self, questions: list[dict]) -> None:
        """Define as perguntas sugeridas e as torna visíveis."""
        self._suggestions = questions
        self._suggestions_visible = True
        self.refresh()

    def toggle_suggestions(self) -> None:
        """Alterna visibilidade das sugestões (tecla P)."""
        self._suggestions_visible = not self._suggestions_visible
        self.refresh()

    def set_stream_paused(self, paused: bool) -> None:
        """Atualiza o indicador de stream pausado no header.

        Só chama refresh() se o estado mudou, para evitar renders desnecessários.
        """
        if paused != self._stream_paused:
            self._stream_paused = paused
            self.refresh()

    def set_saturated(self, saturated: bool) -> None:
        """Atualiza o indicador de saturação atingida no header."""
        if saturated != self._saturated:
            self._saturated = saturated
            self.refresh()

    @property
    def suggestions_visible(self) -> bool:
        """Expõe o estado de visibilidade das sugestões via interface BaseRenderer."""
        return self._suggestions_visible

    # ── Métodos de renderização (privados) ───────────────────────────────────

    def _redraw(self) -> None:
        """Atualiza o conteúdo de cada painel do layout.

        Cada painel é re-criado do zero a cada render com os dados mais
        recentes. O Rich sabe fazer diff internamente para não re-desenhar
        o que não mudou (evita flicker).
        """
        self._layout["header"].update(self._render_header())
        self._layout["coverage"].update(self._render_coverage())
        self._layout["alerts"].update(self._render_alerts())
        self._layout["suggestions"].update(self._render_suggestions())
        self._layout["footer"].update(self._render_footer())

    def _render_header(self) -> Panel:
        """Painel de topo: título + barra de progresso de saturação."""
        score = self._tracker.saturation_score()  # float entre 0.0 e 1.0

        # Barra de progresso ASCII: █ para preenchido, ░ para vazio
        bar_len = 24
        filled = int(score * bar_len)
        bar = "█" * filled + "░" * (bar_len - filled)

        text = Text()
        text.append("DIAGNÓSTICO EM TEMPO REAL", style="bold cyan")
        text.append(f"   [{bar}] {score:.0%}", style="white")

        # Mensagens de status exclusivas (só uma aparece por vez)
        if self._saturated:
            text.append("  ✅ saturação atingida — aperte R", style="bold green")
        elif self._stream_paused:
            text.append("  ⚠️  stream pausado", style="bold yellow")

        return Panel(text, style="cyan", padding=(0, 1))

    def _render_coverage(self) -> Panel:
        """Painel com o grid 2×N das áreas de risco e seus status."""
        areas = list(self._tracker.get_state().values())

        # Table do Rich: renderiza as áreas em 2 colunas lado a lado
        # box=box.SIMPLE → bordas mínimas (sem linhas verticais entre colunas)
        # expand=True     → ocupa toda a largura disponível
        table = Table(box=box.SIMPLE, show_header=False, padding=(0, 2), expand=True)
        table.add_column(ratio=1)  # ratio=1 divide o espaço igualmente
        table.add_column(ratio=1)

        # Percorre as áreas de 2 em 2 para fazer as linhas da tabela
        for i in range(0, len(areas), 2):
            left = areas[i]
            # Marca áreas "specific" com "(esp.)" para distinguir das dinâmicas padrão
            tag = " (esp.)" if left.kind == "specific" else ""
            left_cell = f"{_STATUS_ICON[left.status]} {left.name}{tag}"

            if i + 1 < len(areas):
                right = areas[i + 1]
                tag_r = " (esp.)" if right.kind == "specific" else ""
                right_cell = f"{_STATUS_ICON[right.status]} {right.name}{tag_r}"
            else:
                right_cell = ""  # número ímpar de áreas → célula vazia

            table.add_row(left_cell, right_cell)

        return Panel(table, title="[bold]COBERTURA[/bold]", title_align="left", padding=(0, 1))

    def _render_alerts(self) -> Panel:
        """Painel com os últimos alertas/red flags detectados."""
        if not self._alerts:
            body = Text("(nenhum alerta ainda)", style="dim")
        else:
            body = Text()
            # Mostra no máximo 3 alertas para não estourar o painel de tamanho fixo
            for alert in self._alerts[:3]:
                icon = "🚨" if alert.level == "critical" else "⚠️"
                # critical → vermelho em negrito; warning → amarelo
                style = "bold red" if alert.level == "critical" else "yellow"
                body.append(f"{icon} {alert.text}\n", style=style)

        return Panel(body, title="[bold]ALERTAS[/bold]", title_align="left", padding=(0, 1))

    def _render_suggestions(self) -> Panel:
        """Painel com as perguntas sugeridas pelo QuestionPlanner.

        Antes de ter sugestões: mostra dica para pressionar P.
        Com sugestões visíveis: mostra as 3 principais com área e rationale.
        Com sugestões ocultas (P pressionado de novo): mostra dica para reexibir.
        """
        if not self._suggestions_visible or not self._suggestions:
            # Define o hint dependendo se há sugestões geradas ou não
            if self._suggestions:
                hint = "[P] mostrar sugestões já geradas"
            else:
                hint = "[P] gerar perguntas sugeridas para as lacunas atuais"
            body = Text(hint, style="dim")
        else:
            body = Text()
            for i, q in enumerate(self._suggestions[:3], 1):
                area_id  = q.get("area_id", "")
                question = q.get("question", "")
                rationale = q.get("rationale", "")  # por que essa pergunta é prioritária

                body.append(f"{i}. ", style="bold")
                if area_id:
                    # Mostra de qual área de risco vem a pergunta
                    body.append(f"[{area_id}] ", style="dim cyan")
                body.append(f"{question}\n")
                if rationale:
                    # Indentado com ↳ para parecer uma sub-linha
                    body.append(f"   ↳ {rationale}\n", style="dim")

        return Panel(body, title="[bold]SUGESTÕES[/bold]", title_align="left", padding=(0, 1))

    def _render_footer(self) -> Panel:
        """Painel de rodapé com os atalhos de teclado disponíveis."""
        text = Text()
        for key, label in [("P", "perguntas"), ("R", "relatório"), ("S", "sync"), ("Q", "sair")]:
            text.append(f"[{key}]", style="bold green")  # tecla em verde negrito
            text.append(f" {label}  ")                    # label em texto normal
        return Panel(text, style="dim", padding=(0, 1))
