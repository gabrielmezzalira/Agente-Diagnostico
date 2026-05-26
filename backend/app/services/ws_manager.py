import json
from collections import defaultdict
from typing import Dict, Set

from fastapi import WebSocket


class WebSocketManager:
    def __init__(self):
        self._connections: Dict[str, Set[WebSocket]] = defaultdict(set)

    async def connect(self, session_id: str, ws: WebSocket) -> None:
        await ws.accept()
        self._connections[session_id].add(ws)

    def disconnect(self, session_id: str, ws: WebSocket) -> None:
        self._connections[session_id].discard(ws)

    async def broadcast(self, session_id: str, event: str, data: dict) -> None:
        msg = json.dumps({"event": event, "data": data})
        dead: Set[WebSocket] = set()
        for ws in list(self._connections.get(session_id, set())):
            try:
                await ws.send_text(msg)
            except Exception:
                dead.add(ws)
        for ws in dead:
            self.disconnect(session_id, ws)

    def has_connections(self, session_id: str) -> bool:
        return bool(self._connections.get(session_id))


ws_manager = WebSocketManager()
