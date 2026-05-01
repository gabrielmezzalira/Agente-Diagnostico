# =============================================================================
# transcription/taqtic.py
#
# TaqticWebhookSource: implementa TranscriptionSource consumindo da queue
# alimentada pelo WebhookServer.
#
# Separação de responsabilidades:
#   - WebhookServer   → sabe como rodar um servidor HTTP e receber POSTs
#   - TaqticWebhookSource → sabe como expor os chunks como AsyncIterator
#
# Por que separar server e source em classes diferentes?
# Single Responsibility Principle: o servidor não deve saber como os chunks
# são consumidos, e o source não deve saber como o servidor funciona.
# A asyncio.Queue é o canal desacoplado entre os dois.
#
# Fluxo completo:
#   [Taqtic ext.] → HTTP POST → [WebhookServer] → queue.put() → [TaqticWebhookSource.stream()] → [RealtimeOrchestrator]
# =============================================================================

import asyncio
import logging
from typing import AsyncIterator

from .base import TranscriptChunk, TranscriptionSource
from .webhook_server import WebhookServer

logger = logging.getLogger(__name__)

# Timeout em segundos para cada chamada a queue.get().
# Após QUEUE_TIMEOUT_SECS sem chunk, o stream verifica se deve encerrar.
# Um timeout pequeno (1s) garante que o shutdown é detectado rapidamente
# sem busy-wait (checar is_set() em loop).
_QUEUE_TIMEOUT_SECS = 1.0


class TaqticWebhookSource(TranscriptionSource):
    """Fonte de transcrição que consome da queue do WebhookServer.

    Implementa TranscriptionSource.stream() como AsyncGenerator:
    suspende em await queue.get() até o próximo chunk chegar, e assim
    não bloqueia o event loop enquanto espera.

    Lifecycle:
    1. O RealtimeOrchestrator cria TaqticWebhookSource (e com ele o WebhookServer)
    2. O orchestrator chama server.start() antes de iniciar as tasks
    3. A _ingestion_task faz "async for chunk in source.stream():"
    4. stream() drena a queue até shutdown ser sinalizado
    5. O orchestrator chama server.stop() no finally do run()
    """

    def __init__(self, server: WebhookServer) -> None:
        """
        Args:
            server: WebhookServer já configurado. O source não inicia/para
                    o server — isso é responsabilidade do orchestrator.
        """
        self._server = server
        # Evento de shutdown: quando setado, stream() para de consumir a queue
        # e encerra o gerador normalmente (sem exceção).
        self._shutdown = asyncio.Event()

    @property
    def server(self) -> WebhookServer:
        """Expõe o servidor para o orchestrator gerenciar o ciclo de vida."""
        return self._server

    def stop(self) -> None:
        """Sinaliza que o stream deve encerrar.

        Chamado pelo orchestrator durante o shutdown gracioso.
        Após stop(), a próxima iteração do loop em stream() detecta o
        evento e encerra o gerador.
        """
        self._shutdown.set()

    async def stream(self) -> AsyncIterator[TranscriptChunk]:
        """Gera chunks da queue do WebhookServer conforme chegam.

        Loop:
        1. Tenta obter um chunk da queue com timeout de 1s
        2. Se obteve chunk → yield (entrega ao consumidor e suspende)
        3. Se timeout → verifica shutdown; se não, volta ao passo 1
        4. Se shutdown → encerra o gerador

        Por que asyncio.wait_for com timeout em vez de queue.get() puro?
        queue.get() fica bloqueado indefinidamente se a queue estiver vazia.
        Com timeout, verificamos o shutdown a cada 1s — sem isso, o
        orchestrator ficaria preso esperando um chunk que nunca virá quando
        o usuário pressionar Q.
        """
        logger.info("TaqticWebhookSource: aguardando chunks do webhook...")

        while not self._shutdown.is_set():
            try:
                # Espera até 1s por um novo chunk.
                # asyncio.wait_for cancela a corrotina interna se o timeout
                # esgotar — por isso usamos shield para proteger queue.get().
                chunk = await asyncio.wait_for(
                    self._server.queue.get(),
                    timeout=_QUEUE_TIMEOUT_SECS,
                )
                # Entrega o chunk ao consumidor (ingestion_task) e suspende
                # até que o próximo item seja solicitado.
                yield chunk

            except asyncio.TimeoutError:
                # Passou 1s sem chunk — verifica shutdown e tenta de novo
                # O loop while já checa is_set(), então só continuamos.
                continue

        logger.info("TaqticWebhookSource: stream encerrado.")
