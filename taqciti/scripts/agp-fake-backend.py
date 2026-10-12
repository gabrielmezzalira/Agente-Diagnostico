"""Servidor de fumaça: o roteador WebSocket REAL do backend (app/routers/ws.py) e o ws_manager REAL,
com só o pipeline trocado por um falso (sem banco, sem Gemini). Uso: python agp_fake_backend.py PORT"""
import os, sys
BACKEND = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "backend"))
os.chdir(BACKEND); sys.path.insert(0, BACKEND)
os.environ.setdefault("SUPABASE_URL", "http://localhost:1"); os.environ.setdefault("SUPABASE_KEY", "x")
import uvicorn
from fastapi import FastAPI
from app.routers import ws as ws_router
from app.services import pipeline as pl
from app.services.session_state import Question
from app.services.ws_manager import ws_manager

NOT_ACTIVE = "00000000-0000-4000-8000-000000000000"
QUEUED = Question(id="11111111-aaaa-4bbb-8ccc-000000000001", text="Qual é o gargalo hoje?", block="negocio", source="auto",
                  status="queued", generated_at="2026-10-12T20:00:00+00:00", expires_at="2026-10-12T20:00:30+00:00", lens="produto")
class State:
    questions = [QUEUED]; red_flags = []; transcript_chunks = []
    def coverage_to_dict(self): return {}
class Fake:
    state = State()
    def _budget_payload(self): return {}
    async def trigger_questions(self): pass
async def fake_get_or_create(sid): return None if sid == NOT_ACTIVE else Fake()
pl.pipeline_manager.get_or_create = fake_get_or_create

app = FastAPI(); app.include_router(ws_router.router)
@app.post("/emit/{sid}/new")
async def emit_new(sid: str, text: str = "Quem decide a compra?", lens: str = "dados", status: str = "queued"):
    q = Question(id="22222222-aaaa-4bbb-8ccc-000000000002", text=text, block="eng_dados", source="auto", status=status,
                 generated_at="2026-10-12T20:01:00+00:00", expires_at="2026-10-12T20:01:30+00:00", lens=lens)
    await ws_manager.broadcast(sid, "question_new", q.__dict__); return {"ok": True}
@app.post("/emit/{sid}/expired/{qid}")
async def emit_expired(sid: str, qid: str):
    await ws_manager.broadcast(sid, "question_expired", {"id": qid}); return {"ok": True}
@app.get("/stats/{sid}")
async def stats(sid: str):
    return {"connections": len(ws_manager._connections.get(sid, [])) if hasattr(ws_manager, "_connections") else -1}
uvicorn.run(app, host="127.0.0.1", port=int(sys.argv[1]), log_level="warning")
