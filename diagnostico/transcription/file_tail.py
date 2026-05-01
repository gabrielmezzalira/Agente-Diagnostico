# =============================================================================
# transcription/file_tail.py
#
# FileTailSource: fonte de transcrição que faz "tail -f" em um arquivo .jsonl.
#
# O que é "tail -f"?
# É o comportamento do comando Unix "tail -f arquivo": fica monitorando o
# arquivo e imprime novas linhas conforme elas são adicionadas. Aqui fazemos
# o equivalente em Python: abrimos o arquivo, posicionamos no final (ou no
# início, para replay), e fazemos polling a cada POLL_INTERVAL_SECS segundos
# verificando se há novas linhas.
#
# Quando usar:
#   python3 main.py --mode realtime --source file
#
# Casos de uso:
#   1. Dev sem Taqtic: outra ferramenta escreve transcrições no arquivo
#      e o agente as consome em tempo real.
#   2. Replay de reunião gravada: arquivo já existe com todos os chunks
#      e o agente os processa como se fosse ao vivo. Útil para ajustar
#      os prompts do classificador com dados reais.
#   3. Fallback se o webhook cair mid-meeting: redireciona o Taqtic para
#      escrever num arquivo e o agente continua a partir daí.
#
# Formato esperado do arquivo .jsonl:
#   Cada linha é um JSON independente com o mesmo formato do webhook:
#   {"speaker": "client", "text": "...", "ts": "2026-04-29T14:32:11Z", "is_final": true}
#
# Por que .jsonl (JSON Lines) e não .json?
#   O .jsonl permite adicionar linhas incrementalmente sem reescrever o
#   arquivo inteiro. Um arquivo .json precisaria de um array completo e
#   fechado — impossível de atualizar incrementalmente em append mode.
# =============================================================================

import asyncio
import json
import logging
from pathlib import Path
from typing import AsyncIterator

from .base import TranscriptChunk, TranscriptionSource
from .webhook_server import _default_adapter

logger = logging.getLogger(__name__)

# Intervalo de polling: a cada POLL_INTERVAL_SECS segundos verificamos se
# há novas linhas no arquivo. Valor menor = menor latência, mais CPU.
# 0.5s é um bom balanço: latência máxima de 500ms, CPU desprezível.
_POLL_INTERVAL_SECS = 0.5

# Quantas linhas no máximo processar por ciclo de polling.
# Evita travar o event loop se o arquivo crescer muito de uma vez
# (ex: replay de arquivo grande). Com 50 linhas/ciclo e 0.5s de poll,
# conseguimos processar até 100 linhas/s sem overhead.
_MAX_LINES_PER_POLL = 50


class FileTailSource(TranscriptionSource):
    """Fonte de transcrição que monitora um arquivo .jsonl para novas linhas.

    Implementa TranscriptionSource.stream() como AsyncGenerator:
    faz polling no arquivo a cada POLL_INTERVAL_SECS e yield para cada
    nova linha válida encontrada.

    Args:
        path:      caminho do arquivo .jsonl a monitorar
        from_start: se True, lê o arquivo desde o início (replay completo).
                    se False (padrão), começa do fim (só novas linhas).
        shutdown:  asyncio.Event externo para sinalizar encerramento.
                   Se None, cria um interno — pode ser setado via stop().
    """

    def __init__(
        self,
        path: str | Path = "transcripts/live.jsonl",
        from_start: bool = False,
        shutdown: asyncio.Event | None = None,
    ) -> None:
        self._path = Path(path)
        self._from_start = from_start
        # Aceita Event externo (do orchestrator) ou cria um interno
        self._shutdown = shutdown or asyncio.Event()

    def stop(self) -> None:
        """Sinaliza que o stream deve encerrar na próxima iteração de polling."""
        self._shutdown.set()

    async def stream(self) -> AsyncIterator[TranscriptChunk]:
        """Monitora o arquivo e gera chunks conforme novas linhas chegam.

        Fluxo:
        1. Aguarda o arquivo existir (pode ser criado depois do agente iniciar)
        2. Abre o arquivo e posiciona no início ou no final (from_start)
        3. Loop: lê até MAX_LINES_PER_POLL linhas novas por ciclo
           a. Se linha vazia → arquivo não cresceu → aguarda POLL_INTERVAL_SECS
           b. Se linha válida → parseia JSON → yield TranscriptChunk
           c. Se linha inválida → loga e pula
        4. Encerra quando _shutdown for setado

        Por que não usar asyncio.to_thread() para o I/O do arquivo?
        O arquivo está em disco local (não rede). Reads de arquivo local
        são tão rápidos que o overhead de criar uma thread seria maior
        que o próprio read. Para polling simples, asyncio.sleep() entre
        reads é suficiente — o event loop fica livre durante o sleep.
        """
        # Aguarda o arquivo existir, verificando a cada 1s.
        # Útil quando o agente sobe antes da ferramenta de transcrição criar o arquivo.
        if not self._path.exists():
            logger.info("FileTailSource: aguardando criação do arquivo %s...", self._path)
            while not self._path.exists():
                if self._shutdown.is_set():
                    return
                await asyncio.sleep(1.0)

        logger.info("FileTailSource: monitorando %s (from_start=%s)", self._path, self._from_start)

        # Abre o arquivo em modo leitura de texto com encoding utf-8.
        # Usamos open() clássico (não async) porque o file I/O local é rápido
        # e não há vantagem real em async file I/O para arquivos pequenos.
        with self._path.open(encoding="utf-8", errors="replace") as f:

            # Posicionamento inicial:
            # - from_start=False: seek(0, 2) vai para o FIM do arquivo.
            #   Isso significa que só leremos NOVAS linhas adicionadas depois
            #   do agente iniciar. Comportamento padrão de "tail -f".
            # - from_start=True: permanece no início (posição 0).
            #   Lerá o arquivo inteiro como se fosse um replay da reunião.
            if not self._from_start:
                f.seek(0, 2)  # 2 = SEEK_END (constante do os module)

            lines_processed = 0

            while not self._shutdown.is_set():
                # Lê até MAX_LINES_PER_POLL linhas por ciclo para não travar
                # o event loop se o arquivo crescer muito de uma vez
                batch_count = 0
                while batch_count < _MAX_LINES_PER_POLL:
                    line = f.readline()

                    if not line:
                        # readline() retornou string vazia → chegou ao fim atual do arquivo.
                        # Não há novas linhas — saímos do batch e aguardamos o próximo poll.
                        break

                    line = line.strip()
                    if not line:
                        # Linha em branco (separador entre registros) → ignora
                        continue

                    # Tenta parsear a linha como JSON e converter em TranscriptChunk
                    chunk = _parse_line(line, lines_processed + 1)
                    if chunk is not None:
                        lines_processed += 1
                        batch_count += 1
                        # yield entrega o chunk ao consumidor (ingestion_task)
                        # e suspende até que o próximo item seja solicitado.
                        yield chunk

                # Aguarda antes do próximo poll.
                # asyncio.sleep() cede o controle ao event loop durante o sleep,
                # permitindo que outras tasks (render, watchdog, keyboard) rodem.
                # wait_for + shield permite acordar cedo se o shutdown for disparado.
                try:
                    await asyncio.wait_for(
                        asyncio.shield(self._shutdown.wait()),
                        timeout=_POLL_INTERVAL_SECS,
                    )
                    break  # shutdown disparado → encerra o gerador
                except asyncio.TimeoutError:
                    pass   # poll normal → continua o loop

        logger.info(
            "FileTailSource: encerrado. %d chunks processados de %s.",
            lines_processed,
            self._path.name,
        )


# ── Função auxiliar (module-level) ────────────────────────────────────────────

def _parse_line(line: str, lineno: int) -> TranscriptChunk | None:
    """Parseia uma linha do .jsonl em TranscriptChunk.

    Retorna None se a linha for inválida (JSON malformado, adapter falhou,
    chunk não-final). O chamador deve ignorar None e continuar para a próxima.

    Centralizar o parse aqui (em vez de inline no stream()) mantém o stream()
    limpo e facilita testar o parsing isoladamente.

    Args:
        line:   linha de texto do arquivo (já com strip aplicado)
        lineno: número da linha para mensagens de log mais úteis
    """
    # Parse do JSON
    try:
        payload = json.loads(line)
    except json.JSONDecodeError as e:
        logger.debug("FileTailSource: linha %d inválida (JSON): %s", lineno, e)
        return None

    # Ignora chunks não-finais (parciais) — mesma lógica do WebhookServer.
    # Em arquivos de replay, chunks parciais podem ter sido gravados durante
    # a fala. Processá-los causaria duplicação com o chunk final correspondente.
    if not payload.get("is_final", True):
        return None

    # Usa o mesmo adapter do WebhookServer para garantir consistência:
    # o mesmo arquivo .jsonl funciona tanto no modo webhook quanto no tail.
    try:
        return _default_adapter(payload)
    except ValueError as e:
        # Adapter falhou (ex: campo 'text' vazio)
        logger.debug("FileTailSource: linha %d descartada pelo adapter: %s", lineno, e)
        return None
