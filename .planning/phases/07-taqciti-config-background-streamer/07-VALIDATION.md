---
phase: "7"
slug: "taqciti-config-background-streamer"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: "2026-09-25"
---

# Phase 7 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest `^3.2.7` (jsdom) na Taqciti; pytest no backend (intocado nesta fase) |
| **Config file** | `taqciti/vitest.config.ts` (existe após a importação via subtree; `npm ci` em `taqciti/` é pré-requisito) |
| **Quick run command** | `cd taqciti && npx vitest run src/background/agenteStreamer.test.ts` |
| **Full suite command** | `cd taqciti && npm test && npm run typecheck` (+ `cd backend && python -m pytest tests/ -x -q`) |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd taqciti && npx vitest run src/background/agenteStreamer.test.ts`
- **After every plan wave:** Run `cd taqciti && npm test && npm run typecheck`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 7-01-01 | 01 | 1 | TAQ-01 | T-07-01, T-07-02 | Importação pinada no SHA c41309a, merge isolado só sob taqciti/, histórico sem segredo | smoke | `git ls-files taqciti \| wc -l` (284) + `git rev-list --count HEAD^2` (105) | ❌ W0 | ⬜ pending |
| 7-01-02 | 01 | 1 | TAQ-01 | T-07-03..T-07-06 | Só delta enviado; desligado por padrão; header condicional; envio não bloqueia o flush | e2e (Vitest) | `cd taqciti && npx vitest run src/background/agenteStreamer.test.ts` | ❌ W0 | ⬜ pending |
| 7-01-03 | 01 | 1 | TAQ-01 | T-07-06, T-07-07 | Bordas do delta (vazio, codificação, idempotência, captionId reaproveitado, reunião nova) e da config | unit | `cd taqciti && npx vitest run src/features/agente/wordDelta.test.ts src/shared/config/agenteConfig.test.ts` | ❌ W0 | ⬜ pending |
| 7-02-01 | 02 | 2 | TAQ-01 | T-07-08, T-07-09 | Config normalizada, patch serializado, chave só em storage local | unit | `cd taqciti && npx vitest run src/shared/config/agenteConfigStore.test.ts` | ❌ W0 | ⬜ pending |
| 7-02-02 | 02 | 2 | TAQ-01 | T-07-10, T-07-11 | Config salva liga o streaming; religar sem backfill; reinício sem reenvio | e2e (Vitest) | `cd taqciti && npx vitest run src/background/agenteStreamer.test.ts` | ❌ W0 | ⬜ pending |
| 7-03-01 | 03 | 3 | TAQ-01 | T-07-13 | Rota `?view=agente` vence a fase | unit | `cd taqciti && npx vitest run src/sidepanel/route.test.ts` | ✅ (estendido) | ⬜ pending |
| 7-03-02 | 03 | 3 | TAQ-01 | T-07-12, T-07-14, T-07-15 | Chave mascarada, sem session_id adivinhado, manifesto/painel injetado intocados | component + suíte | `cd taqciti && npx vitest run src/sidepanel/screens/AgenteConfigScreen.test.tsx` + `cd taqciti && npm run typecheck && npm run lint && npm test && npm run build` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

*O planner/checker completa esta tabela a partir das tasks de cada PLAN.md.*

---

## Wave 0 Requirements

- [ ] `taqciti/` importado via `git subtree add` (sem `--squash`) — pré-requisito de qualquer arquivo da Taqciti existir neste repo
- [ ] `npm ci` dentro de `taqciti/` — `node_modules` ausente hoje
- [ ] `taqciti/src/background/agenteStreamer.test.ts` — cobre TAQ-01 (diff por segmento, gate on/off, header condicional, reset de sessão)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Streaming ao vivo durante uma chamada real do Google Meet chega em `/webhook/extension` | TAQ-01 (SC1) | Exige Meet real + extensão carregada no Chrome + backend rodando | Carregar `taqciti/dist` no Chrome, ligar o toggle, colar `session_id` de uma sessão ativa, falar numa chamada de teste e confirmar linhas novas em `transcript_chunks` / tela de monitoramento |
| Fluxo em lote `POST /api/generate` não regride | TAQ-01 (SC2) | Não há teste automatizado para `generateDocument.ts` hoje | Encerrar uma reunião de teste com o streaming desligado, clicar em "Gerar Documento" e confirmar que o documento é gerado como antes |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
