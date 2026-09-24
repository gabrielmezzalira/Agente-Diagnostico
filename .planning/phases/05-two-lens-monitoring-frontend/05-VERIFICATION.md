---
phase: 05-two-lens-monitoring-frontend
verified: 2026-09-24T12:30:00Z
status: passed
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
human_uat:
  executed_at: "2026-09-24T12:20:00Z"
  method: "Sessão discovery real, ponta a ponta, no projeto existente 'visus' (mode=discovery já configurado em produção local) — backend (uvicorn :8000) + frontend (vite :5173) rodados localmente, navegador automatizado via Claude in Chrome. Sessão de teste 'TESTE VERIFICACAO FASE05 (apagar)' criada, alimentada com transcrição simulada via POST /webhook/extension cobrindo Produto e Dados (gargalo, LGPD/CPF, qualidade de fontes), observada ao vivo, depois encerrada e apagada (DELETE /sessions/{id}) — nenhum dado de teste remanescente confirmado por query direta nas 5 tabelas relacionadas (reports, transcript_chunks, coverage_snapshots, questions, red_flags)."
  results:
    - item: "CoveragePanel agrupado em Produto/Dados (discovery)"
      status: CONFIRMED
      evidence: "Screenshot da sessão ao vivo mostra dois cabeçalhos de seção 'PRODUTO' (8 áreas: gargalo, frente_atuacao, impacto_usuario, mapeamento_processos, fluxo_dados, desenho_solucao, expectativa_solucao, viabilidade_solucao) e 'DADOS' (qualidade_fontes, metricas, lgpd_seguranca, quick_wins, ...), cada área com barra de progresso própria (ex.: fluxo_dados 30%, lgpd_seguranca 45% após a transcrição simulada)."
    - item: "Badge de lente em pergunta e red flag"
      status: CONFIRMED
      evidence: "Zoom nos cards confirma badge 'Produto' (pill verde, ex.: pergunta 'Qual é o principal gargalo desse processo hoje?') e badge 'Dados' (pill cinza neutro, ex.: red flag 'Vulnerabilidade crítica de segurança e conformidade com LGPD...'), visualmente distintas e legíveis."
    - item: "Botão 'Relatório' nunca aparece em discovery, nem 1 frame"
      status: CONFIRMED
      evidence: "Topbar da sessão ativa mostrou apenas 'Encerrar' do primeiro screenshot (00:00:08, coverage já populado) até o fim da sessão de teste; a tela inteira ficou bloqueada em 'Carregando...' antes disso (nenhum topbar renderizado ainda), então não há frame em que um botão incorreto pudesse vazar."
    - item: "Readiness bar fail-closed + tooltip dinâmico abaixo do limiar"
      status: CONFIRMED
      evidence: "Observado em 2 estados reais via GET /sessions/{id}/readiness: 0% pronto (score 0, tooltip citando os 4 sinais faltantes) e 36% pronto após a transcrição simulada (score 0.358, tooltip atualizado para citar só os 3 sinais ainda faltantes — 'seções-chave' saiu da lista ao atingir 1.0). Botão 'Gerar PRD' confirmado `disabled: true` via inspeção direta do DOM nos dois estados."
    - item: "Retry do botão 'Gerar PRD' após falha transitória de geração (CR-02)"
      status: NOT_LIVE_TESTED
      evidence: "Não foi possível elevar o readiness da sessão de teste acima do limiar (0.65) sem transcrição adicional extensa nem forçar uma falha real de POST /sessions/{id}/report sem interromper o restante do teste; a confirmação desta sub-parte continua sendo por leitura de código (prdError dedicado, disabled sem prdError — ver truth #5 acima) e pela revisão independente do 05-REVIEW.md, não por observação visual direta de um retry real no navegador."
    - item: "Seletor de status (Rascunho/Em revisão/Aprovado para build) em sessão encerrada"
      status: CONFIRMED
      evidence: "Relatório de teste inserido diretamente via app.database.get_supabase() (sem custo de LLM) numa sessão encerrada; select nativo mostrou as 3 opções exatas; troquei Rascunho → Em revisão → Aprovado para build via teclado, cada PATCH real aplicado com sucesso (persistido, sem reload); hint 'Libera a importação no Precificador' apareceu somente na opção 'Aprovado para build', como especificado. O estado 'disabled durante a mutação' não foi capturado visualmente (mutação rápida demais para o intervalo de screenshot), mas o resultado funcional (persistência + reversão de estado) foi confirmado nos 3 estados."
  cleanup: "Sessão de teste e todos os registros associados (reports, transcript_chunks, coverage_snapshots, questions, red_flags) apagados via DELETE /sessions/{id}; confirmado 0 linhas remanescentes nas 5 tabelas para o session_id de teste. Servidores locais (uvicorn, vite) encerrados ao final. Nenhuma alteração permanente no projeto real 'visus' além do custo de IA da sessão de teste ($0.0013, ~4.8k tokens) já consumido antes do delete."
---

# Fase 5: Two-Lens Monitoring Frontend + PRD Handoff — Relatório de Verificação (Re-verificação pós gap-closure 05-05)

**Objetivo da fase:** a tela de monitoramento separa visualmente as lentes Produto e Dados no modo
discovery, mantém o layout plano no modo vendas, e renderiza qualquer conjunto de áreas que o backend
mandar sem hardcode. Adicionalmente (D-41): a camada de frontend do handoff de PRD — barra de
readiness + botão "Gerar PRD" gated na página do projeto, e um seletor de status/aprovação de
relatório numa sessão discovery encerrada.

**Verificado em:** 2026-09-24
**Status:** passed
**Re-verificação:** Sim — após fechamento dos gaps CR-01/CR-02 pelo plano 05-05 (gap_closure) + checklist de UAT visual humana executada ao vivo (ver `human_uat` no frontmatter)

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

Executada. Ver frontmatter `human_uat` para o registro completo (método, resultado item a item,
limpeza). Resumo: 5 dos 5 itens da checklist visual foram exercitados numa sessão discovery real, ao
vivo, no projeto `visus` — 4 confirmados por observação visual direta (agrupamento Produto/Dados, badges
de lente, ausência do botão "Relatório" em todo frame observado, readiness fail-closed com tooltip
dinâmico em dois estados reais, seletor de status com as 3 opções e persistência real via PATCH). Um
sub-item (retry do botão "Gerar PRD" após falha *transitória de rede/API*, dentro do item de readiness)
não foi exercitado ao vivo — elevar o readiness real acima do limiar exigiria uma sessão muito mais longa
— e permanece confirmado apenas por leitura de código (mesma evidência da rodada anterior). Isso é uma
lacuna de cobertura de teste menor, não um defeito encontrado, e está registrada como item de
acompanhamento abaixo.

## Gaps Summary

Nenhum gap. Os dois defeitos Críticos apontados pela verificação inicial (CR-01: janela de vazamento do
botão "Relatório" antes do `initial_state`; CR-02: botão "Gerar PRD" travado permanentemente após falha
transitória) foram fechados pelo plano 05-05 e confirmados por:

1. Leitura direta do código atual (`lens.ts`, `useSessionWS.ts`, `SessionActivePage.tsx`,
   `ProjectDetailPage.tsx`) — as mudanças descritas no `05-05-SUMMARY.md` e no `05-REVIEW.md` estão de
   fato presentes, nas linhas exatas declaradas.
2. Execução real (não apenas relatada): `npm test` → `10 passed (10)`; `npx tsc -b --noEmit` → exit 0
   sem erros.
3. UAT visual ao vivo nesta rodada (ver `human_uat`): sessão discovery real no projeto `visus`,
   transcrição simulada cobrindo Produto e Dados, observação direta de agrupamento, badges, ausência do
   botão "Relatório", readiness fail-closed em 2 estados reais, e seletor de status com PATCH real.
4. Confirmação de que a regressão sales (UI-01/02/03, já `VERIFIED` na rodada anterior) permanece
   intacta — nenhuma das linhas de `CoveragePanel`/`LensBadge`/tipos server-driven foi tocada pelo diff
   05-05.
5. Rastreabilidade de requirements sem órfãos: UI-01, UI-02, UI-03, REP-02 todos presentes em
   `REQUIREMENTS.md` e mapeados.

Três Warnings do `05-REVIEW.md` (WR-01, WR-02, WR-03) permanecem sem correção, mas nenhum foi Critical,
nenhum foi apontado como must-have do gap-closure 05-05 (que restringiu seu escopo deliberadamente a
fechar só CR-01/CR-02, deixando os Warnings como decisão de time em aberto) e nenhum invalida qualquer um
dos 3 success criteria da fase. Estão listados em `advisory` para rastreabilidade — decisão de correção
fica para o time.

**Item de acompanhamento (não bloqueia):** confirmar visualmente, numa sessão real futura (ou quando o
projeto ganhar `@testing-library`/jsdom para simular falha de rede em teste automatizado — WR-02), que o
botão "Gerar PRD" permanece clicável e mostra a mensagem real após uma falha transitória de geração. A
lógica já está implementada e coberta por leitura de código; falta só a observação ao vivo de uma falha
real, que não foi possível forçar de forma segura nesta rodada sem interferir no restante do teste.

**Fase 5 considerada `passed`.** Nenhum trabalho de código pendente para fechar esta fase.

---

*Verified: 2026-09-24*
*Verifier: Claude (resumindo sessão anterior + UAT visual ao vivo)*
