---
phase: "6"
slug: "opt-in-webhook-auth"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: validated
nyquist_compliant: true
wave_0_complete: true
created: "2026-09-24"
---

# Phase 6 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | pytest 8.x + pytest-asyncio (`asyncio_mode = auto`) |
| **Config file** | `backend/pytest.ini` |
| **Quick run command** | `cd backend && python -m pytest tests/test_webhook_auth.py -x` |
| **Full suite command** | `cd backend && python -m pytest tests/ -x` |
| **Estimated runtime** | ~5 seconds (quick) / existing suite runtime (full) |

No test framework/runner exists for `extension/` (plain unbundled JS, no `package.json`, no
`*.test.js`). The three extension-side changes (`background.js`, `popup.html`, `popup.js`) are
manual-only this phase.

---

## Sampling Rate

- **After every task commit:** Run `cd backend && python -m pytest tests/test_webhook_auth.py -x`
- **After every plan wave:** Run `cd backend && python -m pytest tests/ -x`
- **Before `/gsd-verify-work`:** Full suite must be green; manual extension check (DevTools Network
  tab, unpacked-extension reload) recorded as part of UAT since no automated JS harness exists.
- **Max feedback latency:** ~10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 06-01-01 | 01 | 1 | TAQ-03 (SC1) | Fail-open-by-design (V4) | Unset `EXTENSION_SHARED_KEY` → route accepts exactly as today | unit | `pytest tests/test_webhook_auth.py::test_verify_extension_key_noop_when_unset -x` | ✅ W1 | ✅ green |
| 06-01-02 | 01 | 1 | TAQ-03 (SC2) | Timing attack (V6) / Spoofing (V4) | Set + missing/wrong header → 401, `secrets.compare_digest` used | unit | `pytest tests/test_webhook_auth.py::test_verify_extension_key_rejects_missing_header_when_set -x`; `::test_verify_extension_key_rejects_wrong_value_when_set -x` | ✅ W1 | ✅ green |
| 06-01-03 | 01 | 1 | TAQ-03 (SC3) | Access Control (V4) | Set + correct header → accepted, processed normally | unit | `pytest tests/test_webhook_auth.py::test_verify_extension_key_accepts_correct_value_when_set -x` | ✅ W1 | ✅ green |
| 06-01-04 | 01 | 1 | TAQ-03 (D-01) | Route-scoped, not router-scoped | `/webhook/recall` untouched — gate applies only to `/webhook/extension` | unit/manual read | grep confirms no `Depends(verify_extension_key)` on `recall_webhook` | ✅ existing file | ✅ green |
| 06-0X (extension) | 01 | 1 | TAQ-03 (D-02) | Secret storage (chrome.storage.local, not .sync) | Popup key field saves/loads via `chrome.storage.local`; header sent only when key is set | manual-only | Load unpacked extension, fill/clear key field, inspect DevTools Network tab on `POST /webhook/extension` | n/a — manual | ⬜ pending (UAT) |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [x] `backend/tests/test_webhook_auth.py` — new file, 4 tests for TAQ-03 (all 3 success criteria);
      written first (TDD RED), then made GREEN by Task 1.
- [x] No fixture/conftest changes needed — `monkeypatch` is a built-in pytest fixture.
- [x] No framework install needed — pytest/pytest-asyncio already installed and configured.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Extension popup key field persists via `chrome.storage.local` and `background.js` conditionally sends `x-agente-key` | TAQ-03 (D-02) | No JS test harness in `extension/` (no `package.json`, no test runner) | Load the unpacked extension in Chrome (`chrome://extensions` → Load unpacked), fill the new key field and save, open DevTools → Network on a real `POST /webhook/extension` call and confirm the `x-agente-key` header is present with the saved value; clear the field, repeat, confirm the header is absent. |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 10s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** validated (2026-09-24)

---

## Validation Audit 2026-09-24

| Metric | Count |
|--------|-------|
| Gaps found | 0 |
| Resolved | 0 |
| Escalated | 0 |

All 4 automated tests in `backend/tests/test_webhook_auth.py` exist exactly as named in the
Per-Task Verification Map and pass individually (`test_verify_extension_key_noop_when_unset`,
`test_verify_extension_key_rejects_missing_header_when_set`,
`test_verify_extension_key_rejects_wrong_value_when_set`,
`test_verify_extension_key_accepts_correct_value_when_set`). The D-01 route-scoping grep
(06-01-04) confirms `Depends(verify_extension_key)` appears exactly once, exclusively on
`extension_webhook`. The extension row (06-0X) remains manual-only by design (no JS test
harness in `extension/`) — pending human UAT per `<human-check>` in 06-01-PLAN.md Task 2.
