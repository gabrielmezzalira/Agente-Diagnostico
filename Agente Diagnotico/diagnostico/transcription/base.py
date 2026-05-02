# =============================================================================
# transcription/base.py
#
# Contrato (interface) para fontes de transcrição.
#
# Por que uma classe abstrata em vez de implementar direto?
# Seguindo o princípio da Inversão de Dependência (SOLID), o RealtimeOrchestrator
# depende desta abstração — não de uma implementação específica. Isso significa
# que posso trocar WebhookSource por FileTailSource ou StdinSource sem
# alterar nada no orchestrator. Basta implementar este contrato.
# =============================================================================

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import datetime
from typing import AsyncIterator


@dataclass
class TranscriptChunk:
    """Um trecho de transcrição recebido em tempo real.

    No Recall.ai, a transcrição chega em pedaços conforme as pessoas falam —
    não em um bloco só. Cada pedaço é um TranscriptChunk.

    Campos:
        text       → o texto transcrito desse trecho
        speaker    → quem estava falando: "client", "sales", ou "unknown"
                     (útil para o classificador saber se foi o cliente ou o
                     comercial falando — o cliente é quem traz as informações
                     relevantes para o diagnóstico)
        ts         → timestamp de quando o chunk foi recebido
        is_final   → True = chunk completo / False = ainda digitando (parcial)
                     Chunks parciais podem ser ignorados ou tratados diferente
        session_id → ID da sessão do Recall.ai (útil para correlacionar chunks
                     de uma mesma reunião)
    """
    text: str
    speaker: str = "unknown"
    ts: datetime = field(default_factory=datetime.now)
    is_final: bool = True
    session_id: str = ""


class TranscriptionSource(ABC):
    """Interface abstrata para qualquer fonte de transcrição.

    Toda fonte de transcrição deve implementar o método stream(), que é um
    gerador assíncrono: retorna chunks um por um conforme chegam, sem bloquear
    o event loop do asyncio enquanto espera o próximo.

    Implementações existentes:
        StdinSource         → lê linhas do stdin (fallback / dev)
        WebhookSource  → recebe HTTP POST do Recall.ai via ngrok
        FileTailSource      → faz tail de um arquivo .jsonl (passo 12)
    """

    @abstractmethod
    async def stream(self) -> AsyncIterator[TranscriptChunk]:
        """Gera TranscriptChunks conforme chegam da fonte.

        É um gerador assíncrono: use "async for chunk in source.stream():"
        para consumir. O método usa "yield" nas implementações concretas, o
        que o torna um AsyncGenerator — ele suspende a execução a cada yield
        e retoma quando o consumidor pede o próximo item.

        Por que assíncrono? Porque esperar por transcrição é I/O-bound:
        ficamos esperando o Recall.ai mandar dados, a rede, o arquivo crescer...
        Usar async permite que o event loop faça outras coisas enquanto espera
        (renderizar o painel, processar teclas, rodar o watchdog, etc.).
        """
        raise NotImplementedError
