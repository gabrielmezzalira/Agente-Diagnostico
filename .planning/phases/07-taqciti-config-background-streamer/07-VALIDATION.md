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
| 7-01-01 | 01 | 1 | TAQ-01 | — | N/A (importação via subtree) | smoke | `git ls-files taqciti/ \| wc -l` | ❌ W0 | ⬜ pending |

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
