# =============================================================================
# transcription/webhook_server.py
#
# WebhookServer: servidor HTTP local que recebe transcrições do Taqtic.
#
# O Taqtic (extensão Chrome para Google Meet) captura o áudio da reunião,
# transcreve em tempo real e envia cada trecho via HTTP POST para este servidor.
# O servidor converte o payload JSON em TranscriptChunk e coloca numa
# asyncio.Queue para ser consumida pelo TaqticWebhookSource.
#
# Por que asyncio.Queue como intermediário?
# O servidor HTTP (aiohttp) e o consumidor (TaqticWebhookSource.stream) rodam
# no mesmo event loop. A Queue é o canal seguro entre os dois:
# - O handler do POST faz queue.put_nowait(chunk) — não bloqueia
# - O stream() faz await queue.get() — suspende até chegar um chunk
# Sem a Queue, precisaríamos de callbacks ou pipes complexos.
#
# Por que aiohttp e não FastAPI/Flask?
# Este servidor tem apenas 2 endpoints e serve uma única máquina (loopback).
# aiohttp é biblioteca padrão de I/O assíncrono no Python — sem overhead de
# framework completo. FastAPI adicionaria uvicorn + pydantic sem benefício real.
#
# Segurança:
# - Bind em 127.0.0.1 (loopback) — nunca exposto na rede local ou internet
# - Token de autenticação via header Authorization: Bearer <secret>
#   ou X-Taqtic-Signature. Se TAQTIC_WEBHOOK_SECRET não estiver configurado,
#   a autenticação é desabilitada (desenvolvimento local).
# =============================================================================

import asyncio
import json
import logging
from datetime import datetime, timezone

from aiohttp import web

from .base import TranscriptChunk

logger = logging.getLogger(__name__)

# Formato aceito nos campos de timestamp do payload.
# O Taqtic envia ISO 8601 com Z (UTC), ex: "2026-04-29T14:32:11Z"
_ISO_FORMAT = "%Y-%m-%dT%H:%M:%SZ"


class WebhookServer:
    """Servidor HTTP local que recebe chunks de transcrição do Taqtic.

    Expõe dois endpoints:
        POST /transcription → recebe um chunk de transcrição
        GET  /healthz       → verifica se o servidor está de pé

    Os chunks recebidos são colocados numa asyncio.Queue que o
    TaqticWebhookSource consome via stream().
    """

    def __init__(
        self,
        host: str = "127.0.0.1",
        port: int = 8765,
        secret: str = "",
        payload_adapter=None,
    ) -> None:
        """
        Args:
            host:            endereço de bind (padrão: loopback, nunca exposto)
            port:            porta do servidor
            secret:          token de autenticação. Se vazio, auth desabilitada.
            payload_adapter: função opcional para converter payloads não-padrão
                             em TranscriptChunk. Se None, usa o formato padrão
                             do Taqtic (ver _default_adapter).
        """
        self._host = host
        self._port = port
        self._secret = secret
        # O adapter permite trocar o formato do payload sem alterar o servidor.
        # Princípio Aberto/Fechado: se o Taqtic mudar o formato do JSON, só
        # o adapter muda — o servidor e o source ficam intocados.
        self._adapter = payload_adapter or _default_adapter

        # Queue que faz a ponte entre o handler HTTP e o stream().
        # maxsize=0 → ilimitada. Em reuniões normais o consumidor drena
        # mais rápido do que chunks chegam (1 chunk a cada ~1-3s).
        self._queue: asyncio.Queue[TranscriptChunk] = asyncio.Queue()

        # Objetos internos do aiohttp, inicializados em start()
        self._app: web.Application | None = None
        self._runner: web.AppRunner | None = None
        self._site: web.TCPSite | None = None

    @property
    def queue(self) -> asyncio.Queue[TranscriptChunk]:
        """Expõe a queue para o TaqticWebhookSource consumir."""
        return self._queue

    async def start(self) -> None:
        """Inicializa e sobe o servidor aiohttp no event loop atual.

        Sequência do aiohttp para servidor não-blocking:
        1. web.Application() → cria o app com as rotas
        2. AppRunner(app)    → prepara o app para rodar (sem iniciar ainda)
        3. runner.setup()    → inicializa o runner no event loop
        4. TCPSite(runner)   → liga o TCP na porta
        5. site.start()      → começa a aceitar conexões

        Por que não usar web.run_app()? Porque run_app() bloqueia o thread
        com seu próprio event loop. Aqui precisamos que o servidor rode
        junto com as outras tasks do orchestrator no mesmo event loop.
        """
        self._app = web.Application()
        self._app.router.add_post("/transcription", self._handle_transcription)
        self._app.router.add_get("/healthz", self._handle_healthz)

        self._runner = web.AppRunner(self._app)
        await self._runner.setup()

        self._site = web.TCPSite(self._runner, self._host, self._port)
        await self._site.start()

        logger.info("WebhookServer rodando em http://%s:%d", self._host, self._port)

    async def stop(self) -> None:
        """Para o servidor e libera os recursos.

        Chamado pelo orchestrator durante o shutdown gracioso.
        """
        if self._runner:
            await self._runner.cleanup()
            logger.info("WebhookServer encerrado.")

    # ── Handlers HTTP ─────────────────────────────────────────────────────────

    async def _handle_transcription(self, request: web.Request) -> web.Response:
        """Handler do POST /transcription.

        Fluxo:
        1. Valida autenticação (se secret estiver configurado)
        2. Lê e parseia o JSON do body
        3. Converte para TranscriptChunk via adapter
        4. Coloca na queue para o stream() consumir
        5. Retorna 200 OK

        Em caso de erro (payload inválido, JSON malformado, etc.), retorna
        o código HTTP apropriado sem derrubar o servidor.
        """
        # ── Autenticação ──────────────────────────────────────────────────────
        if self._secret:
            auth_header = request.headers.get("Authorization", "")
            sig_header = request.headers.get("X-Taqtic-Signature", "")

            # Aceita Bearer token no Authorization ou no header customizado
            token = ""
            if auth_header.startswith("Bearer "):
                token = auth_header[len("Bearer "):]
            elif sig_header:
                token = sig_header

            if token != self._secret:
                logger.warning("WebhookServer: requisição com token inválido rejeitada.")
                return web.Response(status=401, text="Unauthorized")

        # ── Parse do payload ──────────────────────────────────────────────────
        try:
            payload = await request.json()
        except json.JSONDecodeError:
            logger.warning("WebhookServer: payload não é JSON válido.")
            return web.Response(status=400, text="Invalid JSON")

        # ── Conversão para TranscriptChunk ────────────────────────────────────
        try:
            chunk = self._adapter(payload)
        except Exception as exc:
            # Adapter falhou — payload tem formato inesperado
            logger.warning("WebhookServer: adapter falhou ao converter payload: %s", exc)
            return web.Response(status=422, text=f"Adapter error: {exc}")

        # Ignora chunks não-finais (parciais) — reduz ruído de classificação
        # com texto ainda sendo ditado. Chunks parciais chegam durante a fala
        # e são substituídos pelo chunk final quando o falante faz uma pausa.
        if not chunk.is_final:
            return web.Response(status=200, text="ignored (not final)")

        # Coloca na queue — não bloqueia, o consumidor drena assincronamente
        self._queue.put_nowait(chunk)
        logger.debug("WebhookServer: chunk recebido [%s]: %s", chunk.speaker, chunk.text[:60])

        return web.Response(status=200, text="ok")

    async def _handle_healthz(self, request: web.Request) -> web.Response:
        """Handler do GET /healthz. Retorna 200 se o servidor estiver de pé.

        O simulador (simulate_transcript.py) chama este endpoint antes de
        começar a enviar chunks para garantir que o servidor está pronto.
        """
        return web.json_response({"status": "ok", "queue_size": self._queue.qsize()})


# ── Adapter padrão (module-level) ─────────────────────────────────────────────

def _default_adapter(payload: dict) -> TranscriptChunk:
    """Converte o payload JSON do Taqtic para TranscriptChunk.

    Formato esperado do Taqtic:
    {
      "session_id": "abc-123",
      "speaker":    "client" | "sales" | "unknown",
      "text":       "texto transcrito",
      "ts":         "2026-04-29T14:32:11Z",   ← ISO 8601 UTC (opcional)
      "is_final":   true
    }

    Campos opcionais têm valores padrão sensatos:
    - speaker  → "unknown" se ausente
    - ts       → datetime.now() se ausente ou malformado
    - is_final → True se ausente
    - session_id → "" se ausente

    Por que módulo-nível e não método estático?
    Para que o payload_adapter seja passável como callable sem precisar
    instanciar o WebhookServer — facilita testes e substituição por lambda.
    """
    text = payload.get("text", "").strip()
    if not text:
        # Chunk sem texto não tem utilidade — levanta exceção para o handler
        # retornar 422 em vez de colocar lixo na queue.
        raise ValueError("campo 'text' ausente ou vazio no payload")

    # Parse do timestamp — aceita falha graciosamente com datetime.now()
    ts = datetime.now()
    raw_ts = payload.get("ts", "")
    if raw_ts:
        try:
            ts = datetime.strptime(raw_ts, _ISO_FORMAT).replace(tzinfo=timezone.utc)
        except ValueError:
            logger.debug("WebhookServer: timestamp '%s' inválido, usando now().", raw_ts)

    return TranscriptChunk(
        text=text,
        speaker=payload.get("speaker", "unknown"),
        ts=ts,
        is_final=bool(payload.get("is_final", True)),
        session_id=payload.get("session_id", ""),
    )
