---
phase: 10-agp-question-panel-in-taqciti
verified: 2026-10-30T15:30:00Z
status: human_needed
score: 8/12 must-haves verified
covered_files:
  - .planning/phases/10-agp-question-panel-in-taqciti/10-01-PLAN.md
  - .planning/phases/10-agp-question-panel-in-taqciti/10-01-SUMMARY.md
  - .planning/phases/10-agp-question-panel-in-taqciti/10-02-PLAN.md
  - .planning/phases/10-agp-question-panel-in-taqciti/10-02-SUMMARY.md
  - .planning/phases/10-agp-question-panel-in-taqciti/10-03-PLAN.md
  - .planning/phases/10-agp-question-panel-in-taqciti/10-03-SUMMARY.md
  - .planning/phases/10-agp-question-panel-in-taqciti/10-04-PLAN.md
  - .planning/phases/10-agp-question-panel-in-taqciti/10-04-SUMMARY.md
  - .planning/phases/10-agp-question-panel-in-taqciti/10-05-PLAN.md
  - .planning/phases/10-agp-question-panel-in-taqciti/10-05-SUMMARY.md
  - .planning/phases/10-agp-question-panel-in-taqciti/10-06-PLAN.md
  - .planning/phases/10-agp-question-panel-in-taqciti/10-06-SUMMARY.md
  - .planning/phases/10-agp-question-panel-in-taqciti/10-07-PLAN.md
  - .planning/phases/10-agp-question-panel-in-taqciti/10-07-SUMMARY.md
  - .planning/phases/10-agp-question-panel-in-taqciti/10-08-PLAN.md
  - .planning/phases/10-agp-question-panel-in-taqciti/10-08-SUMMARY.md
  - .planning/phases/10-agp-question-panel-in-taqciti/10-09-PLAN.md
  - .planning/phases/10-agp-question-panel-in-taqciti/10-09-SUMMARY.md
  - .planning/phases/10-agp-question-panel-in-taqciti/10-10-PLAN.md
  - .planning/phases/10-agp-question-panel-in-taqciti/10-10-SUMMARY.md
  - .planning/phases/10-agp-question-panel-in-taqciti/10-11-PLAN.md
  - .planning/phases/10-agp-question-panel-in-taqciti/10-11-SUMMARY.md
  - .planning/phases/10-agp-question-panel-in-taqciti/10-12-PLAN.md
  - .planning/phases/10-agp-question-panel-in-taqciti/10-12-SUMMARY.md
  - .planning/phases/10-agp-question-panel-in-taqciti/10-PLAN.md
  - .planning/phases/10-agp-question-panel-in-taqciti/10-SUMMARY.md
  - frontend/src/lib/taqcitiInstall.ts
  - frontend/src/pages/ExtensionPage.tsx
  - taqciti/manifest.config.ts
  - taqciti/src/background/agenteBindResume.ts
  - taqciti/src/background/agpBrowserSocket.ts
  - taqciti/src/background/agpQuestionsFeed.ts
  - taqciti/src/background/agpQuestionsFeedHold.ts
  - taqciti/src/background/agpQuestionsFeedInstance.ts
  - taqciti/src/background/meetingEndedInTab.ts
  - taqciti/src/background/messageRouter.ts
  - taqciti/src/content/ui/PanelApp.tsx
  - taqciti/src/features/agente/agpQuestions.ts
  - taqciti/src/features/agente/agpTarget.ts
  - taqciti/src/shared/config/agpQuestionsStore.ts
  - taqciti/src/shared/hooks/useAgpQuestions.ts
  - taqciti/src/sidepanel/components/AgpLiveTabs.tsx
  - taqciti/src/sidepanel/components/AgpQuestionsPanel.tsx
  - taqciti/src/sidepanel/screens/LiveScreen.tsx
covered_digest: "v4:sha256:b31e26fa04ca15f3518c6290b7bdd245ed36b6193c06b7e6731085384f90efe4"
behavior_unverified: 3
overrides_applied: 0
behavior_unverified_items:
  - truth: "SC1: com a Taqciti vinculada a uma sessão ativa, a aba AGP mostra a fila viva dela (cada cartão com a lente produto/dados) e atualiza conforme o backend emite perguntas"
    test: "Teste 2 do 10-UAT.md: reunião real no Meet, vincular a ZZ-TESTE-AGP <data>, clicar em Gerar no site, olhar a aba AGP e o contador"
    expected: "Cartões aparecem sozinhos em poucos segundos, com emblema Produto ou Dados, e o número ao lado de AGP sobe com a aba Transcrição selecionada"
    why_human: "O fluxo está coberto por testes com socket falso e pela fumaça contra o roteador /ws real (3/3), mas o D-13 do CONTEXT exige Chrome real e Gemini com crédito; o backend falso nunca vale como prova final"
  - truth: "SC4: a aba não atrapalha a captura/envio da Taqciti (Fases 7-8) nem a tela de perguntas do web app (Fase 5)"
    test: "Testes 5, 6, 8, 9 e 10 do 10-UAT.md (fim da call, navegação, Continuar envio, duas abas, Nova Guia) numa call real"
    expected: "A captura e o encerramento se comportam como antes; a reunião sobrevive quando só uma das duas abas sai; a fala não aparece duplicada na transcrição com duas abas abertas"
    why_human: "A suíte automática (1737 testes) está verde e backend/ e supabase/ não mudaram, mas o comportamento das duas abas depende do Chrome real e há o aviso WR-01 do 10-REVIEW.md (fala duplicada) que só um teste real confirma"
  - truth: "D-13: a fase só fecha com uma pergunta real gerada pela IA chegando na Taqciti com a lente certa e expirando pelo tempo (testes 2 e 3)"
    test: "Testes 2 e 3 do 10-UAT.md, com o Gemini com crédito (sem 402 RESOURCE_EXHAUSTED no terminal do backend)"
    expected: "Pergunta real com a lente certa aparece; a pergunta que ninguém tocou some após o tempo da fila (30 s); a fixada no site continua"
    why_human: "Exige Chrome real, uma call no Meet, e crédito do Gemini (ação de quem tem a chave). O plano 10-11 está com status blocked, adiado pelo usuário; nenhum dos 12 testes rodou"
human_verification:
  - test: "Rodar os 12 testes do 10-UAT.md (ou /gsd-verify-work 10), com prioridade para os testes 2 e 3 (IA real) e o teste 7 (layout do painel do Meet nos degraus compact/regular, sem rolagem horizontal nos 396 px)"
    expected: "Todos em result: pass. O roteiro e o passo a passo de cada teste já estão no 10-UAT.md (Preparo comum + como fazer)"
    why_human: "Chrome real, call no Meet, Gemini com crédito e medição de layout; o jsdom não mede rolagem nem layout"
  - test: "Teste 10 do 10-UAT.md: medir getPermissionWarningsByManifest com e sem a permissão tabs e anotar a saída (suposições A1/A2 do D-04)"
    expected: "A diferença do aviso de instalação fica registrada para a decisão de comunicação da nova permissão"
    why_human: "Só se mede no DevTools do service worker do Chrome real"
  - test: "Teste 11 do 10-UAT.md: com a captura pausada ou o envio desligado, a aba mostra 'Pausado' com as perguntas e o terminal do backend NÃO mostra conexão nova de /ws"
    expected: "Faixa 'Pausado · mostrando as últimas perguntas' e nenhuma nova conexão no log do backend"
    why_human: "Depende do log do backend rodando de verdade e de IA com crédito"
  - test: "Aprovar ou reverter o texto do D-07 no CLAUDE.md (commit b64d8b6): responder d07-ok ou d07-reverter (git revert b64d8b6)"
    expected: "Decisão humana registrada; a ameaça T-10-21 do 10-SECURITY.md fecha"
    why_human: "Plano 10-12 é não autônomo: a aprovação do texto foi adiada pelo usuário e continua pendente. Não tratar como aprovada"
  - test: "Decidir o aviso WR-01 do 10-REVIEW.md (com a mesma call em duas abas, a fala entra duas vezes) e o WR-02 (texto do manifesto diz 'sem integração com nenhum backend')"
    expected: "Decisão do time (mudança de comportamento é DECISÃO EM ABERTO pela regra do CLAUDE.md); a confirmação real da duplicação vem do teste 9"
    why_human: "WR-01 muda comportamento da captura; WR-02 mexe em texto público e no nome da extensão"
---

# Fase 10: Painel de perguntas AGP na Taqciti — Relatório de Verificação

**Objetivo da fase:** Durante uma call ao vivo, as perguntas de discovery geradas pelo backend (cada uma com a lente produto/dados) aparecem em quase tempo real numa aba dedicada "AGP" dentro da extensão Taqciti, restritas à sessão de discovery vinculada, para o operador ler as perguntas sem sair da Taqciti.
**Verificado em:** 2026-10-30
**Status:** human_needed
**Re-verificação:** Não, verificação inicial

## Resumo em português claro

O código da aba AGP existe, está ligado nas duas telas ao vivo (painel do Meet e tela larga), só lê do backend e só abre a conexão quando deve. Os testes automáticos passam. O que falta é a prova no Chrome real com IA de verdade (decisão D-13 do CONTEXT), que o usuário adiou para a verificação final dele: nenhum dos 12 testes do `10-UAT.md` rodou. Por isso o status é `human_needed`, e o TAQ-05 continua `Pending` no REQUIREMENTS.md, como deve ser. Não há nenhum critério falho nem lacuna de código que bloqueie.

## Alcance do objetivo

### Verdades observáveis

| # | Verdade | Status | Evidência |
|---|---------|--------|-----------|
| 1 | SC1: com a Taqciti vinculada a uma sessão ativa, a aba AGP mostra a fila viva dela (cartão com lente) e atualiza conforme o backend emite | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | Cadeia completa presente e ligada: `agpQuestionsFeedInstance.ts` (socket `/ws/{id}`) → `agpQuestionsFeed.ts` → `writeAgpFeed` → `chrome.storage.local` → `useAgpQuestions` → `AgpLiveTabs` → `AgpQuestionsPanel` (emblema `Produto`/`Dados`, `AgpQuestionsPanel.tsx:20,87-91`). O backend envia `lens` em `question_new` (`pipeline.py:386,400`) e no `initial_state` (`ws.py:28-37`). 11 arquivos de teste (233 testes) passam, mais a fumaça contra o roteador `/ws` real (3/3, relatada pelo orquestrador). Falta a prova no Chrome real com IA (D-13): testes 2 e 3 do UAT ainda `pending` |
| 2 | SC2: as perguntas e lentes vêm do backend para a sessão vinculada; a Taqciti não recalcula nem inventa | ✓ VERIFIED | `agpQuestions.ts`: só entram `initial_state`, `question_new`, `question_expired` (qualquer outro evento vira `null`, linhas 71-93); lista branca de 5 campos com tetos (`toAgpQuestion`, linhas 40-55); `AgpSocket` não tem `send` (`agpQuestionsFeed.ts:32-37`); nenhum `.send` em `agpQuestionsFeed*.ts`/`agpBrowserSocket.ts`; `agpQuestionsFeedInstance.test.ts` afirma `noSends()` (linha 106). Sem relógio local para expirar: só o `question_expired` do backend remove |
| 3 | SC3: AGP só mostra perguntas com vínculo explícito; sem vínculo mostra o aviso, nunca pergunta de sessão adivinhada | ✓ VERIFIED | `selectAgpTarget` exige `origin` e `sessionId` explícitos, estado `linked` e sessão não encerrada (`agpTarget.ts:20-31`); `decideAgpFollow` devolve `none` fora das fases ao vivo ou sem alvo; `normalizeAgpFeed` devolve `EMPTY_AGP_FEED` sem `sessionId` e o painel mostra `UNLINKED_NOTICE` (`AgpQuestionsPanel.tsx:56-58`); hidratação do feed salvo só vale com o mesmo `sessionId`. Testes: `agpTarget.test.ts`, `agpQuestionsFeedInstance.test.ts` (sem vínculo → nenhum socket e `EMPTY_AGP_FEED`) |
| 4 | SC4: a aba vive em `taqciti/` e não atrapalha captura/envio (Fases 7-8) nem a tela de perguntas do web app (Fase 5) | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | Lado web app e backend: `git diff eb3bf01 HEAD -- backend supabase` vazio; no `frontend/` só mudaram a página de ajuda `ExtensionPage.tsx` e `taqcitiInstall.ts` (+26 linhas, nenhuma na tela de perguntas). Lado captura: feed é só leitura e não toca o `sessionController`; suíte da Taqciti 1737/0 falhas (portão automático do orquestrador). Em aberto: comportamento com duas abas no Chrome real e o aviso WR-01 do 10-REVIEW.md (fala duplicada, `messageRouter.ts` não filtra `meet/chunk` de aba não dona); nenhum teste cobre captura com duas abas |
| 5 | D-11 (WR-04): o feed só abre o socket com a reunião em `recording`, vínculo explícito e envio ligado; em pausa/sem legendas/envio desligado fecha e mantém as perguntas (`paused`) | ✓ VERIFIED | `decideAgpFollow` (`agpTarget.ts:49-59`) → `hold` quando fase ≠ `recording` ou `streamingEnabled` falso; `agpQuestionsFeedHold.ts` (módulo puro, 88 linhas); `agpQuestionsFeed.ts` 193 linhas (≤ 200). `agpQuestionsFeedInstance.test.ts` (10 testes) exercita a composição de produção com o `WebSocket` global falso: gravando+vínculo+envio ligado abre 1 socket; pausa/captionsRequired/envio desligado fecham e publicam `paused` sem abrir outro; encerrada/URL inválida deixam `EMPTY_AGP_FEED`. Todos passaram nesta verificação |
| 6 | Proibição (D-08/D-10): a Taqciti só lê o `/ws` e nunca manda comando por ele | ✓ VERIFIED | Prohibition `verification: test` do 10-03 tem enforcement ligado: interface `AgpSocket` sem `send`, grep sem `send(` no feed e no adaptador, e `noSends()` assertado no teste de composição. Não é `unverified-prohibition` |
| 7 | D-02/D-03/D-16/D-17/D-18: "Continuar envio" recusa durante encerramento; duas abas não encerram a reunião quando só uma sai; `meet/ended` de aba não dona não encerra | ✓ VERIFIED | `agenteBindResume.ts:59` recusa silenciosamente se `isClosing`; `meetingRoomTabs.ts`, `meetingTabClosed.ts`, `meetingTabNavigated.ts`, `meetingEndedInTab.ts` presentes; testes `meetingTwoTabs.test.ts` e `meetingEndedTwoTabs.test.ts` passam. Janela estreita residual IN-01 (milissegundos) registrada no 10-REVIEW.md. Prova no Chrome real: testes 8 e 9 do UAT (pendentes) |
| 8 | D-04 (WR-06): permissão `tabs` no manifesto | ✓ VERIFIED | `manifest.config.ts:165` lista `'tabs'`; `manifest.test.ts` passa. A medição do aviso de instalação (A1/A2) é item humano (teste 10) |
| 9 | D-05: `background/index.ts` dividido por refator puro (sem mudar comportamento) | ✓ VERIFIED | `index.ts` com 27 linhas, só compõe `bootstrap.ts`, `browserListeners.ts`, `messageRouter.ts`; o 10-REVIEW.md comparou a ordem da cadeia `ready`, os listeners síncronos e cada `case` com `6968bb9^` e achou idêntico. Os 3 arquivos acima de 200 linhas em `background/` (`agenteBindFlow.ts`, `agenteStreamerInstance.ts`, `sessionController.ts`) são anteriores à fase |
| 10 | D-06: documentos velhos marcados como superados, sem apagar | ✓ VERIFIED | Os três (`RETOMAR-AQUI.md`, `PENDENCIAS-FASE-08.md`, `PENDENCIAS-FASE-10.md`) têm o aviso `SUPERADO (2026-10-28)` no topo apontando para este CONTEXT e o ROADMAP; continuam no repositório |
| 11 | D-07: `CLAUDE.md` diz que a Taqciti lê `/ws/{session_id}` só para leitura | ? UNCERTAIN | Texto aplicado no commit `b64d8b6` (+3 linhas, nenhuma linha existente alterada; prohibition do 10-12 respeitada), `CLAUDE.md:843-845`. A APROVAÇÃO HUMANA do texto está pendente (adiada pelo usuário); tratada como provisória, não aprovada. Ameaça T-10-21 segue aberta (medium, não bloqueante) |
| 12 | D-13: prova no Chrome real com IA real (pergunta real, lente certa, expirando) | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | Plano 10-11 com `status: blocked`, 0 tarefas, 0 commits; `10-UAT.md` tem 12 testes e 12 `result: [pending]` (conferido por grep). Nenhum resultado inventado |

**Pontuação:** 8/12 verdades verificadas (3 presentes e ligadas, comportamento não provado no Chrome real; 1 incerta, depende de aprovação humana)

### Itens adiados

Nenhum. A Fase 10.1 (ações na aba) está só em `<deferred>` do CONTEXT e ainda não existe no roadmap; ela não cobre nenhuma lacuna desta fase (D-08 manteve a aba como somente leitura).

### Artefatos exigidos

| Artefato | Esperado | Status | Detalhes |
|----------|----------|--------|----------|
| `taqciti/src/features/agente/agpTarget.ts` | `selectAgpTarget`, `decideAgpFollow` (pura) | ✓ VERIFIED | 59 linhas, usada por `agpQuestionsFeedInstance.ts` |
| `taqciti/src/features/agente/agpQuestions.ts` | Parser com lista branca e reducer | ✓ VERIFIED | 114 linhas, usada pelo feed e pelo store |
| `taqciti/src/background/agpQuestionsFeed.ts` | Dono do socket, reconexão, parada no 4004 | ✓ VERIFIED | 193 linhas, só portas injetadas |
| `taqciti/src/background/agpQuestionsFeedHold.ts` | Decisões puras de segurar/retomar/hidratar | ✓ VERIFIED | 88 linhas, importado pelo feed |
| `taqciti/src/background/agpQuestionsFeedInstance.ts` | Composição de produção | ✓ VERIFIED | 61 linhas; `registerAgpQuestionsFeed(ready)` chamado em `index.ts:21` |
| `taqciti/src/shared/config/agpQuestionsStore.ts` | Store que a UI lê (`taq:agpQuestions`) | ✓ VERIFIED | 55 linhas; `CONNECTIONS` inclui `paused` |
| `taqciti/src/shared/hooks/useAgpQuestions.ts` | Assina o store, nunca abre conexão | ✓ VERIFIED | 12 linhas, usado por `AgpLiveTabs` |
| `taqciti/src/sidepanel/components/AgpQuestionsPanel.tsx` | Cartões com lente, faixa de status, avisos | ✓ VERIFIED | 105 linhas |
| `taqciti/src/sidepanel/components/AgpLiveTabs.tsx` | Abas Transcrição / AGP acessíveis | ✓ VERIFIED | 88 linhas; usado em `PanelApp.tsx:916` e `LiveScreen.tsx:68` |
| `taqciti/manifest.config.ts` | Permissão `tabs` | ✓ VERIFIED | linha 165 |

### Verificação dos elos principais

| De | Para | Via | Status | Detalhes |
|----|------|-----|--------|----------|
| `index.ts` | feed AGP | `registerAgpQuestionsFeed(ready)` | WIRED | `index.ts:21` |
| feed AGP | `/ws/{session_id}` | `openBrowserSocket(url)` + `buildAgpSocketUrl` | WIRED | URL validada; teste de composição abre 1 socket com a URL e a sessão da associação |
| feed AGP | UI | `writeAgpFeed` → `chrome.storage.local` → `subscribeAgpFeed` | WIRED | escritor único = service worker |
| `AgpLiveTabs` | painel do Meet e tela larga | `PanelApp.tsx:916`, `LiveScreen.tsx:68` | WIRED | as duas superfícies |
| alvo do feed | vínculo explícito (Fase 8) | `loadAssociations` → `decideAgpFollow` | WIRED | `agpQuestionsFeedInstance.ts:28-37` |
| backend `question_new` | cartão com lente | `q.__dict__` inclui `lens` → `toAgpQuestion` | WIRED | `pipeline.py:400`; lente fora de `produto`/`dados` vira `null` e o emblema some |

### Fluxo de dados (nível 4)

| Artefato | Variável | Fonte | Produz dado real | Status |
|----------|----------|-------|------------------|--------|
| `AgpQuestionsPanel` | `feed.questions` | `useAgpQuestions` ← storage ← socket real do backend | Sim (backend: `Question` gerada pelo planner com `lens`) | ✓ FLOWING (em teste; prova real com IA pendente) |
| `AgpLiveTabs` | `count` | `feed.questions.length` | Sim | ✓ FLOWING |

### Verificações comportamentais

| Comportamento | Comando | Resultado | Status |
|---------------|---------|-----------|--------|
| Feed, alvo, store, painel, abas, manifesto e duas abas | `npx vitest run` nos 11 arquivos da fase | 11 arquivos, 233 testes passaram | ✓ PASS |
| Fumaça contra o roteador `/ws` real | `agpBackendSmoke` (opt-in) | 3/3 (relatado pelo orquestrador, não reexecutado aqui) | ✓ PASS (relatado) |
| Suíte completa da Taqciti, `tsc`, `eslint`, frontend 25/25 | portão automático do orquestrador | 1737/0 falhas, limpos (relatado, não reexecutado aqui) | ✓ PASS (relatado) |
| Backend e Supabase intocados | `git diff eb3bf01 HEAD -- backend supabase` | vazio | ✓ PASS |

### Execução de probes

Passo 7c: sem probes `scripts/*/tests/probe-*.sh` declarados nos planos desta fase. Nada a executar.

### Cobertura de requisitos

| Requisito | Planos de origem | Descrição | Status | Evidência |
|-----------|------------------|-----------|--------|-----------|
| TAQ-05 | 10-PLAN.md e 10-01 a 10-12 (todos declaram `requirements: [TAQ-05]`) | Perguntas de discovery com lente aparecem quase em tempo real numa aba "AGP" da Taqciti, restritas à sessão vinculada | ? NEEDS HUMAN | Implementação presente e coberta por testes automáticos (verdades 1 a 6); a prova de Chrome real com IA (D-13) está pendente. REQUIREMENTS.md linha 96 mantém `Pending` (correto; não alterado) |

Requisitos órfãos: nenhum. O REQUIREMENTS.md só mapeia TAQ-05 à Fase 10, e todos os planos o reivindicam.

### Anti-padrões encontrados

| Arquivo | Linha | Padrão | Severidade | Impacto |
|---------|-------|--------|------------|---------|
| (arquivos de produção tocados pela fase) | - | `TBD`/`FIXME`/`XXX` | - | Nenhum encontrado. Os 3 acertos de `TODO` são a palavra "TODO(S)" em comentário em português ("todo documento", "TODO handler"), não marcadores de dívida |
| `taqciti/src/background/messageRouter.ts` | 68-79 | `meet/chunk` de aba não dona alimenta a transcrição (WR-01) | ⚠️ Warning | Possível fala duplicada com duas abas; confirmar no teste 9; decisão do time |
| `taqciti/manifest.config.ts` | 26-28 | `description` diz "sem integração com nenhum backend" (WR-02) | ⚠️ Warning | Texto público desatualizado (transparência/LGPD); corrigir antes de distribuir |
| `taqciti/src/background/agpQuestionsFeed.ts` | 108-114 | Falha ao abrir socket vira `idle` sem nova tentativa (IN-02) | ℹ️ Info | Mensagem enganosa e sem retentativa; raro, URL já validada |
| `taqciti/src/background/agenteBindResume.ts` | 59-69 | Janela de milissegundos entre `isClosing` e `send-resumed` (IN-01) | ℹ️ Info | Caso do WR-05 muito mais raro, não zerado |
| `taqciti/manifest.config.ts` | 29 | Versão continua 2.1.2 com permissão nova (IN-08) | ℹ️ Info | Subir a versão no commit de publicação |

Nenhum é bloqueador. Os achados do 10-REVIEW.md (0 críticos, 2 avisos, 8 info) e do 10-SECURITY.md (21 ameaças, 20 fechadas, 1 aberta não bloqueante: T-10-21, aprovação do D-07) foram cruzados com o código e são coerentes com o que encontrei.

### Verificação humana necessária

Todos os itens abaixo estão no `10-UAT.md` (12 testes, cada um com "como fazer" passo a passo). Não recriei nem sobrescrevi o arquivo.

#### 1. Prova real com IA (testes 2 e 3, D-13)

**Teste:** com o Gemini com crédito (sem `402 RESOURCE_EXHAUSTED` no terminal do backend), reunião real no Meet, vincular a `ZZ-TESTE-AGP <data>`, clicar em "Gerar" no site, observar a aba AGP e o contador; depois deixar 40 s sem tocar em nada e fazer a contra-prova com uma pergunta fixada no site.
**Esperado:** cartões com emblema Produto ou Dados chegam sozinhos; a pergunta da fila some após ~30 s; a fixada continua.
**Por que humano:** Chrome real, call no Meet e crédito do Gemini; o backend falso nunca vale como prova final.

#### 2. Layout do painel (teste 7) e demais comportamentos no Chrome real (testes 1, 4, 5, 6, 8, 9, 10, 11, 12)

**Teste:** percorrer o roteiro do `10-UAT.md` na ordem.
**Esperado:** todos em `result: pass`; trecho longo sem espaço sem rolagem horizontal nos 396 px; faixa de status fixa no topo; duas abas não encerram a reunião quando só uma sai; aviso de instalação anotado com e sem `tabs`.
**Por que humano:** o jsdom não mede layout nem rolagem; o Chrome real é a única prova de duas abas e do aviso de permissão.

#### 3. Aprovação do D-07 (plano 10-12)

**Teste:** ler as 3 linhas acrescentadas em `CLAUDE.md:843-845` e responder `d07-ok` ou `d07-reverter` (`git revert b64d8b6`).
**Esperado:** decisão registrada; T-10-21 fecha.
**Por que humano:** plano não autônomo, aprovação adiada pelo usuário; não tratada como aprovada.

#### 4. Decisões do time dos avisos do review

**Teste:** decidir WR-01 (filtrar `meet/chunk` de aba não dona) depois de ver o resultado real do teste 9; decidir WR-02 (texto do manifesto e nome "Standalone").
**Por que humano:** mudança de comportamento e de texto público são DECISÃO EM ABERTO pela regra do `CLAUDE.md`.

### Resumo das lacunas

Não há lacunas de código. O que impede o status `passed` é só a prova humana que o usuário adiou de propósito: Chrome real com Gemini com crédito (D-13, que o próprio CONTEXT definiu como condição de fechamento da fase), a aprovação do texto do D-07 e a decisão sobre os avisos WR-01/WR-02. Ao fechar esses itens com `pass`, a fase pode virar `passed` e o TAQ-05 pode ser marcado como concluído (isso não foi feito aqui: REQUIREMENTS.md e o ROADMAP não foram alterados por esta verificação). O plano 10-11 segue com `status: blocked` e é a pendência a destravar.

---

_Verificado em: 2026-10-30_
_Verificador: Claude (gsd-verifier)_
