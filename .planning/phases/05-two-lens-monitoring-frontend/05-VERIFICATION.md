---
phase: 05-two-lens-monitoring-frontend
verified: 2026-09-25T00:00:00Z
status: gaps_found
score: 4/6 must-haves verified
covered_files:
  - ".planning/REQUIREMENTS.md"
  - ".planning/phases/05-two-lens-monitoring-frontend/05-01-PLAN.md"
  - ".planning/phases/05-two-lens-monitoring-frontend/05-01-SUMMARY.md"
  - ".planning/phases/05-two-lens-monitoring-frontend/05-02-PLAN.md"
  - ".planning/phases/05-two-lens-monitoring-frontend/05-02-SUMMARY.md"
  - ".planning/phases/05-two-lens-monitoring-frontend/05-03-PLAN.md"
  - ".planning/phases/05-two-lens-monitoring-frontend/05-03-SUMMARY.md"
  - ".planning/phases/05-two-lens-monitoring-frontend/05-04-PLAN.md"
  - ".planning/phases/05-two-lens-monitoring-frontend/05-04-SUMMARY.md"
  - ".planning/phases/05-two-lens-monitoring-frontend/05-REVIEW.md"
  - "backend/app/models/sessions.py"
  - "backend/app/routers/sessions.py"
  - "backend/tests/test_readiness_route.py"
  - "frontend/package.json"
  - "frontend/src/lib/api.ts"
  - "frontend/src/lib/lens.test.ts"
  - "frontend/src/lib/lens.ts"
  - "frontend/src/lib/useSessionWS.ts"
  - "frontend/src/pages/ProjectDetailPage.tsx"
  - "frontend/src/pages/SessionActivePage.tsx"
  - "frontend/vite.config.ts"
covered_digest: "v1:sha256:a6f3ea1fd7238573959fb39f3ec8e3e235070ae078f292b5ee4b316c83fb0884"
behavior_unverified: 0
overrides_applied: 0
gaps:
  - truth: "Botão 'Relatório' da topbar da sessão ativa fica oculto quando o modo é discovery (05-02 Impl Note 7, suporte a D-47)"
    status: failed
    reason: "isDiscoveryCoverage(ws.coverage) infere o modo a partir do payload assíncrono do WebSocket, que nasce vazio ({}) até o evento initial_state chegar. Nessa janela (montagem do componente ou após qualquer queda de conexão — useSessionWS não reconecta automaticamente, só marca connected:false), isDiscoveryCoverage({}) retorna false, então o botão 'Relatório' é renderizado e fica clicável mesmo numa sessão discovery, disparando POST /sessions/{id}/report diretamente — rota que não verifica readiness_score() em nenhum momento no backend. O único gate do fluxo D-47 é esse condicional no front, e ele está incorreto por construção nessa janela."
    artifacts:
      - path: "frontend/src/pages/SessionActivePage.tsx"
        issue: "linha 1053: `{!isDiscoveryCoverage(ws.coverage) && (<button onClick={handleGenerateReport} ...>` usa um estado assíncrono derivado do WS como fonte de verdade do modo, em vez de um campo síncrono (ex.: session.mode, já disponível em `session` desde o `api.sessions.get` no mount)."
    missing:
      - "Gate por uma fonte síncrona confiável do modo (ex.: `session.mode` em vez de `isDiscoveryCoverage(ws.coverage)`), ou um flag explícito `hasReceivedInitialState` que mantenha o botão oculto em discovery até o primeiro `initial_state` chegar."
  - truth: "O botão 'Gerar PRD' da página do projeto permite gerar o relatório de forma confiável quando pronto, incluindo recuperação de falhas transitórias (parte de SC4 — 'gera o relatório quando [a readiness] passa [o limiar]')"
    status: failed
    reason: "`readinessError` é reaproveitado tanto para a falha do GET readiness quanto para a falha do POST generateReport (dentro de `handleGeneratePrd`). Ao falhar a geração do PRD (ex.: chave Gemini ausente/expirada, timeout, rate limit), o botão fica desabilitado PERMANENTEMENTE — a condição de `disabled` inclui `!!readinessError`, e nada limpa esse estado de novo para a mesma sessão (o único `useEffect` que reseta `readinessError` roda apenas quando `discoverySessionId` muda) — e a mensagem exibida ao usuário é sempre o texto fixo 'Erro ao carregar readiness', descolada da causa real. Uma sessão cujo readiness já passou o limiar perde a capacidade de gerar o PRD após qualquer falha transitória, sem caminho de retry a não ser recarregar a página inteira."
    artifacts:
      - path: "frontend/src/pages/ProjectDetailPage.tsx"
        issue: "estado único `readinessError` (linha 97) compartilhado entre o fetch de readiness (linhas 118-127) e `handleGeneratePrd` (linhas 129-140, catch em 135-136); o JSX (linhas 399-403) sempre renderiza o texto fixo do caso GET; `disabled` (linha 406) inclui `!!readinessError` sem distinguir a origem do erro."
    missing:
      - "Separar `readinessError` (falha do GET, mantém o gate fail-closed) de um `prdError` dedicado (falha do POST generateReport); não incluir `prdError` na condição de `disabled` do botão — permitir nova tentativa; exibir a mensagem real da falha de geração em vez do texto fixo de readiness."
---

# Fase 5: Two-Lens Monitoring Frontend + PRD Handoff — Relatório de Verificação

**Objetivo da fase:** a tela de monitoramento separa visualmente as lentes Produto e Dados no modo
discovery, mantém o layout plano no modo vendas, e renderiza qualquer conjunto de áreas que o backend
mandar sem hardcode. Adicionalmente (D-41): a camada de frontend do handoff de PRD — barra de
readiness + botão "Gerar PRD" gated na página do projeto, e um seletor de status/aprovação de
relatório numa sessão discovery encerrada. A única mudança de backend é a rota aditiva de readiness
(D-49).

**Verificado em:** 2026-09-25
**Status:** gaps_found
**Re-verificação:** Não — verificação inicial

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidência |
|---|-------|--------|-----------|
| 1 | Sessão discovery agrupa cobertura em Produto/Dados; sessão sales mostra a mesma lista plana de hoje | ✓ VERIFIED | `frontend/src/pages/SessionActivePage.tsx` `CoveragePanel` (linhas 100-157): empty state → duas seções por lente (discovery) → lista plana idêntica (sales). Coberto por `frontend/src/lib/lens.test.ts` (6 casos, todos verdes — rodei `npm test` diretamente: `6 passed (6)`). |
| 2 | Todo card de pergunta e toda linha de red flag exibem badge de lente em discovery | ✓ VERIFIED | `QuestionCard` (linhas 403-414) e `TranscriptPanel` (linhas 305-309) renderizam `<LensBadge>` gated por `question.lens != null` / `rf.lens != null`; sales (lens null) preserva o chip/linha atual sem badge. `grep BADGE_WIRED_OK` confirma `lensBadgeVariant`/`isDiscoveryCoverage` ligados no componente. |
| 3 | `useSessionWS`/`SessionActivePage` renderizam o conjunto de áreas que o backend manda, sem lista hardcoded | ✓ VERIFIED | `useSessionWS.ts` não contém mais `COVERAGE_AREAS`/`INITIAL_COVERAGE`; `SessionActivePage.tsx` não contém mais `AREA_LABELS` (`grep` confirma ausência — `NO_HARDCODE_OK`). `CoverageArea.name`/`.lens` tipados e usados via `info.name \|\| area`. |
| 4 | Página do projeto: barra de readiness + botão "Gerar PRD" bloqueado abaixo do limiar (tooltip com o que falta) e que gera o relatório quando pronto | ✗ FAILED (parcial) | Fail-closed nos 3 estados documentados (`!readiness?.ready \|\| readinessLoading \|\| !!readinessError`) está correto e o caminho feliz funciona (`ProjectDetailPage.tsx:404-415`). Mas `readinessError` é reaproveitado para a falha de **geração** do PRD (não só a falha do GET) e trava o botão **permanentemente** sem retry, com mensagem enganosa — ver gap 2 abaixo (= CR-02 do code review, não corrigido). |
| 5 | Sessão discovery encerrada: seletor de status (Rascunho/Em revisão/Aprovado para build); "Aprovado para build" sinaliza liberação de import no Precificador | ✓ VERIFIED | `SessionActivePage.tsx` linhas 925-952: `<select>` com as 3 opções verbatim, gated por `finishedReport.status != null`, `handleUpdateReportStatus` no padrão disable-while-mutating, hint "Libera a importação no Precificador" exibido quando aprovado. `grep STATUS_SELECTOR_OK` confirma. |
| 6 | (05-02 Impl Note 7, must-have de plano) Botão "Relatório" da topbar oculto na sessão ativa quando o modo é discovery | ✗ FAILED | `SessionActivePage.tsx:1053` usa `!isDiscoveryCoverage(ws.coverage)`; `ws.coverage` nasce `{}` (ver `useSessionWS.ts:62-70`) até o `initial_state` chegar — nessa janela o botão aparece e é clicável mesmo em discovery, chamando `POST /sessions/{id}/report` sem NENHUM gate de readiness no backend (`generate_session_report`, `backend/app/routers/sessions.py:325-343`, não verifica `readiness_score()`). = CR-01 do code review, não corrigido. |

**Score:** 4/6 truths verificadas (0 behavior-unverified)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `frontend/src/lib/lens.ts` | `isDiscoveryCoverage`, `groupCoverageByLens`, `blockLabel`, `lensLabel`, `lensBadgeVariant`, `BLOCK_LABELS` (18+8) | ✓ VERIFIED | Todos presentes, puros (sem import de React), exportados e testados. |
| `frontend/src/lib/useSessionWS.ts` | `CoverageArea.name/.lens`, `RedFlag.lens`, `WSQuestion.lens`; sem `COVERAGE_AREAS`/`INITIAL_COVERAGE` | ✓ VERIFIED | Tipos presentes (linhas 4-30); `coverage` inicial `{}` (linha 63). |
| `frontend/src/pages/SessionActivePage.tsx` `CoveragePanel` | agrupamento por lente + empty state + labels server-driven | ✓ VERIFIED | Linhas 54-176. |
| `frontend/src/pages/SessionActivePage.tsx` `QuestionCard`/`TranscriptPanel` | badge de lente | ✓ VERIFIED | Linhas 389-448, 258-345. |
| `frontend/src/pages/SessionActivePage.tsx` topbar | botão "Relatório" oculto em discovery | ⚠️ WIRED MAS INCORRETO | Existe e compila, mas a condição usa uma fonte assíncrona (ver gap 1 / truth 6). |
| `frontend/src/lib/lens.test.ts` | testes de regressão | ✓ VERIFIED | 6 casos, todos verdes (`npm test`). |
| `backend/app/models/sessions.py::ReportResponse.status` | `Optional[Literal] = None` | ✓ VERIFIED | Linha 34; construção sem `status` retorna `None` (sales preservado). |
| `backend/app/routers/sessions.py` `GET /{session_id}/readiness` | rota aditiva, `allow_finished=True`, 404 padrão | ✓ VERIFIED | Linhas 382-394; `pytest tests/test_readiness_route.py` → 2 passed. |
| `frontend/src/lib/api.ts` | `Readiness`, `Report.status`, `getReadiness`, `updateReportStatus` | ✓ VERIFIED | `grep API_CLIENT_OK` confirma; `tsc -b --noEmit` limpo. |
| `frontend/src/pages/ProjectDetailPage.tsx` | `ReadinessBar` + bloco "Gerar PRD" + `READINESS_SIGNAL_LABELS` | ⚠️ WIRED MAS COM BUG DE ERRO | Existe, compila, fail-closed correto no caminho feliz; bug de erro conflado (gap 2). |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| WS `coverage_update.areas`/`initial_state.coverage` | `useSessionWS` tipos → `lens.ts` → `CoveragePanel` | payload cru propagado | ✓ WIRED | Confirmado por leitura direta do código + testes. |
| WS `question_new`/`red_flag` (com `lens`) | `QuestionCard`/`TranscriptPanel` via `LensBadge` | tipos da 05-01 | ✓ WIRED | Confirmado. |
| `SessionState.readiness_score()` | `GET /sessions/{id}/readiness` → `api.sessions.getReadiness` → `ProjectDetailPage` | `pipeline_manager.get_or_create(allow_finished=True)` + 404 | ✓ WIRED | Rota testada (200 com 4 campos + `allow_finished=True` assertado; 404 para sessão inexistente). |
| `PATCH /sessions/{id}/report` (D-38) | `api.sessions.updateReportStatus` → seletor de status | contrato existente | ✓ WIRED | Confirmado por leitura direta. |
| `isDiscoveryCoverage(ws.coverage)` | visibilidade do botão "Relatório" da topbar | estado assíncrono do WS | ⚠️ MAL-WIRED | Fonte de verdade errada (ver gap 1) — tecnicamente "ligado", mas a lógica de gate é incorreta na janela pré-`initial_state`. |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|---------------------|--------|
| `CoveragePanel` | `coverage` | `ws.coverage` (WebSocket `initial_state`/`coverage_update`) | Sim | ✓ FLOWING |
| `ReadinessBar` / botão "Gerar PRD" | `readiness` | `api.sessions.getReadiness(sessionId)` (fetch real, `GET /sessions/{id}/readiness`) | Sim | ✓ FLOWING |
| Seletor de status | `finishedReport.status` | `api.sessions.getReport` (mount) → `api.sessions.updateReportStatus` (PATCH) | Sim | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Tipos server-driven compilam ponta a ponta | `cd frontend && npx tsc -b --noEmit` | exit 0, sem "error TS" | ✓ PASS |
| Regressão sales byte-idêntico + agrupamento discovery + labels + badge | `cd frontend && npm test` | `6 passed (6)` | ✓ PASS |
| Rota de readiness (200 com 4 campos + `allow_finished=True`; 404) | `cd backend && python -m pytest tests/test_readiness_route.py -x -q` | `2 passed` | ✓ PASS |
| Ausência de hardcode (`COVERAGE_AREAS`/`AREA_LABELS`) + helpers puros presentes | greps do PLAN (05-01/05-02/05-03/05-04) | Todos imprimiram o marcador esperado (`NO_HARDCODE_OK`, `LENS_HELPERS_OK`, `BADGE_WIRED_OK`, `GERAR_PRD_OK`, `STATUS_SELECTOR_OK`) | ✓ PASS |
| Suíte completa do backend (contexto, não re-executada aqui — já rodada na 05-03) | `python -m pytest -q` (relatado no SUMMARY 05-03) | 88 passed, 4 skipped, 1 failed (pré-existente, depende de Supabase real, fora do escopo da fase) | ℹ️ INFO |

### Probe Execution

Não aplicável — a fase não declara probes de migração/tooling (`scripts/*/tests/probe-*.sh`); nenhum
achado nos PLANs/SUMMARYs desta fase referenciando probes.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|--------------|--------|----------|
| UI-01 | 05-01 | Cobertura agrupada por lente em discovery, lista plana em sales | ✓ SATISFIED | `CoveragePanel` + `lens.test.ts` |
| UI-02 | 05-02 | Badge de lente em pergunta e red flag | ✓ SATISFIED | `QuestionCard`/`TranscriptPanel` + `LensBadge` |
| UI-03 | 05-01 | Cobertura server-driven, sem hardcode | ✓ SATISFIED | `useSessionWS.ts`/`lens.ts` + greps `NO_HARDCODE_OK` |
| REP-02 | 05-03, 05-04 | Handoff de PRD alimenta o Precificador (backend em Fase 4; esta fase entrega a última milha de UI — readiness route + Gerar PRD + seletor de aprovação) | ⚠️ PARCIALMENTE SATISFEITO | Rota + client + UI existem e compilam/testam verde, mas 2 defeitos Críticos do code review (CR-01/CR-02) permanecem sem correção, comprometendo a integridade do gate de readiness (truth 6) e a confiabilidade do botão "Gerar PRD" após falha (truth 4). `REQUIREMENTS.md` já marcava REP-02 como "Complete" na Fase 4 (mecanismo de backend do import-from-diagnosis); esta fase adiciona a superfície de UI, que tem os defeitos acima. |

Nenhum requirement órfão: os 4 IDs declarados nos frontmatters dos planos (UI-01, UI-02, UI-03, REP-02)
aparecem em `REQUIREMENTS.md` e estão todos mapeados/contabilizados na tabela de rastreabilidade.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `frontend/src/pages/SessionActivePage.tsx` | 1053 | Gate de modo derivado de estado assíncrono (`ws.coverage`) que nasce vazio | 🛑 Blocker | Botão "Relatório" (sem gate de readiness) fica visível/clicável em discovery na janela antes do `initial_state` — contorna o fluxo D-47. Confirma CR-01 do `05-REVIEW.md`, não corrigido. |
| `frontend/src/pages/ProjectDetailPage.tsx` | 97, 118-140, 399-416 | Estado de erro único reaproveitado para duas causas distintas, sem caminho de retry | 🛑 Blocker | Falha transitória na geração do PRD trava o botão "Gerar PRD" permanentemente e mostra mensagem errada ao usuário. Confirma CR-02 do `05-REVIEW.md`, não corrigido. |
| `frontend/src/pages/ProjectDetailPage.tsx` | 114-116, 129-140 | `pickDiscoverySession` não filtra por `status`; redirect pós-geração pode cair numa sessão ainda ativa que não mostra o relatório recém-gerado | ⚠️ Warning | Confirma WR-01 do `05-REVIEW.md`, não corrigido (não invalida diretamente nenhum success criterion, mas é uma lacuna de UX real do handoff). |
| `frontend/vite.config.ts` | 17-20 | `environment: 'node'` + `include: ['src/**/*.test.ts']` — não cobre `.tsx` nem jsdom | ⚠️ Warning | Testes de componente React futuros (`@testing-library/react` já é devDependency) serão silenciosamente ignorados. Confirma WR-02, não corrigido. |
| `backend/app/routers/sessions.py` | 382-394 | Rota nova sem `response_model` explícito | ⚠️ Warning | Inconsistência com o resto do arquivo; sem validação de schema na saída. Confirma WR-03, não corrigido. |

Nenhum debt marker (`TBD`/`FIXME`/`XXX`/`TODO`/`HACK`/`PLACEHOLDER`) encontrado nos arquivos desta fase.

### Human Verification Required

Não aplicável ao frontmatter (status é `gaps_found`, que tem precedência sobre `human_needed` na árvore
de decisão). Registro apenas informativo: as 05-01/05-02/05-03/05-04 SUMMARY.md acumulam vários itens
`human_judgment: true` (render visual real de badges, empty state, seletor de status, barra de
readiness) que ainda não foram confirmados visualmente por um humano em uma sessão discovery real. Isso
é adicional aos dois gaps acima — recomendo essa confirmação visual **depois** de corrigir os gaps 1 e 2,
já que ambos os gaps afetam exatamente as telas que precisariam da inspeção visual.

## Gaps Summary

A fase entrega corretamente a parte "pura" e mais arriscada arquiteturalmente (UI-01/UI-02/UI-03):
`lens.ts` está bem coberto por teste, a inferência de modo e o agrupamento por lente preservam o sales
byte-idêntico, e a cobertura deixou de ser hardcoded no front — tudo confirmado por leitura direta do
código e por `npm test`/`tsc -b --noEmit` rodados agora, não apenas pelas alegações do SUMMARY.

O problema real está nos dois Blockers já apontados pelo `05-REVIEW.md` (CR-01, CR-02) e que **continuam
presentes no código atual**, sem correção nem override registrado:

1. **CR-01** — o botão "Relatório" da sessão ativa (sem nenhum gate de readiness no backend) vaza para
   sessões discovery durante a janela entre o mount do componente e o primeiro evento `initial_state` do
   WebSocket, porque o gate usa `isDiscoveryCoverage(ws.coverage)` — um estado assíncrono que nasce
   vazio — em vez de uma fonte síncrona como `session.mode`. Isso abre um caminho real, ainda que
   estreito, para gerar um relatório de discovery sem passar pelo readiness gate que é o núcleo do D-47.
2. **CR-02** — na página do projeto, o mesmo estado `readinessError` cobre tanto a falha de buscar o
   readiness quanto a falha de gerar o PRD; uma falha transitória na geração trava o botão "Gerar PRD"
   permanentemente (sem retry) e mostra uma mensagem de erro que não corresponde à causa real.

Nenhum dos dois foi corrigido entre a revisão de código (`05-REVIEW.md`, `2026-09-23`) e o estado atual
do repositório — confirmado por leitura direta das linhas exatas apontadas pela review. Por isso o
`REQUIREMENTS.md` marcar UI-01/UI-02/UI-03/REP-02 como "Complete" está adiantado: as três primeiras estão
de fato satisfeitas, mas REP-02 (a parte entregue nesta fase — o handoff de PRD) carrega dois defeitos
Críticos não resolvidos que tocam diretamente o mecanismo de gate que a fase existe para entregar.

**Recomendação:** tratar os dois gaps como um plano de fechamento focado (mesma raiz: estados
derivados/reaproveitados de forma incorreta em vez de fontes de verdade dedicadas), aplicar os fixes já
detalhados no `05-REVIEW.md` (CR-01/CR-02), rodar `tsc -b --noEmit` + `npm test` de novo, e só então
seguir para a verificação visual humana pendente.

---

*Verified: 2026-09-25*
*Verifier: Claude (gsd-verifier)*
