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
| 04-01-01 | 01 | 1 | REP-02 | — | checkpoint:decision — aprovar migration one-way (D-36) | manual (gate) | — (checkpoint) | n/a | ⬜ pending |
| 04-01-02 | 01 | 1 | REP-02 | — | Migration aditiva/nullable/sem-default aplicada; repo lê `status` (Pitfall 5) | grep + human-check | `MIG=supabase/migrations/20260923000000_add_status_to_reports.sql; test -f "$MIG" && grep -q "ADD COLUMN IF NOT EXISTS status text" "$MIG" && echo MIGRATION_OK` | ❌ W0 | ⬜ pending |
| 04-01-03 | 01 | 1 | REP-02 | T-04-01 (bypass do gate), T-04-02 (status arbitrário) | Import exige `status == 'Aprovado para build'`; extrai ≥1 feature; vincula `pricings.session_id`; sales (None) passa; PATCH valida Literal | integration (mock LLM) | `cd backend && python -m pytest tests/test_import_from_diagnosis_gate.py -x` | ❌ W0 | ⬜ pending |
| 04-02-01 | 02 | 2 | REP-03 | — | `generate_report(mode="sales")` byte-idêntico ao pré-fase (golden congelado antes de tocar llm.py) | unit (golden) | `cd backend && python -m pytest tests/test_discovery_report.py::test_sales_mode_unchanged -x` | ❌ W0 | ⬜ pending |
| 04-02-02 | 02 | 2 | REP-01 | — | `build_report_generator` = esqueleto PRD 16 seções; sem símbolos comerciais (DISC-03) | unit (import assert) | `cd backend && python -m pytest tests/test_discovery_report.py -x` | ❌ W0 | ⬜ pending |
| 04-02-03 | 02 | 2 | REP-01 | T-04-04 | Duas tabelas por lens (DISCOVERY_AREA_SET); perguntas por lens; marcador de seção vazia; ramo discovery tolera shape lens-less do upload (questions=list[str] + red_flags sem lens → bucket "não classificado", sem AttributeError — contrato com 04-04, D-39) | unit (golden/snapshot + robustez) | `cd backend && python -m pytest tests/test_discovery_report.py -x` | ❌ W0 | ⬜ pending |
| 04-03-01 | 03 | 2 | REP-02 | — | 12 blocos sincronizados nos dois prompts do Precificador + desambiguação (D-32) | grep/unit | `cd backend && python -m pytest tests/ -q` (grep BLOCKS_12_OK) | ✅ existente | ⬜ pending |
| 04-03-02 | 03 | 2 | REP-01 | T-04-05 | readiness_score puro: 4 sinais, score ponderado + limiar, low_signals (D-33/D-34) | unit (pure) | `cd backend && python -m pytest tests/test_readiness_score.py -x` | ❌ W0 | ⬜ pending |
| 04-04-01 | 04 | 3 | REP-01, REP-03 | T-04-07 | upload_pdf propaga `mode`; grant `status='Rascunho'` só discovery; sales inalterado (correção D-39, commit isolado); depende de 04-02 para a crash-safety do discovery branch com shape lens-less | unit | `cd backend && python -m pytest tests/test_upload_pdf_mode.py -x` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `backend/tests/test_import_from_diagnosis_gate.py` (plano 04-01, tracer) — cobre REP-02 (gate de `status` 422/aprovado + extração + `pricings.session_id`; sales None passa)
- [ ] `backend/tests/test_discovery_report.py` (plano 04-02) — cobre REP-03 (golden sales, congelar fixture ANTES de tocar `llm.py`) e REP-01 (esqueleto PRD, duas tabelas por lens, marcador de seção vazia); inclui `test_discovery_tolerates_lensless_upload_shape` (contrato cross-plan com 04-04: discovery branch não estoura com questions=list[str] + red_flags sem lens; itens no bucket "não classificado", D-39)
- [ ] `backend/tests/test_readiness_score.py` (plano 04-03) — cobre readiness (D-33/D-34): sessão vazia (ready=False) vs. coberta (ready=True)
- [ ] `backend/tests/test_upload_pdf_mode.py` (plano 04-04) — cobre a correção D-39 (discovery→PRD/'Rascunho'; sales→sales/None)
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
