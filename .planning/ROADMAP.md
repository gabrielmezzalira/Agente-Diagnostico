# Roadmap: Agente Diagnóstico

## Overview

v1.0 (legacy CLI, `diagnostico/`) and v2.0 (web app + Precificador, Phases 1-13) are complete —
full phase detail is archived in `.planning/milestones/v2.0-phases/`. v3.0 pivots the product from
pre-sales technical-risk detection to live discovery: the same realtime pipeline (coverage
classification, red-flag detection, question planning, reporting) is reframed around two
coordinated lenses — Produto (primary) and Dados (auxiliary) — instead of one generic sales-risk
classifier, and the transcription source moves from the custom Chrome extension to Taqciti. The 9
phases split into two ordered tracks: Phases 1-5 do the domain reframe (area registry → discovery
mode → two-agent questions → discovery report → two-lens UI), testable end-to-end with the existing
streaming extension; Phases 6-9 then swap the transcription source to Taqciti (webhook auth → live
streaming → session binding → cutover), so discovery correctness is proven before capture changes.

## Milestones

- ✅ **v1.0 Diagnóstico CLI** - terminal interview + realtime pipeline (legacy, `diagnostico/`)
- ✅ **v2.0 Web + Precificador** - Phases 1-13 (archived in `.planning/milestones/v2.0-phases/`)
- 🚧 **v3.0 Pivot Discovery** - Phases 1-9 (in progress)

## Phases

**Phase Numbering:**

- This milestone (v3.0) restarts numbering at Phase 1 — this project's convention numbers each
  milestone's phases from 1, archiving the prior milestone's phase detail under `.planning/milestones/`.
- Integer phases (1-9): planned v3.0 milestone work.
- Decimal phases (e.g. 1.1): urgent insertions only, via `/gsd-phase --insert`.

- [x] **Phase 1: Area-Set Registry** - Single source of truth for coverage areas; zero behavior change for sales mode (completed 2026-09-20)
- [x] **Phase 2: Discovery Mode + DiscoveryPromptBuilder** - Projects can run in discovery mode over the 18 discovery areas with discovery framing (completed 2026-09-21)
- [x] **Phase 3: Two-Agent Questions + Lens Tagging** - Produto + Dados planners share one question queue; areas/red flags/questions carry a lens tag (completed 2026-09-22)
- [x] **Phase 4: Discovery Report + Pricing Handoff** - One discovery document with a pricing-metrics section, feeding import-from-diagnosis (completed 2026-09-23)
- [x] **Phase 5: Two-Lens Monitoring (Frontend)** - Coverage grouped by lens, lens badges, server-driven area rendering (completed 2026-09-24)
- [x] **Phase 6: Opt-In Webhook Auth** - Non-breaking shared-secret gate on the transcription webhook (completed 2026-09-25)
- [x] **Phase 7: Taqciti Config + Background Streamer** - Taqciti streams live captions to the backend during the call (completed 2026-09-27)
- [ ] **Phase 8: Taqciti Session Association** - A Taqciti meeting binds to a backend session through an explicit per-meeting client selection
- [ ] **Phase 9: Cutover + Retire Custom Extension** - Taqciti becomes the sole transcription source
- [ ] **Phase 10: AGP Question Panel in Taqciti** - Discovery questions (with lens) appear live in an "AGP" tab inside the Taqciti extension during the call

## Phase Details

### Phase 1: Area-Set Registry

**Goal**: A single source of truth generates the coverage JSON schema, eliminating the 8 hardcoded sales areas duplicated across ~6 files, with zero observable change to sales-mode output
**Depends on**: Nothing (first phase)
**Requirements**: DISC-04
**Success Criteria** (what must be TRUE):

  1. A sales-mode session's coverage classification output (8 areas, same names, order, and schema) is unchanged before and after the refactor
  2. The 8 sales coverage areas are defined in exactly one file (`coverage_areas.py`); no other file in backend or frontend hardcodes the area list
  3. `prompt_builder.py`, `llm.py`, and `session_state.py` all read the area list from the registry instead of embedding their own copy
  4. Adding a new area set (used starting Phase 2) requires editing only the registry file, not the consuming modules

**Plans**: 3/3 plans executed
**Wave 1**

- [x] 01-01-PLAN.md — Freeze golden fixture + create coverage_areas.py registry (leaf) + tracer rewire of llm.classify_coverage schema

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 01-02-PLAN.md — Rewire remaining llm.py (labels + block enum) + prompt_builder.py (relocate AREAS_BY_PROJECT_TYPE, schema not_applicable toggle, block enum)

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 01-03-PLAN.md — Rewire session_state (keys + D-04 custom_areas guard) + structured_context block enum + single-source grep gates

### Phase 2: Discovery Mode + DiscoveryPromptBuilder

**Goal**: A project configured with `mode=discovery` runs the full pipeline over the 18 discovery areas (Produto + Dados lenses) with discovery framing, while sales projects behave exactly as before
**Depends on**: Phase 1
**Requirements**: DISC-01, DISC-02, DISC-03
**Success Criteria** (what must be TRUE):

  1. A project can be created or edited with `mode=discovery` (vs `mode=sales`); existing sales projects keep working with `mode=sales` unaffected by the new column
  2. A discovery-mode session's `coverage_update` events show the 18 discovery areas (Produto + Dados lenses) instead of the 8 sales areas
  3. Discovery-mode prompts sent to the LLM omit the CITI_PORTFOLIO sales framing while still calibrating tone and depth by the project's Data Maturity Score
  4. Re-running a sales-mode session after this change still produces the 8 sales areas and CITI_PORTFOLIO-aware prompts, with no regression

> **D-12:** a lista de discovery é de **18 áreas** (não 11) — o usuário, autoridade de domínio,
> somou as 11 iniciais com novas disciplinas e fundiu duplicatas (D-06/D-06a). Os SCs acima foram
> atualizados de "11" para "18" (ajuste de texto, não de escopo).

**Plans**: 2/3 plans executed

**Wave 1**

- [x] 02-01-PLAN.md — TRACER: `DISCOVERY_AREA_SET` (18 áreas) + `DiscoveryPromptBuilder` (irmão, D-09) + `SessionState.mode`/`_init_coverage` + seleção de builder no pipeline (DISC-02, DISC-03)

**Wave 2** *(bloqueado na conclusão da Wave 1)*

- [x] 02-02-PLAN.md — Relatório discovery: gate do portfólio comercial por `mode` em `generate_report` (Pitfall 1) (DISC-03)
- [x] 02-03-PLAN.md — Configurar/persistir `mode`: migration one-way (checkpoint) + `mode` nos schemas Pydantic + toggle no formulário (DISC-01) — **CONCLUÍDO**: Task 1 decidida, Task 2 (`6b6f55a`), Task 4 toggle frontend (`dacc146`, build verde), Task 3 migration aplicada e confirmada no Supabase (2026-09-21). DISC-01 fechado ponta a ponta

### Phase 3: Two-Agent Questions + Lens Tagging

**Goal**: Produto (primary) and Dados (auxiliary) planners generate questions into one shared queue, and every coverage area, red flag, and question carries a lens tag, with no duplicate questions across the two agents
**Depends on**: Phase 2
**Requirements**: LENS-01, LENS-02, LENS-03, LENS-04, LENS-05
**Success Criteria** (what must be TRUE):

  1. In a discovery session, questions from the Produto planner (bottleneck, frente de atuação, user impact, process mapping, delivery viability) and the Dados planner (sources, quality, metrics, LGPD/security, solution approach, quick wins) both land in the same question queue, each labeled with its lens
  2. Every coverage area and every red flag shown for a discovery session carries a `lens` tag (`produto` or `dados`)
  3. Across a live session, the Dados planner triggers on a visibly slower cadence than the Produto planner (not on every question-generation cycle)
  4. No two questions in the queue — regardless of which agent produced them — are duplicates of each other; anti-repetition context is shared across both agents

**Plans**: 3/3 plans complete

**Wave 1**

- [x] 03-01-PLAN.md — TRACER: split de dois agentes (Produto/Dados) na fila única com `lens` por pergunta, contador de cadência, dedup normalizado e regressão sales (LENS-01/02/03/05, D-13/14/16/17/20/21/24)
- [x] 03-02-PLAN.md — Migration aditiva one-way (`questions.lens`, `red_flags.lens`, COMMENT em `session_prompts.agent`) + `lens` em `QuestionResponse` (LENS-03/04, D-18/23) — **autonomous:false** (checkpoint:decision + apply manual no Supabase)

**Wave 2** *(bloqueado na conclusão da Wave 1)*

- [x] 03-03-PLAN.md — Lente nos red flags (contrato JSON + fallback produto validado) e nas coverage areas (`coverage_to_dict` derivado do registro) (LENS-04, D-15/19/22)

### Phase 4: Discovery Report + Pricing Handoff

**Goal**: A discovery session produces one report with Produto, Dados, and pricing-metrics sections, and that report feeds the Precificador via the existing import flow, while sales reporting is unaffected
**Depends on**: Phase 2, Phase 3
**Requirements**: REP-01, REP-02, REP-03
**Success Criteria** (what must be TRUE):

  1. Ending a discovery session generates a single Markdown report following the CITi PRD skeleton (16 sections) with distinct Produto and Dados coverage sections, and the pricing metrics (backlog+estimates §6.3, phasing §11, volumetria §7.3) are present natively in the PRD and extractable by the import (REP-02) — reformulated per D-30/D-29 (no separately-named "Métricas para Precificação" section)
  2. Running "Importar do diagnóstico" against an *approved* discovery report extracts at least one feature into the pricing feature table, and the created pricing's `session_id` links back to the discovery session
  3. Ending a sales-mode session still generates the existing sales report format with no regression

**Plans**: 4/4 plans executed

Plans:
**Wave 1**

- [x] 04-01-PLAN.md — Tracer: espinha do handoff gateado por status (migration reports.status + grant + PATCH transição D-38 + gate no import D-37) [Wave 1]

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 04-02-PLAN.md — REP-01: esqueleto do PRD de 16 seções + duas tabelas por lens + perguntas por lens (D-26/D-27/D-28/D-40) + golden sales REP-03 [Wave 2]
- [x] 04-03-PLAN.md — Enriquecimento: blocos ampliados 7→12 (D-32) + readiness score ponderado (D-33/D-34) [Wave 2]

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 04-04-PLAN.md — Correção isolada D-39: upload_pdf_transcript propaga mode + grant de status [Wave 2]

### Phase 5: Two-Lens Monitoring (Frontend)

**Goal**: The monitoring screen visually separates the Produto and Dados lenses in discovery mode, keeps the flat layout in sales mode, and renders whatever area set the backend sends without hardcoding
**Depends on**: Phase 2, Phase 3
**Requirements**: UI-01, UI-02, UI-03
**Success Criteria** (what must be TRUE):

  1. Opening the monitoring screen for a discovery session shows coverage areas grouped into Produto and Dados sections; opening it for a sales session shows the same flat list as before
  2. Every question card and red-flag row displays a lens badge (Produto or Dados) in discovery mode
  3. `useSessionWS` and `SessionActivePage` render whatever coverage-area set the backend sends without a hardcoded area list in the frontend
  4. On the project page, a discovery session shows a readiness bar and a "Gerar PRD" button that stays blocked until readiness passes the threshold (tooltip lists what's missing) and generates the report once it does (D-41/D-47/D-49)
  5. On a finished discovery session, a report status selector (Rascunho / Em revisão / Aprovado para build) lets the user mark "Aprovado para build", which unlocks import-from-diagnosis in the Precificador (D-41/D-48)

> **D-41:** os SCs 4–5 foram acrescentados no planejamento (mesmo precedente de D-12/D-30): a Fase 5
> entrega, além de UI-01/02/03, a camada de frontend do handoff de PRD (honrando D-35 — Fase 4 fez o
> backend, Fase 5 faz o frontend). A única mudança de backend é a rota aditiva de readiness (D-49).

**Plans**: 5/5 plans executed (05-05 é fechamento de gaps, aguardando execução)

**Wave 1**

- [x] 05-01-PLAN.md — TRACER: cobertura server-driven + agrupamento por lente (kill hardcoded, consome name+lens, empty state) + semente de regressão sales byte-idêntico (UI-01/UI-03)
- [x] 05-03-PLAN.md — Backend aditivo: rota `GET /sessions/{id}/readiness` (D-49) + `ReportResponse.status` (Impl Note 3) + client api.ts (Readiness/Report.status/getReadiness/updateReportStatus) (REP-02)

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 05-02-PLAN.md — Badges de lente em QuestionCard + linhas de red flag (D-44) + 18 labels de bloco discovery + ocultar botão Relatório da topbar em discovery (UI-02)

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 05-04-PLAN.md — Handoff de PRD (frontend): ReadinessBar + "Gerar PRD" gated por readiness (D-47) + seletor de status/aprovação na sessão encerrada (D-48) (REP-02)

**Gap closure** *(fecha CR-01/CR-02 da 05-VERIFICATION.md)*

- [x] 05-05-PLAN.md — Fechamento de gaps: gate do botão "Relatório" por fonte síncrona (hasReceivedInitialState, CR-01) + separar prdError de readinessError com retry no "Gerar PRD" (CR-02) (UI-01/UI-02/UI-03/REP-02)

**UI hint**: yes

### Phase 6: Opt-In Webhook Auth

**Goal**: The transcription webhook is protected by a shared-secret header that is opt-in — current production traffic is unaffected until the secret is configured
**Depends on**: Nothing new (starts the Taqciti track; independent of Phases 1-5)
**Requirements**: TAQ-03
**Success Criteria** (what must be TRUE):

  1. With `EXTENSION_SHARED_KEY` unset, `POST /webhook/extension` continues to accept chunks exactly as it does today
  2. With `EXTENSION_SHARED_KEY` set, a request missing the `x-agente-key` header (or sending the wrong value) is rejected
  3. With `EXTENSION_SHARED_KEY` set and the correct `x-agente-key` header supplied, the request is accepted and processed normally

**Plans**: 2/2 plans executed (1 executed, 1 gap-closure pending)

**Wave 1**

- [x] 06-01-PLAN.md — TRACER: gate opt-in por shared-secret (`verify_extension_key`, route-scoped em `extension_webhook`) + expansão: campo opcional de chave na extensão Chrome (D-01/D-02, TAQ-03)

**Gap closure** *(fecha G-06-1 do 06-UAT.md — bloqueado na conclusão da Wave 1)*

- [x] 06-02-PLAN.md — GAP G-06-1 (replanejado): rastreio de edição por campo no popup (regras puras em `extension/lib/configFieldGuard.js`) — o polling de 3s nunca sobrescreve texto não salvo, nem depois de o foco sair para o "Salvar" (Tab/mousedown) ou de um clique fora; "Salvar" grava exatamente o texto digitado e relê o valor salvo após confirmação. Tracer no campo da chave + campo URL do backend, com testes `node:test` (zero dependências) que executam o popup e o `background.js` reais (TAQ-03/D-02)

### Phase 7: Taqciti Config + Background Streamer

**Goal**: Taqciti streams merged live caption segments to the backend during a call, reusing the existing `/webhook/extension` endpoint, without disturbing Taqciti's existing batch flow
**Depends on**: Phase 6
**Requirements**: TAQ-01
**Success Criteria** (what must be TRUE):

  1. During a live Google Meet call, Taqciti streams merged caption segments to `/webhook/extension` in near-real-time, not only after the call ends
  2. Taqciti's existing batch `/api/generate` flow continues to work unchanged for calls that don't use live streaming
  3. The Agente backend URL and streaming toggle are configurable in Taqciti (via `agenteConfig.ts`) rather than hardcoded

**Plans**: 4/4 plans complete (07-04 é fechamento de gaps, aguardando execução)

**Wave 1**

- [x] 07-01-PLAN.md — Importação da Taqciti em `taqciti/` via `git subtree` (commit isolado, com histórico — D-01/D-02/D-03) + TRACER do streaming ponta a ponta: flush agrupado de 250 ms → delta palavra-a-palavra por segmento → `POST /webhook/extension` com `x-agente-key` condicional, desligado por padrão (D-06/D-07/D-08/D-09/D-10) + casos de borda (TAQ-01)

**Wave 2** *(bloqueada na conclusão da Wave 1)*

- [x] 07-02-PLAN.md — Config do Agente editável em runtime: store em `chrome.storage.local` (`taq:agenteConfig`, fila de patch + `onChanged`) ligado como fonte do streamer — liga/desliga sem recompilar, sem backfill ao religar (D-08/D-09/D-10, TAQ-01)

**Wave 3** *(bloqueada na conclusão da Wave 2)*

- [x] 07-03-PLAN.md — Tela "Agente Diagnóstico" na saída larga (`?view=agente`, link na tela inicial, sem `default_popup`): toggle, session_id manual, URL e chave mascarada + verificação final (typecheck/lint/test/build da Taqciti, pytest do backend, nada fora do escopo alterado) (D-04/D-05/D-08/D-09/D-10, TAQ-01)

**Gap closure** *(fecha G-07-1/G-07-2 do 07-UAT.md — linhas fragmentadas palavra a palavra na tela de monitoramento)*

- [x] 07-04-PLAN.md — GAP G-07-1/G-07-2: envio ao Agente agrupado por fala (janela de silêncio de 1,5 s + teto de 5 s + envio imediato no fim/pausa) em `phraseBatcher.ts` puro + timer único no `agenteStreamer.ts`; cadência local de 250 ms, `sessionController.ts` e `wordDelta.ts` intocados; abre com checkpoint de refinamento do D-06 — **autonomous:false** (TAQ-01)

### Phase 8: Taqciti Session Association

**Goal**: A Taqciti meeting binds to a backend discovery session through an explicit per-meeting client selection (replaces the earlier localStorage auto-detect, decided in `08-CONTEXT.md` D-01); chunks are never attributed without an explicit binding
**Depends on**: Phase 7
**Requirements**: TAQ-02
**Context**: `.planning/phases/08-taqciti-session-association/08-CONTEXT.md`
**Success Criteria** (what must be TRUE):

  1. When a meeting is detected, Taqciti asks the user to pick a client from a searchable list (or create a new one) or to defer; choosing a client creates a new backend session for that meeting and streams the meeting's speech to it
  2. A deferred meeting is kept only in Taqciti and sends nothing until a client is chosen at the end of the meeting (or from the panel); "Descartar" asks for confirmation and removes the meeting from Taqciti's local history only
  3. The manual session-id field from Phase 7 stays as a hidden fallback that appears only when the client list cannot load; chunks are only attributed to a session when the binding is explicit — never guessed or defaulted silently
  4. When the Agente is unreachable during a live meeting, unsent speech is kept and resent once it is back, and the user is told on screen that the Agente is offline
  5. Sessions that Taqciti created are closed automatically so the Agente never keeps spending AI after the call: on meeting end (including closing the meeting tab) as soon as the send queue is empty, and after 5 minutes if sending is stalled; a live meeting is never closed; coming back to the same room after the session was closed starts a new meeting (new pending association and a new session with only what is said afterwards)

**Open team decisions** (block the tasks that depend on them; see `08-CONTEXT.md`): new extension routes for listing clients, creating clients and creating sessions (API contract); removing the required Gemini key from project creation (API contract); a per-chunk identifier on the webhook to avoid duplicates on resend (webhook contract)

**Answered team decisions (2026-10-12, see `08-DECISOES-PENDENTES.md`)**: B4-b (close the session on meeting end with an empty queue; 5 minutes when sending is stalled; coming back to the same room = new meeting); DA-1 (the new meeting gets a new history record, a new association and a session with only what is said after coming back); DA-2 ("Continuar envio" after the session was closed shows the closed-session notice); DA-3 (closing the meeting tab mid-call counts as the end of the meeting). Open and non-blocking: DA-4 (tab navigates away from Meet mid-call) and DA-5 (what closes a session after the Taqciti gave up closing it)

**Plans**: 23/27 plans executed
**UI hint**: yes

**Wave 1**

- [x] 08-01-PLAN.md — Tracer: o vínculo por reunião decide o destino do streamer (extração mecânica do CR-01, semente `{}`, reevaluate) + reducer completo da associação (fim, retomada e conclusão por estado)
- [x] 08-02-PLAN.md — Kit (ícone alert, keyframe nudge, ConfirmModal.cancelLabel) + bolha "!" e cartão de decisão
- [x] 08-03-PLAN.md — Portas ClientDirectory/AgenteSessionGateway + busca sem acento + seletor de clientes com plano B
- [x] 08-04-PLAN.md — Barra de vínculo, cartão de fim da reunião (envio em partes) e selo do histórico
- [x] 08-05-PLAN.md — Motor do envio em partes (plano puro + executor serial com pausa e retomada)
- [x] 08-06-PLAN.md — Backend: asyncio.Lock por sessão em get_or_create + prova da suposição A1 (chunk_id extra)
- [x] 08-07-PLAN.md — [DECISÃO B1 + B4-a] Rotas da extensão: listar clientes e criar sessão
- [x] 08-08-PLAN.md — [DECISÃO B2] Chave Gemini opcional na criação de projeto (backend + web app)

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 08-09-PLAN.md — [DECISÃO B3 + B3-b + B3-c] Webhook idempotente por chunk_id + migração aplicada por humano; no mesmo checkpoint, B3-b (desistir ou não de fala recusada com HTTP 500) e B3-c opcional (404 para session_id inexistente)
- [x] 08-10-PLAN.md — Comandos ui/agente/* + vínculo ao vivo (backfill + semente) e envio da reunião encerrada
- [x] 08-11-PLAN.md — Fila durável (store) + status de entrega em storage.local (reenvio nasce desligado até a B3) + rastro persistente de falas descartadas e a nota dele na tela "Agente Diagnóstico"

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 08-12-PLAN.md — Criar cliente pela extensão + portas HTTP reais na Taqciti
- [x] 08-14-PLAN.md — Painel do Meet: bolha "!", cartão, seletor e barra de vínculo (hooks e contêineres)
- [x] 08-22-PLAN.md — Ciclo de vida da associação: pendente ao detectar, não enviada no fim, retomada da mesma sala, recuperação no boot
- [x] 08-23-PLAN.md — Sender sobre a fila durável: refactor de API, sem descarte do mais antigo, retirada por HTTP 500 só conforme a resposta B3-b do time, toda fala descartada anotada no rastro, fiação e ponta a ponta de queda/reinício

**Wave 4** *(blocked on Wave 3 completion)*

- [x] 08-13-PLAN.md — [D-11 porta sem volta] Evicção protegida do histórico + comando de descarte
- [x] 08-15-PLAN.md — [B4-b já respondida] Rota de encerramento da sessão criada pela Taqciti (idempotente, só source extension, parador de pipeline injetado) + correção da corrida do stop_session
- [x] 08-18-PLAN.md — [DECISÃO B5] Tela "Agente Diagnóstico": ID manual só no plano B, sem destino silencioso
- [x] 08-19-PLAN.md — Aplica a B3 na Taqciti: chunk_id no corpo + reenvio automático ligado

**Wave 5** *(blocked on Wave 4 completion)*

- [x] 08-16-PLAN.md — Alicerce do encerramento (B4-b): tempos da decisão (5 min, 30 s, 10 s, backoff limitado) fixados por teste, a associação guarda o encerramento e a porta HTTP do finish — inerte
- [x] 08-17-PLAN.md — Fim da reunião e histórico: enviar ao Agente, descartar com confirmação, selos

**Wave 6** *(blocked on Wave 5 completion)*

- [x] 08-27-PLAN.md — Agendador do encerramento (B4-b): encerra na hora com a fila vazia, prazo de 5 min com envio parado, backoff limitado, nunca com a reunião ao vivo; kick dedicado do envio — ainda inerte

**Wave 7** *(blocked on Wave 6 completion)*

- [x] 08-24-PLAN.md — Reentrada na mesma sala depois do encerramento = reunião nova (ajuste do 08-22; DA-1 respondida): regra no reducer, boot e máquina da reunião (`startFresh`)

**Wave 8** *(blocked on Wave 7 completion)*

- [ ] 08-26-PLAN.md — [DA-3 respondida] Fechar a aba da reunião no meio da call conta como fim da reunião (handler extraído em refator separado; máquina da Fase 7 intocada)

**Wave 9** *(blocked on Wave 8 completion)*

- [ ] 08-25-PLAN.md — Fiação do encerramento automático (B4-b): permissão alarms, listener síncrono, `isMeetingLive` testado, reavaliação no boot e gatilhos (fim da reunião, envio em partes, vínculo)

**Wave 10** *(blocked on Wave 9 completion)*

- [ ] 08-20-PLAN.md — "Continuar envio" do índice confirmado, com o aviso de sessão já encerrada (DA-2)

**Wave 11** *(blocked on Wave 10 completion)*

- [ ] 08-21-PLAN.md — Portão automático completo + roteiro manual D-20 (a-i) numa reunião real

### Phase 9: Cutover + Retire Custom Extension

**Goal**: Taqciti is the sole transcription source in production; the custom extension is removed while the backend contract it used remains intact for historical data
**Depends on**: Phase 6, Phase 7, Phase 8
**Requirements**: TAQ-04
**Success Criteria** (what must be TRUE):

  1. A full discovery session — transcript, coverage updates, questions, and final report — completes end-to-end using only Taqciti as the transcription source
  2. The `extension/` directory and its packaged zip are removed from the repository
  3. The `/webhook/extension` endpoint, the `ExtensionChunk` model, and the `extension` source enum value remain intact in the backend, so historical sessions referencing them still resolve

**Plans**: TBD

### Phase 10: AGP Question Panel in Taqciti

**Goal**: During a live call, the discovery questions generated by the backend (each with its produto/dados lens) appear in near-real-time inside a dedicated "AGP" tab in the Taqciti extension, scoped to the bound discovery session — so the operator reads the questions to ask without leaving Taqciti
**Depends on**: Phase 3 (lens-tagged questions), Phase 8 (session binding)
**Requirements**: TAQ-05
**Success Criteria** (what must be TRUE):

  1. With Taqciti bound to an active discovery session, an "AGP" tab shows that session's live question queue (each card carrying its produto/dados lens), updating as the backend emits new questions
  2. The questions and lenses shown in AGP come from the backend for the bound session (reusing the existing `/ws/{session_id}` `question_new` / `question_expired` stream) — Taqciti does not recompute or invent questions
  3. AGP renders questions only when the session binding is explicit (from Phase 8); with no bound session it shows an empty/prompt state, never questions from a guessed or defaulted session
  4. The panel lives in the Taqciti repo and does not disturb Taqciti's existing capture/streaming flow (Phases 7-8) nor the Agente web app's own question view (Phase 5)

**Plans**: TBD
**UI hint**: yes
**Note**: Lives in the separate Taqciti repo (like Phases 7-8); coordinate repo access before starting. Ordered after cutover for a clean insertion, but depends only on Phases 3 and 8 — it can be pulled earlier if the team prefers to validate capture + questions display in a single real call.

## Progress

**Execution Order:**
Phases 1-5 (domain reframe) then Phases 6-10 (Taqciti transcription swap + AGP panel): 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9 → 10

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Area-Set Registry | 3/3 | Complete    | 2026-09-20 |
| 2. Discovery Mode + DiscoveryPromptBuilder | 3/3 | Complete    | 2026-09-21 |
| 3. Two-Agent Questions + Lens Tagging | 3/3 | Complete    | 2026-09-22 |
| 4. Discovery Report + Pricing Handoff | 4/4 | Complete    | 2026-09-23 |
| 5. Two-Lens Monitoring (Frontend) | 5/5 | Complete    | 2026-09-24 |
| 6. Opt-In Webhook Auth | 2/2 | Complete    | 2026-09-25 |
| 7. Taqciti Config + Background Streamer | 4/4 | Complete    | 2026-09-27 |
| 8. Taqciti Session Association | 23/27 | In Progress | - |
| 9. Cutover + Retire Custom Extension | 0/? | Not started | - |
| 10. AGP Question Panel in Taqciti | 0/? | Not started | - |

## Backlog

### Phase 999.1: Follow-up — Phase 7 deferred UAT follow-up: caption quality/punctuation lag (BACKLOG)

**Goal:** Improve punctuation and coherence of the text streamed to the Agente, which currently comes straight from Google Meet's native captions (CC) with no cleanup pass
**Source phase:** 07
**Deferred at:** 2026-09-26 during /gsd-verify-work 07 session
**Follow-ups:**
- [ ] User reported during SC1 UAT: "a pontuação, entendimento das falas pelo taqciti estão muito defasada" — Meet's own captions are the source; a fix would require an AI cleanup/rewrite pass over the raw caption text, which is new scope, not a Phase 7 defect (deferred 2026-09-26)

### Phase 999.2: Follow-up — Phase 7 deferred UAT follow-up: make the Agente Diagnóstico link more prominent in Taqciti (BACKLOG)

**Goal:** Make the "Agente Diagnóstico · streaming ao vivo" entry point on the Taqciti home screen more visually explicit (currently a small muted-caption text link)
**Source phase:** 07
**Deferred at:** 2026-09-26 during /gsd-verify-work 07 session
**Follow-ups:**
- [ ] User reported during SC1 UAT: "a parte de conectar com a gente diagnostico está muito pequena na aba do taqciti, quero deixar mais explicito essa conexão" — cosmetic/UX polish, out of Phase 7's scope (deferred 2026-09-26)

### Phase 999.3: Follow-up — Phase 7 deferred UAT follow-up: option to not generate a transcript for a meeting (BACKLOG)

**Goal:** Let the user opt a given Taqciti meeting out of transcript generation entirely (today every captured meeting produces a transcript)
**Source phase:** 07
**Deferred at:** 2026-09-26 during /gsd-verify-work 07 session
**Follow-ups:**
- [ ] User reported during SC1 UAT: "não existe uma opção de não querer gerar uma transcrição" — product-scope decision, needs team alignment before planning (deferred 2026-09-26)
