# Phase 13: Embedded Pricing Chatbot — Research

**Researched:** 2026-07-19
**Domain:** LangGraph tool-calling agent + React chat panel + Supabase conversation persistence
**Confidence:** HIGH

---

## Summary

Phase 13 adds an embedded chatbot to the existing `PricingEditorPage`. The chatbot uses a LangGraph `create_react_agent` graph with four structured tools (`add_feature`, `remove_feature`, `update_feature`, `update_inputs`) that mutate the pricing DB and immediately reflect in the frontend feature table. Conversation history is persisted in `pricing_chat_messages` (already created in the Phase 11 migration).

The backend already has everything needed: `llm_factory.py` (`create_llm`), `PricingRepository` (all feature CRUD methods), `LLMPricingService` (pattern for injecting repo + BaseChatModel), and the `_get_llm_pricing_service` factory in `pricings.py`. Phase 13 follows the exact same pattern, extending it with a graph-based agent instead of a single `.with_structured_output()` call.

The frontend already has `PricingEditorPage`, `usePricing` (owns `setFeatures`), and `usePricingFeatures` (owns `addFeature`, `updateFeature`, `deleteFeature`). Phase 13 adds a `ChatPanel` component, `usePricingChat` hook, and a `POST /pricings/{id}/chat` endpoint. After each tool call the backend returns the updated feature list, and the frontend calls `setFeatures()` to update the table without any additional polling.

**Primary recommendation:** Use `create_react_agent` with a closure-based tool factory. Tools are closures over `pricing_id` and `PricingRepository` — they perform DB mutations internally and return human-readable confirmation strings. The endpoint is a synchronous POST (not WebSocket): user sends a message, backend runs the agent to completion, returns assistant text + updated feature list. This is simpler than streaming and sufficient for MVP.

---

## Project Constraints (from CLAUDE.md)

### SOLID Architecture (mandatory)
- Routers call services only; never touch `db.table()` directly
- Services call repositories; no SQL in service layer
- Repositories: all `db.table()` calls isolated here
- Components do one thing; hooks encapsulate state/effects; pages only compose
- File size limit: >200 lines is a sign of too many responsibilities

### LangChain + LangGraph (non-negotiable for Agente Precificador)
- All LLM integration for the Precificador MUST use LangChain/LangGraph
- `BaseChatModel` abstraction — services never reference provider concrete classes
- Lazy imports inside method bodies; `TYPE_CHECKING` guard for annotation-only imports

### Stack
- Backend: Python + FastAPI + Supabase (no ORMs, direct PostgREST via `supabase-py`)
- Frontend: React + Vite + TypeScript + Tailwind (CSS variables, no hardcoded colors)
- Authentication: none (single-user local deployment)

### Existing patterns that MUST be followed (from phase 11/12 decisions)
- `TYPE_CHECKING` guard for `BaseChatModel` — module importable before `pip install`
- `asyncio.to_thread()` wraps sync service methods in async FastAPI endpoints
- `_get_llm_pricing_service` Depends factory pattern — wires repo + vault + LLM; endpoint is 1-line forwarder
- `vault_get_secret` RPC for decrypting API keys (NOT `vault.decrypted_secrets` — that was broken)
- CSS design tokens: always `var(--color-*)`, never hardcoded colors

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PREC-12 | Embedded chat panel on pricing screen; LLM context includes: diagnosis report content + approved pricing history + current feature list + current inputs | ChatPanel component in PricingEditorPage; context assembled by ChatbotService from existing PricingRepository methods |
| PREC-13 | User can instruct chatbot to add, remove, or modify features and hours via natural language; changes applied to feature table in real time | LangGraph tools execute DB mutations; endpoint returns updated feature list; frontend calls setFeatures() |
| PREC-14 | Chatbot can discuss diagnosis report content and explain feature/hour suggestions | Diagnosis reports already fetched by get_project_reports(); included in system prompt context |
| PREC-15 | Chatbot uses structured tool calls: add_feature, remove_feature, update_feature, update_inputs; results reflected immediately in feature table | @tool decorators + create_react_agent + closure injection pattern; all 4 tools confirmed implementable |
</phase_requirements>

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Chat panel UI (input + message history) | Frontend / React | — | Client-side rendering; state managed in `usePricingChat` hook |
| Conversation persistence (save/load messages) | API Backend | Database | `POST /pricings/{id}/chat` saves to `pricing_chat_messages`; `GET` loads history |
| LLM agent execution (tool calls + text response) | API Backend | — | LangGraph agent runs server-side; tool results are DB mutations |
| Feature table mutation from tool calls | API Backend + Database | Frontend | Backend writes to DB; endpoint returns updated features; frontend refreshes state |
| LLM context assembly (reports, history, features, inputs) | API Backend (Service) | — | All context from existing repository methods; assembled in ChatbotService |
| Conversation memory across turns | API Backend | — | `InMemorySaver` keyed by `pricing_id` (per-session, per-process) |

---

## Standard Stack

### Core (already installed — no new packages needed)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `langgraph` | 1.2.9 [VERIFIED: installed venv] | Agent graph with tool-calling loop | Mandatory per CLAUDE.md; already installed |
| `langchain-core` | 1.4.9 [VERIFIED: installed venv] | `@tool`, `BaseChatModel`, `HumanMessage`, `SystemMessage` | Core abstraction layer |
| `langchain` | 1.3.14 [VERIFIED: installed venv] | Message types and chain utilities | Already installed |
| `langchain-openai` | 1.3.5 [VERIFIED: installed venv] | `ChatOpenAI` concrete provider | Already installed |
| `langchain-anthropic` | 1.4.8 [VERIFIED: installed venv] | `ChatAnthropic` concrete provider | Already installed |
| `langchain-google-genai` | 4.2.7 [VERIFIED: installed venv] | `ChatGoogleGenerativeAI` concrete provider | Already installed |

### Key LangGraph Imports for This Phase

```python
from langgraph.prebuilt import create_react_agent   # builds agent graph
from langgraph.checkpoint.memory import InMemorySaver  # per-process conversation memory
from langchain_core.tools import tool               # @tool decorator
from langchain_core.messages import HumanMessage, SystemMessage, AIMessage  # lazy-import inside methods
```

**No new packages required.** All dependencies are already in `backend/requirements.txt` from Phase 12.

---

## Package Legitimacy Audit

No new packages are introduced in Phase 13. All packages were installed and verified in Phase 12.

| Package | Registry | slopcheck | Disposition |
|---------|----------|-----------|-------------|
| langgraph | PyPI | [OK] | Approved — already installed |
| langchain | PyPI | [OK] | Approved — already installed |
| langchain-core | PyPI | [OK] | Approved — already installed |
| langchain-openai | PyPI | [OK] | Approved — already installed |
| langchain-anthropic | PyPI | [OK] | Approved — already installed |
| langchain-google-genai | PyPI | [OK] | Approved — already installed |

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

---

## Architecture Patterns

### System Architecture Diagram

```
Browser (PricingEditorPage)
    |
    |-- usePricingChat hook
    |       |
    |       |-- GET /pricings/{id}/chat-history     → loads pricing_chat_messages on mount
    |       |-- POST /pricings/{id}/chat             → sends user message, receives {reply, features}
    |
    |-- ChatPanel component (messages + input)
    |-- On POST response: setFeatures(data.features) → table updates immediately
    |
FastAPI (pricings.py router)
    |
    |-- GET /pricings/{id}/chat-history
    |       → PricingRepository.list_chat_messages(pricing_id) → list[ChatMessage]
    |
    |-- POST /pricings/{id}/chat
            → _get_chatbot_service(pricing_id, db) [Depends factory]
                    → PricingRepository(db)
                    → repo.get_project_llm_config(project_id)
                    → repo.decrypt_pricing_api_key(secret_id)
                    → create_llm(provider, model, api_key)
                    → PricingChatbotService(repo, llm)
            → asyncio.to_thread(svc.chat, pricing_id, user_message)
                    → ChatbotService.chat():
                        1. Persist user message to pricing_chat_messages
                        2. Assemble context (reports + history + features + inputs)
                        3. Build tools via make_pricing_tools(pricing_id, repo)
                        4. create_react_agent(llm, tools, prompt=system_prompt,
                                              checkpointer=InMemorySaver [singleton])
                        5. graph.invoke({"messages": full_history}, config={thread_id: pricing_id})
                        6. Extract assistant reply from last AIMessage
                        7. Persist assistant message to pricing_chat_messages
                        8. Fetch updated features via repo.get_pricing_features(pricing_id)
                        9. Return {reply: str, features: list[PricingFeatureResponse]}
    |
Supabase (PostgreSQL)
    └── pricing_chat_messages (role, content, tool_calls, created_at)
    └── pricing_features (mutated by tool calls during step 5)
    └── pricings (mutated by update_inputs tool)
```

### Recommended Project Structure

New files for Phase 13:

```
backend/app/
  services/
    pricing_chatbot_service.py    # ChatbotService + make_pricing_tools factory
  models/
    chat_messages.py              # ChatMessageResponse, ChatRequest, ChatResponse Pydantic models
  routers/
    pricings.py                   # EXTEND: add 2 new endpoints (GET chat-history, POST chat)

frontend/src/
  hooks/
    usePricingChat.ts             # Chat state: messages, sending, send(), loadHistory()
  pages/
    PricingEditorPage.tsx         # EXTEND: import ChatPanel, show alongside feature table
  (no new pages — chatbot is embedded in existing page)
```

Note: `ChatPanel` can live in `PricingEditorPage.tsx` as an internal component (like `FeatureRow`, `SuggestionCard`, `Field`, `OutputRow` already do) since it is only used in one place. If it grows beyond ~80 lines, extract to a named file.

### Pattern 1: Tool Factory with Closure Injection

The critical pattern: tools are closures over `pricing_id` and `repo`. The LLM schema only sees the business arguments; `pricing_id` and `repo` are captured from the outer scope.

```python
# Source: verified locally — closure pattern hides context from LLM schema
from langchain_core.tools import tool
from app.repositories.pricing_repository import PricingRepository

def make_pricing_tools(pricing_id: str, repo: PricingRepository) -> list:
    """Returns 4 bound tools for the pricing agent.
    
    pricing_id and repo are captured via closure — they never appear in the
    LLM-facing tool schema. The LLM only sees the business arguments.
    """

    @tool
    def add_feature(bloco: str, funcionalidade: str, horas: float) -> str:
        """Adiciona uma nova funcionalidade à tabela de precificação.
        Use this when the user asks to add a feature, functionality, or task."""
        row = {
            "pricing_id": pricing_id,
            "bloco": bloco,
            "funcionalidade": funcionalidade,
            "horas": str(horas),
            "citi_responsible": True,
        }
        inserted = repo.insert_feature(row)
        return f'Funcionalidade "{funcionalidade}" adicionada ao bloco "{bloco}" com {horas}h (id: {inserted["id"]})'

    @tool
    def remove_feature(feature_id: str) -> str:
        """Remove uma funcionalidade da tabela pelo seu ID.
        Use this when the user asks to remove or delete a feature."""
        existing = repo.get_feature(feature_id, pricing_id)
        if not existing:
            return f"Funcionalidade {feature_id} não encontrada nesta precificação."
        repo.delete_feature(feature_id)
        return f'Funcionalidade "{existing.get("funcionalidade", feature_id)}" removida.'

    @tool
    def update_feature(feature_id: str, bloco: str | None = None,
                       funcionalidade: str | None = None, horas: float | None = None) -> str:
        """Atualiza campos de uma funcionalidade existente (bloco, funcionalidade, horas).
        Provide only the fields that should change. Use this when the user asks to edit or change a feature."""
        existing = repo.get_feature(feature_id, pricing_id)
        if not existing:
            return f"Funcionalidade {feature_id} não encontrada."
        updates: dict = {}
        if bloco is not None: updates["bloco"] = bloco
        if funcionalidade is not None: updates["funcionalidade"] = funcionalidade
        if horas is not None: updates["horas"] = str(horas)
        if not updates:
            return "Nenhum campo para atualizar foi fornecido."
        repo.update_feature(feature_id, updates)
        return f'Funcionalidade "{existing.get("funcionalidade", feature_id)}" atualizada.'

    @tool
    def update_inputs(num_analysts: int | None = None, hours_per_day: float | None = None,
                      ticket_price: float | None = None,
                      extra_calendar_days: int | None = None) -> str:
        """Atualiza os parâmetros de entrada da precificação (analistas, horas/dia, ticket, dias extras).
        Use this when the user asks to change the pricing parameters or inputs."""
        updates: dict = {}
        if num_analysts is not None: updates["num_analysts"] = num_analysts
        if hours_per_day is not None: updates["hours_per_day"] = str(hours_per_day)
        if ticket_price is not None: updates["ticket_price"] = str(ticket_price)
        if extra_calendar_days is not None: updates["extra_calendar_days"] = extra_calendar_days
        if not updates:
            return "Nenhum parâmetro para atualizar foi fornecido."
        updates["updated_at"] = __import__("datetime").datetime.now(
            __import__("datetime").timezone.utc
        ).isoformat()
        repo.update_pricing(pricing_id, updates)
        return f"Parâmetros atualizados: {', '.join(updates.keys())}"

    return [add_feature, remove_feature, update_feature, update_inputs]
```

**Why closures, not InjectedToolArg:** `InjectedToolArg` hides individual arguments from the LLM schema but still requires the tool signature to declare them, which is more complex. Closures capture context cleanly and were verified locally to produce schemas that expose only the business arguments to the LLM.

### Pattern 2: create_react_agent with InMemorySaver

```python
# Source: verified locally — InMemorySaver + create_react_agent work in installed version 1.2.9
from langgraph.prebuilt import create_react_agent
from langgraph.checkpoint.memory import InMemorySaver

# Singleton per service instance — persists conversation across turns for a pricing_id
_checkpointer = InMemorySaver()

class PricingChatbotService:
    def __init__(self, repo: PricingRepository, llm: "BaseChatModel") -> None:
        self._repo = repo
        self._llm = llm

    def chat(self, pricing_id: str, user_message: str) -> dict:
        tools = make_pricing_tools(pricing_id, self._repo)
        graph = create_react_agent(
            self._llm,
            tools=tools,
            prompt=self._build_system_prompt(pricing_id),
            checkpointer=_checkpointer,
        )
        # thread_id = pricing_id: each pricing has its own conversation thread
        config = {"configurable": {"thread_id": pricing_id}}
        result = graph.invoke(
            {"messages": [("user", user_message)]},
            config=config,
        )
        # Last message in result["messages"] is the assistant's final reply
        last_msg = result["messages"][-1]
        reply = last_msg.content if hasattr(last_msg, "content") else str(last_msg)
        return reply
```

**Important:** `InMemorySaver` is process-local. It survives across multiple HTTP requests (in the same process) but is lost on process restart. This is acceptable for MVP — conversation history is also saved to `pricing_chat_messages` for persistence. On new process start, the Supabase history is loaded and replayed into the graph to restore context.

### Pattern 3: Context Assembly in System Prompt

```python
def _build_system_prompt(self, pricing_id: str) -> str:
    """Builds a context-rich system prompt for the chatbot.
    
    Assembles all 4 context types required by PREC-12:
    A) Current feature list
    B) Current inputs (parameters)
    C) Diagnosis reports
    D) Approved pricing history (top 3)
    """
    pricing = self._repo.get_pricing(pricing_id)
    features = self._repo.get_pricing_features(pricing_id)
    project_id = str(pricing["project_id"])
    reports = self._repo.get_project_reports(project_id)
    history = self._repo.get_recent_history(limit=3)

    # A) Current features
    features_text = "\n".join(
        f"- ID: {f['id']} | [{f.get('bloco','')}] {f.get('funcionalidade','')} — {f.get('horas','?')}h"
        for f in features
    ) or "Nenhuma funcionalidade cadastrada."

    # B) Inputs
    inputs_text = (
        f"Analistas: {pricing.get('num_analysts')}, "
        f"Horas/dia: {pricing.get('hours_per_day')}, "
        f"Ticket mensal: R${pricing.get('ticket_price')}, "
        f"Dias extras: {pricing.get('extra_calendar_days', 0)}"
    )

    # C) Diagnosis reports (truncated to ~2000 chars to stay within context)
    reports_text = "\n\n---\n\n".join(
        r["markdown_content"][:1000] for r in reports if r.get("markdown_content")
    ) or "Nenhum relatório de diagnóstico disponível."

    # D) Approved history
    history_lines = []
    for h in history:
        snap = h.get("snapshot", {})
        for f in snap.get("features", [])[:5]:  # top 5 features per pricing
            history_lines.append(
                f"  [{f.get('bloco','')}] {f.get('funcionalidade','')} → {f.get('horas','?')}h"
            )
    history_text = "\n".join(history_lines) or "Sem histórico disponível."

    return (
        "Você é um assistente de precificação técnica da CITi. "
        "Ajude o comercial a refinar a precificação conversando em português. "
        "Quando solicitado a adicionar, remover ou editar funcionalidades, use as ferramentas disponíveis. "
        "Responda de forma concisa e direta.\n\n"
        f"## Funcionalidades Atuais (com IDs para editar/remover)\n{features_text}\n\n"
        f"## Parâmetros da Precificação\n{inputs_text}\n\n"
        f"## Relatório de Diagnóstico (resumo)\n{reports_text[:2000]}\n\n"
        f"## Histórico de Precificações Aprovadas\n{history_text}"
    )
```

**Key insight:** The system prompt is rebuilt on every chat call to include the **current** feature list with IDs. This is essential for `remove_feature` and `update_feature` — the LLM needs to know what IDs exist. The LangGraph checkpointer preserves conversation history across turns; the system prompt provides current state.

### Pattern 4: Endpoint + Depends Factory (mirrors existing _get_llm_pricing_service)

```python
# Source: mirrors existing _get_llm_pricing_service pattern in pricings.py exactly

def _get_chatbot_service(
    pricing_id: UUID,
    db: Client = Depends(get_supabase),
) -> PricingChatbotService:
    repo = PricingRepository(db)
    pricing = repo.get_pricing(str(pricing_id))
    if not pricing:
        raise HTTPException(status_code=404, detail="Pricing not found")
    project_id = str(pricing["project_id"])
    llm_config = repo.get_project_llm_config(project_id)
    api_key = repo.decrypt_pricing_api_key(llm_config["secret_id"])
    llm = create_llm(llm_config["provider"], llm_config["model"], api_key)
    return PricingChatbotService(repo, llm)

@router.post("/pricings/{pricing_id}/chat", response_model=ChatResponse)
async def chat(
    pricing_id: UUID,
    body: ChatRequest,
    svc: PricingChatbotService = Depends(_get_chatbot_service),
) -> ChatResponse:
    return await asyncio.to_thread(svc.chat, str(pricing_id), body.message)

@router.get("/pricings/{pricing_id}/chat-history", response_model=list[ChatMessageResponse])
async def get_chat_history(
    pricing_id: UUID,
    db: Client = Depends(get_supabase),
) -> list[ChatMessageResponse]:
    repo = PricingRepository(db)
    rows = repo.list_chat_messages(str(pricing_id))
    return [ChatMessageResponse(**r) for r in rows]
```

### Pattern 5: Database Schema for pricing_chat_messages

The table **already exists** from Phase 11 migration:

```sql
-- Already in 20260719000000_precificador_schema.sql — DO NOT recreate
CREATE TABLE IF NOT EXISTS pricing_chat_messages (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    pricing_id  uuid NOT NULL REFERENCES pricings(id) ON DELETE CASCADE,
    role        text,       -- user | assistant | tool
    content     text,
    tool_calls  jsonb,
    created_at  timestamptz DEFAULT now()
);
```

Phase 13 only needs to populate this table. No migration is needed.

### Pattern 6: PricingRepository Extensions (chat messages)

```python
# Add to PricingRepository — following existing method patterns
def list_chat_messages(self, pricing_id: str) -> list[dict]:
    result = (
        self._db.table("pricing_chat_messages")
        .select("*")
        .eq("pricing_id", pricing_id)
        .order("created_at")
        .execute()
    )
    return result.data or []

def insert_chat_message(self, row: dict) -> dict:
    result = self._db.table("pricing_chat_messages").insert(row).execute()
    return result.data[0]
```

### Pattern 7: Chat History Replay on Process Restart

When a new process starts, `InMemorySaver` is empty. Load previous messages from Supabase and replay them into the graph before the user's new message:

```python
def chat(self, pricing_id: str, user_message: str) -> ChatResponse:
    # ... tools and graph setup ...
    
    # Replay history from DB if checkpointer has no state for this thread
    config = {"configurable": {"thread_id": pricing_id}}
    state = graph.get_state(config)
    if not state.values.get("messages"):
        # Load history and seed the checkpointer
        db_history = self._repo.list_chat_messages(pricing_id)
        if db_history:
            history_messages = [
                ("user" if m["role"] == "user" else "assistant", m["content"])
                for m in db_history
                if m["role"] in ("user", "assistant") and m.get("content")
            ]
            if history_messages:
                graph.invoke({"messages": history_messages}, config=config)
    
    # Now invoke with the new message
    result = graph.invoke({"messages": [("user", user_message)]}, config=config)
    # ...
```

### Pattern 8: Frontend Chat Hook

```typescript
// Source: mirrors useLLMSuggestions.ts pattern exactly
export function usePricingChat(pricingId: string | undefined, setFeatures: React.Dispatch<...>) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [sending, setSending] = useState(false)
  const [chatError, setChatError] = useState<string | null>(null)

  // Load history on mount
  useEffect(() => {
    if (!pricingId) return
    api.pricings.getChatHistory(pricingId)
      .then(setMessages)
      .catch(() => {}) // history load failure is non-blocking
  }, [pricingId])

  const sendMessage = useCallback(async (text: string) => {
    if (!pricingId || !text.trim()) return
    const userMsg: ChatMessage = { id: Date.now().toString(), role: 'user', content: text, created_at: new Date().toISOString() }
    setMessages(m => [...m, userMsg])
    setSending(true)
    setChatError(null)
    try {
      const { reply, features } = await api.pricings.chat(pricingId, text)
      const assistantMsg: ChatMessage = { id: (Date.now()+1).toString(), role: 'assistant', content: reply, created_at: new Date().toISOString() }
      setMessages(m => [...m, assistantMsg])
      if (features) setFeatures(features)   // atomic table update
    } catch (e: unknown) {
      setChatError(e instanceof Error ? e.message : 'Erro no chatbot')
      setMessages(m => m.slice(0, -1))  // remove optimistic user message on error
    } finally {
      setSending(false)
    }
  }, [pricingId, setFeatures])

  return { messages, sending, chatError, sendMessage }
}
```

### Anti-Patterns to Avoid

- **WebSocket for the chatbot:** The chatbot is a request-response flow (user sends → agent runs to completion → response). POST is simpler, avoids connection state, and is consistent with the existing `/import-from-diagnosis` and `/suggest-features` endpoints. Streaming is a future enhancement if latency becomes an issue.
- **Storing graph state in DB:** LangGraph `InMemorySaver` is the source of truth for in-flight conversation state. Supabase is for persistence across process restarts. Do not try to serialize graph state to Supabase — it's complex and unnecessary.
- **Rebuilding the graph on every tool call:** Build the graph once per `chat()` call (each HTTP request). Tools are stateless closures; only DB state changes between calls.
- **Putting tool logic in the router:** Tools are defined in `pricing_chatbot_service.py` via `make_pricing_tools()`. The router only wires dependencies and forwards to the service.
- **LangGraph in the Diagnostic Agent:** CLAUDE.md explicitly bans LangGraph from the Agente Diagnóstico (ADR locked). This phase only adds chatbot to the Precificador module.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Tool-calling loop (LLM → tool → LLM → ...) | Custom retry/dispatch loop | `create_react_agent` | Handles loop, termination, tool routing, error recovery out of the box |
| Conversation turn management | Manual message list | `InMemorySaver` + `thread_id` config | Handles message accumulation, state persistence, concurrent threads |
| Tool schema generation | Manual JSON schema dicts | `@tool` decorator | Auto-generates schema from Python function signature + docstring |
| Provider switching | if/elif chains | existing `create_llm` factory in `llm_factory.py` | Already built, tested, handles all 3 providers |
| Context injection into tools | Complex InjectedToolArg | Closure pattern | Simpler, already verified locally, cleaner schemas |

---

## Common Pitfalls

### Pitfall 1: Stale Feature IDs in Tool Calls
**What goes wrong:** LLM tries to `remove_feature` or `update_feature` with an ID that no longer exists (was deleted mid-conversation, or from a previous session).
**Why it happens:** The system prompt is built at the start of `chat()` with the feature list at that moment. If another request (e.g., direct feature deletion in the table) happens in parallel, the IDs in the prompt are stale.
**How to avoid:** The tool already guards against this — `get_feature(feature_id, pricing_id)` returns `None` if not found, and the tool returns a user-friendly error string. The LLM will then clarify with the user.
**Warning signs:** Tool returns "não encontrada nesta precificação" even for valid IDs the user referenced.

### Pitfall 2: InMemorySaver State Leak Between Pricings
**What goes wrong:** Two different pricings accidentally share conversation history because `thread_id` was set wrong.
**Why it happens:** Using a constant `thread_id` like `"default"` or the project ID instead of the pricing ID.
**How to avoid:** Always `config = {"configurable": {"thread_id": pricing_id}}` where `pricing_id` is the specific UUID of the pricing being chatted about. Verify: each pricing has its own conversation thread.

### Pitfall 3: Graph Rebuilt Without Checkpointer
**What goes wrong:** Every `chat()` call creates a new `create_react_agent(checkpointer=InMemorySaver())` instance. The InMemorySaver is local to that instance — no history is preserved.
**Why it happens:** `InMemorySaver()` called inside `chat()` method instead of as a module-level or class-level singleton.
**How to avoid:** Declare `_CHATBOT_CHECKPOINTER = InMemorySaver()` at module level in `pricing_chatbot_service.py`. The `create_react_agent` call references this singleton.

### Pitfall 4: update_inputs Requires updated_at
**What goes wrong:** `update_inputs` updates the pricings table but forgets `updated_at`, so the frontend's `pricing.updated_at` stays stale.
**Why it happens:** `update_feature` does not need `updated_at` (pricing_features has no such column); `update_pricing` does.
**How to avoid:** The `update_inputs` tool explicitly adds `updated_at` before calling `repo.update_pricing()`. All other repos follow this same pattern (`pricing_service.py` line 99).

### Pitfall 5: TYPE_CHECKING Guard Forgotten
**What goes wrong:** `from langchain_core.language_models import BaseChatModel` at module top causes `ModuleNotFoundError` before `pip install`.
**Why it happens:** Learned the hard way in Phases 12-01 and 12-02.
**How to avoid:** Always use `TYPE_CHECKING` guard in `pricing_chatbot_service.py` exactly as in `llm_pricing_service.py`. Use `"BaseChatModel"` string annotation in method signatures.

### Pitfall 6: Tool Docstrings Are Critical
**What goes wrong:** LLM calls the wrong tool, or fails to call any tool when asked to add/remove features.
**Why it happens:** Docstrings that are too vague, or in English when the user speaks Portuguese.
**How to avoid:** Write Portuguese docstrings that are explicit about when to use each tool. Include both the verb ("adiciona") and a clarifying phrase about the context ("quando o usuário pedir para adicionar"). Verified: `@tool` uses the function docstring as the tool description sent to the LLM.

### Pitfall 7: Chat Panel Layout Breaks on Small Screens
**What goes wrong:** Adding a chat panel alongside the existing two-column layout (inputs/outputs + feature table) on a narrow screen creates three columns that don't fit.
**Why it happens:** Current layout already uses `flex flex-col lg:flex-row`. Adding a third column requires careful responsive design.
**How to avoid:** Add the chat panel as a full-width section **below** the existing two-column area (not alongside it). On desktop, use a collapsible drawer or a tab to show/hide the chat without disrupting the feature table. This is the safest approach for MVP.

---

## Code Examples

### Complete Minimal Service

```python
# backend/app/services/pricing_chatbot_service.py
from __future__ import annotations
from typing import TYPE_CHECKING
if TYPE_CHECKING:
    from langchain_core.language_models import BaseChatModel

from app.repositories.pricing_repository import PricingRepository
from app.models.pricings import ChatResponse
from langchain_core.tools import tool
from langgraph.prebuilt import create_react_agent
from langgraph.checkpoint.memory import InMemorySaver

_CHECKPOINTER = InMemorySaver()  # singleton — shared across all requests in this process

def make_pricing_tools(pricing_id: str, repo: PricingRepository) -> list:
    @tool
    def add_feature(bloco: str, funcionalidade: str, horas: float) -> str:
        """Adiciona nova funcionalidade à precificação. Use quando o usuário pedir para adicionar."""
        row = {"pricing_id": pricing_id, "bloco": bloco, "funcionalidade": funcionalidade, "horas": str(horas), "citi_responsible": True}
        inserted = repo.insert_feature(row)
        return f'Funcionalidade "{funcionalidade}" adicionada (id: {inserted["id"]})'

    @tool
    def remove_feature(feature_id: str) -> str:
        """Remove funcionalidade pelo ID. Use quando o usuário pedir para remover."""
        existing = repo.get_feature(feature_id, pricing_id)
        if not existing:
            return f"ID {feature_id} não encontrado nesta precificação."
        repo.delete_feature(feature_id)
        return f'Funcionalidade "{existing.get("funcionalidade","")}" removida.'

    @tool
    def update_feature(feature_id: str, bloco: str | None = None,
                       funcionalidade: str | None = None, horas: float | None = None) -> str:
        """Atualiza bloco, funcionalidade ou horas de uma feature existente."""
        existing = repo.get_feature(feature_id, pricing_id)
        if not existing:
            return f"ID {feature_id} não encontrado."
        updates = {k: v for k, v in {"bloco": bloco, "funcionalidade": funcionalidade, "horas": str(horas) if horas else None}.items() if v is not None}
        if updates:
            repo.update_feature(feature_id, updates)
        return f'Feature "{existing.get("funcionalidade","")}" atualizada.'

    @tool
    def update_inputs(num_analysts: int | None = None, hours_per_day: float | None = None,
                      ticket_price: float | None = None, extra_calendar_days: int | None = None) -> str:
        """Atualiza parâmetros da precificação (analistas, horas/dia, ticket mensal, dias extras)."""
        import datetime
        updates = {k: v for k, v in {"num_analysts": num_analysts, "hours_per_day": str(hours_per_day) if hours_per_day else None, "ticket_price": str(ticket_price) if ticket_price else None, "extra_calendar_days": extra_calendar_days}.items() if v is not None}
        if updates:
            updates["updated_at"] = datetime.datetime.now(datetime.timezone.utc).isoformat()
            repo.update_pricing(pricing_id, updates)
        return f"Parâmetros atualizados: {list(updates.keys())}"

    return [add_feature, remove_feature, update_feature, update_inputs]


class PricingChatbotService:
    def __init__(self, repo: PricingRepository, llm: "BaseChatModel") -> None:
        self._repo = repo
        self._llm = llm

    def chat(self, pricing_id: str, user_message: str) -> dict:
        # Persist user message
        self._repo.insert_chat_message({"pricing_id": pricing_id, "role": "user", "content": user_message})
        
        tools = make_pricing_tools(pricing_id, self._repo)
        system_prompt = self._build_system_prompt(pricing_id)
        graph = create_react_agent(self._llm, tools=tools, prompt=system_prompt, checkpointer=_CHECKPOINTER)
        config = {"configurable": {"thread_id": pricing_id}}
        
        # Seed checkpointer from DB if fresh process
        state = graph.get_state(config)
        if not state.values.get("messages"):
            self._replay_history(graph, pricing_id, config)
        
        result = graph.invoke({"messages": [("user", user_message)]}, config=config)
        reply = result["messages"][-1].content
        
        # Persist assistant reply
        self._repo.insert_chat_message({"pricing_id": pricing_id, "role": "assistant", "content": reply})
        
        # Return updated features for immediate table refresh
        features = self._repo.get_pricing_features(pricing_id)
        return {"reply": reply, "features": features}

    def _replay_history(self, graph, pricing_id: str, config: dict) -> None:
        db_msgs = self._repo.list_chat_messages(pricing_id)
        history = [(m["role"], m["content"]) for m in db_msgs if m.get("content") and m["role"] in ("user", "assistant")]
        if history:
            graph.invoke({"messages": history}, config=config)

    def _build_system_prompt(self, pricing_id: str) -> str:
        # ... (see Pattern 3 above) ...
        return "Você é um assistente de precificação da CITi..."
```

### Frontend API Extension

```typescript
// Add to frontend/src/lib/api.ts

export interface ChatMessage {
  id: string
  pricing_id: string
  role: 'user' | 'assistant'
  content: string
  created_at: string
}

export interface ChatResponse {
  reply: string
  features: PricingFeature[]
}

// In api.pricings namespace:
chat: (pricingId: string, message: string) =>
  request<ChatResponse>(`/pricings/${pricingId}/chat`, {
    method: 'POST',
    body: JSON.stringify({ message }),
  }),
getChatHistory: (pricingId: string) =>
  request<ChatMessage[]>(`/pricings/${pricingId}/chat-history`),
```

### Pydantic Models for Chat Endpoint

```python
# Add to backend/app/models/pricings.py (or new chat_messages.py)
from pydantic import BaseModel
from datetime import datetime
from uuid import UUID

class ChatRequest(BaseModel):
    message: str

class ChatMessageResponse(BaseModel):
    id: UUID
    pricing_id: UUID
    role: str
    content: str | None = None
    created_at: datetime

class ChatResponse(BaseModel):
    reply: str
    features: list[PricingFeatureResponse]
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Manual tool dispatch with if/elif | `create_react_agent` + `ToolNode` | LangGraph 0.1+ | Automatic loop, error handling, streaming |
| `MemorySaver` import | `InMemorySaver` import | LangGraph 1.x | Same class, different name in some versions — verified: `InMemorySaver` works in installed version 1.2.9 |
| Custom state graph (StateGraph + MessagesState) | `create_react_agent` prebuilt | LangGraph 0.2+ | `create_react_agent` is the standard for ReAct agents; manual StateGraph only needed for custom state schemas |
| Static prompt with no context | System prompt rebuilt per call with current state | Phase 13 | Enables `remove_feature` with correct current IDs |

**Verified import path (in langgraph 1.2.9):**
```python
from langgraph.checkpoint.memory import InMemorySaver   # works
from langgraph.prebuilt import create_react_agent        # works
from langchain_core.tools import tool                    # works
```

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `graph.get_state(config)` with empty thread returns `state.values = {}` (empty dict, not None) | Pattern 7 | History replay might double-add messages if check is wrong — can be fixed by catching exception instead |
| A2 | `create_react_agent` with `checkpointer=_CHECKPOINTER` persists messages across invocations for the same `thread_id` | Pattern 2 | Conversation context would be lost per-call — would need to pass full history manually |
| A3 | The chat panel layout below the feature table (full width) is acceptable UX for MVP | Pitfall 7 | User may prefer a side panel; design is easily changed in a later iteration |
| A4 | `result["messages"][-1].content` contains the final assistant text (not a ToolMessage) | Pattern 2 | Would need to filter `isinstance(msg, AIMessage)` for the last human-visible response |

---

## Open Questions

1. **Approved pricing guard for the chatbot**
   - What we know: Approved pricings have all inputs/buttons disabled in the frontend
   - What's unclear: Should the chatbot be disabled for approved pricings too, or allowed for discussion only (no tool calls)?
   - Recommendation: For MVP, disable the chat input when `isApproved` in the frontend. The backend endpoint can also guard with a 409 if the pricing is approved and a tool call is attempted.

2. **System prompt context length limit**
   - What we know: Feature lists and diagnosis reports can be long; LLM context windows vary by provider
   - What's unclear: What's a safe truncation length for the system prompt?
   - Recommendation: Cap diagnosis reports at 2000 chars, history at 500 chars, features unlimited (they are typically < 50 items). Include a note in the system prompt that context was truncated.

3. **Chat panel position in layout**
   - What we know: Current layout is `flex flex-col lg:flex-row` with two sections (left=params, right=features)
   - What's unclear: Does the chat go below the whole layout or below just the feature table (right side)?
   - Recommendation: Full-width below the existing two-column area. Simpler and works at all screen sizes.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| langgraph | ChatbotService | ✓ | 1.2.9 | — |
| langchain-core | @tool decorator | ✓ | 1.4.9 | — |
| langchain-openai | OpenAI provider | ✓ | 1.3.5 | — |
| langchain-anthropic | Anthropic provider | ✓ | 1.4.8 | — |
| langchain-google-genai | Google provider | ✓ | 4.2.7 | — |
| Supabase `pricing_chat_messages` table | Chat persistence | ✓ | Created in Phase 11 migration | — |

**Missing dependencies with no fallback:** none
**Missing dependencies with fallback:** none

All dependencies are available. No new installations required.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | TypeScript compiler (tsc --noEmit) |
| Config file | frontend/tsconfig.json |
| Quick run command | `cd frontend && npx tsc --noEmit` |
| Full suite command | `cd frontend && npm run build` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PREC-12 | Chat panel renders on pricing screen | manual | UI inspection | ❌ Wave 0 |
| PREC-12 | Chat history loads from pricing_chat_messages | manual | POST + GET chat-history | ❌ Wave 0 |
| PREC-13 | "adiciona funcionalidade X com 20h" → appears in table | manual (E2E) | human checkpoint | ❌ Wave 0 |
| PREC-13 | "remove funcionalidade de deploy" → removed from table | manual (E2E) | human checkpoint | ❌ Wave 0 |
| PREC-14 | Ask "por que esse projeto custa R$25k?" → chatbot explains | manual (E2E) | human checkpoint | ❌ Wave 0 |
| PREC-15 | Tool calls applied atomically + reflected immediately | manual + tsc | `tsc --noEmit` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `cd frontend && npx tsc --noEmit`
- **Per wave merge:** `cd frontend && npm run build`
- **Phase gate:** `npm run build` green + human checkpoint on all 5 success criteria

### Wave 0 Gaps
- [ ] TypeScript compilation baseline: `cd frontend && npx tsc --noEmit` must pass before adding chat files
- [ ] Backend import verification: `python3 -c "from app.services.pricing_chatbot_service import PricingChatbotService"` in venv

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | single-user local deployment |
| V3 Session Management | no | stateless HTTP with pricing_id in URL |
| V4 Access Control | no | no multi-user, no auth layer |
| V5 Input Validation | yes | Pydantic `ChatRequest` validates message field |
| V6 Cryptography | yes (existing) | API key stored in Supabase Vault, decrypted in PricingRepository.decrypt_pricing_api_key |

### Known Threat Patterns for This Stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Prompt injection via user message | Tampering | LangGraph tool schemas are fixed; LLM cannot call tools outside the registered list |
| API key disclosure in LLM context | Information Disclosure | Key stays in memory during request only; never logged or included in system prompt |
| Tool call loop / infinite recursion | Denial of Service | create_react_agent has built-in recursion_limit (default 25 steps); configurable via `create_react_agent(..., recursion_limit=10)` |
| Malformed feature_id in remove/update | Tampering | Tool checks `get_feature(feature_id, pricing_id)` — scoped to pricing_id; cross-pricing mutation impossible |

---

## Sources

### Primary (HIGH confidence)
- Installed package inspection (`pip show`, Python import tests) — verified versions and import paths for langgraph 1.2.9, langchain-core 1.4.9
- Local Python REPL — verified: `create_react_agent`, `InMemorySaver`, `@tool`, closure schema behavior
- Codebase reading — existing `llm_pricing_service.py`, `pricing_repository.py`, `pricings.py` router, `PricingEditorPage.tsx`, `useLLMSuggestions.ts` — all patterns confirmed from actual source files
- Phase 11/12 SUMMARY.md files — locked decisions and known gotchas

### Secondary (MEDIUM confidence)
- WebSearch: LangGraph `create_react_agent` + `MemorySaver` + tool calling — confirms pattern is standard for LangGraph 0.2+/1.x
- GitHub gist (arthrod/f37a66cddc) — `create_react_agent` usage pattern with MemorySaver and thread_id config
- `supabase/migrations/20260719000000_precificador_schema.sql` — confirmed `pricing_chat_messages` table exists with correct columns

### Tertiary (LOW confidence)
- Assumption A1 (`graph.get_state` return value for empty thread) — needs verification during implementation

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all packages installed, all imports verified locally
- Architecture patterns: HIGH — mirrors existing Phase 12 patterns exactly; verified with local Python REPL
- Pitfalls: HIGH — pitfalls 5, 6, 7 are from direct Phase 12 postmortems (TYPE_CHECKING, docstrings, layout)
- Chatbot tool pattern: HIGH — closure schema behavior confirmed by running Python locally

**Research date:** 2026-07-19
**Valid until:** 2026-08-19 (30 days — stable LangGraph API, no expected breaking changes in 1.x)
