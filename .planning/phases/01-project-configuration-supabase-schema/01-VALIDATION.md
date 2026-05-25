---
phase: 1
slug: project-configuration-supabase-schema
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-24
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Backend framework** | pytest 9.0.3 |
| **Frontend framework** | vitest (install in Wave 0) |
| **Backend config** | `backend/pytest.ini` — Wave 0 creates |
| **Frontend config** | `frontend/vitest.config.ts` — Wave 0 creates |
| **Backend quick run** | `pytest backend/tests/ -x -q` |
| **Frontend quick run** | `cd frontend && npm run test -- --run` |
| **Full suite command** | `pytest backend/tests/ && cd frontend && npm run test -- --run` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `pytest backend/tests/ -x -q`
- **After every plan wave:** Run `pytest backend/tests/ && cd frontend && npm run test -- --run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 01-schema | schema | 1 | PROJ-05 | — | N/A | smoke | `pytest backend/tests/test_schema.py::test_tables_exist -x` | ❌ W0 | ⬜ pending |
| 01-create | api | 2 | PROJ-01 | T-01-vault | Vault UUID in projects; plaintext never stored | integration | `pytest backend/tests/test_projects.py::test_create_project -x` | ❌ W0 | ⬜ pending |
| 01-edit | api | 2 | PROJ-02 | — | N/A | integration | `pytest backend/tests/test_projects.py::test_edit_project -x` | ❌ W0 | ⬜ pending |
| 01-badge | api | 2 | PROJ-03 | — | N/A | integration | `pytest backend/tests/test_projects.py::test_active_session_badge -x` | ❌ W0 | ⬜ pending |
| 01-mask | api | 2 | PROJ-04 | T-01-key | has_api_key bool; no gemini key in response | unit | `pytest backend/tests/test_projects.py::test_api_key_not_exposed -x` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `backend/tests/__init__.py` — test package init
- [ ] `backend/tests/conftest.py` — Supabase client fixture + test project cleanup
- [ ] `backend/tests/test_projects.py` — stubs for PROJ-01 through PROJ-04
- [ ] `backend/tests/test_schema.py` — stub for PROJ-05 (table existence check)
- [ ] `backend/pytest.ini` — test discovery config
- [ ] `frontend/vitest.config.ts` — vitest setup
- [ ] Frontend dev dependencies: `npm install -D vitest @testing-library/react @testing-library/user-event`

---

## Security Threat Map

| Threat ID | Description | STRIDE | Mitigation | Tested By |
|-----------|-------------|--------|------------|-----------|
| T-01-vault | Gemini API key exposed in GET /projects response | Information Disclosure | `has_api_key: bool` in ProjectResponse; never SELECT from `vault.decrypted_secrets` in public endpoints | test_api_key_not_exposed |
| T-01-key | SUPABASE_KEY exposed to browser | Information Disclosure | All Supabase access is server-side (FastAPI); frontend never holds the service key | manual review |
| T-01-sql | SQL injection via project fields | Tampering | supabase-py uses parameterized queries via PostgREST | integration tests |
| T-01-cors | Cross-origin requests bypassing API layer | Tampering | Vite proxy in dev; FastAPI CORS middleware in prod | manual smoke |
