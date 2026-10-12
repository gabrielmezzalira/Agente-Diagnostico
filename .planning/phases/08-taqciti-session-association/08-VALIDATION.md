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
| **Estimated runtime** | Medido em 2026-10-11: suíte Taqciti ~33 s (`npm test`), `npm run typecheck` ~6 s, `npx eslint <arquivos>` ~6 s, um `npx vitest run <arquivos>` ~14 s, `npm run build` ~8 s · ~5 segundos por arquivo puro do backend |

Utilitário existente: `taqciti/src/test/chromeStorageMock.ts` (`installChromeStorageMock`, com `onChanged` real) — usar nos stores novos.

---

## Sampling Rate

- **Após cada commit de task (`<verify>` da task):** só os arquivos de teste da task num único `npx vitest run <arquivos>` (ou `python -m pytest tests/<arquivo> -x -q`) + `npm run typecheck` + `npx eslint` dos arquivos tocados (ou `npm run build` em task de manifesto/fiação de UI). Nunca `npm test` inteiro nem `npm run lint` inteiro por task.
- **Após cada plano (seção `<verification>`, "Portão do plano") e cada wave:** `cd taqciti && npm test && npm run typecheck && npm run lint` (+ `npm run build` nos planos de UI/manifesto, + os testes puros do backend tocados)
- **Antes do `/gsd-verify-work` (plano 08-21, Task 1 — portão da fase):** suíte completa da Taqciti verde, typecheck e lint limpos, testes puros do backend verdes, `npm run build`
- **Durante o `/gsd-verify-work`:** o teste manual D-20 (ver "Manual-Only Verifications")
- **Latência máxima de feedback por task:** 30 segundos (exceto o portão da fase no 08-21, que é a suíte completa por definição)

---

## Per-Task Verification Map

> Preenchido pelo planejador a partir dos PLAN.md (27 planos, 11 waves — revisão de 2026-10-12 da decisão B4-b: encerrar
> na hora (fila vazia) e em 5 min com envio parado; o 08-15 ganhou a Task 3 (corrida do stop_session), o 08-16 virou o
> alicerce do encerramento e o 08-27 o agendador; nasceram o 08-24 (reentrada na mesma sala = reunião nova), o 08-26
> (aba fechada = fim da reunião) e o 08-25 (fiação e gatilhos); os critérios "10 min" dos antigos 08-16-T2/T3 foram
> substituídos e o 08-19 foi para a onda 4 (sem dependência do 08-16). Revisão de 2026-10-11: o ciclo de vida da
> associação saiu do 08-01 para o 08-22 e o sender/fiação da fila saíram do 08-11 para o 08-23; revisão 2: a regra de
> retirada por HTTP 500 virou o item B3-b do checkpoint do 08-09, o 08-11 ganhou a Task 3 — rastro de falas descartadas
> na tela "Agente Diagnóstico" — e o 08-23 grava o rastro). Tasks de checkpoint
> (decisões B1–B5 e D-11, migração humana) não têm comando automático e não aparecem aqui. O status é atualizado pelo
> plano 08-21. A coluna "Automated Command" mostra o teste da task; todo `<verify>` também roda `npm run typecheck`.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 08-01-T1 | 08-01 | 1 | TAQ-02 (SC3) | T-08-01 / T-08-02 | Sem associação `linked` nada sai (mesmo com ID na config); `linked` de qualquer origem = destino; CR-01 não bloqueia associação; semente `{}` válida; resto enviado após fim durante o vínculo; chave nunca persistida | e2e | `cd taqciti && npx vitest run src/background/agenteStreamerAssociation.test.ts src/background/agenteStreamer.test.ts` | ❌ W0 | ⬜ pending |
| 08-01-T2 | 08-01 | 1 | TAQ-02 (SC2) | T-08-01 / T-08-03 | Reducer completo (fim/retomada/conclusão por estado); store sem perder escrita concorrente | unit | `cd taqciti && npx vitest run src/features/agente/association.test.ts src/shared/config/agenteAssociationStore.test.ts` | ❌ W0 | ⬜ pending |
| 08-02-T1 | 08-02 | 1 | TAQ-02 (SC2) | T-08-04 | `ConfirmModal.cancelLabel`; Esc/fundo = cancelar | component | `cd taqciti && npx vitest run src/shared/ui/ConfirmModal.test.tsx` | ❌ W0 | ⬜ pending |
| 08-02-T2 | 08-02 | 1 | TAQ-02 (SC1) | — | Bolha "!" e cartão; Esc contido; sem foco roubado | component | `cd taqciti && npx vitest run src/sidepanel/components/AgenteNudge.test.tsx src/sidepanel/components/AgenteDecisionCard.test.tsx` | ❌ W0 | ⬜ pending |
| 08-03-T1 | 08-03 | 1 | TAQ-02 (SC1) | — | Busca sem acento/caixa; duplicidade | unit | `cd taqciti && npx vitest run src/features/agente/clientSearch.test.ts` | ❌ W0 | ⬜ pending |
| 08-03-T2/T3 | 08-03 | 1 | TAQ-02 (SC1/SC3) | T-08-05 / T-08-06 | Seletor em 2 passos; estados; plano B só com lista em erro; nome como texto; UUID validado | component | `cd taqciti && npx vitest run src/sidepanel/components/ClientPicker.test.tsx` | ❌ W0 | ⬜ pending |
| 08-04-T1/T2 | 08-04 | 1 | TAQ-02 (SC2/SC4) | T-08-07 | Barra (offline com contagem), fim da reunião, selo; sem "Continuar envio" antes da B3 | component | `cd taqciti && npx vitest run src/sidepanel/components/AgenteBindingBar.test.tsx src/sidepanel/components/AgenteEndPrompt.test.tsx src/sidepanel/components/AssociationBadge.test.tsx` | ❌ W0 | ⬜ pending |
| 08-05-T1/T2 | 08-05 | 1 | TAQ-02 (SC2) | T-08-08 | Envio em partes serial, blocos de 20, pausa 1 s, progresso por índice, retomada | unit | `cd taqciti && npx vitest run src/features/agente/meetingUploader.test.ts src/features/agente/meetingUploadRunner.test.ts` | ❌ W0 | ⬜ pending |
| 08-06-T1 | 08-06 | 1 | TAQ-02 | T-08-09 | 2 chamadas concorrentes a `get_or_create` ⇒ 1 pipeline | unit async | `cd backend && python -m pytest tests/test_pipeline_get_or_create_lock.py -x -q` | ❌ W0 | ⬜ pending |
| 08-06-T2 | 08-06 | 1 | TAQ-02 (SC4) | — | Suposição A1: `chunk_id` extra aceito | unit | `cd backend && python -m pytest tests/test_extension_chunk_extra_fields.py -x -q` | ❌ W0 | ⬜ pending |
| 08-07-T2/T3 | 08-07 | 1 | TAQ-02 (SC1) | T-08-10 / T-08-11 / T-08-12 | Listagem mínima; sessão nova; 404; gate 401 (B1) | unit | `cd backend && python -m pytest tests/test_extension_clients.py -x -q` | ❌ W0 | ⬜ pending |
| 08-08-T2 | 08-08 | 1 | TAQ-02 (SC1) | T-08-13 / T-08-14 | Projeto sem chave Gemini não toca o Vault (B2); importação de PDF segue a resposta `pdf-fallback` | unit | `cd backend && python -m pytest tests/test_projects.py tests/test_upload_pdf_mode.py -x -q` | ✅ estender | ⬜ pending |
| 08-08-T3 | 08-08 | 1 | TAQ-02 (SC1) | — | Formulário sem chave obrigatória (B2) | build | `npm --prefix frontend run build` | ✅ | ⬜ pending |
| 08-09-T2 | 08-09 | 2 | TAQ-02 (SC4) | T-08-15 / T-08-16 | `chunk_id` repetido ⇒ 202 sem `push_chunk` (B3) | unit | `cd backend && python -m pytest tests/test_webhook_idempotency.py -x -q` | ❌ W0 | ⬜ pending |
| 08-10-T1 | 08-10 | 2 | TAQ-02 (SC1) | T-08-17 | Comandos zod; lista indisponível → plano B | unit | `cd taqciti && npx vitest run src/background/agenteAssociationService.test.ts` | ❌ W0 | ⬜ pending |
| 08-10-T2/T3 | 08-10 | 2 | TAQ-02 (SC1/SC2) | T-08-18 / T-08-19 | Vínculo ao vivo com backfill e semente; 1 sessão por reunião; `onLinked` após `link-completed`; fim durante o vínculo → `ended-unsent`; envio da reunião encerrada; eventos seguem o estado (sala retomada) | integration | `cd taqciti && npx vitest run src/background/agenteBindFlow.test.ts src/background/agenteAssociationService.test.ts` | ❌ W0 | ⬜ pending |
| 08-11-T1 | 08-11 | 2 | TAQ-02 (SC4) | T-08-20 / T-08-22 | Fila durável sem segredo, teto com overflow | unit | `cd taqciti && npx vitest run src/features/agente/outbox.test.ts src/shared/config/agenteOutboxStore.test.ts` | ❌ W0 | ⬜ pending |
| 08-11-T2 | 08-11 | 2 | TAQ-02 (SC4) | T-08-20 / T-08-44 | Status de entrega em `storage.local`; reporter só grava quando muda; rastro de falas descartadas em chave própria que o status "ok" não apaga | unit | `cd taqciti && npx vitest run src/shared/config/agenteDeliveryStore.test.ts src/background/agenteStatusReporter.test.ts` | ❌ W0 | ⬜ pending |
| 08-11-T3 | 08-11 | 2 | TAQ-02 (SC4) | T-08-44 | Tela "Agente Diagnóstico" mostra o rastro junto do status; sem rastro, texto da Fase 7 intacto | unit + component | `cd taqciti && npx vitest run src/shared/config/agenteStatus.test.ts src/sidepanel/screens/AgenteConfigScreenDropTrace.test.tsx src/sidepanel/screens/AgenteConfigScreen.test.tsx` | ❌ W0 | ⬜ pending |
| 08-23-T1 | 08-23 | 3 | TAQ-02 (SC4) | — | Refactor da API do sender sem mudança de comportamento (mesmas asserções; fila em memória recortada para `agenteSendQueue.ts`) | unit | `cd taqciti && npx vitest run src/background/agenteSender.test.ts src/background/agenteStreamer.test.ts src/background/agenteStreamerAssociation.test.ts` | ✅ estender | ⬜ pending |
| 08-23-T2 | 08-23 | 3 | TAQ-02 (SC4) | T-08-21 / T-08-43 / T-08-46 | Sem "descarta o mais antigo"; política de reenvio; retirada por 500 só conforme a B3-b (valor de produção fixado por teste); toda saída sem entrega não pedida pela pessoa avisa o rastro (falha ao gravar a fila = overflow); request null e cancelAll fora do rastro; dispose não limpa a porta | unit | `cd taqciti && npx vitest run src/background/agenteSender.test.ts` | ✅ estender | ⬜ pending |
| 08-23-T3 | 08-23 | 3 | TAQ-02 (SC4) | T-08-45 / T-08-21 / T-08-46 | Queda, reinício do SW e reenvio em ordem (a fila durável sobrevive ao `configureAgenteStreamer` pós-reinício); rastro de fala descartada sobrevive ao próximo "ok" e ao reinício; reinício com o envio desligado/config não pronta não manda nada (fila limpa, rastro sem incremento — D-09 da Fase 7 no `resume`) | e2e | `cd taqciti && npx vitest run src/background/agenteOutbox.test.ts src/background/agenteStreamer.test.ts src/background/agenteStreamerAssociation.test.ts` | ❌ W0 | ⬜ pending |
| 08-22-T1/T2 | 08-22 | 3 | TAQ-02 (SC2) | T-08-41 / T-08-42 | `pending` idempotente; fim sem escolha → `ended-unsent`; retomada da mesma sala por estado; boot nunca deixa estado preso | integration | `cd taqciti && npx vitest run src/background/agenteAssociationLifecycle.test.ts` | ❌ W0 | ⬜ pending |
| 08-12-T1 | 08-12 | 3 | TAQ-02 (SC1) | T-08-23 | Criar cliente só com nome; 409 duplicado (B1/B2/B4-a) | unit | `cd backend && python -m pytest tests/test_extension_clients.py -x -q` | ❌ W0 | ⬜ pending |
| 08-12-T2/T3 | 08-12 | 3 | TAQ-02 (SC1/SC3) | T-08-24 / T-08-25 | Portas HTTP com gate, URL validada, resposta validada, nome da sessão cortado em 200; produção usa as rotas | integration | `cd taqciti && npx vitest run src/background/httpAgentePorts.test.ts src/background/agenteAssociationHttp.test.ts` | ❌ W0 | ⬜ pending |
| 08-13-T1 | 08-13 | 4 | TAQ-02 (SC2) | T-08-27 | Histórico cheio nunca remove reunião não enviada | unit/integration | `cd taqciti && npx vitest run src/background/history.test.ts` | ❌ W0 | ⬜ pending |
| 08-13-T3 | 08-13 | 4 | TAQ-02 (SC2) | T-08-26 | Descartar só `ended-unsent` fora do ar, só local | unit | `cd taqciti && npx vitest run src/background/agenteAssociationService.test.ts` | ❌ W0 | ⬜ pending |
| 08-14-T1 | 08-14 | 3 | TAQ-02 (SC1/SC4) | T-08-28 | Tradução associação/entrega → visão (inclui sala retomada) | unit | `cd taqciti && npx vitest run src/features/agente/bindingView.test.ts` | ❌ W0 | ⬜ pending |
| 08-14-T2 | 08-14 | 3 | TAQ-02 (SC1/SC2) | T-08-29 | Cartão ↔ seletor ↔ barra; minimizar = Depois | component | `cd taqciti && npx vitest run src/sidepanel/components/AgenteLiveSlot.test.tsx` | ❌ W0 | ⬜ pending |
| 08-14-T3 | 08-14 | 3 | TAQ-02 (SC1) | T-08-29 | Bolha só em `pending`; cabeçalho manda `open`, cápsula decorativa; fiação compila | component + build | `cd taqciti && npx vitest run src/sidepanel/components/AgenteNudgeAnchor.test.tsx src/sidepanel/components/AgenteLiveSlot.test.tsx` | ❌ W0 | ⬜ pending |
| 08-15-T2 | 08-15 | 4 | TAQ-02 | T-08-30 / T-08-31 | Finish idempotente só de sessão extension (404/409; chamada repetida devolve 200 e chama stop_session); parador de pipeline injetado (B4-b) | unit | `cd backend && python -m pytest tests/test_extension_clients.py tests/test_finish_stops_pipeline.py -x -q` | ✅ estender | ⬜ pending |
| 08-15-T3 | 08-15 | 4 | TAQ-02 | T-08-31 / T-08-47 | `stop_session` espera a criação do pipeline em andamento: finish durante a criação não deixa pipeline órfão | unit async | `cd backend && python -m pytest tests/test_pipeline_get_or_create_lock.py tests/test_finish_stops_pipeline.py -x -q` | ✅ estender | ⬜ pending |
| 08-16-T1 | 08-16 | 5 | TAQ-02 | T-08-32 / T-08-49 | Tempos da B4-b fixados por teste (5 min, 30 s, 10 s, backoff de 11 tentativas) | unit | `cd taqciti && npx vitest run src/features/agente/finishPolicy.test.ts` | ❌ W0 | ⬜ pending |
| 08-16-T2 | 08-16 | 5 | TAQ-02 | T-08-32 / T-08-49 | A associação guarda `sessionFinished`, `finishBy` (só o primeiro prazo), `finishTries` e `finishGaveUp`; `carryIdentity` e lista branca os preservam; elegibilidade exclui manual-id, encerrada e desistida | unit | `cd taqciti && npx vitest run src/features/agente/associationClose.test.ts src/shared/config/agenteAssociationStore.test.ts` | ❌ W0 | ⬜ pending |
| 08-16-T3 | 08-16 | 5 | TAQ-02 | T-08-48 / T-08-49 | Porta HTTP do finish com erro tipado: repete rede/5xx, não repete 401/4xx, 404/409 = nada a encerrar; id validado | unit | `cd taqciti && npx vitest run src/background/httpAgentePorts.test.ts` | ❌ W0 | ⬜ pending |
| 08-27-T1 | 08-27 | 6 | TAQ-02 (SC4) | T-08-32 | Kick dedicado do envio alcança a fila em qualquer estado da reunião, respeitando o portão `canDrain` | unit | `cd taqciti && npx vitest run src/background/agenteStreamerKick.test.ts src/background/agenteOutbox.test.ts` | ❌ W0 | ⬜ pending |
| 08-27-T2 | 08-27 | 6 | TAQ-02 | T-08-32 / T-08-49 | Agendador: encerra na hora com a fila vazia; espera a última fala; prazo de 5 min; backoff limitado; desistência sem laço (nem no boot); nunca com a reunião ao vivo | unit | `cd taqciti && npx vitest run src/background/agenteSessionFinisherDrain.test.ts src/background/agenteSessionFinisherInstance.test.ts` | ❌ W0 | ⬜ pending |
| 08-27-T3 | 08-27 | 6 | TAQ-02 | T-08-54 | Composição de produção com falha segura (sem `isMeetingLive` configurado ninguém é encerrado) | unit | `cd taqciti && npx vitest run src/background/agenteSessionFinisher.test.ts` | ❌ W0 | ⬜ pending |
| 08-24-T1 | 08-24 | 7 | TAQ-02 | T-08-50 | Sessão encerrada + sala de volta → `pending` limpo em qualquer estado com sessão; volta antes do encerramento cancela o prazo; boot (B4-b) | unit + integration | `cd taqciti && npx vitest run src/features/agente/associationMeeting.test.ts src/features/agente/association.test.ts src/background/agenteAssociationLifecycle.test.ts` | ❌ W0 | ⬜ pending |
| 08-24-T3 | 08-24 | 7 | TAQ-02 | T-08-50 / T-08-51 | A volta depois do encerramento é reunião nova na máquina (DA-1); Fase 7 intacta sem o campo | unit | `cd taqciti && npx vitest run src/features/meeting/machineStartFresh.test.ts src/features/meeting/machine.test.ts src/background/agenteFreshStart.test.ts` | ❌ W0 | ⬜ pending |
| 08-26-T1 | 08-26 | 8 | TAQ-02 | T-08-56 | Refator mecânico: handler de aba fechada extraído com testes de caracterização do comportamento de hoje | unit | `cd taqciti && npx vitest run src/background/meetingTabClosed.test.ts` | ❌ W0 | ⬜ pending |
| 08-26-T2 | 08-26 | 8 | TAQ-02 | T-08-55 / T-08-56 | Aba da reunião fechada ao vivo = MEETING_FINISHED (DA-3); sem RESET; reabrir a sala segue a regra do 08-24; máquina da Fase 7 intacta | unit + integration | `cd taqciti && npx vitest run src/background/meetingTabClosed.test.ts src/background/meetingTabClosedFlow.test.ts src/features/meeting/machine.test.ts` | ❌ W0 | ⬜ pending |
| 08-25-T1 | 08-25 | 9 | TAQ-02 | T-08-33 / T-08-52 | Permissão `alarms`; listener de alarme síncrono no topo; `isMeetingLive` testado; reavaliação no boot | unit + build + grep | `cd taqciti && npx vitest run src/background/agenteAssociationLifecycle.test.ts && npm run build` | ✅ estender | ⬜ pending |
| 08-25-T2 | 08-25 | 9 | TAQ-02 | T-08-52 / T-08-53 | Gatilhos: fim/preempção da reunião (inclusive aba fechada), envio em partes concluído ou parado e vínculo concluído; nenhum espera o agendador | integration | `cd taqciti && npx vitest run src/background/agenteFinishTriggers.test.ts src/background/agenteAssociationLifecycle.test.ts` | ❌ W0 | ⬜ pending |
| 08-17-T1/T2 | 08-17 | 5 | TAQ-02 (SC2) | T-08-34 / T-08-35 | Selo no histórico; enviar/descartar com confirmação (`discard()` no hook) | component | `cd taqciti && npx vitest run src/sidepanel/components/AssociationBadgeFor.test.tsx src/sidepanel/components/AgenteEndSlot.test.tsx` | ❌ W0 | ⬜ pending |
| 08-18-T2 | 08-18 | 4 | TAQ-02 (SC3) | T-08-36 | Campo de ID só no plano B; nunca destino silencioso (B5); os testes que já montavam a tela (Back, DropTrace) seguem verdes dentro do `PlatformProvider` falso, sem mudar expectativas | component | `cd taqciti && npx vitest run src/sidepanel/screens/AgenteConfigScreenPlanB.test.tsx src/sidepanel/screens/AgenteConfigScreen.test.tsx src/sidepanel/screens/AgenteConfigScreenBack.test.tsx src/sidepanel/screens/AgenteConfigScreenDropTrace.test.tsx` | ✅ estender | ⬜ pending |
| 08-19-T1/T2 | 08-19 | 4 | TAQ-02 (SC4) | T-08-37 / T-08-38 | `chunk_id` estável; reenvio automático ligado (B3) | unit/e2e | `cd taqciti && npx vitest run src/shared/config/agenteConfig.test.ts src/background/agenteSender.test.ts src/background/agenteOutbox.test.ts` | ✅ estender | ⬜ pending |
| 08-20-T1/T3 | 08-20 | 10 | TAQ-02 (SC2) | T-08-39 | "Continuar envio" do índice confirmado (B3); aviso de sessão já encerrada (DA-2); reentrada durante o envio nunca deixa `linked` com sessão encerrada | unit/component | `cd taqciti && npx vitest run src/background/agenteBindFlow.test.ts src/sidepanel/components/AgenteEndSlot.test.tsx src/sidepanel/components/AgenteEndPrompt.test.tsx src/features/agente/bindingView.test.ts` | ✅ estender | ⬜ pending |
| 08-21-T1 | 08-21 | 11 | TAQ-02 | T-08-10 / T-08-40 / T-08-SC | Portão completo da fase; testes do backend conforme B1/B3-a (lista conferida contra os SUMMARYs); manifestos de pacote sem diff; estado do risco T-08-10 registrado | suite (portão da fase) | `cd taqciti && npm test && npm run typecheck && npm run lint && npm run build` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `taqciti/src/features/agente/association.test.ts` — SC1/SC2 (reducer)
- [ ] `taqciti/src/features/agente/meetingUploader.test.ts` — SC2 (blocos/ordem/progresso)
- [ ] `taqciti/src/features/agente/clientSearch.test.ts` — busca sem acento
- [ ] `taqciti/src/shared/config/agenteAssociationStore.test.ts`, `agenteOutboxStore.test.ts`, `agenteDeliveryStore.test.ts` — escritor único, valor inteiro, teto
- [ ] `taqciti/src/background/agenteStatusReporter.test.ts` — status de entrega só grava quando muda (08-11)
- [ ] `taqciti/src/background/agenteAssociationService.test.ts`, `agenteOutbox.test.ts` — SC1/SC4
- [ ] `taqciti/src/background/agenteAssociationLifecycle.test.ts` — ciclo de vida, retomada e boot (08-22)
- [ ] `taqciti/src/features/agente/{associationClose,finishPolicy,associationMeeting}.test.ts`, `taqciti/src/background/{agenteSessionFinisherDrain,agenteSessionFinisherInstance,agenteSessionFinisher,agenteStreamerKick,agenteFreshStart,agenteFinishTriggers,meetingTabClosed,meetingTabClosedFlow}.test.ts`, `taqciti/src/features/meeting/machineStartFresh.test.ts` — encerramento da B4-b, reentrada e aba fechada (08-16, 08-27, 08-24, 08-26, 08-25)
- [ ] `taqciti/src/background/history.test.ts` — evicção protegida
- [ ] `taqciti/src/sidepanel/components/{ClientPicker,AgenteDecisionCard,AgenteBindingBar,AgenteEndPrompt,AgenteNudgeAnchor}.test.tsx`, `taqciti/src/shared/ui/ConfirmModal.test.tsx`
- [ ] `taqciti/src/sidepanel/screens/AgenteConfigScreenDropTrace.test.tsx` — rastro de falas descartadas visível (08-11 Task 3)
- [ ] `backend/tests/test_extension_clients.py`, `test_webhook_idempotency.py`, `test_pipeline_get_or_create_lock.py`
- [ ] Framework: nenhum a instalar.

---

## Manual-Only Verifications

**Quem executa: uma pessoa do time (quem conduz a fase), com Chrome ≥ 116 e o backend local e o web app que ela
mesma sobe com o próprio .env. Quando: durante o /gsd-verify-work da Fase 8, depois do plano 08-21. O executor só
prepara o build e este roteiro; nunca marca o teste como aprovado.** O resultado de cada linha vai para a seção
"Roteiro manual D-20" (criada pelo 08-21, Task 2) e para o UAT.

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Fluxo real no Chrome + Meet: (a) envio em blocos ao fim, (b) queda do Agente + reenvio, (c) descarte com confirmação, (d) vínculo no meio da reunião, (e) encerramento automático da sessão (na hora; ~5 min com envio parado), (f) reentrada na mesma sala depois do encerramento = reunião nova, (g) permissão `alarms` sem aviso, (h) nada é encerrado com a reunião ao vivo, (i) aba fechada no meio da call encerra a reunião e a sessão | TAQ-02 (D-20) | Depende de extensão carregada, Google Meet ao vivo e backend no ar | Roteiro D-20 na seção "Roteiro manual D-20" deste arquivo (08-21, Task 2); registrar também no UAT |
| Checagens visuais "backstop" do UI-SPEC (cartão em 320/564 px, selo no histórico, modal com título longo, picker em 320 px) | TAQ-02 | Layout real no side panel do Chrome | Abrir o painel nas larguras indicadas e conferir contra `08-UI-SPEC.md` |
| `getBytesInUse` do `storage.local` após reunião longa | TAQ-02 (SC4) | Cota real do Chrome (10 MB sem `unlimitedStorage`) | Medir no DevTools do service worker durante o teste D-20; pedir `unlimitedStorage` ao time só se passar de ~5 MB (Open Question 8) |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency por task < 30s (só o portão da fase, 08-21 Task 1, roda a suíte completa)
- [ ] Teste manual D-20 executado pela pessoa do time durante o `/gsd-verify-work` e registrado
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
