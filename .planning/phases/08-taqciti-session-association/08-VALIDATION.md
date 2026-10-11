---
phase: "8"
slug: "taqciti-session-association"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: "2026-10-11"
---

# Phase 8 — Validation Strategy

> Contrato de validação por fase, para amostragem de feedback durante a execução.
> Derivado da seção `## Validation Architecture` do `08-RESEARCH.md`.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest `^3.2.7` (jsdom) em `taqciti/`; pytest `>=8` + pytest-asyncio (`asyncio_mode = auto`) em `backend/` |
| **Config file** | `taqciti/vitest.config.ts` (alias `@` → `src`); `backend/pytest.ini` |
| **Quick run command** | `cd taqciti && npx vitest run <arquivo>` · `cd backend && python -m pytest tests/<arquivo> -x -q` |
| **Full suite command** | `cd taqciti && npm test && npm run typecheck && npm run lint` (baseline: 42 arquivos / 619 testes) · backend: **só** os arquivos puros tocados (padrão `test_webhook_auth.py`) — `test_schema.py` e o fixture `conftest.supabase_client` falam com o Supabase real |
| **Estimated runtime** | ~60 segundos (suíte Taqciti) · ~5 segundos por arquivo puro do backend |

Utilitário existente: `taqciti/src/test/chromeStorageMock.ts` (`installChromeStorageMock`, com `onChanged` real) — usar nos stores novos.

---

## Sampling Rate

- **Após cada commit de task:** o arquivo de teste da task (`npx vitest run <arquivo>` ou `python -m pytest tests/<arquivo> -x -q`)
- **Após cada wave:** `cd taqciti && npm test && npm run typecheck && npm run lint` (+ os testes puros do backend tocados)
- **Antes do `/gsd-verify-work`:** suíte completa da Taqciti verde, typecheck e lint limpos, testes puros do backend verdes, `npm run build`, e o teste manual D-20
- **Latência máxima de feedback:** 60 segundos

---

## Per-Task Verification Map

> Preenchido pelo planejador a partir dos PLAN.md. Mapa de partida (critério → teste), vindo da pesquisa:

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 8-TBD | TBD | TBD | TAQ-02 (SC1) | T-8-03 | Reducer `pending → choosing → linking → linked`; nunca vincula sem escolha explícita | unit | `cd taqciti && npx vitest run src/features/agente/association.test.ts` | ❌ W0 | ⬜ pending |
| 8-TBD | TBD | TBD | TAQ-02 (SC1) | T-8-08 | Picker: busca sem acento/caixa, criar cliente, estados loading/empty/error; nome renderizado como texto | component | `cd taqciti && npx vitest run src/sidepanel/components/ClientPicker.test.tsx` | ❌ W0 | ⬜ pending |
| 8-TBD | TBD | TBD | TAQ-02 (SC1) | T-8-03 | `bind` cria sessão via `ClientDirectory` fake, backfill em ordem | integration | `cd taqciti && npx vitest run src/background/agenteAssociationService.test.ts` | ❌ W0 | ⬜ pending |
| 8-TBD | TBD | TBD | TAQ-02 (SC1) | T-8-01 / T-8-02 | Rotas novas: listagem com campos mínimos; 401 sem chave com gate ligado | unit | `cd backend && python -m pytest tests/test_extension_clients.py -x -q` | ❌ W0 | ⬜ pending |
| 8-TBD | TBD | TBD | TAQ-02 (SC2) | T-8-03 | Reunião `pending`/`deferred` nunca chama `send` | integration | `cd taqciti && npx vitest run src/background/agenteStreamer.test.ts` | ✅ estender | ⬜ pending |
| 8-TBD | TBD | TBD | TAQ-02 (SC2) | T-8-07 | Descartar remove só o local; histórico cheio não evita não enviados | unit/integration | `cd taqciti && npx vitest run src/background/history.test.ts` | ❌ W0 | ⬜ pending |
| 8-TBD | TBD | TBD | TAQ-02 (SC2) | T-8-06 | Upload em blocos: ordem, K por bloco, pausa, progresso | unit | `cd taqciti && npx vitest run src/features/agente/meetingUploader.test.ts` | ❌ W0 | ⬜ pending |
| 8-TBD | TBD | TBD | TAQ-02 (SC3) | T-8-03 | Campo de ID só com lista em erro; sem associação `linked` ⇒ nenhum envio | component | `cd taqciti && npx vitest run src/sidepanel/screens/AgenteConfigScreen.test.tsx` | ✅ estender | ⬜ pending |
| 8-TBD | TBD | TBD | TAQ-02 (SC4) | T-8-04 / T-8-05 | Falha ⇒ outbox persistida, status `offline`; chave não persistida no item | unit | `cd taqciti && npx vitest run src/background/agenteSender.test.ts` | ✅ estender | ⬜ pending |
| 8-TBD | TBD | TBD | TAQ-02 (SC4) | T-8-04 | Reinício do SW rehidrata a outbox e reenvia em ordem com o mesmo `chunkId` | integration | `cd taqciti && npx vitest run src/background/agenteOutbox.test.ts` | ❌ W0 | ⬜ pending |
| 8-TBD | TBD | TBD | TAQ-02 (SC4) | T-8-04 | Webhook: `chunk_id` repetido ⇒ 202 sem `push_chunk` (bloqueado pela decisão 3) | unit | `cd backend && python -m pytest tests/test_webhook_idempotency.py -x -q` | ❌ W0 | ⬜ pending |
| 8-TBD | TBD | TBD | TAQ-02 | T-8-06 | 2 chamadas concorrentes a `get_or_create` ⇒ 1 pipeline | unit async | `cd backend && python -m pytest tests/test_pipeline_get_or_create_lock.py -x -q` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `taqciti/src/features/agente/association.test.ts` — SC1/SC2 (reducer)
- [ ] `taqciti/src/features/agente/meetingUploader.test.ts` — SC2 (blocos/ordem/progresso)
- [ ] `taqciti/src/features/agente/clientSearch.test.ts` — busca sem acento
- [ ] `taqciti/src/shared/config/agenteAssociationStore.test.ts`, `agenteOutboxStore.test.ts`, `agenteDeliveryStore.test.ts` — escritor único, valor inteiro, teto
- [ ] `taqciti/src/background/agenteAssociationService.test.ts`, `agenteOutbox.test.ts` — SC1/SC4
- [ ] `taqciti/src/background/history.test.ts` — evicção protegida
- [ ] `taqciti/src/sidepanel/components/{ClientPicker,AgenteDecisionCard,AgenteBindingBar,AgenteEndPrompt}.test.tsx`, `taqciti/src/shared/ui/ConfirmModal.test.tsx`
- [ ] `backend/tests/test_extension_clients.py`, `test_webhook_idempotency.py`, `test_pipeline_get_or_create_lock.py`
- [ ] Framework: nenhum a instalar.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Fluxo real no Chrome + Meet: (a) envio em blocos ao fim, (b) queda do Agente + reenvio, (c) descarte com confirmação, (d) vínculo no meio da reunião | TAQ-02 (D-20) | Depende de extensão carregada, Google Meet ao vivo e backend no ar | Roteiro D-20 em `08-CONTEXT.md`; registrar em VERIFICATION/UAT |
| Checagens visuais "backstop" do UI-SPEC (cartão em 320/564 px, selo no histórico, modal com título longo, picker em 320 px) | TAQ-02 | Layout real no side panel do Chrome | Abrir o painel nas larguras indicadas e conferir contra `08-UI-SPEC.md` |
| `getBytesInUse` do `storage.local` após reunião longa | TAQ-02 (SC4) | Cota real do Chrome (10 MB sem `unlimitedStorage`) | Medir no DevTools do service worker durante o teste D-20 |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
