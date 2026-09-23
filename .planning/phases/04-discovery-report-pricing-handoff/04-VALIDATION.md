---
phase: "04"
slug: "discovery-report-pricing-handoff"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: "2026-09-22"
---

# Phase 04 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Semente derivada de `04-RESEARCH.md` §"Validation Architecture". O planner preenche o
> Per-Task Verification Map ao criar os PLAN.md.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | pytest + pytest-asyncio (já em uso em `backend/tests/`) |
| **Config file** | mesmo setup das Fases 1-3 (`backend/pytest.ini` ou equivalente) |
| **Quick run command** | `cd backend && python -m pytest tests/test_discovery_report.py tests/test_import_from_diagnosis_gate.py -x` |
| **Full suite command** | `cd backend && python -m pytest tests/ -q` |
| **Estimated runtime** | ~30 seconds (suíte completa backend) |

---

## Sampling Rate

- **After every task commit:** `cd backend && python -m pytest tests/test_discovery_report.py tests/test_import_from_diagnosis_gate.py -x`
- **After every plan wave:** `cd backend && python -m pytest tests/ -q`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

> Preenchido pelo planner ao criar os PLAN.md (uma linha por task com `<automated>` verify).

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 04-01-01 | 01 | 1 | REP-01 | — | Relatório discovery = esqueleto PRD, tabelas Produto/Dados, `[a preencher no PRD]` quando sem insumo | unit (golden/snapshot) | `cd backend && python -m pytest tests/test_discovery_report.py -x` | ❌ W0 | ⬜ pending |
| 04-0x-0x | 0x | x | REP-02 | T-04-01 (bypass do gate) | Import exige `status == 'Aprovado para build'`; extrai ≥1 feature; vincula `pricings.session_id` | integration (mock LLM) | `cd backend && python -m pytest tests/test_import_from_diagnosis_gate.py -x` | ❌ W0 | ⬜ pending |
| 04-0x-0x | 0x | x | REP-03 | — | `generate_report(mode="sales")` byte-idêntico ao pré-fase | unit (golden) | `cd backend && python -m pytest tests/test_discovery_report.py::test_sales_mode_unchanged -x` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `backend/tests/test_discovery_report.py` — cobre REP-01 (esqueleto PRD, duas tabelas por lens, `[a preencher no PRD]`) e REP-03 (golden sales, congelar fixture ANTES de tocar `llm.py`)
- [ ] `backend/tests/test_import_from_diagnosis_gate.py` — cobre REP-02 (gate de `status` + extração + `pricings.session_id` + transição de status via novo endpoint D-38)
- [ ] Nenhuma nova fixture de framework necessária — `pytest`/`pytest-asyncio`/`monkeypatch` já cobrem tudo.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Fidelidade visual/semântica do relatório PRD gerado por um LLM real | REP-01 | Saída de LLM não é determinística; golden testa estrutura, não a prosa gerada | Rodar uma sessão discovery real, gerar o relatório e conferir que as 16 seções aparecem na ordem do PRD com o mapeamento de lens correto |

*Golden test do REP-03 valida byte-identidade da saída sales via monkeypatch de `llm._call` (determinístico).*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
