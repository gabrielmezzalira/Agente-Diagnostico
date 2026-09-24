---
phase: 05-two-lens-monitoring-frontend
verified: 2026-09-23T23:21:00Z
status: human_needed
score: 5/5 must-haves verified
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
  - ".planning/phases/05-two-lens-monitoring-frontend/05-05-PLAN.md"
  - ".planning/phases/05-two-lens-monitoring-frontend/05-05-SUMMARY.md"
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
covered_digest: "v1:sha256:ee84f622d2d74e3040dfbd9bfd6da0481ea8ce9c8ac8ea24df1f501c68d0d0a2"
behavior_unverified: 0
overrides_applied: 0
re_verification:
  previous_status: gaps_found
  previous_score: 4/6
  gaps_closed:
    - "Botão 'Relatório' da topbar oculto em discovery inclusive antes do primeiro initial_state (CR-01)"
    - "Botão 'Gerar PRD' permanece utilizável após falha transitória de geração (CR-02)"
  gaps_remaining: []
  regressions: []
advisory:
  - finding: "WR-01 (05-REVIEW.md): prdError não é zerado quando discoverySessionId muda (troca de sessão discovery selecionada), podendo exibir uma mensagem de erro de uma sessão já deletada/trocada sob o card da sessão atual."
    category: other
    reason: "Classificado como Warning pelo 05-REVIEW.md, explicitamente registrado como fora da fronteira do gap-closure 05-05 (plano restrito a corrigir apenas CR-01/CR-02). Não afeta nenhum dos 3 success criteria da fase nem os dois gaps fechados nesta rodada."
    evidence_status: "confirmado presente no código atual (linhas 122-131 de ProjectDetailPage.tsx não incluem setPrdError(null)); não corrigido, não é regressão desta rodada"
  - finding: "WR-02 (05-REVIEW.md): frontend/vite.config.ts usa environment: 'node' e não cobre .tsx/jsdom — testes de componente React futuros seriam silenciosamente ignorados."
    category: other
    reason: "Fora de frontend/src/ (fronteira declarada do 05-05); exigiria nova devDependency (jsdom). Documentado como decisão de time em aberto no 05-05-PLAN.md."
    evidence_status: "confirmado presente (vite.config.ts:18); não corrigido"
  - finding: "WR-03 (05-REVIEW.md): hasReceivedInitialState não é resetado se sessionId mudar sem desmontar o componente; hoje não é alcançável por nenhuma rota do app (confirmado pelo reviewer), mas nada impede que uma mudança futura reabra a janela do CR-01."
    category: architectural
    reason: "Risco latente documentado, não uma falha atual — nenhuma rota do app hoje troca sessionId sem remount completo. Fora do escopo do gap-closure restrito a frontend/src/ (via edição pontual)."
    evidence_status: "confirmado presente no código atual; não corrigido"
human_verification:
  - test: "Abrir uma sessão discovery real ao vivo (ou via WS mock) e observar o CoveragePanel: confirmar que a lista aparece de fato agrupada em duas seções visuais (Produto/Dados), com cabeçalhos visíveis mesmo quando uma das lentes está vazia (backstop zero-one-many); abrir uma sessão sales e confirmar lista plana idêntica ao comportamento anterior."
    expected: "Discovery mostra 2 grupos visuais nomeados; sales mostra lista plana sem headers de lente, pixel-idêntica ao antes desta fase."
    why_human: "Renderização visual real (cores, layout, texto exato do cabeçalho) não tem teste de render automatizado — vitest está configurado só para .ts, não .tsx/jsdom (WR-02)."
  - test: "Na mesma sessão discovery, verificar visualmente que cada QuestionCard e cada linha de red-flag exibe a badge de lente (Produto/Dados) com a cor/variante certa; na sessão sales, confirmar ausência total de badge."
    expected: "Badge visível e legível em discovery; nenhuma badge (nem espaço vazio estranho) em sales."
    why_human: "Gate lógico (`lens != null`) está testado por leitura de código, mas o resultado visual (cor da variante, alinhamento do sub-label) não é exercitado por nenhum teste automatizado."
  - test: "Abrir a tela de monitoramento de uma sessão discovery no exato momento da conexão WS (recarregar a página) e confirmar visualmente que o botão 'Relatório' da topbar nunca aparece, nem por um instante, antes do primeiro carregamento completo dos dados."
    expected: "Botão 'Relatório' nunca visível em nenhum frame de uma sessão discovery, do mount até o fim; aparece imediatamente após o carregamento em uma sessão sales."
    why_human: "O helper `shouldShowManualReportButton` está coberto por 4 testes unitários puros (RED→GREEN confirmados agora via `npm test`, 10/10), mas o comportamento de frame-a-frame no navegador real (timing da conexão WS, re-render) ainda não foi observado numa sessão viva."
  - test: "Na página do projeto, abrir uma sessão discovery com readiness abaixo do limiar e confirmar visualmente a barra em 0%/parcial, o label de carregamento e o tooltip listando os sinais faltantes; depois simular uma falha de geração (ex.: desconectar rede) e confirmar que o botão 'Gerar PRD' permanece clicável e mostra a mensagem de erro real abaixo dele, sem a barra de readiness sumir ou mudar de estado."
    expected: "Fail-closed visual correto abaixo do limiar; após falha de POST, botão continua ativo (não fica cinza permanentemente) e exibe `prdError` real, distinto do texto fixo de erro do GET."
    why_human: "CR-02 foi confirmado por leitura de código + grep (condição `disabled` sem `prdError`, catch roteando para `setPrdError`), mas o fluxo de retry real após uma falha de rede/API (não simulável por unit test puro) precisa de confirmação humana ponta a ponta, como o próprio 05-05-SUMMARY.md já registra (`human_judgment: true`, item D3)."
  - test: "Numa sessão discovery já encerrada, confirmar visualmente o seletor de status (Rascunho/Em revisão/Aprovado para build), que ele fica desabilitado durante a chamada PATCH, e que ao selecionar 'Aprovado para build' aparece o hint 'Libera a importação no Precificador'."
    expected: "As 3 opções aparecem, o select desabilita durante a mutação e volta a habilitar, e o hint aparece só na opção aprovada."
    why_human: "Gate lógico e handler confirmados por leitura de código; o comportamento visual do disable-during-mutation e a reversão em caso de falha da PATCH não têm teste de render automatizado."
---

# Fase 5: Two-Lens Monitoring Frontend + PRD Handoff — Relatório de Verificação (Re-verificação pós gap-closure 05-05)

**Objetivo da fase:** a tela de monitoramento separa visualmente as lentes Produto e Dados no modo
discovery, mantém o layout plano no modo vendas, e renderiza qualquer conjunto de áreas que o backend
mandar sem hardcode. Adicionalmente (D-41): a camada de frontend do handoff de PRD — barra de
readiness + botão "Gerar PRD" gated na página do projeto, e um seletor de status/aprovação de
relatório numa sessão discovery encerrada.

**Verificado em:** 2026-09-23
**Status:** human_needed
**Re-verificação:** Sim — após fechamento dos gaps CR-01/CR-02 pelo plano 05-05 (gap_closure)

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidência |
|---|-------|--------|-----------|
| 1 | Sessão discovery agrupa cobertura em Produto/Dados; sessão sales mostra a mesma lista plana de hoje (SC1) | ✓ VERIFIED | `SessionActivePage.tsx` `CoveragePanel` inalterado pelo diff 05-05 (`git diff ddce96b..HEAD` confirma zero mudança nessas linhas); `lens.test.ts` — 10/10 testes verdes agora, incluindo os 6 casos originais de regressão sales/discovery, rodados diretamente (`npm test` → `10 passed (10)`). |
| 2 | Todo card de pergunta e toda linha de red flag exibem badge de lente em discovery (SC2) | ✓ VERIFIED | `grep` confirma `rf.lens != null` (linha 312) e `question.lens != null` (linha 410) gateando `<LensBadge>`; código não tocado pelo 05-05. |
| 3 | Frontend renderiza o conjunto de áreas que o backend manda, sem hardcode (SC3) | ✓ VERIFIED | `grep -n "COVERAGE_AREAS\|AREA_LABELS"` em `SessionActivePage.tsx`/`useSessionWS.ts` → 0 ocorrências. |
| 4 | (CR-01, fechado por 05-05) Botão "Relatório" da topbar fica oculto em discovery inclusive antes do primeiro `initial_state` | ✓ VERIFIED | `useSessionWS.ts:47-77,119-128` — campo `hasReceivedInitialState: boolean`, `false` inicial, `true` só no `case 'initial_state'`. `lens.ts:92-97` — `shouldShowManualReportButton(hasReceivedInitialState, coverage) = hasReceivedInitialState && !isDiscoveryCoverage(coverage)`. `SessionActivePage.tsx:1060` — gate religado: `shouldShowManualReportButton(ws.hasReceivedInitialState, ws.coverage)`. 4 testes novos em `lens.test.ts:82-106` cobrindo os 4 quadrantes (antes/depois do initial_state × discovery/sales) — todos verdes. `05-REVIEW.md` (revisão independente pós-fix) traçou o contrato do backend (`_init_coverage(mode="discovery")` popula 18 áreas com `lens` não-nulo desde o primeiro payload) e confirmou não haver janela residual. |
| 5 | (CR-02, fechado por 05-05) Botão "Gerar PRD" permanece utilizável após falha transitória de geração, com mensagem real e sem afetar o fail-closed do GET readiness | ✓ VERIFIED | `ProjectDetailPage.tsx:101` — `prdError`/`setPrdError` dedicado. `:134` guarda de saída mantém `readinessError` (fail-closed do GET preservado). `:135` — `setPrdError(null)` no início de `handleGeneratePrd`. `:141` — catch chama `setPrdError(e instanceof Error ? e.message : 'Erro ao gerar PRD')`, nunca `setReadinessError`. `:411` — `disabled={!readiness?.ready || readinessLoading || !!readinessError || generatingPrd}` NÃO inclui `prdError` (retry permitido). `:421-423` — `{prdError && (<p>...</p>)}` renderiza a mensagem real, separada do erro de readiness. Effect de fetch do GET (`:122-131`) intocado — `readinessError` continua sendo setado no `.catch` e mantendo o gate fail-closed. |

**Score:** 5/5 truths verificadas (0 behavior-unverified)

### Deferred Items

Nenhum.

### Advisory (New Scope, Unevidenced)

Achados de novo escopo do `05-REVIEW.md` sobre o próprio diff 05-05, sem correção registrada — não
bloqueiam (nenhum foi Critical), mas ficam documentados para decisão do time.

| # | Finding | Category | Why Advisory |
|---|---------|----------|--------------|
| 1 | WR-01: `prdError` não é zerado quando `discoverySessionId` muda | other | Warning no `05-REVIEW.md`; fora da fronteira declarada do gap-closure 05-05 (restrito a fechar só CR-01/CR-02); não afeta nenhum success criterion da fase. |
| 2 | WR-02: `vite.config.ts` não cobre `.tsx`/jsdom | other | Warning; exige nova dependência (`jsdom`), fora de `frontend/src/`; decisão de time registrada no 05-05-PLAN.md. |
| 3 | WR-03: `hasReceivedInitialState` não reseta em troca de `sessionId` sem remount | architectural | Warning; hoje inalcançável por qualquer rota do app (confirmado pelo reviewer via checagem de todos os `navigate`/`to` para `/sessions/:id`); risco latente documentado, não falha atual. |

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `frontend/src/lib/lens.ts` | `isDiscoveryCoverage`, `groupCoverageByLens`, `blockLabel`, `lensLabel`, `lensBadgeVariant`, `BLOCK_LABELS`, `shouldShowManualReportButton` (novo) | ✓ VERIFIED | Todos presentes, puros (sem import de React), exportados e testados (10 testes). |
| `frontend/src/lib/useSessionWS.ts` | `CoverageArea.name/.lens`, `RedFlag.lens`, `WSQuestion.lens`, `SessionWSState.hasReceivedInitialState` (novo); sem `COVERAGE_AREAS`/`INITIAL_COVERAGE` | ✓ VERIFIED | Campo novo na interface (linha 62), inicial `false` (linha 77), `true` só no handler `initial_state` (linha 127). |
| `frontend/src/pages/SessionActivePage.tsx` topbar | botão "Relatório" oculto em discovery, inclusive na janela pré-initial_state | ✓ VERIFIED | Linha 1060 usa `shouldShowManualReportButton(ws.hasReceivedInitialState, ws.coverage)`; `isDiscoveryCoverage` permanece usado no `CoveragePanel` (linha 108), não removido. |
| `frontend/src/pages/ProjectDetailPage.tsx` | `prdError` dedicado, `disabled` sem `prdError`, mensagem real renderizada, `readinessError` fail-closed preservado | ✓ VERIFIED | Linhas 97-141, 404-423 conforme evidência acima. |
| `frontend/src/lib/lens.test.ts` | testes de regressão + 4 novos casos do gate | ✓ VERIFIED | 10 casos, todos verdes (`npm test` rodado agora: `Tests 10 passed (10)`). |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `useSessionWS` `case 'initial_state'` | `hasReceivedInitialState: true` | atribuição direta no reducer do WS | ✓ WIRED | Linha 127. |
| `ws.hasReceivedInitialState` + `ws.coverage` | `shouldShowManualReportButton()` → visibilidade do botão "Relatório" | chamada direta no JSX | ✓ WIRED | `SessionActivePage.tsx:1060`. |
| `handleGeneratePrd` catch | `prdError` (não `readinessError`) | `setPrdError(e instanceof Error ? e.message : ...)` | ✓ WIRED | `ProjectDetailPage.tsx:141`. |
| `prdError` | condição `disabled` do botão "Gerar PRD" | ausência deliberada — `disabled` não referencia `prdError` | ✓ WIRED (por omissão correta) | `ProjectDetailPage.tsx:411` — grep positivo da string exata confirma que a condição não mudou. |
| `readinessError` (GET) | condição `disabled` + ramo de erro no JSX | inalterado | ✓ WIRED | `ProjectDetailPage.tsx:122-131, 404, 411`. |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|---------------------|--------|
| Botão "Relatório" (topbar) | `ws.hasReceivedInitialState`, `ws.coverage` | WebSocket real (`useSessionWS`), atualizado só pelo evento `initial_state`/`coverage_update` | Sim | ✓ FLOWING |
| Botão "Gerar PRD" / mensagem de erro | `prdError` | `catch` de `api.sessions.generateReport` (chamada real) | Sim | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Suíte vitest completa (regressão + 4 testes novos do gate CR-01) | `cd frontend && npm test` | `Test Files 1 passed (1)` / `Tests 10 passed (10)` | ✓ PASS |
| Typecheck ponta a ponta (novo campo do hook, novo helper, novo estado) | `cd frontend && npx tsc -b --noEmit` | exit 0, sem "error TS" | ✓ PASS |
| Gate do botão "Relatório" religado ao helper síncrono | `grep -n "shouldShowManualReportButton(ws.hasReceivedInitialState, ws.coverage)" src/pages/SessionActivePage.tsx` | 1 ocorrência (linha 1060) | ✓ PASS |
| `prdError` separado, fora do `disabled`, renderizado | greps de `prdError`/`disabled=` em `ProjectDetailPage.tsx` | condição `disabled` sem `prdError`; `setPrdError(e instanceof Error...)` presente; `{prdError && (` presente | ✓ PASS |
| Ausência de hardcode de áreas | `grep -n "COVERAGE_AREAS\|AREA_LABELS"` | 0 ocorrências | ✓ PASS |
| Nenhum debt marker nos 5 arquivos do gap-closure | `grep -n -E "TBD\|FIXME\|XXX\|TODO\|HACK\|PLACEHOLDER"` | 0 ocorrências | ✓ PASS |
| Commits atômicos do gap-closure presentes no git log | `git log --oneline -5 -- <5 arquivos>` | `9aa7183 fix(05-05): ... (CR-02)`, `2aa01a6 fix(05-05): ... (CR-01)` confirmados | ✓ PASS |

### Probe Execution

Não aplicável — a fase não declara probes de migração/tooling (`scripts/*/tests/probe-*.sh`).

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|--------------|--------|----------|
| UI-01 | 05-01 | Cobertura agrupada por lente em discovery, lista plana em sales | ✓ SATISFIED | `CoveragePanel` + `lens.test.ts`; `REQUIREMENTS.md:89` marca "Complete" para Fase 5. |
| UI-02 | 05-02 | Badge de lente em pergunta e red flag | ✓ SATISFIED | `QuestionCard`/`TranscriptPanel` + `LensBadge`; `REQUIREMENTS.md:90`. |
| UI-03 | 05-01 | Cobertura server-driven, sem hardcode | ✓ SATISFIED | `useSessionWS.ts`/`lens.ts` sem `COVERAGE_AREAS`/`AREA_LABELS`; `REQUIREMENTS.md:91`. |
| REP-02 | 05-03, 05-04, 05-05 | Handoff de PRD alimenta o Precificador (mecanismo de backend já "Complete" na Fase 4; esta fase entrega a última milha de UI — readiness route + Gerar PRD + seletor de aprovação, agora com os 2 defeitos Críticos fechados) | ✓ SATISFIED | Rota + client + UI existem, compilam/testam verde, E os dois defeitos Críticos que comprometiam a integridade do gate (CR-01) e a confiabilidade do retry (CR-02) foram corrigidos e confirmados nesta rodada. `REQUIREMENTS.md:87` já marcava REP-02 "Complete" desde a Fase 4 (mecanismo de backend); a superfície de UI entregue nesta fase agora está sem defeitos Críticos conhecidos. |

Nenhum requirement órfão: os 4 IDs declarados nos frontmatters dos planos (UI-01, UI-02, UI-03, REP-02,
incluindo o 05-05-PLAN.md que redeclara os 4) aparecem em `REQUIREMENTS.md` e estão todos
mapeados/contabilizados na tabela de rastreabilidade (linhas 87, 89-91).

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `frontend/src/pages/ProjectDetailPage.tsx` | 120-131 | `prdError` não é zerado no efeito que roda quando `discoverySessionId` muda | ⚠️ Warning | WR-01 do `05-REVIEW.md`, não corrigido — mensagem de erro de uma sessão trocada/deletada pode vazar visualmente sob o card da sessão atual. Não invalida nenhum success criterion nem os 2 gaps fechados. |
| `frontend/vite.config.ts` | 17-20 | `environment: 'node'` + `include: ['src/**/*.test.ts']` — não cobre `.tsx` nem jsdom | ⚠️ Warning | WR-02, não corrigido — testes de componente React futuros serão silenciosamente ignorados. |
| `frontend/src/lib/useSessionWS.ts` | 67-78, 101-174 | `state` não é resetado no início do effect de `[sessionId]` | ⚠️ Warning | WR-03, não corrigido — risco latente (hoje inalcançável por nenhuma rota do app) de reabrir o CR-01 se uma futura navegação trocar `sessionId` sem remount. |

Nenhum debt marker (`TBD`/`FIXME`/`XXX`/`TODO`/`HACK`/`PLACEHOLDER`) encontrado nos 5 arquivos
modificados pelo gap-closure 05-05.

### Human Verification Required

Ver frontmatter `human_verification`. Resumo: os 4 planos originais (05-01 a 05-04) acumularam vários
itens `human_judgment: true` no SUMMARY.md — confirmação visual real de agrupamento por lente, badges,
esconder/mostrar do botão "Relatório", barra de readiness fail-closed e seletor de status — que nunca
foram verificados numa sessão real, porque o projeto não tem `@testing-library`/jsdom configurado
(`frontend/vite.config.ts`, WR-02) para testes de render de componente. Na verificação anterior esses
itens ficaram apenas registrados como nota informativa porque `status: gaps_found` tinha precedência.
Agora que os dois gaps (CR-01/CR-02) estão fechados e confirmados por evidência direta de código +
testes passando, esses itens de inspeção visual passam a ser o único motivo do status não ser `passed`.

## Gaps Summary

Nenhum gap remanescente. Os dois defeitos Críticos apontados pela verificação inicial (CR-01: janela de
vazamento do botão "Relatório" antes do `initial_state`; CR-02: botão "Gerar PRD" travado
permanentemente após falha transitória) foram fechados pelo plano 05-05 e confirmados nesta rodada por:

1. Leitura direta do código atual (`lens.ts`, `useSessionWS.ts`, `SessionActivePage.tsx`,
   `ProjectDetailPage.tsx`) — as mudanças descritas no `05-05-SUMMARY.md` e no `05-REVIEW.md` estão de
   fato presentes, nas linhas exatas declaradas.
2. Execução real (não apenas relatada): `npm test` → `10 passed (10)`; `npx tsc -b --noEmit` → exit 0
   sem erros.
3. Confirmação de que a regressão sales (UI-01/02/03, já `VERIFIED` na rodada anterior) permanece
   intacta — nenhuma das linhas de `CoveragePanel`/`LensBadge`/tipos server-driven foi tocada pelo diff
   05-05 (`git log` mostra só os 2 commits `2aa01a6`/`9aa7183`, escopados exatamente aos 5 arquivos
   declarados).
4. Rastreabilidade de requirements sem órfãos: UI-01, UI-02, UI-03, REP-02 todos presentes em
   `REQUIREMENTS.md` e mapeados.

O status não é `passed` porque a fase acumula itens de inspeção visual humana pendentes (badges, empty
state, seletor de status, barra de readiness, timing do botão "Relatório" no navegador real) que nenhum
teste automatizado deste projeto cobre hoje (vitest configurado só para `.ts`, não `.tsx`/jsdom — WR-02).
Isso não é uma regressão nem um gap novo: é a mesma lacuna de UAT visual já sinalizada pelos SUMMARYs
05-01 a 05-04, que só agora emerge como motivo do status porque os dois Blockers que a mascaravam
(`gaps_found` tem precedência sobre `human_needed` na árvore de decisão) foram resolvidos.

Três Warnings do `05-REVIEW.md` (WR-01, WR-02, WR-03) permanecem sem correção, mas nenhum foi
Critical, nenhum foi apontado como must-have do gap-closure 05-05 (que restringiu seu escopo
deliberadamente a fechar só CR-01/CR-02, deixando os Warnings como decisão de time em aberto) e nenhum
invalida qualquer um dos 3 success criteria da fase. Estão listados em `advisory` para rastreabilidade.

**Recomendação:** rodar a checklist de verificação visual humana listada acima (abrir uma sessão
discovery real e uma sales, e um projeto discovery com readiness abaixo/acima do limiar) antes do
merge/ship final da fase. Após essa confirmação, a fase pode ser considerada `passed` sem nenhum
trabalho de código adicional pendente.

---

*Verified: 2026-09-23*
*Verifier: Claude (gsd-verifier)*
