---
phase: "8"
slug: "taqciti-session-association"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: true
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
| 08-01-T1 | 08-01 | 1 | TAQ-02 (SC3) | T-08-01 / T-08-02 | Sem associação `linked` nada sai (mesmo com ID na config); `linked` de qualquer origem = destino; CR-01 não bloqueia associação; semente `{}` válida; resto enviado após fim durante o vínculo; chave nunca persistida | e2e | `cd taqciti && npx vitest run src/background/agenteStreamerAssociation.test.ts src/background/agenteStreamer.test.ts` | ✅ | ✅ green |
| 08-01-T2 | 08-01 | 1 | TAQ-02 (SC2) | T-08-01 / T-08-03 | Reducer completo (fim/retomada/conclusão por estado); store sem perder escrita concorrente | unit | `cd taqciti && npx vitest run src/features/agente/association.test.ts src/shared/config/agenteAssociationStore.test.ts` | ✅ | ✅ green |
| 08-02-T1 | 08-02 | 1 | TAQ-02 (SC2) | T-08-04 | `ConfirmModal.cancelLabel`; Esc/fundo = cancelar | component | `cd taqciti && npx vitest run src/shared/ui/ConfirmModal.test.tsx` | ✅ | ✅ green |
| 08-02-T2 | 08-02 | 1 | TAQ-02 (SC1) | — | Bolha "!" e cartão; Esc contido; sem foco roubado | component | `cd taqciti && npx vitest run src/sidepanel/components/AgenteNudge.test.tsx src/sidepanel/components/AgenteDecisionCard.test.tsx` | ✅ | ✅ green |
| 08-03-T1 | 08-03 | 1 | TAQ-02 (SC1) | — | Busca sem acento/caixa; duplicidade | unit | `cd taqciti && npx vitest run src/features/agente/clientSearch.test.ts` | ✅ | ✅ green |
| 08-03-T2/T3 | 08-03 | 1 | TAQ-02 (SC1/SC3) | T-08-05 / T-08-06 | Seletor em 2 passos; estados; plano B só com lista em erro; nome como texto; UUID validado | component | `cd taqciti && npx vitest run src/sidepanel/components/ClientPicker.test.tsx` | ✅ | ✅ green |
| 08-04-T1/T2 | 08-04 | 1 | TAQ-02 (SC2/SC4) | T-08-07 | Barra (offline com contagem), fim da reunião, selo; sem "Continuar envio" antes da B3 | component | `cd taqciti && npx vitest run src/sidepanel/components/AgenteBindingBar.test.tsx src/sidepanel/components/AgenteEndPrompt.test.tsx src/sidepanel/components/AssociationBadge.test.tsx` | ✅ | ✅ green |
| 08-05-T1/T2 | 08-05 | 1 | TAQ-02 (SC2) | T-08-08 | Envio em partes serial, blocos de 20, pausa 1 s, progresso por índice, retomada | unit | `cd taqciti && npx vitest run src/features/agente/meetingUploader.test.ts src/features/agente/meetingUploadRunner.test.ts` | ✅ | ✅ green |
| 08-06-T1 | 08-06 | 1 | TAQ-02 | T-08-09 | 2 chamadas concorrentes a `get_or_create` ⇒ 1 pipeline | unit async | `cd backend && python -m pytest tests/test_pipeline_get_or_create_lock.py -x -q` | ✅ | ✅ green |
| 08-06-T2 | 08-06 | 1 | TAQ-02 (SC4) | — | Suposição A1: `chunk_id` extra aceito | unit | `cd backend && python -m pytest tests/test_extension_chunk_extra_fields.py -x -q` | ✅ | ✅ green |
| 08-07-T2/T3 | 08-07 | 1 | TAQ-02 (SC1) | T-08-10 / T-08-11 / T-08-12 | Listagem mínima; sessão nova; 404; gate 401 (B1) | unit | `cd backend && python -m pytest tests/test_extension_clients.py -x -q` | ✅ | ✅ green |
| 08-08-T2 | 08-08 | 1 | TAQ-02 (SC1) | T-08-13 / T-08-14 | Projeto sem chave Gemini não toca o Vault (B2); importação de PDF segue a resposta `pdf-fallback` | unit | `cd backend && python -m pytest tests/test_projects.py tests/test_upload_pdf_mode.py -x -q` | ✅ (estendido) | ✅ green |
| 08-08-T3 | 08-08 | 1 | TAQ-02 (SC1) | — | Formulário sem chave obrigatória (B2) | build | `npm --prefix frontend run build` | ✅ | ✅ green |
| 08-09-T2 | 08-09 | 2 | TAQ-02 (SC4) | T-08-15 / T-08-16 | `chunk_id` repetido ⇒ 202 sem `push_chunk` (B3) | unit | `cd backend && python -m pytest tests/test_webhook_idempotency.py -x -q` | ✅ | ✅ green |
| 08-10-T1 | 08-10 | 2 | TAQ-02 (SC1) | T-08-17 | Comandos zod; lista indisponível → plano B | unit | `cd taqciti && npx vitest run src/background/agenteAssociationService.test.ts` | ✅ | ✅ green |
| 08-10-T2/T3 | 08-10 | 2 | TAQ-02 (SC1/SC2) | T-08-18 / T-08-19 | Vínculo ao vivo com backfill e semente; 1 sessão por reunião; `onLinked` após `link-completed`; fim durante o vínculo → `ended-unsent`; envio da reunião encerrada; eventos seguem o estado (sala retomada) | integration | `cd taqciti && npx vitest run src/background/agenteBindFlow.test.ts src/background/agenteAssociationService.test.ts` | ✅ | ✅ green |
| 08-11-T1 | 08-11 | 2 | TAQ-02 (SC4) | T-08-20 / T-08-22 | Fila durável sem segredo, teto com overflow | unit | `cd taqciti && npx vitest run src/features/agente/outbox.test.ts src/shared/config/agenteOutboxStore.test.ts` | ✅ | ✅ green |
| 08-11-T2 | 08-11 | 2 | TAQ-02 (SC4) | T-08-20 / T-08-44 | Status de entrega em `storage.local`; reporter só grava quando muda; rastro de falas descartadas em chave própria que o status "ok" não apaga | unit | `cd taqciti && npx vitest run src/shared/config/agenteDeliveryStore.test.ts src/background/agenteStatusReporter.test.ts` | ✅ | ✅ green |
| 08-11-T3 | 08-11 | 2 | TAQ-02 (SC4) | T-08-44 | Tela "Agente Diagnóstico" mostra o rastro junto do status; sem rastro, texto da Fase 7 intacto | unit + component | `cd taqciti && npx vitest run src/shared/config/agenteStatus.test.ts src/sidepanel/screens/AgenteConfigScreenDropTrace.test.tsx src/sidepanel/screens/AgenteConfigScreen.test.tsx` | ✅ | ✅ green |
| 08-23-T1 | 08-23 | 3 | TAQ-02 (SC4) | — | Refactor da API do sender sem mudança de comportamento (mesmas asserções; fila em memória recortada para `agenteSendQueue.ts`) | unit | `cd taqciti && npx vitest run src/background/agenteSender.test.ts src/background/agenteStreamer.test.ts src/background/agenteStreamerAssociation.test.ts` | ✅ (estendido) | ✅ green |
| 08-23-T2 | 08-23 | 3 | TAQ-02 (SC4) | T-08-21 / T-08-43 / T-08-46 | Sem "descarta o mais antigo"; política de reenvio; retirada por 500 só conforme a B3-b (valor de produção fixado por teste); toda saída sem entrega não pedida pela pessoa avisa o rastro (falha ao gravar a fila = overflow); request null e cancelAll fora do rastro; dispose não limpa a porta | unit | `cd taqciti && npx vitest run src/background/agenteSender.test.ts` | ✅ (estendido) | ✅ green |
| 08-23-T3 | 08-23 | 3 | TAQ-02 (SC4) | T-08-45 / T-08-21 / T-08-46 | Queda, reinício do SW e reenvio em ordem (a fila durável sobrevive ao `configureAgenteStreamer` pós-reinício); rastro de fala descartada sobrevive ao próximo "ok" e ao reinício; reinício com o envio desligado/config não pronta não manda nada (fila limpa, rastro sem incremento — D-09 da Fase 7 no `resume`) | e2e | `cd taqciti && npx vitest run src/background/agenteOutbox.test.ts src/background/agenteStreamer.test.ts src/background/agenteStreamerAssociation.test.ts` | ✅ | ✅ green |
| 08-22-T1/T2 | 08-22 | 3 | TAQ-02 (SC2) | T-08-41 / T-08-42 | `pending` idempotente; fim sem escolha → `ended-unsent`; retomada da mesma sala por estado; boot nunca deixa estado preso | integration | `cd taqciti && npx vitest run src/background/agenteAssociationLifecycle.test.ts` | ✅ | ✅ green |
| 08-12-T1 | 08-12 | 3 | TAQ-02 (SC1) | T-08-23 | Criar cliente só com nome; 409 duplicado (B1/B2/B4-a) | unit | `cd backend && python -m pytest tests/test_extension_clients.py -x -q` | ✅ | ✅ green |
| 08-12-T2/T3 | 08-12 | 3 | TAQ-02 (SC1/SC3) | T-08-24 / T-08-25 | Portas HTTP com gate, URL validada, resposta validada, nome da sessão cortado em 200; produção usa as rotas | integration | `cd taqciti && npx vitest run src/background/httpAgentePorts.test.ts src/background/agenteAssociationHttp.test.ts` | ✅ | ✅ green |
| 08-13-T1 | 08-13 | 4 | TAQ-02 (SC2) | T-08-27 | Histórico cheio nunca remove reunião não enviada | unit/integration | `cd taqciti && npx vitest run src/background/history.test.ts` | ✅ | ✅ green |
| 08-13-T3 | 08-13 | 4 | TAQ-02 (SC2) | T-08-26 | Descartar só `ended-unsent` fora do ar, só local | unit | `cd taqciti && npx vitest run src/background/agenteAssociationService.test.ts` | ✅ | ✅ green |
| 08-14-T1 | 08-14 | 3 | TAQ-02 (SC1/SC4) | T-08-28 | Tradução associação/entrega → visão (inclui sala retomada) | unit | `cd taqciti && npx vitest run src/features/agente/bindingView.test.ts` | ✅ | ✅ green |
| 08-14-T2 | 08-14 | 3 | TAQ-02 (SC1/SC2) | T-08-29 | Cartão ↔ seletor ↔ barra; minimizar = Depois | component | `cd taqciti && npx vitest run src/sidepanel/components/AgenteLiveSlot.test.tsx` | ✅ | ✅ green |
| 08-14-T3 | 08-14 | 3 | TAQ-02 (SC1) | T-08-29 | Bolha só em `pending`; cabeçalho manda `open`, cápsula decorativa; fiação compila | component + build | `cd taqciti && npx vitest run src/sidepanel/components/AgenteNudgeAnchor.test.tsx src/sidepanel/components/AgenteLiveSlot.test.tsx` | ✅ | ✅ green |
| 08-15-T2 | 08-15 | 4 | TAQ-02 | T-08-30 / T-08-31 | Finish idempotente só de sessão extension (404/409; chamada repetida devolve 200 e chama stop_session); parador de pipeline injetado (B4-b) | unit | `cd backend && python -m pytest tests/test_extension_clients.py tests/test_finish_stops_pipeline.py -x -q` | ✅ (estendido) | ✅ green |
| 08-15-T3 | 08-15 | 4 | TAQ-02 | T-08-31 / T-08-47 | `stop_session` espera a criação do pipeline em andamento: finish durante a criação não deixa pipeline órfão | unit async | `cd backend && python -m pytest tests/test_pipeline_get_or_create_lock.py tests/test_finish_stops_pipeline.py -x -q` | ✅ (estendido) | ✅ green |
| 08-16-T1 | 08-16 | 5 | TAQ-02 | T-08-32 / T-08-49 | Tempos da B4-b fixados por teste (5 min, 30 s, 10 s, backoff de 11 tentativas) | unit | `cd taqciti && npx vitest run src/features/agente/finishPolicy.test.ts` | ✅ | ✅ green |
| 08-16-T2 | 08-16 | 5 | TAQ-02 | T-08-32 / T-08-49 | A associação guarda `sessionFinished`, `finishBy` (só o primeiro prazo), `finishTries` e `finishGaveUp`; `carryIdentity` e lista branca os preservam; elegibilidade exclui manual-id, encerrada e desistida | unit | `cd taqciti && npx vitest run src/features/agente/associationClose.test.ts src/shared/config/agenteAssociationStore.test.ts` | ✅ | ✅ green |
| 08-16-T3 | 08-16 | 5 | TAQ-02 | T-08-48 / T-08-49 | Porta HTTP do finish com erro tipado: repete rede/5xx, não repete 401/4xx, 404/409 = nada a encerrar; id validado | unit | `cd taqciti && npx vitest run src/background/httpAgentePorts.test.ts` | ✅ | ✅ green |
| 08-27-T1 | 08-27 | 6 | TAQ-02 (SC4) | T-08-32 | Kick dedicado do envio alcança a fila em qualquer estado da reunião, respeitando o portão `canDrain` | unit | `cd taqciti && npx vitest run src/background/agenteStreamerKick.test.ts src/background/agenteOutbox.test.ts` | ✅ | ✅ green |
| 08-27-T2 | 08-27 | 6 | TAQ-02 | T-08-32 / T-08-49 | Agendador: encerra na hora com a fila vazia; espera a última fala; prazo de 5 min; backoff limitado; desistência sem laço (nem no boot); nunca com a reunião ao vivo | unit | `cd taqciti && npx vitest run src/background/agenteSessionFinisherDrain.test.ts src/background/agenteSessionFinisherInstance.test.ts` | ✅ | ✅ green |
| 08-27-T3 | 08-27 | 6 | TAQ-02 | T-08-54 | Composição de produção com falha segura (sem `isMeetingLive` configurado ninguém é encerrado) | unit | `cd taqciti && npx vitest run src/background/agenteSessionFinisher.test.ts` | ✅ | ✅ green |
| 08-24-T1 | 08-24 | 7 | TAQ-02 | T-08-50 | Sessão encerrada + sala de volta → `pending` limpo em qualquer estado com sessão; volta antes do encerramento cancela o prazo; boot (B4-b) | unit + integration | `cd taqciti && npx vitest run src/features/agente/associationMeeting.test.ts src/features/agente/association.test.ts src/background/agenteAssociationLifecycle.test.ts` | ✅ | ✅ green |
| 08-24-T3 | 08-24 | 7 | TAQ-02 | T-08-50 / T-08-51 | A volta depois do encerramento é reunião nova na máquina (DA-1); Fase 7 intacta sem o campo | unit | `cd taqciti && npx vitest run src/features/meeting/machineStartFresh.test.ts src/features/meeting/machine.test.ts src/background/agenteFreshStart.test.ts` | ✅ | ✅ green |
| 08-26-T1 | 08-26 | 8 | TAQ-02 | T-08-56 | Refator mecânico: handler de aba fechada extraído com testes de caracterização do comportamento de hoje | unit | `cd taqciti && npx vitest run src/background/meetingTabClosed.test.ts` | ✅ | ✅ green |
| 08-26-T2 | 08-26 | 8 | TAQ-02 | T-08-55 / T-08-56 | Aba da reunião fechada ao vivo = MEETING_FINISHED (DA-3); sem RESET; reabrir a sala segue a regra do 08-24; máquina da Fase 7 intacta | unit + integration | `cd taqciti && npx vitest run src/background/meetingTabClosed.test.ts src/background/meetingTabClosedFlow.test.ts src/features/meeting/machine.test.ts` | ✅ | ✅ green |
| 08-25-T1 | 08-25 | 9 | TAQ-02 | T-08-33 / T-08-52 | Permissão `alarms`; listener de alarme síncrono no topo; `isMeetingLive` testado; reavaliação no boot | unit + build + grep | `cd taqciti && npx vitest run src/background/agenteAssociationLifecycle.test.ts && npm run build` | ✅ (estendido) | ✅ green |
| 08-25-T2 | 08-25 | 9 | TAQ-02 | T-08-52 / T-08-53 | Gatilhos: fim/preempção da reunião (inclusive aba fechada), envio em partes concluído ou parado e vínculo concluído; nenhum espera o agendador | integration | `cd taqciti && npx vitest run src/background/agenteFinishTriggers.test.ts src/background/agenteAssociationLifecycle.test.ts` | ✅ | ✅ green |
| 08-17-T1/T2 | 08-17 | 5 | TAQ-02 (SC2) | T-08-34 / T-08-35 | Selo no histórico; enviar/descartar com confirmação (`discard()` no hook) | component | `cd taqciti && npx vitest run src/sidepanel/components/AssociationBadgeFor.test.tsx src/sidepanel/components/AgenteEndSlot.test.tsx` | ✅ | ✅ green |
| 08-18-T2 | 08-18 | 4 | TAQ-02 (SC3) | T-08-36 | Campo de ID só no plano B; nunca destino silencioso (B5); os testes que já montavam a tela (Back, DropTrace) seguem verdes dentro do `PlatformProvider` falso, sem mudar expectativas | component | `cd taqciti && npx vitest run src/sidepanel/screens/AgenteConfigScreenPlanB.test.tsx src/sidepanel/screens/AgenteConfigScreen.test.tsx src/sidepanel/screens/AgenteConfigScreenBack.test.tsx src/sidepanel/screens/AgenteConfigScreenDropTrace.test.tsx` | ✅ (estendido) | ✅ green |
| 08-19-T1/T2 | 08-19 | 4 | TAQ-02 (SC4) | T-08-37 / T-08-38 | `chunk_id` estável; reenvio automático ligado (B3) | unit/e2e | `cd taqciti && npx vitest run src/shared/config/agenteConfig.test.ts src/background/agenteSender.test.ts src/background/agenteOutbox.test.ts` | ✅ (estendido) | ✅ green |
| 08-20-T1/T3 | 08-20 | 10 | TAQ-02 (SC2) | T-08-39 | "Continuar envio" do índice confirmado (B3); aviso de sessão já encerrada (DA-2); reentrada durante o envio nunca deixa `linked` com sessão encerrada | unit/component | `cd taqciti && npx vitest run src/background/agenteBindFlow.test.ts src/sidepanel/components/AgenteEndSlot.test.tsx src/sidepanel/components/AgenteEndPrompt.test.tsx src/features/agente/bindingView.test.ts` | ✅ (estendido) | ✅ green |
| 08-21-T1 | 08-21 | 11 | TAQ-02 | T-08-10 / T-08-40 / T-08-SC | Portão completo da fase; testes do backend conforme B1/B3-a (lista conferida contra os SUMMARYs); manifestos de pacote sem diff; estado do risco T-08-10 registrado | suite (portão da fase) | `cd taqciti && npm test && npm run typecheck && npm run lint && npm run build` | ✅ | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [x] `taqciti/src/features/agente/association.test.ts` — SC1/SC2 (reducer)
- [x] `taqciti/src/features/agente/meetingUploader.test.ts` — SC2 (blocos/ordem/progresso)
- [x] `taqciti/src/features/agente/clientSearch.test.ts` — busca sem acento
- [x] `taqciti/src/shared/config/agenteAssociationStore.test.ts`, `agenteOutboxStore.test.ts`, `agenteDeliveryStore.test.ts` — escritor único, valor inteiro, teto
- [x] `taqciti/src/background/agenteStatusReporter.test.ts` — status de entrega só grava quando muda (08-11)
- [x] `taqciti/src/background/agenteAssociationService.test.ts`, `agenteOutbox.test.ts` — SC1/SC4
- [x] `taqciti/src/background/agenteAssociationLifecycle.test.ts` — ciclo de vida, retomada e boot (08-22)
- [x] `taqciti/src/features/agente/{associationClose,finishPolicy,associationMeeting}.test.ts`, `taqciti/src/background/{agenteSessionFinisherDrain,agenteSessionFinisherInstance,agenteSessionFinisher,agenteStreamerKick,agenteFreshStart,agenteFinishTriggers,meetingTabClosed,meetingTabClosedFlow}.test.ts`, `taqciti/src/features/meeting/machineStartFresh.test.ts` — encerramento da B4-b, reentrada e aba fechada (08-16, 08-27, 08-24, 08-26, 08-25)
- [x] `taqciti/src/background/history.test.ts` — evicção protegida
- [x] `taqciti/src/sidepanel/components/{ClientPicker,AgenteDecisionCard,AgenteBindingBar,AgenteEndPrompt,AgenteNudgeAnchor}.test.tsx`, `taqciti/src/shared/ui/ConfirmModal.test.tsx`
- [x] `taqciti/src/sidepanel/screens/AgenteConfigScreenDropTrace.test.tsx` — rastro de falas descartadas visível (08-11 Task 3)
- [x] `backend/tests/test_extension_clients.py`, `test_webhook_idempotency.py`, `test_pipeline_get_or_create_lock.py`
- [x] Framework: nenhum a instalar.

---

## Manual-Only Verifications

**Quem executa: uma pessoa do time (quem conduz a fase), com Chrome ≥ 116 e o backend local e o web app que ela
mesma sobe com o próprio .env. Quando: durante o /gsd-verify-work da Fase 8, depois do plano 08-21. O executor só
prepara o build e este roteiro; nunca marca o teste como aprovado.** O resultado de cada linha vai para a seção
"Roteiro D-20 (a)-(i)" logo abaixo (criada pelo 08-21, Task 2) e para o UAT.

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Fluxo real no Chrome + Meet: (a) envio em blocos ao fim, (b) queda do Agente + reenvio, (c) descarte com confirmação, (d) vínculo no meio da reunião, (e) encerramento automático da sessão (na hora; ~5 min com envio parado), (f) reentrada na mesma sala depois do encerramento = reunião nova, (g) permissão `alarms` sem aviso, (h) nada é encerrado com a reunião ao vivo, (i) aba fechada no meio da call encerra a reunião e a sessão | TAQ-02 (D-20) | Depende de extensão carregada, Google Meet ao vivo e backend no ar | Roteiro D-20 (a)-(i) na seção seguinte deste arquivo (08-21, Task 2); registrar também no UAT |
| Checagens visuais "backstop" do UI-SPEC (cartão em 320/564 px, selo no histórico, modal com título longo, picker em 320 px) | TAQ-02 | Layout real no side panel do Chrome | Abrir o painel nas larguras indicadas e conferir contra `08-UI-SPEC.md` |
| `getBytesInUse` do `storage.local` após reunião longa | TAQ-02 (SC4) | Cota real do Chrome (10 MB sem `unlimitedStorage`) | Medir no DevTools do service worker durante o teste D-20; pedir `unlimitedStorage` ao time só se passar de ~5 MB (Open Question 8) |

---

## Resultado do portão automático (08-21, Task 1 — 2026-10-12)

Rodado na árvore principal, branch `feat/fase-08-taqciti-session-association`, sem ler `.env`.

| Verificação | Comando | Resultado |
|-------------|---------|-----------|
| Suíte da Taqciti | `cd taqciti && npm test` | **85 arquivos / 1294 testes passando** (baseline de partida da fase: 42 / 619) |
| Typecheck | `npm run typecheck` | sem erros (exit 0) |
| Lint | `npm run lint` (`eslint src`) | sem erros (exit 0) |
| Build da extensão | `npm run build` | `✓ built`, exit 0 (`taqciti/dist`, ignorado pelo git) |
| Build do web app | `npm --prefix frontend run build` | `✓ built`, exit 0 (linha 08-08-T3) |
| Backend (testes puros da fase) | `python -m pytest <LISTA> -x -q` | **73 passed, 4 skipped** (os 4 são stubs antigos "implement in Plan 02" de `test_projects.py`, anteriores à fase) |
| Manifestos de pacote | `git diff --stat main...HEAD -- taqciti/package.json taqciti/package-lock.json backend/requirements.txt frontend/package.json frontend/package-lock.json` | vazio (nenhum pacote novo na fase) |
| Linhas `⬜ pending` do mapa | `awk` do plano | 0 |

`LISTA` do backend (impressa pelo comando): `tests/test_webhook_auth.py tests/test_pipeline_get_or_create_lock.py tests/test_extension_chunk_extra_fields.py tests/test_finish_stops_pipeline.py tests/test_projects.py tests/test_upload_pdf_mode.py tests/test_extension_clients.py tests/test_webhook_idempotency.py`.
Conferida contra as decisões: B1 = `aprovar-recomendado` (08-07-SUMMARY) → `test_extension_clients.py` **presente**; B3-a = `aprovar-chunk-id` (08-09-SUMMARY) → `test_webhook_idempotency.py` **presente**. A lista bate.

Falha pré-existente, fora do portão: `tests/test_schema.py::test_tables_exist` exige Supabase real (`APIError` do postgrest) e já falhava antes da fase (registrada no 08-09-SUMMARY, "Itens adiados"); não conta contra o portão.

Todas as linhas do mapa de verificação acima estão `✅ green` (nenhuma `não executado — decisão Bx`: B1, B2, B3-a, B4-b e D-11 foram aprovadas, então nenhuma task ficou sem rodar). `wave_0_complete: true`: todos os arquivos de teste da seção "Wave 0 Requirements" existem. `nyquist_compliant` continua `false` até o teste manual.

## Pendências por decisão do time

> **LEMBRETES OBRIGATÓRIOS antes de qualquer deploy, merge ou junção com o AGM**
> 1. **TEM QUE CRIAR `GEMINI_API_KEY` NO RAILWAY** (B2 = `aprovar-sem-env`): clientes criados pela Taqciti não têm chave própria; sem a variável do servidor o pipeline de IA não roda, e a importação de PDF (pdf-fallback = sim) também usa essa chave.
> 2. **Ordem de rollout:** migração `chunk_id` (JÁ aplicada em produção no Supabase em 2026-10-12) → deploy do backend (rota de finish do 08-15 e corrida do `stop_session`) → build da Taqciti.
> 3. **NÃO distribuir o build da Taqciti antes do teste manual D-20.**
> 4. O backend vai para a `master` por merge da `main`, e o deploy sai da `master`.
> 5. **Revisar o risco T-08-10 antes do deploy** (linha abaixo).

**Critérios do ROADMAP não atendidos por causa de uma opção escolhida:** nenhum (B1 aprovada → critério 1; B3-a aprovada → critério 4; B4-b ajustada + DA-1/2/3 → critério 5). ROADMAP §Phase 8 (critérios 1-5) e REQUIREMENTS (TAQ-02) conferidos: descrevem o seletor de cliente por reunião (D-01), não o auto-detect por localStorage. Os critérios só contam como atendidos de fato depois do teste manual D-20.

- **T-08-10:** risco residual aceito por Time Antonio até o login do AGM (08-07-SUMMARY, 2026-10-12; deploy ainda não feito, então as rotas ainda não estão expostas em produção). `EXTENSION_SHARED_KEY` **não** foi confirmada ativa no Railway. Revisar antes do deploy.
- **B3-b (desistir de fala recusada com HTTP 500):** sem resposta do time → padrão `retirada-nunca` (D-18 literal). Valor aplicado (08-23-SUMMARY): `AGENTE_OUTBOX_SERVER_ERROR_MAX_AGE_MS = null`, fixado por teste. É padrão por falta de resposta, **não** decisão do time; o limite numérico existe só por injeção, para trocar a regra num commit próprio.
- **B3-c (404 para `session_id` inexistente):** sem resposta → `404-depois`. 404 webhook: pendência com dono quem conduz a fase, revisitar no cutover da Fase 9. Hoje `session_id` inexistente ainda vira 500.
- **DA-1 (08-24):** `reuniao-nova-de-verdade` (respondida em 2026-10-12). **DA-2 (08-20):** `continuar-com-aviso` (respondida em 2026-10-12). **DA-3 (08-26):** `fechar-aba-encerra` (respondida em 2026-10-12; implementada no 08-26).
- **DA-4: PENDÊNCIA DO TIME (sem resposta; nada implementado).** Aba que NAVEGA para outro site no meio da call, sem fechar, não gera `tabs.onRemoved` nem `meet/ended`: mesmo custo de IA ocioso. Opção recomendada: `navegar-encerra`; alternativa `nao-tratar` só vale se o time aceitar explicitamente.
- **DA-5: PENDÊNCIA DO TIME (sem resposta; a Taqciti desiste e só registra no log).** Depois de cerca de 16 h de falha de rede/5xx, ou de recusa definitiva 401/403/4xx, a Taqciti desiste de encerrar a sessão e nada mais a encerra (nem a varredura do boot). Opção recomendada: `nova-rodada-no-boot`.
- **`finishGaveUp` e "Continuar envio" (08-20):** a retomada do envio limpa `finishBy`/`finishTries`, mas **não** `finishGaveUp` (como o plano mandava). Pedir confirmação do time se isso é o desejado.
- **Histórico cheio de reuniões não enviadas (Open Question 5, 08-13):** o histórico nunca remove reunião não enviada, então pode passar de 100 e pressionar a cota; o aviso na UI ("histórico cheio de não enviadas") é decisão do time e não foi feito. A cota é medida no D-20.
- **Remoção de código da Fase 7:** `confirmNewMeeting`, `confirmedMeetingId`, `configDestination` e o texto "confirme abaixo" em `agenteStatus.ts` ficaram sem uso na tela; remover é decisão de remoção registrada no 08-01, dependente do time.
- **B2 `aprovar-sem-env`:** `GEMINI_API_KEY` ainda não existe no Railway (lembrete 1).

## Roteiro manual D-20 (a)-(i) — numa reunião real no Meet

**Quem executa: uma pessoa do time (quem conduz a fase), com Chrome ≥ 116 e o backend local e o web app que ela mesma sobe com o próprio .env. Quando: durante o /gsd-verify-work da Fase 8, depois do plano 08-21. O executor só prepara o build e este roteiro; nunca marca o teste como aprovado.**

**Estado: NÃO EXECUTADO.** A coluna "Resultado" fica vazia até a pessoa voltar com "ok" ou a descrição do problema. Nada abaixo foi marcado como aprovado.

**Pré-requisitos** (a pessoa do time faz; o executor não sobe backend nem lê `.env`):
- Backend local em `:8000` com as rotas novas (clientes, sessões, finish) e a migração `chunk_id` aplicada no Supabase que esse backend usa (em produção ela já está aplicada); web app em `:5173` (`npm --prefix frontend run dev`).
- `GEMINI_API_KEY` no `.env` local da pessoa (B2: clientes criados pela Taqciti não têm chave própria).
- Extensão carregada em `chrome://extensions` (modo desenvolvedor) a partir de `taqciti/dist` (build gerado em 2026-10-12 com `npm run build`); tela "Agente Diagnóstico" com o envio ligado e a URL do backend local.
- Chrome ≥ 116; uma reunião do Google Meet que a pessoa possa abrir e fechar (sala própria, uma só pessoa basta).

| # | O que fazer | Resultado esperado | Resultado (pessoa preenche) |
|---|-------------|--------------------|------------------------------|
| a | Entrar numa reunião do Meet, falar ~1 min, clicar "Depois"; encerrar → "Enviar esta reunião ao Agente?" → escolher um cliente | A barra vai até "Reunião enviada…"; no web app a sessão nova tem a transcrição completa, na ordem (valida também a suposição A3: blocos de 20 + pausa de 1 s) | |
| b | Nova reunião, vincular pelo seletor; parar o backend no meio; falar mais; religar o backend | Faixa amarela "O Agente está fora do ar…" com a contagem; ao religar, toast "Agente de volta. Falas reenviadas."; sem duplicatas no banco: `SELECT session_id, chunk_id, count(*) FROM transcript_chunks WHERE session_id = '<id>' GROUP BY 1,2 HAVING count(*) > 1` → 0 linhas (o índice único já garante; a versão por `text` do plano também serve como conferência, mas pode listar uma fala repetida de verdade, como "sim") | |
| c | Nova reunião, terminar sem cliente → "Descartar" | Modal com "Manter reunião" (desistir mantém); "Descartar" → some do histórico da Taqciti; nada muda no web app | |
| d | Nova reunião, falar ~30 s sem escolher; depois escolher o cliente pelo "!"/cartão | "Enviando o que já foi falado… x de y" → "Enviando ao vivo para {cliente}"; a sessão no web app tem o começo da reunião e o que veio depois, na ordem | |
| e | Reunião vinculada pelo seletor: terminar com o Agente no ar. Repetir com o backend derrubado durante a reunião e religado depois do fim. Colar um ID manual (plano B) em outra reunião e terminá-la | Sessão ENCERRADA no web app em poucos segundos (fila vazia); com o backend fora, encerra assim que a fila esvazia ou ~5 min depois do fim se a fila não andar; a sessão colada pelo plano B nunca é encerrada | |
| f | Voltar à mesma sala em até 10 min DEPOIS do encerramento; depois, voltar à sala ANTES do encerramento (ex.: fila ainda esvaziando) | Depois: bolha "!" de novo e, ao escolher o cliente, sessão NOVA no web app só com o que foi dito depois da volta (a antiga continua encerrada). Antes: continua na mesma sessão | |
| g | Instalar a extensão nova por cima de uma versão anterior (ou recarregá-la) | O Chrome NÃO mostra aviso de instalação nem de atualização por causa da permissão `alarms` | |
| h | Reunião vinculada: deixar passar mais de 5 min COM a reunião em andamento (backend no ar) | A sessão continua ativa no web app; só é encerrada depois do fim da reunião | |
| i | Reunião vinculada: fechar a aba do Meet no meio da call; depois reabrir a mesma sala | A reunião aparece encerrada no histórico da Taqciti e a sessão aparece ENCERRADA no web app em poucos segundos; reabrir a sala depois do encerramento = reunião nova (DA-3) | |

**Backstops visuais** (UI-SPEC, conferir no painel real):

| Checagem | Resultado esperado | Resultado (pessoa preenche) |
|----------|--------------------|------------------------------|
| Cartão de decisão com título, corpo e botões em 320 px e 564 px | Sem corte e sem rolagem horizontal | |
| Selo de associação ao lado do StatusBadge no HistoryCard com título longo | Selo e badge legíveis, sem estourar o card | |
| Modal de descarte com “{título}” longo | O texto não estoura o modal | |
| Seletor de clientes em 320 px e 564 px | O painel sobe para regular ao abrir o seletor; em 564 px, pelo menos 3 linhas de cliente visíveis | |

**Cota do storage:** no DevTools do service worker, rodar `chrome.storage.local.getBytesInUse(null)` depois de uma reunião longa e anotar o valor aqui: ____ bytes. Pedir `unlimitedStorage` ao time só se passar de ~5 MB (Open Question 8).

**Depois do teste:** a pessoa registra os resultados nesta tabela e no UAT (`/gsd-verify-work`). Só então a fase pode ser dada como concluída e o TAQ-02 marcado.

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency por task < 30s (só o portão da fase, 08-21 Task 1, roda a suíte completa)
- [ ] Teste manual D-20 executado pela pessoa do time durante o `/gsd-verify-work` e registrado
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
