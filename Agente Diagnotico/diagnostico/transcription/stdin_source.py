# =============================================================================
# transcription/stdin_source.py
#
# StdinSource: fonte de transcrição via entrada padrão (stdin).
#
# Casos de uso:
#   1. Desenvolvimento/teste sem o Taqtic:
#      echo "texto da reunião" | python3 main.py --mode realtime --source stdin
#
#   2. Teste manual: rodar o app e digitar linhas simulando a transcrição
#
# Limitação: quando usada como fonte, o stdin fica ocupado lendo transcrição.
# O CommandHandler (teclas P/R/Q) detecta isso via sys.stdin.isatty() e se
# desativa automaticamente — não dá para usar stdin para duas coisas ao mesmo
# tempo.
# =============================================================================

import asyncio
import sys
from datetime import datetime
from typing import AsyncIterator

from .base import TranscriptionSource, TranscriptChunk


class StdinSource(TranscriptionSource):
    """Lê transcrição linha por linha do stdin de forma assíncrona."""

    async def stream(self) -> AsyncIterator[TranscriptChunk]:
        """Gera um TranscriptChunk para cada linha não-vazia lida do stdin.

        Por que run_in_executor?
        sys.stdin.readline() é uma operação BLOQUEANTE: o Python trava o
        thread inteiro esperando o usuário digitar ou o pipe terminar.
        No asyncio, bloquear o thread bloqueia o event loop inteiro — o painel
        pararia de renderizar, as teclas não funcionariam, etc.

        run_in_executor() resolve isso rodando readline() em uma thread
        separada (do ThreadPoolExecutor padrão do asyncio) enquanto o event
        loop continua fazendo outras coisas. O "await" aqui significa:
        "espere a thread terminar, mas não trave o event loop enquanto espera".

        Quando stdin fecha (fim de pipe ou EOF com Ctrl+D), readline() retorna
        string vazia → o loop termina → a task de ingestion finaliza →
        o shutdown event é disparado pelo orchestrator.
        """
        loop = asyncio.get_event_loop()

        while True:
            # Roda readline() em thread separada para não bloquear o event loop
            line = await loop.run_in_executor(None, sys.stdin.readline)

            # readline() retorna "" apenas em EOF (fim do pipe ou Ctrl+D)
            if not line:
                break

            text = line.strip()
            if text:  # ignora linhas em branco
                yield TranscriptChunk(
                    text=text,
                    speaker="unknown",   # stdin não sabe quem está falando
                    ts=datetime.now(),
                    is_final=True,       # cada linha é considerada um chunk final
                )
