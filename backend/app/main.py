# =============================================================================
# main.py
#
# Entry point do backend FastAPI — Agente Diagnóstico v2.0
#
# Responsabilidade: criar a aplicação FastAPI, configurar middleware, montar
# arquivos estáticos (produção) e definir o endpoint de health check.
#
# Nota: os routers de projects, sessions etc. são adicionados nos planos
# subsequentes (Plan 02+). Esta versão apenas expõe GET /health para
# verificar conectividade com o frontend.
# =============================================================================

from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.routers import projects_router, question_bank_router, questions_router, sessions_router, webhook_router, ws_router

app = FastAPI(
    title="Agente Diagnóstico v2.0",
    description="Backend do sistema de diagnóstico técnico de projetos — CITi",
    version="2.0.0",
)

# ---------------------------------------------------------------------------
# CORS — permite apenas o dev server do Vite em desenvolvimento.
# Em produção, o FastAPI serve o build estático diretamente,
# então o CORS não é necessário (same-origin).
# ---------------------------------------------------------------------------
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # extensão Chrome + Vite dev server + produção
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Health check — usado pelo frontend para verificar conectividade.
# ---------------------------------------------------------------------------
app.include_router(projects_router)
app.include_router(sessions_router)
app.include_router(questions_router)
app.include_router(question_bank_router)
app.include_router(webhook_router)
app.include_router(ws_router)


@app.get("/health")
async def health_check() -> dict:
    """Verifica se o backend está rodando.

    Returns:
        {"status": "ok"} se o servidor está no ar.
    """
    return {"status": "ok"}


# ---------------------------------------------------------------------------
# Servir o SPA React em produção (se o build existir).
# O mount precisa ser o ÚLTIMO — é um catch-all para qualquer rota
# não resolvida pelos routers de API.
# Em dev, o Vite serve o frontend diretamente e faz proxy de /api/* para cá.
# ---------------------------------------------------------------------------
_dist_dir = Path(__file__).parent.parent.parent / "frontend" / "dist"
if _dist_dir.exists():
    app.mount(
        "/",
        StaticFiles(directory=str(_dist_dir), html=True),
        name="spa",
    )
