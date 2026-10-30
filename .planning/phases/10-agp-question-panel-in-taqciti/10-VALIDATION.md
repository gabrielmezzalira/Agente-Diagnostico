---
phase: "10"
slug: "agp-question-panel-in-taqciti"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: validated
nyquist_compliant: false
wave_0_complete: true
created: "2026-10-28"
audited: "2026-10-30"
# Auditoria de 2026-10-30 em modo SOMENTE-RELATORIO: nenhum teste ou codigo foi criado/alterado. validated + nyquist_compliant: false = PARTIAL
# (toda a camada automatica esta verde; faltam a prova no Chrome real com IA e a aprovacao humana do D-07, ambas adiadas pelo usuario).
---

# Phase 10 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Fonte: `10-RESEARCH.md` § "Arquitetura de Validação" (comandos executados de verdade em 2026-10-28, Windows 11).

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 3.2.7 (`jsdom`) na Taqciti; pytest no backend (somente leitura nesta fase) |
| **Config file** | `taqciti/vitest.config.ts` (`include: ['src/**/*.test.{ts,tsx}']`, alias `@` → `src`) |
| **Quick run command** | `cd taqciti && npx vitest run <arquivos tocados> && npx tsc --noEmit` |
| **Full suite command** | `cd taqciti && npx vitest run && npx eslint src` |
| **Estimated runtime** | ~110 s (suíte completa); ~30 s (tsc); ~27 s (eslint) |

Comandos auxiliares:

- Fumaça contra o roteador WS real (bash): `cd taqciti && AGP_PYTHON=python AGP_SMOKE_SERVER=scripts/agp-fake-backend.py npx vitest run src/background/agpBackendSmoke.test.ts`
- Fumaça (PowerShell): `$env:AGP_PYTHON='python'; $env:AGP_SMOKE_SERVER='scripts/agp-fake-backend.py'; npx vitest run src/background/agpBackendSmoke.test.ts`
- Build sem sobrescrever o `dist` do usuário: `cd taqciti && npx vite build --outDir <pasta-fora-do-repo> --emptyOutDir`
- No Windows **não existe `python3` real**: usar `python`.
- Portão "só acréscimo" (10-03 Task 2, 10-05 Task 2, 10-07 Task 1, 10-09 Tasks 1 e 2): `n=$(git diff --numstat eb3bf01 -- <arquivos>) && printf '%s\n' "$n" | awk '{r+=$2} END{exit (r>0)}'` — sai diferente de 0 com qualquer linha apagada ou alterada, seja qual for o primeiro caractere (o `grep -cE '^-([^-]|$)'` anterior não via a remoção de um item de lista `- ...`, que vira `-- ...` no diff). No 10-12 Task 1 (CLAUDE.md, arquivo que o time edita por fora) o mesmo portão roda só sobre o commit `docs(10-12): CLAUDE.md ...` (`git diff --numstat <sha>~1 <sha>`). Revisão de 2026-10-29.
- Portão de tamanho (CLAUDE.md, ">200 linhas = sinal de divisão"): `awk 'END {print NR}' <arquivo>` ≤ 200 — 10-03 (Tasks 1 e 3) nos 5 arquivos de produção do plano, incluindo o módulo puro novo `taqciti/src/background/agpQuestionsFeedHold.ts`, com o `agpQuestionsFeed.ts` ≤ 192 ao fim da Task 1 (reserva para a Task 3; protótipo do desenho medido em 193 linhas com as Tasks 1 e 3); 10-08 nos arquivos da divisão do `index.ts`.
- Portões que leem o HEAD (`git show HEAD`: 10-04 Task 1, 10-08 Tasks 1 e 2, 10-09 Task 3; `git log --grep`: 10-12 Task 1): a ação de cada task manda commitar ANTES do `<verify>` e corrigir com `git commit --amend` (nunca commit extra). Revisão de 2026-10-29 (iteração 2).
- Composição de produção do feed (10-03): portões de grep fora de comentário em `agpQuestionsFeedInstance.ts` na Task 1 (`decideAgpFollow(`, `streamingEnabled`, `.phase`; linha de base 0) e o teste `agpQuestionsFeedInstance.test.ts` na Task 2 (módulos reais sobre o storage simulado; só o `WebSocket` global é falso).

Linha de base (2026-10-28): 97 arquivos, **1513 testes passando**, 3 pulados (fumaça opt-in); tsc e eslint limpos; fumaça 3/3.
Backend: 279 passam, 4 pulados, 1 falha **preexistente e fora do escopo** (`tests/test_schema.py::test_tables_exist`, PGRST205).

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run <arquivos tocados>` + `npx tsc --noEmit`
- **After every plan wave:** Run `npx vitest run` + `npx eslint src` + a fumaça (se a onda tocou `agp*`) + `npx vite build --outDir <scratch>`
- **Before `/gsd-verify-work`:** Full suite must be green (≥ 1513 + os testes novos) **e** o UAT 1-12 executado no Chrome real, com Gemini com crédito para os testes 2 e 3 (D-13)
- **Max feedback latency:** ~120 seconds

---

## Per-Task Verification Map

> Preenchido pelo planejador/executor por task. Mapa por decisão (da pesquisa) como ponto de partida:

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| D-02 | 10-01 | 1 | TAQ-05 (SC4) | T-10-01 | "Continuar envio" não apaga `finishBy`/`finishTries` enquanto `isClosing` | unit + composição | `cd taqciti && npx vitest run src/background/agenteBindResume.test.ts src/background/agenteBindFlow.test.ts` | ✅ `agenteBindResume.test.ts` (7 testes) | ✅ green |
| D-03 | 10-02 | 1 | TAQ-05 (SC4) | T-10-03, T-10-04 | fechar/navegar a aba dona com outra aba na call reaponta; a última saída encerra 1 vez; consulta falhou = encerra (D-17); após o reinício do worker, a aba que manda `meet/chunk` volta a contar (legenda atrasada de aba que saiu, não) | unit + fluxo (máquina real) | `cd taqciti && npx vitest run src/background/meetingTwoTabs.test.ts src/background/meetingTabClosed.test.ts src/background/meetingTabNavigated.test.ts src/background/meetingTabClosedFlow.test.ts src/background/meetingTabNavigatedFlow.test.ts src/features/meeting/machine.test.ts` | ✅ `meetingTwoTabs.test.ts` (40 testes); A3/A4 no Chrome real só no UAT 9 (⬜ pending) | ✅ green |
| D-11 | 10-03 | 1 | TAQ-05 (SC1, SC3) | T-10-05..T-10-08 | feed só conecta em `recording` + vínculo explícito + `streamingEnabled`; `hold` mantém a lista e sobrevive ao sono do worker; decisões do hold no módulo puro `agpQuestionsFeedHold.ts`; feed e módulo ≤ 200 linhas | unit (tabela + funções puras) + fluxo com store real + composição de produção + portão de tamanho | `cd taqciti && npx vitest run src/background/agpQuestionsFeedHold.test.ts src/background/agpQuestionsFeedInstance.test.ts src/features/agente/agpTarget.test.ts src/shared/config/agpQuestionsStore.test.ts src/background/agpQuestionsFeed.test.ts` | ✅ `agpQuestionsFeedHold.test.ts` (34), `agpQuestionsFeedInstance.test.ts` (10), `agpTarget.test.ts` (35), `agpQuestionsStore.test.ts` (21); sono real do worker só no UAT 11 (⬜ pending) | ✅ green |
| D-04 | 10-04 | 1 | TAQ-05 (SC4) | T-10-09, T-10-10 | `permissions` inclui `tabs`; `<all_urls>` mantido; commit isolado | unit (manifesto) + build | `cd taqciti && npx vitest run src/manifest.test.ts` | ✅ `manifest.test.ts` (3 testes); A1/A2 no Chrome real só no UAT 10 (⬜ pending) | ✅ green |
| D-06/D-09 | 10-05 | 1 | TAQ-05 | T-10-11 | página de ajuda explica a aba AGP e a divergência; docs antigos marcados; D-09/A-4 corrigidos | unit (frontend) + texto | `npm --prefix frontend test -- src/lib/taqcitiInstall.test.ts` | ✅ `taqcitiInstall.test.ts` (8 testes, só o texto da página; D-06/D-09 nos docs só por grep/git, sem teste persistente) | ✅ green |
| D-16 | 10-06 | 2 | TAQ-05 (SC4) | T-10-12, T-10-13 | `meet/ended` de aba não dona não encerra; aba que saiu da call não segura a reunião | unit + fluxo | `cd taqciti && npx vitest run src/background/meetingEndedTwoTabs.test.ts src/background/meetingTwoTabs.test.ts` | ✅ `meetingEndedTwoTabs.test.ts` (13 testes); A3/A4 no Chrome real só no UAT 9 (⬜ pending) | ✅ green |
| M-1..M-3 | 10-07 | 2 | TAQ-05 (SC1) | T-10-14 | estado "Pausado", faixa fixa, `scroll-region` | unit (React) | `cd taqciti && npx vitest run src/sidepanel/components/AgpQuestionsPanel.test.tsx src/sidepanel/components/AgpLiveTabs.test.tsx` | ✅ `AgpQuestionsPanel.test.tsx` (22) e `AgpLiveTabs.test.tsx` (19); layout/rolagem/quebra de linha só no UAT 7 e no `/gsd-ui-review 10` (⬜ pending) | ✅ green |
| D-05 | 10-08 | 3 | TAQ-05 (SC4) | T-10-15 | N/A (refator puro) | caracterização | `cd taqciti && npx vitest run src/background/index.test.ts` (escrito antes do corte, passa sem edição depois) | ✅ `index.test.ts` (54 testes, 1 commit só) | ✅ green |
| M-4..M-6 | 10-09 | 3 | TAQ-05 (SC1) | T-10-16 | abas acessíveis, 2ª frase na saída larga, grade 4/8/16 | unit (React) | `cd taqciti && npx vitest run src/sidepanel/components/AgpLiveTabs.test.tsx src/sidepanel/components/AgpQuestionsPanel.test.tsx` | ✅ `AgpLiveTabs.test.tsx` (19) e `AgpQuestionsPanel.test.tsx` (22); M-6 (classes `p-4`/`mb-2`/`px-4`/`ml-2`) só por grep, nenhum teste afirma as classes; a montagem da aba em `LiveScreen`/`PanelApp` não tem teste de composição | ✅ green |
| D-12 | todos | — | TAQ-05 (SC2) | T-10-07 | backoff, 4004 e "sem relógio local" não regridem | unit + fumaça | testes existentes do feed + fumaça (`git diff --quiet eb3bf01` nos arquivos do D-12) | ✅ `agpQuestionsFeed.test.ts` (14), `agpQuestions.test.ts` (22); gate git exit 0 em 2026-10-30; fumaça opt-in (3/3 no 10-10, não repetida na auditoria) | ✅ green |
| D-15 | 10-10 | 4 | TAQ-05 | T-10-17, T-10-18 | UAT de 12 testes com "como fazer"; portão automático; build com as variáveis | texto + suíte | `grep -c "^### [0-9]*\. " .planning/phases/10-agp-question-panel-in-taqciti/10-UAT.md` (= 12) | ✅ doc: 12 testes confirmados em 2026-10-30 (os 12 seguem `result: [pending]`) | ✅ green |
| D-13 | 10-11 | 5 | TAQ-05 (SC1-SC4) | T-10-19, T-10-20 | prova no Chrome real com IA; a pessoa roda o UAT (checkpoint) e a Task 3 (auto) grava o que ela relatou | manual + registro | `grep -c "^result: \[pending\]" .planning/phases/10-agp-question-panel-in-taqciti/10-UAT.md` (= 0 depois da Task 3) | ❌ nada rodou: plano 10-11 `status: blocked`, UAT adiado pelo usuário; hoje o grep dá 12, não 0 | ⬜ pending (bloqueado, MISSING) |
| D-07 | 10-12 | 5 | TAQ-05 | T-10-21 | frase do D-07 aplicada por task automática, só acréscimo, aprovada pelo humano depois | texto + git | `grep -c "a aba AGP mostra as perguntas da sessão vinculada e nunca manda comando por ele" CLAUDE.md` (= 1 com "d07-ok") | ✅ grep = 1, `git diff --numstat` do commit `b64d8b6` = `3 0` (2026-10-30); aprovação humana do texto PENDENTE (entrada aberta em `.planning/WINDOWS.md`) | ⚠️ grep ✅ / aprovação ⬜ pending (PARTIAL) |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [x] `taqciti/src/background/index.test.ts` — caracterização do `index.ts` **antes** do D-05 (10-08, Task 1) — 54/54 verdes em 2026-10-30
- [x] `taqciti/src/manifest.test.ts` — `tabs` e `<all_urls>` (D-04; 10-04, Task 1) — 3/3
- [x] `taqciti/src/background/meetingTwoTabs.test.ts` — adaptador `meetingRoomTabs.ts` (com `chrome.tabs.query` simulado), evento `MEETING_TAB_CHANGED` e fluxos DA-3/DA-4 com duas abas (D-03; 10-02, Task 1) — 40/40
- [x] `taqciti/src/background/agenteBindResume.test.ts` — D-02 pela composição real (10-01, Task 1) — 7/7
- [x] `taqciti/src/background/agpQuestionsFeedHold.test.ts` — hold/retomada/sono do worker e casos diretos do módulo puro `agpQuestionsFeedHold.ts` (D-11; 10-03, Task 1) — 34/34
- [x] `taqciti/src/background/agpQuestionsFeedInstance.test.ts` — composição de produção do feed com a fase e o envio reais (D-11; 10-03, Task 2 — a primeira task que o usa no `<verify>`) — 10/10
- [x] `10-UAT.md` reescrito de 7 para 12 testes, cada um dizendo COMO fazer (10-10, Task 1) — 12 testes confirmados (todos `[pending]`)
- [x] Extra (não listado no plano original): `taqciti/src/background/meetingEndedTwoTabs.test.ts` — D-16 (10-06) — 13/13

Cada arquivo de teste novo é criado pela PRIMEIRA task do plano que o usa (em geral o tracer; o
`agpQuestionsFeedInstance.test.ts` nasce na Task 2 do 10-03, que é a primeira a usá-lo), no mesmo commit da mudança
ou do teste que ele prova — o `<automated>` de cada task nunca aponta para um arquivo que ainda não existe naquela task.

*Nenhum framework a instalar.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Pergunta real com lente chega na aba AGP e expira | TAQ-05 (SC1, SC2) / D-13 | precisa de Chrome + Meet reais e Gemini com crédito | `10-UAT.md` testes 2 e 3 |
| DA-4 dispara ao ir para `chrome://newtab/` | D-04 | comportamento do Chrome (suposições A1/A2 da pesquisa) | `10-UAT.md` teste 10 + saída de `chrome.management.getPermissionWarningsByManifest` |
| Duas abas na mesma sala | D-03 | depende do Meet real ("Participar também") | `10-UAT.md` teste 9 |
| Feed fecha em pausa/envio desligado e mantém a lista; worker dorme >30 s | D-11 | ciclo de vida real do service worker | `10-UAT.md` teste 11 |
| Visual (degraus `compact`/`regular`, faixa fixa, sem rolagem horizontal) | D-14 / UI-SPEC | inspeção visual | `/gsd-ui-review 10` |
| Sair da call, navegar e encerrar com a sessão no backend (SC4) | TAQ-05 (SC3, SC4) | encerramento real depende do Chrome + backend; os testes simulam `chrome.tabs` e o fetch | `10-UAT.md` testes 1, 5, 6 (o 6 é a prova da DA-4 e do D-05 sobre o código dividido) |
| Corrida real do "Continuar envio" com o `finish` em voo | D-02 / WR-05 | precisa do truque de bloqueio e limitação de rede no DevTools do service worker | `10-UAT.md` teste 8 (procedimento assistido) |
| Aba AGP montada nas duas telas ao vivo (painel do Meet e saída larga) | TAQ-05 (SC1) | não existe teste de composição de `LiveScreen`/`PanelApp`; só gate de grep (`surface="wide"` = 1) | `10-UAT.md` testes 1 e 7; ver lacuna G3 da auditoria (pode virar teste automático) |
| Texto do D-07 no `CLAUDE.md` aprovado por uma pessoa do time | D-07 (10-12) | aprovação humana, não automatizável | `git show b64d8b6 -- CLAUDE.md` e responder `d07-ok` ou `d07-reverter` (entrada aberta em `.planning/WINDOWS.md`) |

---

## Auditoria de cobertura 2026-10-30 (modo somente-relatório)

Auditoria feita sem criar, editar ou apagar teste ou código (o agente `gsd-nyquist-auditor` não foi acionado).
Evidência rodada na hora: suíte completa da Taqciti (`cd taqciti && npx vitest run`) = 104 arquivos passando, 1 pulado
(a fumaça opt-in), **1737 testes passando, 3 pulados, 0 falhas** em 89 s; os 13 arquivos de teste da fase = 294/294;
`npx tsc --noEmit` exit 0; `npm --prefix frontend test -- src/lib/taqcitiInstall.test.ts` = 8/8; gate do D-12
(`git diff --quiet eb3bf01` nos 6 arquivos) exit 0; `backend/` e `supabase/` sem diff desde `eb3bf01`; arquivos de produção
novos todos ≤ 200 linhas (feed 193, mensageiro 172). Não rodado agora: `eslint`, `vite build` e a fumaça contra o
roteador real (sobe um servidor Python); os três estão registrados como verdes no SUMMARY do 10-10.

| Dimensão | Resultado | Base |
|----------|-----------|------|
| D-02 WR-05 ("Continuar envio" vs `isClosing`) | COVERED | `agenteBindResume.test.ts` 7/7; corrida real só no UAT 8 |
| D-03 duas abas (fechar/navegar a dona) | COVERED (A3/A4 no Chrome real: manual) | `meetingTwoTabs.test.ts` 40/40 |
| D-16 `meet/ended` da aba não dona | COVERED (Chrome real: manual) | `meetingEndedTwoTabs.test.ts` 13/13 |
| D-11 feed só grava + vínculo + envio (hold/paused) | COVERED (sono real do worker: manual) | Hold 34, Instance 10, `agpTarget` 35, store 21 |
| D-12 backoff, 4004, sem relógio local | COVERED | `agpQuestionsFeed.test.ts` 14 + Hold (4004) + gate git |
| D-04 permissão `tabs` | COVERED (A1/A2: manual) | `manifest.test.ts` 3/3 |
| D-05 divisão do `index.ts` | COVERED | `index.test.ts` 54/54, escrito antes do corte |
| M-1..M-5 UI da aba AGP (Pausado, faixa fixa, abas acessíveis, aviso 2 frases) | COVERED (layout real: manual) | `AgpQuestionsPanel` 22 + `AgpLiveTabs` 19 |
| M-6 espaçamento 4/8/16 | PARTIAL | só gate de grep; nenhum teste afirma as classes |
| Montagem da aba em `LiveScreen`/`PanelApp` | PARTIAL | sem teste de composição (G3) |
| D-06/D-09 docs e página de ajuda | COVERED (texto da página) / PARTIAL (docs `.planning`) | `taqcitiInstall.test.ts` 8/8; docs só por grep/git |
| D-15 UAT de 12 testes | COVERED (artefato) | 12 testes, todos `[pending]` |
| D-13 prova no Chrome real com IA (SC1, SC2) | MISSING | plano 10-11 `blocked`; UAT 2 e 3 não rodaram |
| D-07 frase no `CLAUDE.md` | PARTIAL | grep e gate só-acréscimo ok; aprovação humana pendente |
| TAQ-05 (REQUIREMENTS.md) | PARTIAL | camada automática verde; segue `Pending` até o UAT 2 e 3 |

Lacunas desta auditoria (nada foi gerado): G1 = D-13/SC1-SC2 com IA real (manual, escalada); G2 = comportamentos do Chrome
real (A1 a A4, UAT 5, 6, 8, 9, 10, 11; manual, escalada); G3 = nenhum teste de composição monta `AgpLiveTabs` em
`LiveScreen`/`PanelApp` (**única lacuna que um teste automático pode fechar**); G4 = aprovação humana do D-07
(escalada); G5 = backstops visuais do UI-SPEC sem prova no Chrome real e sem `/gsd-ui-review 10` registrado quando a auditoria começou (um `10-UI-REVIEW.md` não rastreado apareceu no meio da auditoria, vindo de outro passo; não foi lido nem avaliado aqui) (escalada). Itens menores: M-6 só por grep;
`agpBrowserSocket.ts` sem teste próprio (passa pelo `FakeWebSocket` do `agpQuestionsFeedInstance.test.ts` e pela fumaça opt-in);
fumaça é `describe.skipIf(AGP_SMOKE_SERVER === undefined)` e não roda na suíte padrão; não há workflow de CI no repositório;
4 testes de temporização instáveis sob carga (`deferred-items.md`) passaram nesta rodada, mas podem falhar de novo.

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies — exceção: 10-11 só tem checkpoints humanos (bloqueado)
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 120s (suíte completa medida em 89 s)
- [ ] `nyquist_compliant: true` set in frontmatter — NÃO: G1 e G4 em aberto

**Approval:** partial (2026-10-30) — camada automática verde, `nyquist_compliant: false` até o UAT em Chrome real (D-13) e a aprovação do D-07

## Validation Audit 2026-10-30

| Metric | Count |
|---|---|
| Gaps found | 5 |
| Resolved | 0 |
| Escalated | 4 |
