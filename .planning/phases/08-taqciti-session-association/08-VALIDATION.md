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

> Preenchido pelo planejador a partir dos PLAN.md (21 planos, 8 waves). Tasks de checkpoint (decisões B1–B5 e D-11,
> migração humana) não têm comando automático e não aparecem aqui. O status é atualizado pelo plano 08-21.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 08-01-T1 | 08-01 | 1 | TAQ-02 (SC3) | T-08-01 / T-08-02 | Sem associação `linked` nada sai (mesmo com ID na config); `linked` de qualquer origem = destino; chave nunca persistida | e2e | `cd taqciti && npx vitest run src/background/agenteStreamerAssociation.test.ts` | ❌ W0 | ⬜ pending |
| 08-01-T2 | 08-01 | 1 | TAQ-02 (SC2) | T-08-03 | `pending` idempotente; fim sem escolha → `ended-unsent`; boot nunca deixa estado preso | unit/integration | `cd taqciti && npx vitest run src/features/agente/association.test.ts src/background/agenteAssociationLifecycle.test.ts` | ❌ W0 | ⬜ pending |
| 08-02-T1 | 08-02 | 1 | TAQ-02 (SC2) | T-08-04 | `ConfirmModal.cancelLabel`; Esc/fundo = cancelar | component | `cd taqciti && npx vitest run src/shared/ui/ConfirmModal.test.tsx` | ❌ W0 | ⬜ pending |
| 08-02-T2 | 08-02 | 1 | TAQ-02 (SC1) | — | Bolha "!" e cartão; Esc contido; sem foco roubado | component | `cd taqciti && npx vitest run src/sidepanel/components/AgenteNudge.test.tsx src/sidepanel/components/AgenteDecisionCard.test.tsx` | ❌ W0 | ⬜ pending |
| 08-03-T1 | 08-03 | 1 | TAQ-02 (SC1) | — | Busca sem acento/caixa; duplicidade | unit | `cd taqciti && npx vitest run src/features/agente/clientSearch.test.ts` | ❌ W0 | ⬜ pending |
| 08-03-T2/T3 | 08-03 | 1 | TAQ-02 (SC1/SC3) | T-08-05 / T-08-06 | Seletor em 2 passos; estados; plano B só com lista em erro; nome como texto; UUID validado | component | `cd taqciti && npx vitest run src/sidepanel/components/ClientPicker.test.tsx` | ❌ W0 | ⬜ pending |
| 08-04-T1/T2 | 08-04 | 1 | TAQ-02 (SC2/SC4) | T-08-07 | Barra (offline com contagem), fim da reunião, selo; sem "Continuar envio" antes da B3 | component | `cd taqciti && npx vitest run src/sidepanel/components/AgenteBindingBar.test.tsx src/sidepanel/components/AgenteEndPrompt.test.tsx src/sidepanel/components/AssociationBadge.test.tsx` | ❌ W0 | ⬜ pending |
| 08-05-T1/T2 | 08-05 | 1 | TAQ-02 (SC2) | T-08-08 | Envio em partes serial, blocos de 20, pausa 1 s, progresso por índice, retomada | unit | `cd taqciti && npx vitest run src/features/agente/meetingUploader.test.ts src/features/agente/meetingUploadRunner.test.ts` | ❌ W0 | ⬜ pending |
| 08-06-T1 | 08-06 | 1 | TAQ-02 | T-08-09 | 2 chamadas concorrentes a `get_or_create` ⇒ 1 pipeline | unit async | `cd backend && python -m pytest tests/test_pipeline_get_or_create_lock.py -x -q` | ❌ W0 | ⬜ pending |
| 08-06-T2 | 08-06 | 1 | TAQ-02 (SC4) | — | Suposição A1: `chunk_id` extra aceito | unit | `cd backend && python -m pytest tests/test_extension_chunk_extra_fields.py -x -q` | ❌ W0 | ⬜ pending |
| 08-07-T2/T3 | 08-07 | 1 | TAQ-02 (SC1) | T-08-10 / T-08-11 / T-08-12 | Listagem mínima; sessão nova; 404; gate 401 (B1) | unit | `cd backend && python -m pytest tests/test_extension_clients.py -x -q` | ❌ W0 | ⬜ pending |
| 08-08-T2 | 08-08 | 1 | TAQ-02 (SC1) | T-08-13 / T-08-14 | Projeto sem chave Gemini não toca o Vault (B2) | unit | `cd backend && python -m pytest tests/test_projects.py -x -q` | ✅ estender | ⬜ pending |
| 08-08-T3 | 08-08 | 1 | TAQ-02 (SC1) | — | Formulário sem chave obrigatória (B2) | build | `npm --prefix frontend run build` | ✅ | ⬜ pending |
| 08-09-T2 | 08-09 | 2 | TAQ-02 (SC4) | T-08-15 / T-08-16 | `chunk_id` repetido ⇒ 202 sem `push_chunk` (B3) | unit | `cd backend && python -m pytest tests/test_webhook_idempotency.py -x -q` | ❌ W0 | ⬜ pending |
| 08-10-T1 | 08-10 | 2 | TAQ-02 (SC1) | T-08-17 | Comandos zod; lista indisponível → plano B | unit | `cd taqciti && npx vitest run src/background/agenteAssociationService.test.ts` | ❌ W0 | ⬜ pending |
| 08-10-T2/T3 | 08-10 | 2 | TAQ-02 (SC1/SC2) | T-08-18 / T-08-19 | Vínculo ao vivo com backfill e semente; 1 sessão por reunião; envio da reunião encerrada | integration | `cd taqciti && npx vitest run src/background/agenteBindFlow.test.ts` | ❌ W0 | ⬜ pending |
| 08-11-T1 | 08-11 | 2 | TAQ-02 (SC4) | T-08-20 / T-08-22 | Fila durável sem segredo, teto com overflow | unit | `cd taqciti && npx vitest run src/features/agente/outbox.test.ts src/shared/config/agenteOutboxStore.test.ts` | ❌ W0 | ⬜ pending |
| 08-11-T2 | 08-11 | 2 | TAQ-02 (SC4) | T-08-21 | Sem "descarta o mais antigo"; política de reenvio | unit | `cd taqciti && npx vitest run src/background/agenteSender.test.ts` | ✅ estender | ⬜ pending |
| 08-11-T3 | 08-11 | 2 | TAQ-02 (SC4) | T-08-20 / T-08-21 | Queda, reinício do SW e reenvio em ordem | e2e | `cd taqciti && npx vitest run src/background/agenteOutbox.test.ts` | ❌ W0 | ⬜ pending |
| 08-12-T1 | 08-12 | 3 | TAQ-02 (SC1) | T-08-23 | Criar cliente só com nome; 409 duplicado (B1/B2/B4-a) | unit | `cd backend && python -m pytest tests/test_extension_clients.py -x -q` | ❌ W0 | ⬜ pending |
| 08-12-T2/T3 | 08-12 | 3 | TAQ-02 (SC1/SC3) | T-08-24 / T-08-25 | Portas HTTP com gate, URL validada, resposta validada; produção usa as rotas | integration | `cd taqciti && npx vitest run src/background/httpAgentePorts.test.ts src/background/agenteAssociationHttp.test.ts` | ❌ W0 | ⬜ pending |
| 08-13-T1 | 08-13 | 4 | TAQ-02 (SC2) | T-08-27 | Histórico cheio nunca remove reunião não enviada | unit/integration | `cd taqciti && npx vitest run src/background/history.test.ts` | ❌ W0 | ⬜ pending |
| 08-13-T3 | 08-13 | 4 | TAQ-02 (SC2) | T-08-26 | Descartar só `ended-unsent` fora do ar, só local | unit | `cd taqciti && npx vitest run src/background/agenteAssociationService.test.ts` | ❌ W0 | ⬜ pending |
| 08-14-T1 | 08-14 | 3 | TAQ-02 (SC1/SC4) | T-08-28 | Tradução associação/entrega → visão | unit | `cd taqciti && npx vitest run src/features/agente/bindingView.test.ts` | ❌ W0 | ⬜ pending |
| 08-14-T2 | 08-14 | 3 | TAQ-02 (SC1/SC2) | T-08-29 | Cartão ↔ seletor ↔ barra; minimizar = Depois | component | `cd taqciti && npx vitest run src/sidepanel/components/AgenteLiveSlot.test.tsx` | ❌ W0 | ⬜ pending |
| 08-15-T2 | 08-15 | 4 | TAQ-02 | T-08-30 / T-08-31 | Finish só de sessão extension ativa + stop_session (B4-b) | unit | `cd backend && python -m pytest tests/test_extension_clients.py tests/test_finish_stops_pipeline.py -x -q` | ✅ estender | ⬜ pending |
| 08-16-T1 | 08-16 | 5 | TAQ-02 | T-08-32 | Encerramento 10 min após o fim, fila vazia, nunca manual-id (B4-b) | unit | `cd taqciti && npx vitest run src/background/agenteSessionFinisher.test.ts` | ❌ W0 | ⬜ pending |
| 08-17-T1/T2 | 08-17 | 5 | TAQ-02 (SC2) | T-08-34 / T-08-35 | Selo no histórico; enviar/descartar com confirmação | component | `cd taqciti && npx vitest run src/sidepanel/components/AssociationBadgeFor.test.tsx src/sidepanel/components/AgenteEndSlot.test.tsx` | ❌ W0 | ⬜ pending |
| 08-18-T2 | 08-18 | 4 | TAQ-02 (SC3) | T-08-36 | Campo de ID só no plano B; nunca destino silencioso (B5) | component | `cd taqciti && npx vitest run src/sidepanel/screens/AgenteConfigScreenPlanB.test.tsx src/sidepanel/screens/AgenteConfigScreen.test.tsx` | ✅ estender | ⬜ pending |
| 08-19-T1/T2 | 08-19 | 6 | TAQ-02 (SC4) | T-08-37 / T-08-38 | `chunk_id` estável; reenvio automático ligado (B3) | unit/e2e | `cd taqciti && npx vitest run src/shared/config/agenteConfig.test.ts src/background/agenteSender.test.ts src/background/agenteOutbox.test.ts` | ✅ estender | ⬜ pending |
| 08-20-T1/T3 | 08-20 | 7 | TAQ-02 (SC2) | T-08-39 | "Continuar envio" do índice confirmado (B3) | unit/component | `cd taqciti && npx vitest run src/background/agenteBindFlow.test.ts src/sidepanel/components/AgenteEndSlot.test.tsx` | ✅ estender | ⬜ pending |
| 08-21-T1 | 08-21 | 8 | TAQ-02 | T-08-40 / T-08-SC | Portão completo; manifestos de pacote sem diff | suite | `cd taqciti && npm test && npm run typecheck && npm run lint && npm run build` | ✅ | ⬜ pending |

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
