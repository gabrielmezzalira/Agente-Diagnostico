---
phase: "3"
slug: "two-agent-questions-lens-tagging"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: "2026-09-21"
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | pytest 7.x + pytest-asyncio (backend); Vitest/tsc (frontend, not touched this phase) |
| **Config file** | backend/pytest.ini (existing) |
| **Quick run command** | `cd backend && python -m pytest tests/test_two_agent_lens.py -q` |
| **Full suite command** | `cd backend && python -m pytest -q` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd backend && python -m pytest tests/test_two_agent_lens.py -q`
- **After every plan wave:** Run `cd backend && python -m pytest -q`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 3-01-01 | 01 | 1 | LENS-01, LENS-03 | — | N/A | unit | `cd backend && python -m pytest tests/test_two_agent_lens.py -q` | ❌ W0 | ⬜ pending |
| 3-01-02 | 01 | 1 | LENS-05 | — | N/A | unit | `cd backend && python -m pytest tests/test_two_agent_lens.py -q` | ❌ W0 | ⬜ pending |
| 3-02-01 | 02 | 2 | LENS-02 | — | N/A | unit | `cd backend && python -m pytest tests/test_two_agent_lens.py -q` | ❌ W0 | ⬜ pending |
| 3-03-01 | 03 | 2 | LENS-04 | — | N/A | unit | `cd backend && python -m pytest tests/test_two_agent_lens.py -q` | ❌ W0 | ⬜ pending |
| 3-xx-99 | — | — | (regressão sales D-24) | — | saída sales byte-idêntica | golden | `cd backend && python -m pytest tests/test_coverage_areas_golden.py -q` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

*Table is a seed — the planner refines Task IDs / plan-wave mapping to match the final PLAN.md set.*

---

## Wave 0 Requirements

- [ ] `backend/tests/test_two_agent_lens.py` — stubs for LENS-01..LENS-05 (SC#1/#2/#3/#5 assertions + sales regression D-24)
- [ ] Reuse existing `backend/tests/conftest.py` fixtures (no new fixture infra expected)

*Existing infrastructure (pytest + pytest-asyncio) covers all phase requirements; only new test file(s) required.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Emissão de `lens` no payload WebSocket ao vivo | LENS-03, LENS-04 | Requer sessão discovery real com transcript; automatizável via unit no dataclass `__dict__`, mas o fluxo WS ponta-a-ponta é manual | Abrir sessão discovery, disparar geração, inspecionar frames `question_new`/`red_flag`/`coverage_update` carregando `lens` |

*A maior parte das validações tem cobertura automática por unit; só o fluxo WS ao vivo é manual.*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
