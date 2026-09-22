---
last_mapped_commit: dd6d5da918c8145005ced2b3c76ba98fa6d32aa2
last_mapped_at: 2026-09-19
---
# Technology Stack

**Analysis Date:** 2026-09-19

## Languages

**Primary:**

- **Python** 3.11 - Backend (FastAPI), LLM services, legacy CLI app (`diagnostico/`)
- **TypeScript** ~6.0 - Frontend (React + Vite), type-safe application code
- **JavaScript** (vanilla) - Chrome extension (manifest v3)

**Secondary:**

- **SQL** - Supabase migrations and stored procedures
- **Bash** - Deployment scripts, Docker entrypoint

## Runtime

**Environment:**

- **Python 3.11** - Backend container and local development
- **Node.js** (implicit via npm) - Frontend build toolchain (Vite, TypeScript)
- **Chromium/Chrome** - Extension host and client browser

**Package Manager:**

- **pip** (Python) - Backend dependencies; lockfile: implicit (no lock file checked into repo)
- **npm** (Node.js) - Frontend dependencies; lockfile: `frontend/package-lock.json` (not found, uses npm standard)

## Frameworks

**Core:**

- **FastAPI** ^0.111.0 - Python web framework, backend API, WebSocket support
- **React** ^19.2.6 - UI framework, frontend SPA
- **Vite** ^8.0.12 - Frontend build tool and dev server with HMR

**Testing:**

- **pytest** ^8.0.0 - Python test runner
- **pytest-asyncio** ^0.23.0 - Async test support for FastAPI
- **vitest** ^4.1.7 - Frontend test runner (Vite-native)
- **@testing-library/react** ^16.3.2 - React component testing utilities

**Build/Dev:**

- **TypeScript** compiler (~6.0.2) - Type checking
- **Tailwind CSS** ^4.3.0 - Utility-first CSS framework
- **@tailwindcss/vite** ^4.3.0 - Vite integration for Tailwind
- **@vitejs/plugin-react** ^6.0.1 - JSX/React support in Vite
- **ESLint** ^10.3.0 - JavaScript/TypeScript linting
- **typescript-eslint** ^8.59.2 - TypeScript linting rules

## Key Dependencies

**Critical (LLM & AI):**

- **google-genai** ^0.8.0 - Google Gemini API client (v2 backend, recommended over deprecated `google.generativeai`)
- **google-generativeai** ^0.8.0 - Legacy Gemini SDK (v1 CLI app only, deprecated)
- **langchain** ^0.3.0 - LLM orchestration framework (Precificador agent)
- **langchain-openai** ^0.2.0 - OpenAI provider for LangChain (Precificador configurable)
- **langchain-anthropic** ^0.3.0 - Anthropic/Claude provider (Precificador configurable)
- **langchain-google-genai** ^2.0.0 - Google Gemini LangChain integration (Precificador)
- **langgraph** ^0.2.0 - Agentic workflow orchestration (Precificador chatbot state machine)

**Infrastructure:**

- **supabase** ^2.3.0 - PostgreSQL client library, Vault integration for secrets
- **httpx** ^0.27.0 - Async HTTP client for external service calls (Recall, CITi Flow)
- **websockets** ^12.0 - WebSocket server/client library for real-time updates
- **python-multipart** ^0.0.9 - Multipart form data parsing (FastAPI file uploads)
- **uvicorn** ^0.30.0 - ASGI server for running FastAPI

**Data & Validation:**

- **pydantic** ^2.7.0 - Data validation via Python dataclass-like schemas
- **pdfplumber** ^0.11.0 - PDF parsing (Precificador exports, diagnostic reports)
- **fpdf2** ^2.7.0 - PDF generation (Precificador export)

**Frontend:**

- **@supabase/supabase-js** ^2.106.1 - Supabase client for authentication and real-time data (currently not used for auth, direct API calls via proxy)
- **react-router-dom** ^7.15.1 - Client-side routing
- **react-markdown** ^10.1.0 - Markdown rendering (diagnostic reports)
- **remark-gfm** ^4.0.1 - GitHub-flavored Markdown support
- **lucide-react** ^1.16.0 - Icon library

**Utilities:**

- **python-dotenv** ^1.0.0 - Load `.env` files into environment variables
- **rich** ^13.7.0 - Terminal UI and formatting (v1 CLI app)
- **aiohttp** ^3.9.0 - Async HTTP client (v1 CLI, webhook server)

## Configuration

**Environment:**

- `.env` file (untracked, in `.gitignore`) with required vars:
  - `SUPABASE_URL` - Supabase project URL
  - `SUPABASE_KEY` - Supabase service role key (secrets via Vault)
  - `GEMINI_API_KEY` - Google Gemini API key (per-project override in database)
  - `RECALL_API_KEY` - Recall.ai webhook bot API key (optional)
  - `RECALL_REGION` - Recall.ai region (default: `us-west-2`)
  - `PUBLIC_WEBHOOK_URL` - Public tunnel URL for webhook ingestion (auto-set by tunnel manager)
  - `CITIFLOW_BASE_URL` - CITi Flow integration endpoint (optional, default: `http://localhost:4100`)
  - Optional for Precificador: `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`

**Build:**

- `frontend/vite.config.ts` - Vite configuration, React plugin, Tailwind integration, dev proxy to `http://localhost:8000/api`
- `frontend/tsconfig.json` - TypeScript compiler configuration with app and node build targets
- `Dockerfile` - Python 3.11 base, installs `backend/requirements.txt`, runs FastAPI on port 8080
- `railway.toml` - Railway deployment config with health check at `/health`
- `vercel.json` - Vercel routing (redirects to agente-diagnostico.vercel.app)

## Platform Requirements

**Development:**

- Python 3.11+ with pip
- Node.js 18+ with npm
- PostgreSQL-compatible database (Supabase)
- Optional: `cloudflared` or `ngrok` for tunnel (for Taqtic webhook in dev)
- Optional: Google Chrome/Chromium for extension testing

**Production:**

- **Backend:** Docker container (Python 3.11 + FastAPI + Uvicorn)
  - Deployed on Railway (railway.app)
  - Environment variables via Railway dashboard
  - Health check: `GET /health`
- **Frontend:** Vercel (SPA routing, static hosting)
  - Built output: `frontend/dist` mounted by FastAPI in production
  - Dev: Vite dev server on port 5173 with proxy to `localhost:8000`
- **Database:** Supabase PostgreSQL with extensions (Vault for secrets, HTTP for webhooks)
- **Chrome Extension:** Manifest v3, runs in Chrome 88+, requires extension install from file or store

---

*Stack analysis: 2026-09-19*
