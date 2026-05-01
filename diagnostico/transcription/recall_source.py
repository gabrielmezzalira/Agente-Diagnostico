# =============================================================================
# transcription/recall_source.py
#
# Integração com Recall.ai: bot cloud que entra no Google Meet e envia
# transcrição em tempo real via webhook HTTP.
#
# Diferença do Taqtic:
#   - Taqtic: extensão Chrome, roda no browser do usuário, manda para localhost
#   - Recall.ai: bot cloud, entra headless no Meet, manda para URL pública
#
# Arquitetura: reutiliza WebhookServer + TaqticWebhookSource intocados.
# A única diferença é o recall_adapter, que traduz o formato JSON do Recall.ai
# para TranscriptChunk. O resto do pipeline (buffer, classificador, UI) é idêntico.
#
# Formato de webhook do Recall.ai (event: "transcript.data"):
# {
#   "event": "transcript.data",
#   "data": {
#     "bot_id": "abc-123",
#     "transcript": {
#       "speaker": "Jane Doe",
#       "words": [{"text": "hello"}, {"text": "world"}],
#       "is_final": true
#     }
#   }
# }
# =============================================================================

import logging
from datetime import datetime

from .base import TranscriptChunk
from .webhook_server import WebhookServer
from .taqtic import TaqticWebhookSource

logger = logging.getLogger(__name__)

# Eventos do Recall.ai que carregam transcrição.
_TRANSCRIPT_EVENTS = {"transcript.data", "bot.transcript"}


def recall_adapter(payload: dict) -> TranscriptChunk:
    """Converte o payload de webhook do Recall.ai em TranscriptChunk.

    Formato real enviado pelo Recall.ai (recording_config + realtime_endpoints):
    {
      "event": "transcript.data",
      "data": {
        "data": {
          "words": [{"text": "To make it.", "start_timestamp": {...}, ...}],
          "language_code": "en-US",
          "participant": {"id": 100, "name": "Gabriel Mezzalira", ...}
        },
        "transcript": {"id": "...", "metadata": {}},
        "bot": {"id": "235ee964-...", "metadata": {}}
      }
    }

    Outros eventos (bot.status_change, bot.done, etc.) são rejeitados com
    ValueError — o WebhookServer devolve 422 e não enfileira nada.
    """
    event = payload.get("event", "")
    if event not in _TRANSCRIPT_EVENTS:
        raise ValueError(f"Evento Recall.ai não é transcrição: '{event}' — ignorado.")

    outer = payload.get("data", {})

    # Conteúdo real da transcrição está em data.data
    inner = outer.get("data", {})

    words = inner.get("words", [])
    if words:
        text = " ".join(w.get("text", "") for w in words).strip()
    else:
        text = inner.get("text", "").strip()

    if not text:
        raise ValueError("Transcript do Recall.ai sem texto — ignorado.")

    # Nome do participante está em data.data.participant.name
    participant = inner.get("participant", {})
    speaker = participant.get("name", "unknown")

    # meeting_captions só envia segmentos completos — sempre final
    is_final = True

    bot_id = outer.get("bot", {}).get("id", "")

    return TranscriptChunk(
        text=text,
        speaker=speaker,
        ts=datetime.now(),
        is_final=is_final,
        session_id=bot_id,
    )


def make_recall_source(
    host: str = "127.0.0.1",
    port: int = 8765,
    secret: str = "",
) -> TaqticWebhookSource:
    """Cria uma fonte de transcrição configurada para receber webhooks do Recall.ai.

    Reutiliza WebhookServer (com recall_adapter) e TaqticWebhookSource sem
    duplicar o loop da queue — o único elemento novo é o adapter acima.

    Args:
        host:   endereço de bind do servidor (padrão: loopback)
        port:   porta do servidor (padrão: 8765, mesma do Taqtic)
        secret: token de autenticação opcional. Se configurado, o Recall.ai
                deve enviar "Authorization: Bearer <secret>" em cada request.
    """
    server = WebhookServer(host=host, port=port, secret=secret, payload_adapter=recall_adapter)
    return TaqticWebhookSource(server=server)
