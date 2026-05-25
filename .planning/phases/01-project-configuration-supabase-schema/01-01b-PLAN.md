---
phase: "01-project-configuration-supabase-schema"
plan: "01b"
type: execute
wave: 1
depends_on: []
files_modified:
  - frontend/index.html
  - frontend/package.json
  - frontend/tsconfig.json
  - frontend/vite.config.ts
  - frontend/src/main.tsx
  - frontend/src/App.tsx
  - frontend/src/index.css
autonomous: true
requirements:
  - PROJ-05

must_haves:
  truths:
    - "Frontend starts with `npm run dev` and opens at localhost:5173 with the Agente Diagnóstico topbar"
    - "Tailwind v4 design tokens are defined in @theme and generate usable utility classes"
    - "`npm run build` exits 0 — TypeScript compiles, Tailwind processes"
  artifacts:
    - path: "frontend/src/index.css"
      provides: "Tailwind v4 @theme design tokens"
      contains: "--color-accent: #22a267"
    - path: "frontend/vite.config.ts"
      provides: "Vite config with Tailwind plugin and /api proxy"
      contains: "proxy"
    - path: "frontend/src/App.tsx"
      provides: "React Router routing skeleton with 4 routes"
      contains: "BrowserRouter"
  key_links:
    - from: "frontend/vite.config.ts"
      to: "http://localhost:8000"
      via: "Vite proxy /api/* rewrite"
      pattern: "proxy.*api.*localhost:8000"
---

<objective>
Scaffold the frontend directory: Vite + React 19 + TypeScript + Tailwind v4 with @theme tokens and React Router routing skeleton.

Purpose: Runs in parallel with 01-01a (backend scaffold). Both are Wave 1 and touch completely separate directories (/frontend/ vs /backend/ and /supabase/). Plan 02 and Plan 03 both depend on this plan being complete.

Output:
- /frontend/ bootstrapped with Vite + React 19 + TypeScript + Tailwind v4 @theme tokens
- React Router routing skeleton with 4 placeholder page routes
- `npm run build` exits 0
</objective>

<execution_context>
@/Users/gabrielmezzalira/Documents/Faculdade/CIti/DataInsight/Agente Diagnotico/.planning/phases/01-project-configuration-supabase-schema/01-RESEARCH.md
@/Users/gabrielmezzalira/Documents/Faculdade/CIti/DataInsight/Agente Diagnotico/.planning/phases/01-project-configuration-supabase-schema/01-UI-SPEC.md
</execution_context>

<context>
@/Users/gabrielmezzalira/Documents/Faculdade/CIti/DataInsight/Agente Diagnotico/.planning/ROADMAP.md
@/Users/gabrielmezzalira/Documents/Faculdade/CIti/DataInsight/Agente Diagnotico/.planning/phases/01-project-configuration-supabase-schema/01-CONTEXT.md

<interfaces>
<!-- Key patterns from RESEARCH.md for executor reference -->

From RESEARCH.md Pattern 2 (Tailwind v4 @theme):
```css
/* frontend/src/index.css */
@import "tailwindcss";
@theme {
  --color-accent: #22a267;
  --color-bg-page: #f5f4f0;
  /* ... all tokens ... */
}
```
CRITICAL: The UI-SPEC shows a tailwind.config.ts table — translate every token to CSS variables in @theme block. Do NOT create tailwind.config.ts.

From RESEARCH.md Pattern 3 (Vite proxy):
```typescript
// vite.config.ts
server: {
  proxy: {
    '/api': {
      target: 'http://localhost:8000',
      changeOrigin: true,
      rewrite: (path) => path.replace(/^\/api/, ''),
    },
  },
}
```

From RESEARCH.md Pattern 4 (React Router v7):
```tsx
// main.tsx
import { BrowserRouter } from 'react-router-dom'
ReactDOM.createRoot(document.getElementById('root')!).render(
  <BrowserRouter><App /></BrowserRouter>
)
```
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Frontend scaffold — Vite + React 19 + TypeScript + Tailwind v4 @theme tokens + routing skeleton</name>
  <files>
    frontend/index.html,
    frontend/package.json,
    frontend/tsconfig.json,
    frontend/vite.config.ts,
    frontend/src/main.tsx,
    frontend/src/App.tsx,
    frontend/src/index.css
  </files>
  <read_first>
    - /Users/gabrielmezzalira/Documents/Faculdade/CIti/DataInsight/Agente Diagnotico/.planning/phases/01-project-configuration-supabase-schema/01-UI-SPEC.md (Tailwind Config Contract section — ALL tokens; Design System section — fonts, colors; Navigation Routes section)
    - /Users/gabrielmezzalira/Documents/Faculdade/CIti/DataInsight/Agente Diagnotico/.planning/phases/01-project-configuration-supabase-schema/01-RESEARCH.md (Pattern 2: Tailwind v4 @theme, Pattern 3: Vite proxy, Pattern 4: React Router v7, Pitfall 1: tailwind.config.ts vs @theme)
    - /Users/gabrielmezzalira/Documents/Faculdade/CIti/DataInsight/Agente Diagnotico/.planning/phases/01-project-configuration-supabase-schema/01-CONTEXT.md (Design System section — light theme colors, typography, layout tokens)
  </read_first>
  <action>
    Scaffold the frontend. Run these commands first to initialize:
    ```bash
    cd /path/to/project
    npm create vite@latest frontend -- --template react-ts
    cd frontend
    npm install react-router-dom @supabase/supabase-js lucide-react
    npm install -D tailwindcss @tailwindcss/vite
    npm install -D vitest @testing-library/react @testing-library/user-event @testing-library/jest-dom
    ```

    Then overwrite these files with the correct content:

    frontend/vite.config.ts:
    - Import: `import { defineConfig } from 'vite'`, `import react from '@vitejs/plugin-react'`, `import tailwindcss from '@tailwindcss/vite'`
    - plugins: [react(), tailwindcss()]
    - server.proxy: `/api` → `{ target: 'http://localhost:8000', changeOrigin: true, rewrite: (path) => path.replace(/^\/api/, '') }`
    - NO tailwind.config.ts — Tailwind v4 uses the plugin only

    frontend/src/index.css:
    - First line: `@import "tailwindcss";`
    - Google Fonts @import: `@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500&family=DM+Mono:wght@400;500&display=swap');`
    - @theme block with ALL color tokens from UI-SPEC Tailwind Config Contract section. Map each tailwind.config.ts color key to a `--color-{name}: {hex}` CSS variable:
      - --color-bg-page: #f5f4f0
      - --color-surface: #ffffff
      - --color-border-std: #e8e6e0
      - --color-border-hover: #cccccc
      - --color-text-primary: #1a1a1a
      - --color-text-secondary: #888888
      - --color-accent: #22a267
      - --color-accent-hover: #1a8a56
      - --color-green-bg-light: #f0faf5
      - --color-green-bg-tag: #edfaf3
      - --color-border-green: #a8dfc2
      - --color-red: #d43a3a
      - --color-yellow: #e8a020
      - --color-red-bg: #fff5f5
      - --color-yellow-bg: #fff8f0
      - --color-border-red: #f0b8b8
      - --color-border-yellow: #f0d8b0
      - --color-muted: #f0ede6
    - @theme font families:
      - --font-sans: 'DM Sans', sans-serif
      - --font-mono: 'DM Mono', monospace
    - @theme structural sizes:
      - --height-topbar: 52px
      - --height-budget-bar: 36px
      - --height-btn: 34px
    - @theme border-radius:
      - --radius-card: 10px
      - --radius-panel: 8px
      - --radius-input: 7px
      - --radius-tag: 4px
      - --radius-pill: 99px
      - --radius-btn: 7px
    - Base styles after @theme: `body { font-family: var(--font-sans); background-color: #f5f4f0; color: #1a1a1a; }`

    frontend/src/main.tsx:
    - Import React, ReactDOM, BrowserRouter from 'react-router-dom', App, './index.css'
    - ReactDOM.createRoot(document.getElementById('root')!).render(<BrowserRouter><App /></BrowserRouter>)

    frontend/src/App.tsx:
    - Import Routes, Route from 'react-router-dom'
    - Import placeholder pages: HomePage, ProjectFormPage, ProjectDetailPage (create these as empty TSX shells in src/pages/ — Plan 03 fills them)
    - Routes: / → HomePage, /projects/new → ProjectFormPage, /projects/:id/edit → ProjectFormPage, /projects/:id → ProjectDetailPage
    - Each placeholder page returns a minimal div with the page name as text — enough to verify routing works

    Create src/pages/HomePage.tsx, src/pages/ProjectFormPage.tsx, src/pages/ProjectDetailPage.tsx as minimal shells (just return a div with page name — Plan 03 replaces them completely).

    Do NOT create tailwind.config.ts. The @tailwindcss/vite plugin handles all configuration — @theme in index.css is the design system.
  </action>
  <verify>
    <automated>cd /Users/gabrielmezzalira/Documents/Faculdade/CIti/DataInsight/Agente\ Diagnotico/frontend && npm run build 2>&1 | tail -5</automated>
  </verify>
  <acceptance_criteria>
    - frontend/vite.config.ts contains `tailwindcss()` in plugins array and `/api` proxy with rewrite function
    - frontend/src/index.css starts with `@import "tailwindcss"` and contains `@theme {` block with `--color-accent: #22a267`
    - frontend/src/index.css does NOT contain tailwind.config.ts references
    - frontend/src/App.tsx contains all 4 routes: `/`, `/projects/new`, `/projects/:id/edit`, `/projects/:id`
    - `npm run build` exits 0 (TypeScript compiles, Tailwind processes)
    - No `tailwind.config.ts` file exists in the frontend/ directory
    - frontend/package.json lists react, react-dom at ^19.x, react-router-dom, lucide-react, tailwindcss, @tailwindcss/vite
  </acceptance_criteria>
  <done>Frontend scaffold is running. Tailwind v4 @theme tokens are defined. React Router routes are wired to placeholder pages. npm run build succeeds.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| browser → Vite dev server | Frontend code and assets served locally; no secrets in frontend build |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-01b-supabase-browser | Information Disclosure | frontend .env files | mitigate | No SUPABASE_KEY (service role) is added to any frontend .env file. The anon key (VITE_SUPABASE_ANON_KEY) is not needed in Phase 1 scaffold — placeholder file only. |
| T-01b-tailwind-config | Tampering | frontend/tailwind.config.ts | accept | No tailwind.config.ts created — Tailwind v4 @theme in CSS only. No attack surface. |
| T-01-SC | Tampering | npm install | mitigate | All packages verified in RESEARCH.md Package Legitimacy Audit (all Approved). No [ASSUMED] or [SUS] packages. |
</threat_model>

<verification>
After Task 1 completes:

1. Frontend builds: `cd frontend && npm run build` → exit 0
2. Frontend dev server: `npm run dev` → localhost:5173 serves the React app
3. Verify no tailwind.config.ts: `test ! -f frontend/tailwind.config.ts && echo "no config.ts — correct"`
4. Verify @theme tokens: `grep -c "color-accent" frontend/src/index.css` → at least 1
5. Verify proxy config: `grep -c "localhost:8000" frontend/vite.config.ts` → 1
</verification>

<success_criteria>
- Frontend builds and serves; routing skeleton responds at all 4 routes
- Tailwind v4 @theme design tokens are defined — no hardcoded hex values in components
- `npm run build` exits 0
- No tailwind.config.ts created
</success_criteria>

<output>
Create `.planning/phases/01-project-configuration-supabase-schema/01-01b-SUMMARY.md` when done.
</output>
