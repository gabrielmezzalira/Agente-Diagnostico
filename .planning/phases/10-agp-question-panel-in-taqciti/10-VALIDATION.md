---
phase: "10"
slug: "agp-question-panel-in-taqciti"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: "2026-10-28"
---

# Phase 10 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Fonte: `10-RESEARCH.md` § "Arquitetura de Validação" (comandos executados de verdade em 2026-10-28, Windows 11).

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 3.2.7 (`jsdom`) na Taqciti; pytest no backend (somente leitura nesta fase) |
| **Config file** | `taqciti/vitest.config.ts` (`include: ['src/**/*.test.{ts,tsx}']`, alias `@` → `src`) |
| **Quick run command** | `cd taqciti && npx vitest run <arquivos tocados> && npx tsc --noEmit` |
| **Full suite command** | `cd taqciti && npx vitest run && npx eslint src` |
| **Estimated runtime** | ~110 s (suíte completa); ~30 s (tsc); ~27 s (eslint) |

Comandos auxiliares:

- Fumaça contra o roteador WS real (bash): `cd taqciti && AGP_PYTHON=python AGP_SMOKE_SERVER=scripts/agp-fake-backend.py npx vitest run src/background/agpBackendSmoke.test.ts`
- Fumaça (PowerShell): `$env:AGP_PYTHON='python'; $env:AGP_SMOKE_SERVER='scripts/agp-fake-backend.py'; npx vitest run src/background/agpBackendSmoke.test.ts`
- Build sem sobrescrever o `dist` do usuário: `cd taqciti && npx vite build --outDir <pasta-fora-do-repo> --emptyOutDir`
- No Windows **não existe `python3` real**: usar `python`.

Linha de base (2026-10-28): 97 arquivos, **1513 testes passando**, 3 pulados (fumaça opt-in); tsc e eslint limpos; fumaça 3/3.
Backend: 279 passam, 4 pulados, 1 falha **preexistente e fora do escopo** (`tests/test_schema.py::test_tables_exist`, PGRST205).

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run <arquivos tocados>` + `npx tsc --noEmit`
- **After every plan wave:** Run `npx vitest run` + `npx eslint src` + a fumaça (se a onda tocou `agp*`) + `npx vite build --outDir <scratch>`
- **Before `/gsd-verify-work`:** Full suite must be green (≥ 1513 + os testes novos) **e** o UAT 1-12 executado no Chrome real, com Gemini com crédito para os testes 2 e 3 (D-13)
- **Max feedback latency:** ~120 seconds

---

## Per-Task Verification Map

> Preenchido pelo planejador/executor por task. Mapa por decisão (da pesquisa) como ponto de partida:

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| D-02 | 10-01 | 1 | TAQ-05 (SC4) | — | "Continuar envio" não apaga `finishBy`/`finishTries` enquanto `isClosing` | unit | `cd taqciti && npx vitest run src/background/agenteBindFlow.test.ts` | ✅ estender | ⬜ pending |
| D-03 | 10-02 | 1 | TAQ-05 (SC4) | — | fechar/navegar a 2ª aba da mesma sala não encerra a reunião | unit + fluxo | `cd taqciti && npx vitest run src/background/meetingTabClosed.test.ts src/background/meetingTabNavigated.test.ts src/background/meetingTabClosedFlow.test.ts src/background/meetingTabNavigatedFlow.test.ts src/features/meeting/machine.test.ts src/background/meetingRoomTabs.test.ts` | ❌ W0 (`meetingRoomTabs.test.ts`) | ⬜ pending |
| D-11 | 10-03 | 1 | TAQ-05 (SC1, SC3) | custo de IA | feed só conecta em `recording` + vínculo explícito + `streamingEnabled`; `hold` mantém a lista | unit (tabela) | `cd taqciti && npx vitest run src/features/agente/agpTarget.test.ts src/background/agpQuestionsFeed.test.ts src/shared/config/agpQuestionsStore.test.ts` | ✅ estender | ⬜ pending |
| M-1..M-6 | 10-04 | 2 | TAQ-05 (SC1) | — | N/A | unit (React) | `cd taqciti && npx vitest run src/sidepanel/components/AgpQuestionsPanel.test.tsx src/sidepanel/components/AgpLiveTabs.test.tsx` | ✅ estender | ⬜ pending |
| D-04 | 10-05 | 2 | TAQ-05 (SC4) | privacidade (`tabs`) | `permissions` inclui `tabs`; `<all_urls>` mantido; nenhuma URL de aba logada/gravada | unit (manifesto) | `cd taqciti && npx vitest run src/manifest.test.ts` | ❌ W0 | ⬜ pending |
| D-05 | 10-06 | 3 | TAQ-05 (SC4) | — | N/A (refator puro) | caracterização | `cd taqciti && npx vitest run src/background/index.test.ts` (escrito antes do corte, passa sem edição depois) | ❌ W0 | ⬜ pending |
| D-12 | todos | — | TAQ-05 (SC2) | DoS (reconexão) | backoff, 4004 e "sem relógio local" não regridem | unit + fumaça | testes existentes do feed + fumaça | ✅ | ⬜ pending |
| D-06/D-07 | 10-07 | 3 | — | — | N/A | conferência por texto | `grep -n "SUPERADO" .planning/RETOMAR-AQUI.md .planning/PENDENCIAS-FASE-08.md .planning/PENDENCIAS-FASE-10.md` | doc | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `taqciti/src/background/index.test.ts` — caracterização do `index.ts` **antes** do D-05
- [ ] `taqciti/src/manifest.test.ts` — `tabs` e `<all_urls>` (D-04)
- [ ] `taqciti/src/background/meetingRoomTabs.test.ts` — porta de outras abas da mesma sala (D-03), com `chrome.tabs.query` simulado
- [ ] `10-UAT.md` reescrito de 7 para 12 testes, cada um dizendo COMO fazer

*Nenhum framework a instalar.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Pergunta real com lente chega na aba AGP e expira | TAQ-05 (SC1, SC2) / D-13 | precisa de Chrome + Meet reais e Gemini com crédito | `10-UAT.md` testes 2 e 3 |
| DA-4 dispara ao ir para `chrome://newtab/` | D-04 | comportamento do Chrome (suposições A1/A2 da pesquisa) | `10-UAT.md` teste 10 + saída de `chrome.management.getPermissionWarningsByManifest` |
| Duas abas na mesma sala | D-03 | depende do Meet real ("Participar também") | `10-UAT.md` teste 9 |
| Feed fecha em pausa/envio desligado e mantém a lista; worker dorme >30 s | D-11 | ciclo de vida real do service worker | `10-UAT.md` teste 11 |
| Visual (degraus `compact`/`regular`, faixa fixa, sem rolagem horizontal) | D-14 / UI-SPEC | inspeção visual | `/gsd-ui-review 10` |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 120s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
