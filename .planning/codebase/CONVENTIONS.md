---
last_mapped_commit: dd6d5da918c8145005ced2b3c76ba98fa6d32aa2
last_mapped_at: 2026-09-19
---
# Coding Conventions

<!-- refreshed: 2026-09-19 -->

**Analysis Date:** 2026-09-19

## Naming Patterns

**Files:**

- Python: `snake_case.py` (e.g., `pricing_service.py`, `test_schema.py`)
- TypeScript/JavaScript: `camelCase.ts`, `PascalCase.tsx` for components (e.g., `usePricing.ts`, `SessionActivePage.tsx`, `background.js`)
- Directories: lowercase, underscores for compound names (e.g., `backend/app/`, `frontend/src/pages/`, `extension/`)

**Functions and variables:**

- Python: `snake_case` for functions, methods, variables; `_private_function` prefix for private (repo-level convention, not enforced)
- TypeScript/JavaScript: `camelCase` for functions and variables; `CONST_ALL_CAPS` for constants
- Example patterns:
  - Python: `get_pricing()`, `update_pricing_status()`, `_to_response()`
  - TypeScript: `calculatePricing()`, `usePricing()`, `generateQuestions()`
  - JavaScript (extension): `normalizeUrl()`, `connectWS()`, `loadState()`

**Components and classes:**

- React components: `PascalCase` (e.g., `ProjectFormPage`, `SessionTimer`, `CoveragePanel`)
- Python service classes: `PascalCase` (e.g., `PricingService`, `DiagnosticAgent`)
- Python model classes (Pydantic): `PascalCase` (e.g., `ProjectCreate`, `ProjectResponse`, `PricingWithDetails`)

**Types and enums:**

- TypeScript interfaces: `PascalCase` (e.g., `Project`, `Session`, `PricingFeature`)
- Python type aliases: `snake_case` with `Literal` (e.g., `ProjectType = Literal["bi", "ml", ...]`)
- Exported constants as records/maps: `PascalCase` or `CONSTANT_CASE` for large config maps (e.g., `DMS_META`, `AREA_LABELS`)

## Code Style

**Formatting:**

- **Python:** Follows PEP 8, implicit black formatting (no explicit config file present)
- **TypeScript/React:** ESLint configured (`eslint.config.js`), no explicit prettier config
- **JavaScript (extension):** Direct DOM manipulation, inline styling patterns

**Line length:** 

- Python: implicit ~88-100 character limit
- TypeScript: no strict limit observed; files show flexibility
- Comments span full logical width with dashes for section markers

**Indentation:** 

- 2 spaces (TypeScript/JavaScript files)
- 4 spaces (Python files)

**Linting:**

**Python:**

- No formal linter config file present; code follows PEP 8 conventions
- Type hints encouraged (seen throughout `backend/app/`)
- Docstrings use Google-style format (triple quotes with Args/Returns sections)

**TypeScript/JavaScript:**

- ESLint with:
  - `@eslint/js` recommended
  - `typescript-eslint` for TS rules
  - `eslint-plugin-react-hooks` for React hook rules
  - `eslint-plugin-react-refresh` for Fast Refresh compatibility
- Config: `frontend/eslint.config.js` (flat config format)
- No prettier config; teams rely on ESLint for formatting
- Run linting with: `npm run lint`

## Import Organization

**Python order:**

1. Standard library imports (`datetime`, `uuid`, `logging`, etc.)
2. Third-party imports (`fastapi`, `pydantic`, `supabase`, `google.genai`, etc.)
3. Local imports (`from app.models import`, `from app.services import`, etc.)
4. Blank line between groups

**TypeScript/React order:**

1. React / Next imports (`import React, { useState } from 'react'`)
2. Third-party UI/routing (`lucide-react`, `react-router-dom`, etc.)
3. Third-party utilities (`react-markdown`, etc.)
4. Local types/APIs (`from '../lib/api'`, `from '../types'`)
5. Local components/hooks (`from '../pages/`, `from '../components/'`)
6. Blank line before component/function definition

**Path aliases:**

- TypeScript: No path aliases configured in `tsconfig.json`; uses relative paths (`../lib/api`)
- Python: No path aliases; relative imports within `app/` directory with absolute `from app.X import`

## Error Handling

**Python (FastAPI/Supabase):**

- Raise `HTTPException` with explicit status codes and detail messages
  ```python
  if not project:
      raise HTTPException(status_code=404, detail="Project not found")
  if pricing.get("status") == "approved":
      raise HTTPException(status_code=409, detail="Cannot modify an approved pricing")
  ```
- Services layer handles validation; routers catch and may re-raise
- Pydantic validators use `ValueError` for schema-level failures
- Database cleanup in fixtures uses silent fallback: `except Exception: pass  # best-effort`
- Global exception handler in `main.py` logs unhandled exceptions and returns generic 500 with CORS headers preserved

**TypeScript/React:**

- Try/catch with explicit type checks
  ```typescript
  catch (e) {
    setError(e instanceof Error ? e.message : 'Default error message')
  }
  ```
- API fetch function (`api.ts`) throws `Error` with `.detail` from server or HTTP status fallback
- Component state includes explicit error/loading states (`error: string | null`, `loading: boolean`)
- Silent catch for non-critical operations (e.g., extension popup rendering, optimistic DOM updates)

**JavaScript (extension):**

- Try/catch with silent failures for robustness
  ```javascript
  try { ws.close() } catch {}
  ```
- No centralized error reporting; failures logged implicitly through absence of visual feedback
- Graceful degradation (reconnection after timeout on WS errors)

## Comments

**When to comment:**

- Section dividers in code: `# -----------...` or `// -----------...` (80-character dashes for visual separation)
- File headers explaining responsibility and design (required in Python files, optional in TS)
- Complex logic or business rule explanations (e.g., CORS middleware placement in `main.py`)
- Why, not what: "This prevents circular imports" rather than "Import X first"

**JSDoc/TSDoc:**

**Python (docstrings):**

- Google-style format in triple quotes
- Include Args, Returns, and Raises where applicable
- Example from `DiagnosticAgent.start()`:
  ```python
  def start(self, project_description: str) -> str:
      """Inicia a entrevista com a descrição do projeto.
      
      [longer explanation of design decisions]
      
      Args:
          project_description: descrição livre do projeto fornecida pelo comercial.
      
      Returns:
          Primeira pergunta gerada pelo agente.
      """
  ```

**TypeScript:**

- TSDoc format (/** ... */) for exported functions/components
- Example from hooks: parameter types and return types inline with `: Type`
- Comments over JSDoc for brevity in internal functions

**React components:**

- Props documented in TypeScript interfaces or inline
- No TSDoc required for components that receive props (types are self-documenting)

## Function Design

**Size guideline:** 

- Aim for <50 lines for readability
- Longer functions (e.g., services handling multiple operations) acceptable if single responsibility is clear
- CLAUDE.md mandates: "If a file is getting large (>200 lines), it's a sign it's doing too much"

**Parameters:**

- Explicit type hints required in Python (`def func(x: str, y: int) -> None`)
- TypeScript function signatures with explicit parameter and return types
- Avoid long parameter lists; consider object parameters if >3 args
- Example: `SessionCreate` model in `api.ts` consolidates multiple optional fields

**Return values:**

- Single return type per function (no union types unless explicitly typed as `T | None`)
- `None` for side-effect-only functions; explicit `dict | None` for lookups
- React hooks return object destructuring for multiple state values: `{ pricing, features, outputs, loading, error, refresh }`

## Module Design

**Exports:**

**Python:**

- Service classes are primary exports from `services/` modules
- Repositories and models are exports from their modules
- Private functions/classes use `_` prefix but are not explicitly hidden
- `__all__` not used; relies on naming convention

**TypeScript/React:**

- Default exports for page components (e.g., `export default function ProjectFormPage()`)
- Named exports for utilities, hooks, types (e.g., `export function usePricing()`, `export interface Project`)
- API client exports namespace object: `const api = { projects: {...}, sessions: {...} }`

**Barrel files:**

- Python: `routers/__init__.py` imports all routers for inclusion in main app
  ```python
  from app.routers import (
      projects_router,
      sessions_router,
      ...
  )
  ```
- React: `lib/api.ts` is central export point for all API types and client functions
- Extension: No barrel pattern; files are independent (background.js, popup.js, content_*.js)

## Code Organization Patterns

**Python backend (SOLID-aligned):**

| Layer | Example Files | Responsibility |
|-------|--------------|-----------------|
| **routers** | `projects.py`, `sessions.py` | HTTP validation + status codes; delegates to services |
| **services** | `pricing_service.py` | Business logic, orchestrates repos + external clients |
| **repositories** | `pricing_repository.py` | Data access only (db.table() calls) |
| **models** | `projects.py` | Pydantic schemas (Create, Update, Response) |
| **core** | `llm_factory.py`, `pricing_calculator.py` | Pure business logic or config |

- No linter enforces this, but CLAUDE.md mandates strict SOLID adherence
- Services receive dependencies via constructor injection
- Routers call services, never repositories directly

**TypeScript/React (feature-based):**

| Folder | Example Files | Responsibility |
|--------|--------------|-----------------|
| **pages** | `ProjectFormPage.tsx`, `SessionActivePage.tsx` | Top-level layout composition; no business logic |
| **components** | `CoveragePanel`, `SessionTimer` | Reusable UI; accepts props, no direct API calls |
| **hooks** | `usePricing.ts`, `usePricingChat.ts` | State + side effects (API calls, lifecycle) |
| **lib** | `api.ts`, `pricingCalculator.ts`, `useSessionWS.ts` | Pure utilities, API client, WebSocket hook |

- Pages compose components and hooks
- Components receive data via props; no `useState` for async operations
- Hooks handle async state; pages initialize hooks

## Architectural Decisions

**Dependency Injection:**

- Python services receive their dependencies (repo, LLM client) via constructor
- React hooks receive parameters (e.g., `pricingId`) and manage their own fetch lifecycle
- Extension's `background.js` maintains module-level `state` object shared via Chrome storage and message passing

**Error boundaries:**

- No explicit React Error Boundary found; errors are caught in hook `try/catch`
- Python uses global exception handler in FastAPI middleware

**Testing integration:**

- Tests in `backend/tests/` use `conftest.py` fixtures for singleton `supabase_client`
- Monkeypatching used to inject fake database (no database hit on unit tests)
- No test files found in `frontend/` or `extension/` (test coverage gap noted)

---

*Convention analysis: 2026-09-19*
