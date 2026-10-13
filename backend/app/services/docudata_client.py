"""Cliente do DocuData para o Discovery (porta + adaptador). O resto do Agente só conhece
`DiscoveryGateway`; o HTTP fica isolado aqui (inversão de dependência).

Segurança: a chave de serviço nunca aparece em mensagens de erro, logs ou `repr`; redirecionamentos
não são seguidos (a chave e o corpo não podem ir para outro host); o conteúdo do pacote e o corpo
das respostas nunca são logados.
"""
import asyncio
import json
import logging
from typing import Awaitable, Callable, Protocol

import httpx

logger = logging.getLogger(__name__)

CAMINHO_REUNIOES = "/discovery/reunioes"
ESPERA_MAXIMA_RETRY_AFTER = 30.0
TAMANHO_MAXIMO_ID = 100
# Status HTTP que valem nova tentativa (além de 5xx): timeout do servidor e limite de taxa.
STATUS_REPETIVEIS = frozenset({408, 429})


class EnvioDefinitivoErro(Exception):
    """O DocuData recusou o envio (4xx/3xx) ou o pacote é inválido: repetir não adianta."""


class EnvioFalhouErro(Exception):
    """DocuData indisponível (ou resposta inutilizável) depois de todas as tentativas."""


class DiscoveryGateway(Protocol):
    """Porta: envia uma reunião ao DocuData e devolve o id dela lá."""

    async def enviar_reuniao(self, pacote: dict) -> str: ...


def _extrair_id(resposta: httpx.Response) -> str | None:
    """Valida o corpo da resposta de sucesso e devolve só o `id` (ou None se inutilizável)."""
    try:
        corpo = resposta.json()
    except ValueError:
        return None
    if not isinstance(corpo, dict):
        return None
    identificador = corpo.get("id")
    if not isinstance(identificador, str) or not identificador.strip():
        return None
    if len(identificador) > TAMANHO_MAXIMO_ID:
        return None
    return identificador


def _espera_retry_after(resposta: httpx.Response) -> float:
    """Lê `Retry-After` em segundos (apenas inteiro), limitado a um teto; 0 se ausente/inválido."""
    bruto = resposta.headers.get("Retry-After", "")
    bruto = bruto.strip()
    if len(bruto) > 6 or not bruto.isascii() or not bruto.isdigit():
        return 0.0
    return min(float(int(bruto)), ESPERA_MAXIMA_RETRY_AFTER)


class HttpDocudataGateway:
    """Adaptador HTTP da porta `DiscoveryGateway`, com novas tentativas e espera exponencial."""

    def __init__(
        self, base_url: str, chave: str, *, timeout: float = 15.0, tentativas: int = 3,
        espera_base: float = 1.0, transporte: httpx.AsyncBaseTransport | None = None,
        dormir: Callable[[float], Awaitable[None]] = asyncio.sleep,
    ) -> None:
        self._base = base_url.rstrip("/")
        self._chave = chave
        self._timeout = timeout
        self._tentativas = max(1, tentativas)
        self._espera_base = espera_base
        self._transporte = transporte
        self._dormir = dormir

    def __repr__(self) -> str:
        return f"HttpDocudataGateway(base_url={self._base!r}, chave='***')"

    __str__ = __repr__

    async def enviar_reuniao(self, pacote: dict) -> str:
        """Envia o pacote; devolve o id da reunião no DocuData.

        O `pacote` precisa conter só tipos JSON (str/int/float/bool/None/list/dict): quem monta
        converte datas e UUIDs antes. Levanta `EnvioDefinitivoErro` em recusa e `EnvioFalhouErro`
        quando o DocuData não responde de forma utilizável após as tentativas.

        Pior caso de tempo: tentativas x timeout + soma das esperas (backoff exponencial ou
        Retry-After, teto de 30 s cada); com os padrões, cerca de 3x15 + 60 s.
        """
        try:
            corpo = json.dumps(pacote, allow_nan=False).encode("utf-8")
        except (TypeError, ValueError):
            raise EnvioDefinitivoErro("pacote inválido") from None

        url = f"{self._base}{CAMINHO_REUNIOES}"
        cabecalhos = {"X-Discovery-Key": self._chave, "Content-Type": "application/json"}
        async with httpx.AsyncClient(
            timeout=self._timeout, transport=self._transporte, follow_redirects=False,
            limits=httpx.Limits(max_connections=2, max_keepalive_connections=0),
        ) as http:
            for tentativa in range(self._tentativas):
                espera_extra = 0.0
                try:
                    # Prazo TOTAL por tentativa (o timeout do httpx é por fase). Um estouro vira
                    # erro repetível; CancelledError (cancelamento externo) continua propagando.
                    async with asyncio.timeout(self._timeout):
                        resposta = await http.post(url, content=corpo, headers=cabecalhos)
                except (httpx.HTTPError, TimeoutError):
                    resposta = None
                    logger.warning("DocuData: erro de rede (tentativa %d/%d)", tentativa + 1, self._tentativas)

                if resposta is not None:
                    status = resposta.status_code
                    if status in (200, 202):
                        identificador = _extrair_id(resposta)
                        if identificador is not None:
                            return identificador
                        # 2xx inutilizável: reenviar é seguro (idempotência por fonte_session_id).
                        logger.warning("DocuData: resposta de sucesso inutilizável (tentativa %d/%d)",
                                       tentativa + 1, self._tentativas)
                    elif status < 500 and status not in STATUS_REPETIVEIS:
                        # 3xx (redirecionamento não seguido), 4xx de recusa ou outro 2xx inesperado.
                        logger.warning("DocuData: envio recusado (HTTP %d)", status)
                        raise EnvioDefinitivoErro(f"DocuData recusou o envio (HTTP {status})")
                    else:
                        espera_extra = _espera_retry_after(resposta)
                        logger.warning("DocuData: indisponível (HTTP %d, tentativa %d/%d)",
                                       status, tentativa + 1, self._tentativas)

                if tentativa + 1 < self._tentativas:
                    await self._dormir(max(self._espera_base * 2 ** tentativa, espera_extra))
        raise EnvioFalhouErro("DocuData indisponível após as tentativas")
