# =============================================================================
# ui/web_renderer.py
#
# WebRenderer: implementação de BaseRenderer que exibe o painel via browser.
#
# Em vez de desenhar no terminal com Rich, o WebRenderer:
#   1. Mantém um estado centralizado (dict JSON-serializável) com todos os
#      dados do painel: cobertura, alertas, sugestões, saturação, etc.
#   2. Transmite esse estado via WebSocket para todos os browsers conectados
#      sempre que algo muda (push-on-change, não polling).
#   3. Recebe comandos do browser (equivalentes a P/R/S/Q) via WebSocket e
#      os deposita em command_queue — o orchestrator lê e despacha para os
#      mesmos handlers de teclado do CLIRenderer.
#   4. Serve o frontend HTML estático (frontend/index.html) no mesmo servidor.
#
# Por que aiohttp e não FastAPI/Flask?
# O WebhookServer já usa aiohttp — reutilizar a mesma lib evita adicionar
# dependência nova. aiohttp suporta WebSocket nativamente e é async puro,
# sem overhead de WSGI/ASGI. Para 2 endpoints e ≤5 clientes simultâneos,
# é mais que suficiente.
#
# Relação com o orchestrator:
#   - BaseRenderer.serve() é no-op → CLIRenderer termina o task imediatamente
#   - WebRenderer.serve() bloqueia até o task ser cancelado (evento de shutdown)
#   - orchestrator sempre cria task para serve() e cancela no shutdown
# =============================================================================

import asyncio
import json
import logging
from pathlib import Path
from typing import Any

import aiohttp
import aiohttp.web

from coverage.tracker import CoverageTracker
from ui.base import BaseRenderer

# Desativa o log de acesso do aiohttp para não poluir o terminal durante a sessão.
# O servidor só loga erros reais, não cada GET/WS frame.
_log = logging.getLogger("aiohttp.access")
_log.setLevel(logging.ERROR)


class WebRenderer(BaseRenderer):
    """Renderiza o painel de diagnóstico como aplicação web via WebSocket.

    Responsabilidades:
    - Manter self._state como fonte única de verdade do painel
    - Enviar o estado completo (não diff) a cada mudança para todos os clientes
    - Receber comandos JSON dos clientes e enfileirar em command_queue
    - Servir index.html no GET /

    Por que estado completo e não diff?
    Com ≤5 clientes e payloads de ~2KB, o overhead de serializar tudo é
    desprezível comparado à complexidade de rastrear diffs. Enviar estado
    completo também simplifica o reconexão: o cliente que reconecta recebe
    o estado atual imediatamente sem precisar de replay.
    """

    def __init__(
        self,
        tracker: CoverageTracker,
        host: str = "127.0.0.1",
        port: int = 8080,
    ) -> None:
        self._tracker = tracker
        self._host = host
        self._port = port

        # Conjunto de conexões WebSocket ativas.
        # Usamos set para O(1) add/remove e para iterar sem duplicatas.
        self._clients: set[aiohttp.web.WebSocketResponse] = set()

        # command_queue: onde depositamos os comandos recebidos do browser.
        # O orchestrator lê desta fila no _web_command_task e despacha para
        # os mesmos handlers de P/R/S/Q que o CommandHandler de teclado usa.
        self._cmd_queue: asyncio.Queue[str] = asyncio.Queue()

        # Estado interno — fonte de verdade do painel.
        # Atualizado pelas chamadas de update (add_alert, set_suggestions, etc.)
        # e serializado como JSON a cada broadcast.
        self._state: dict[str, Any] = {
            "score": 0.0,            # float 0.0–1.0: saturação atual
            "saturated": False,      # True quando ≥threshold de cobertura
            "stream_paused": False,  # True quando >60s sem chunk
            "alerts": [],            # lista de {level, text, icon}
            "suggestions": [],       # lista de {area_id, question, rationale}
            "suggestions_visible": False,
            "coverage": [],          # lista de {id, name, status, kind}
        }

        # Estado de visibilidade separado (espelha _state["suggestions_visible"])
        # para que suggestions_visible property funcione sem referenciar o dict
        self._suggestions_vis = False

    # ── Propriedades da interface BaseRenderer ────────────────────────────────

    @property
    def suggestions_visible(self) -> bool:
        return self._suggestions_vis

    @property
    def command_queue(self) -> asyncio.Queue:
        # WebRenderer tem fila de comandos do WebSocket.
        # O orchestrator adiciona o _web_command_task quando command_queue != None.
        return self._cmd_queue

    # ── Ciclo de vida ─────────────────────────────────────────────────────────

    def start(self) -> None:
        # No-op: o servidor aiohttp é iniciado em serve() (async).
        # start() existe para satisfazer a interface BaseRenderer, que é chamada
        # de forma síncrona pelo orchestrator antes de criar as tasks.
        pass

    def stop(self) -> None:
        # No-op: cleanup do servidor aiohttp acontece no finally de serve(),
        # quando a task é cancelada pelo orchestrator no shutdown.
        pass

    def refresh(self) -> None:
        # Atualiza coverage e score com os dados mais recentes do tracker
        # e agenda um broadcast. Chamado a cada 250ms pelo _render_task.
        self._state["score"] = self._tracker.saturation_score()
        self._state["coverage"] = self._build_coverage()
        self._schedule_broadcast()

    # ── Métodos de atualização de estado ─────────────────────────────────────

    def add_alert(self, level: str, text: str) -> None:
        icon = "🚨" if level == "critical" else "⚠️"
        # Insere no topo (mais recente primeiro) e limita a 5
        self._state["alerts"].insert(0, {"level": level, "text": text, "icon": icon})
        self._state["alerts"] = self._state["alerts"][:5]
        self._schedule_broadcast()

    def set_suggestions(self, questions: list[dict]) -> None:
        self._state["suggestions"] = questions
        self._suggestions_vis = True
        self._state["suggestions_visible"] = True
        self._schedule_broadcast()

    def toggle_suggestions(self) -> None:
        self._suggestions_vis = not self._suggestions_vis
        self._state["suggestions_visible"] = self._suggestions_vis
        self._schedule_broadcast()

    def set_stream_paused(self, paused: bool) -> None:
        if paused != self._state["stream_paused"]:
            self._state["stream_paused"] = paused
            self._schedule_broadcast()

    def set_saturated(self, saturated: bool) -> None:
        if saturated != self._state["saturated"]:
            self._state["saturated"] = saturated
            self._schedule_broadcast()

    # ── Internos ──────────────────────────────────────────────────────────────

    def _schedule_broadcast(self) -> None:
        """Agenda o _broadcast() como task no event loop atual.

        Por que create_task() e não await?
        Os métodos de atualização (add_alert, etc.) são síncronos — chamados
        pelo orchestrator sem await. Não podemos usar await neles. Mas podemos
        criar uma task para rodar o broadcast assim que o event loop ceder
        controle (normalmente em microsegundos).

        Por que try/except RuntimeError?
        Caso raro: se _schedule_broadcast for chamado fora do event loop
        (ex: em testes unitários síncronos), get_running_loop() lança
        RuntimeError. O try silencia esse caso para não quebrar testes.
        """
        try:
            asyncio.get_running_loop().create_task(self._broadcast())
        except RuntimeError:
            pass

    def _build_coverage(self) -> list[dict]:
        """Serializa o estado do CoverageTracker para JSON."""
        areas = list(self._tracker.get_state().values())
        return [
            {
                "id": a.id,
                "name": a.name,
                "status": a.status.name,   # "RED" | "YELLOW" | "GREEN"
                "kind": a.kind,            # "universal" | "dynamic" | "specific"
            }
            for a in areas
        ]

    async def _broadcast(self) -> None:
        """Envia o estado completo para todos os clientes WebSocket conectados.

        Remove clientes mortos (conexão fechada) silenciosamente.
        Não levanta exceção se não houver clientes — isso é normal no início
        da sessão, antes do browser conectar.
        """
        if not self._clients:
            return

        data = json.dumps(self._state, ensure_ascii=False)
        dead: set[aiohttp.web.WebSocketResponse] = set()

        for ws in list(self._clients):  # list() para iterar cópia segura
            try:
                await ws.send_str(data)
            except Exception:
                dead.add(ws)

        # Remove conexões mortas do conjunto ativo
        self._clients -= dead

    # ── Handlers HTTP/WebSocket ───────────────────────────────────────────────

    async def _index_handler(self, request: aiohttp.web.Request) -> aiohttp.web.Response:
        """Serve o frontend HTML (frontend/index.html)."""
        # O index.html está em frontend/ relativo à raiz do projeto
        # (dois níveis acima de ui/web_renderer.py)
        index_path = Path(__file__).parent.parent / "frontend" / "index.html"
        return aiohttp.web.FileResponse(index_path)

    async def _ws_handler(
        self, request: aiohttp.web.Request
    ) -> aiohttp.web.WebSocketResponse:
        """Gerencia uma conexão WebSocket com o frontend.

        Protocolo:
          servidor → cliente: JSON com estado completo a cada mudança
          cliente → servidor: JSON {"cmd": "questions"|"report"|"sync"|"quit"}

        Ao conectar, envia o estado atual imediatamente (não espera mudança).
        Isso garante que o browser renderize o painel correto logo após abrir.
        """
        ws = aiohttp.web.WebSocketResponse()
        await ws.prepare(request)
        self._clients.add(ws)

        # Estado atual imediato para o cliente recém-conectado
        try:
            await ws.send_str(json.dumps(self._state, ensure_ascii=False))
        except Exception:
            self._clients.discard(ws)
            return ws

        # Loop de mensagens: recebe comandos do browser
        async for msg in ws:
            if msg.type == aiohttp.WSMsgType.TEXT:
                try:
                    payload = json.loads(msg.data)
                    cmd = payload.get("cmd", "")
                    # Whitelist de comandos válidos — ignora qualquer outra coisa
                    if cmd in ("questions", "report", "sync", "quit"):
                        await self._cmd_queue.put(cmd)
                except Exception:
                    pass  # JSON malformado → ignora silenciosamente
            elif msg.type == aiohttp.WSMsgType.ERROR:
                break

        # Conexão fechada (browser fechou tab ou perdeu rede)
        self._clients.discard(ws)
        return ws

    # ── Servidor ──────────────────────────────────────────────────────────────

    async def serve(self) -> None:
        """Inicia o servidor HTTP/WebSocket e mantém a task viva até ser cancelada.

        O orchestrator adiciona serve() como uma task no asyncio.gather.
        Quando o shutdown é disparado (Q ou KeyboardInterrupt), o orchestrator
        cancela a task → CancelledError é capturado pelo finally que faz cleanup.

        Por que asyncio.Event().wait() no final?
        Precisamos manter a task viva enquanto o servidor roda — se serve()
        retornar, aiohttp encerra e os clientes são desconectados. Um Event
        jamais disparado faz a task "dormir para sempre" até ser cancelada.
        """
        app = aiohttp.web.Application()
        app.router.add_get("/", self._index_handler)
        app.router.add_get("/ws", self._ws_handler)

        # access_log=None suprime o log de cada request (GET /, GET /ws frames)
        runner = aiohttp.web.AppRunner(app, access_log=None)
        await runner.setup()
        site = aiohttp.web.TCPSite(runner, self._host, self._port)
        await site.start()

        print(f"   Frontend: http://{self._host}:{self._port}")

        try:
            # Bloqueia indefinidamente — task cancelada pelo orchestrator no shutdown
            await asyncio.Event().wait()
        finally:
            # Fecha todas as conexões e libera a porta
            await runner.cleanup()
