import asyncio
import re
import shutil
from typing import Optional

# Matches trycloudflare.com and ngrok URLs
_CF_URL_RE = re.compile(r'https://[a-z0-9\-]+\.trycloudflare\.com')
_NGROK_URL_RE = re.compile(r'https://[a-z0-9\-]+\.ngrok[\-\w]*\.(app|io)')

_TUNNEL_TIMEOUT = 30  # seconds to wait for URL from tunnel process


class TunnelManager:
    """Manages one tunnel process per active session.

    Preference: cloudflared (no account required).
    Fallback: ngrok (requires a running agent on the machine).
    """

    def __init__(self) -> None:
        self._procs: dict[str, asyncio.subprocess.Process] = {}
        self._urls: dict[str, str] = {}

    async def start(self, session_id: str, port: int = 8000) -> Optional[str]:
        """Start a tunnel for the session and return the public URL.

        Returns None if neither cloudflared nor ngrok is found,
        or if the URL cannot be parsed within the timeout.
        """
        if session_id in self._procs:
            return self._urls.get(session_id)

        if shutil.which("cloudflared"):
            url = await self._start_cloudflared(session_id, port)
        elif shutil.which("ngrok"):
            url = await self._start_ngrok(session_id, port)
        else:
            return None

        if url:
            self._urls[session_id] = url
        return url

    async def stop(self, session_id: str) -> None:
        """Terminate the tunnel process for the session."""
        proc = self._procs.pop(session_id, None)
        if proc and proc.returncode is None:
            proc.terminate()
            try:
                await asyncio.wait_for(proc.wait(), timeout=5)
            except TimeoutError:
                proc.kill()
        self._urls.pop(session_id, None)

    def get_url(self, session_id: str) -> Optional[str]:
        return self._urls.get(session_id)

    # ------------------------------------------------------------------

    async def _start_cloudflared(self, session_id: str, port: int) -> Optional[str]:
        proc = await asyncio.create_subprocess_exec(
            "cloudflared", "tunnel", "--url", f"http://localhost:{port}",
            stdout=asyncio.subprocess.DEVNULL,
            stderr=asyncio.subprocess.PIPE,
        )
        self._procs[session_id] = proc
        return await self._read_url(proc.stderr, _CF_URL_RE)

    async def _start_ngrok(self, session_id: str, port: int) -> Optional[str]:
        proc = await asyncio.create_subprocess_exec(
            "ngrok", "http", str(port),
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.DEVNULL,
        )
        self._procs[session_id] = proc
        return await self._read_url(proc.stdout, _NGROK_URL_RE)

    @staticmethod
    async def _read_url(
        stream: asyncio.StreamReader,
        pattern: re.Pattern[str],
    ) -> Optional[str]:
        try:
            async with asyncio.timeout(_TUNNEL_TIMEOUT):
                while True:
                    line = await stream.readline()
                    if not line:
                        break
                    match = pattern.search(line.decode(errors="ignore"))
                    if match:
                        return match.group()
        except TimeoutError:
            pass
        return None


# Module-level singleton
tunnel_manager = TunnelManager()
