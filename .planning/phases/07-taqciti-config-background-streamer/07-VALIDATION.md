---
phase: "7"
slug: "taqciti-config-background-streamer"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: validated
nyquist_compliant: true
wave_0_complete: true
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
| 7-01-01 | 01 | 1 | TAQ-01 | T-07-01, T-07-02 | Importação pinada no SHA c41309a, merge isolado só sob taqciti/, histórico sem segredo | smoke | `git rev-list --count HEAD^2` (105, no merge 9a26937) + diff contra o 1º pai só sob taqciti/ (0 fora) | ✅ | ✅ green |
| 7-01-02 | 01 | 1 | TAQ-01 | T-07-03..T-07-06 | Só delta enviado; desligado por padrão; header condicional; envio não bloqueia o flush | e2e (Vitest) | `cd taqciti && npx vitest run src/background/agenteStreamer.test.ts` (10/10, inclui os 4 casos do plano 02) | ✅ | ✅ green |
| 7-01-03 | 01 | 1 | TAQ-01 | T-07-06, T-07-07 | Bordas do delta (vazio, codificação, idempotência, captionId reaproveitado, reunião nova) e da config | unit | `cd taqciti && npx vitest run src/features/agente/wordDelta.test.ts src/shared/config/agenteConfig.test.ts` | ✅ | ✅ green |
| 7-02-01 | 02 | 2 | TAQ-01 | T-07-08, T-07-09 | Config normalizada, patch serializado, chave só em storage local | unit | `cd taqciti && npx vitest run src/shared/config/agenteConfigStore.test.ts` (11/11) | ✅ | ✅ green |
| 7-02-02 | 02 | 2 | TAQ-01 | T-07-10, T-07-11 | Config salva liga o streaming; religar sem backfill; reinício sem reenvio | e2e (Vitest) | `cd taqciti && npx vitest run src/background/agenteStreamer.test.ts` | ✅ | ✅ green |
| 7-03-01 | 03 | 3 | TAQ-01 | T-07-13 | Rota `?view=agente` vence a fase | unit | `cd taqciti && npx vitest run src/sidepanel/route.test.ts` | ✅ (estendido) | ✅ green |
| 7-03-02 | 03 | 3 | TAQ-01 | T-07-12, T-07-14, T-07-15 | Chave mascarada, sem session_id adivinhado, manifesto/painel injetado intocados | component + suíte | `cd taqciti && npx vitest run src/sidepanel/screens/AgenteConfigScreen.test.tsx` (6/6) + `cd taqciti && npm run typecheck && npm run lint && npm test && npm run build` (33 arquivos, 439 testes) | ✅ | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

*O planner/checker completa esta tabela a partir das tasks de cada PLAN.md.*

---

## Wave 0 Requirements

- [x] `taqciti/` importado via `git subtree add` (sem `--squash`) — merge commit `9a26937`, 105 commits, trailer `git-subtree-split: c41309a1c58f3fa06095db877e6dc8f1dbd65635`
- [x] `npm ci` dentro de `taqciti/` — `node_modules` instalado e ignorado pelo git
- [x] `taqciti/src/background/agenteStreamer.test.ts` — cobre TAQ-01 (diff por segmento, gate on/off, header condicional, reset de sessão) — 10/10 verde

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Streaming ao vivo durante uma chamada real do Google Meet chega em `/webhook/extension` | TAQ-01 (SC1) | Exige Meet real + extensão carregada no Chrome + backend rodando | Carregar `taqciti/dist` no Chrome, ligar o toggle, colar `session_id` de uma sessão ativa, falar numa chamada de teste e confirmar linhas novas em `transcript_chunks` / tela de monitoramento |
| Fluxo em lote `POST /api/generate` não regride | TAQ-01 (SC2) | Não há teste automatizado para `generateDocument.ts` hoje | Encerrar uma reunião de teste com o streaming desligado, clicar em "Gerar Documento" e confirmar que o documento é gerado como antes |

---

## Validation Audit 2026-09-26

| Metric | Count |
|--------|-------|
| Gaps found | 0 |
| Resolved | 0 |
| Escalated | 0 |

All 7 per-task automated commands were re-run directly against the post-execution codebase and confirmed green (subtree merge stats, `agenteStreamer.test.ts` 10/10, `wordDelta.test.ts`+`agenteConfig.test.ts`, `agenteConfigStore.test.ts` 11/11, `route.test.ts`, `AgenteConfigScreen.test.tsx` 6/6, full taqciti CI battery). No auditor subagent was needed since no gap existed to fill.

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 60s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** Nyquist-compliant — all requirements have automated verification. The 2 Manual-Only items (SC1 real Meet call, SC2 Gerar Documento) are correctly out of scope for automated coverage and remain pending for `/gsd-verify-work`, per the Manual-Only table above.
