import logging
import os
from typing import Optional

import httpx

CITIFLOW_BASE_URL = os.getenv("CITIFLOW_BASE_URL", "http://localhost:4100")

_log = logging.getLogger(__name__)


async def fetch_briefings_as_context(company_name: str) -> Optional[str]:
    """Busca briefings anteriores do CITi Flow e os serializa em Markdown.

    Filtra por companyName e retorna None se nenhum briefing for encontrado
    ou se ocorrer qualquer erro (best-effort).
    """
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(f"{CITIFLOW_BASE_URL}/api/v1/briefings")
            response.raise_for_status()
            data = response.json()

        if not isinstance(data, list):
            return None

        filtered = [b for b in data if b.get("companyName") == company_name]
        if not filtered:
            return None

        lines = []
        for b in filtered:
            date = (b.get("createdAt") or "")[:10]
            summary = b.get("summary") or ""
            lines.append(f"## {b['companyName']} — {date}\n{summary}\n")

        return "\n".join(lines) or None
    except Exception as exc:
        _log.warning("fetch_briefings_as_context falhou: %s", exc)
        return None


async def post_diagnostic_pricing(run_id: str, pricing_payload: dict) -> bool:
    """Envia precificação gerada pelo Agente Diagnóstico ao FlowEngine do CITi Flow.

    Retorna True em sucesso, False em qualquer falha (fire-and-forget).
    """
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            response = await client.post(
                f"{CITIFLOW_BASE_URL}/api/v1/diagnostic-pricing",
                json={"runId": run_id, "area": "dados", "pricing": pricing_payload},
            )
            return response.status_code == 200
    except Exception as exc:
        _log.error("post_diagnostic_pricing falhou: %s", exc)
        return False
