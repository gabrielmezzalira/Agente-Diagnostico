---
phase: 10-agp-question-panel-in-taqciti
plan: 08
subsystem: taqciti-background (entry point do service worker: bootstrap, listeners do navegador e roteador de mensagens)
tags: [typescript, vitest, chrome-extension, mv3, service-worker, taqciti, refactor]

requires:
  - phase: 10-agp-question-panel-in-taqciti (planos 10-02 e 10-06)
    provides: as últimas correções que mexem no index.ts (memória das abas na call, meet/ended da aba que não é a dona), antes do corte
provides:
  - "index.test.ts: teste de caracterização do entry point (54 testes) — registro síncrono dos 7 listeners e do feed AGP com o ready pendente, ordem da cadeia ready e tabela mensagem → porta"
  - "bootstrap.ts: export const ready (cadeia de inicialização) + configureAgenteSessionFinisher + relaunchLiveLinks"
  - "browserListeners.ts: registerBrowserListeners(ready) com os 6 listeners do navegador na ordem original"
  - "messageRouter.ts: registerMessageRouter(ready) com defaultTitle e o switch de todas as mensagens"
  - "index.ts reduzido a 27 linhas: só compõe (três register* síncronos no topo)"
affects: [10-09, 10-10, 10-11 (UAT 6 e 7 rodam sobre o código dividido), 10-12]

# Actuals (#2632) — mesma escala do estimate (chars/4 sobre os arquivos do diff realizado)
actuals:
  tokens: 12401
  tasks: 2
  commits: 2

commits: 2
plan_head_before: 604ce3c96cff664c713fa51d68267bd691563144
plan_head_after: 6968bb99849d519eb9212f5f2f4ae138312ee72c

tech-stack:
  added: []
  patterns:
    - "Teste de caracterização escrito e commitado ANTES do refator, sobre o arquivo intacto, e intocado no commit do corte"
    - "Entry point do service worker só compõe: cada register*(ready) é chamado de forma síncrona no topo, sem await/then (MV3)"
    - "Portas simuladas por caminho de módulo (vi.mock + vi.hoisted) com o wrapper onMessage/zod e o chrome simulado reais"

key-files:
  created:
    - taqciti/src/background/index.test.ts
    - taqciti/src/background/bootstrap.ts
    - taqciti/src/background/browserListeners.ts
    - taqciti/src/background/messageRouter.ts
  modified:
    - taqciti/src/background/index.ts

key-decisions:
  - "D-05 cumprido como refator pura: recortar e colar, sem mudar lógica, nomes, comentários nem a ordem da cadeia ready e dos registros; só os imports foram ajustados"
  - "O import de ./bootstrap fica por último no index.ts: o corpo dele (configurar o encerramento e disparar a cadeia ready) roda depois de todos os outros módulos carregados, como rodava quando tudo morava no index.ts"
  - "contentMessageRouter.ts não foi necessário: messageRouter.ts ficou com 172 linhas (limite 200)"

requirements-completed: [TAQ-05]

coverage:
  - id: D1
    description: "Teste de caracterização do index.ts intacto: os 7 listeners do Chrome (runtime.onInstalled, action.onClicked, tabs.onRemoved, tabs.onUpdated, runtime.onStartup, alarms.onAlarm, runtime.onMessage), registerAgpQuestionsFeed (com uma Promise) e configureAgenteSessionFinisher são registrados exatamente 1 vez de forma síncrona, com a migração ainda pendente"
    requirement: "TAQ-05"
    verification:
      - kind: unit
        ref: "taqciti/src/background/index.test.ts#registro síncrono dos listeners (MV3) > registra os 7 listeners do Chrome, o feed AGP e o configurador do encerramento com o ready ainda pendente"
        status: pass
      - kind: unit
        ref: "taqciti/src/background/index.test.ts#entrega ao feed AGP o mesmo ready que só resolve depois da migração"
        status: pass
    human_judgment: false
  - id: D2
    description: "Ordem da cadeia ready (migrar, hidratar, streamer, recuperar, recuperar vínculos, relançar, varrer encerramento, preferências) e captura das falhas (migração, relançar, varredura) sem travar o ready"
    requirement: "TAQ-05"
    verification:
      - kind: unit
        ref: "taqciti/src/background/index.test.ts#cadeia ready (4 testes)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Tabela 'tipo de mensagem → porta chamada' para todos os case do roteador (34 casos em it.each, mais 4 testes do canal: sem aba remetente, espera do ready, mensagem inválida descartada pelo zod real, erro interno) e o efeito de cada listener do navegador (9 testes, com a parte síncrona fora do ready provada)"
    requirement: "TAQ-05"
    verification:
      - kind: unit
        ref: "taqciti/src/background/index.test.ts#roteador de mensagens (tipo de mensagem → porta chamada)"
        status: pass
      - kind: unit
        ref: "taqciti/src/background/index.test.ts#listeners do navegador"
        status: pass
    human_judgment: false
  - id: D4
    description: "Refator puro: index.test.ts passa sem nenhuma edição depois do corte e aparece em exatamente 1 commit; o commit refactor(10-08) não toca *.test.ts; a suíte inteira tem o mesmo número de testes passados antes e depois (1720); bootstrap.ts 55, browserListeners.ts 105, messageRouter.ts 172 e index.ts 27 linhas; tsc, eslint e vite build (pasta temporária) ok"
    requirement: "TAQ-05"
    verification:
      - kind: unit
        ref: "cd taqciti && npx vitest run src/background/index.test.ts (54 passed, antes e depois do corte, sem edição)"
        status: pass
      - kind: other
        ref: "git log -- taqciti/src/background/index.test.ts (1 commit); git show --name-only HEAD no refator (0 arquivos *.test.ts); awk NR dos 4 arquivos; npx tsc --noEmit; npx eslint src; npx vite build --outDir <temporária>"
        status: pass
    human_judgment: false
  - id: D5
    description: "Comportamento real no Chrome depois da divisão: o worker acorda com todos os handlers registrados, navegar para fora do Meet encerra a reunião, e as duas telas ao vivo seguem funcionando (UAT 6 e 7)"
    requirement: "TAQ-05"
    verification: []
    human_judgment: true
    rationale: "O teste simula o chrome e as portas; só o Chrome real prova o acordar do service worker MV3 e a navegação de aba. A prova manual é o UAT 6 e 7 do plano 10-11, sobre o código já dividido"

duration: 12min
completed: 2026-10-30
status: complete
---

# Phase 10 Plan 08: Divisão do index.ts do service worker Summary

**O `index.ts` do service worker (322 linhas, acima do limite de 200 do CLAUDE.md) foi dividido em `bootstrap.ts`, `browserListeners.ts` e `messageRouter.ts` como recortar-e-colar puro, com um teste de caracterização de 54 casos escrito antes do corte e passando sem nenhuma edição depois dele.**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-10-30T13:47:24Z
- **Completed:** 2026-10-30T13:59Z
- **Tasks:** 2 (1 tracer + 1 auto)
- **Files:** 4 criados, 1 modificado

## Accomplishments

- **A "foto" antes do corte (Task 1, tracer):** `index.test.ts` importa o `index.ts` de verdade (`await import('./index')`) com todas as portas simuladas por caminho de módulo e o `chrome` simulado. Prova que os 7 listeners e o `registerAgpQuestionsFeed` são registrados de forma síncrona com a promessa de `migrateLocalStorage` ainda pendente (a condição do MV3), que a cadeia `ready` mantém a ordem, que cada `case` do roteador chama a porta certa e que cada listener do navegador faz o que fazia. O wrapper `onMessage` com o esquema zod é o real, então as 34 mensagens do teste também provam que são válidas pelo contrato.
- **O corte (Task 2):** `bootstrap.ts` (55 linhas) tem o bloco de comentário, `configureAgenteSessionFinisher`, `relaunchLiveLinks` e `export const ready`; `browserListeners.ts` (105) tem `registerBrowserListeners(ready)` com os 6 listeners do navegador na ordem original; `messageRouter.ts` (172) tem `defaultTitle` e `registerMessageRouter(ready)` com o `switch` inteiro; `index.ts` (27) só chama, no topo e nesta ordem, `registerAgpQuestionsFeed(ready)`, `registerBrowserListeners(ready)` e `registerMessageRouter(ready)`. Nenhum `register*` ficou atrás de `await`/`.then`.
- **Prova de que o teste pega o defeito que importa:** antes de cortar, mutei o `index.ts` de propósito (registrei `runtime.onStartup` atrás de `ready.then(...)` e troquei um `dispatch`); o teste reprovou exatamente nesses 3 pontos (o registro síncrono, o `onStartup` e o `ui/resume`). O arquivo foi restaurado byte a byte (hash do blob igual ao do HEAD) e nada disso foi commitado.
- **Sem regressão:** suíte inteira com **1720 testes passados e 3 pulados** antes e depois do corte (linha de base da fase antes deste plano: 1666 passados; os 54 a mais são o `index.test.ts`).

## Task Commits

1. **Task 1 (tracer): teste de caracterização do entry point do service worker** — `4bab539` (test)
2. **Task 2: divisão do index.ts em bootstrap, listeners do navegador e roteador de mensagens** — `6968bb9` (refactor)

## Files Created/Modified

- `taqciti/src/background/index.test.ts` — caracterização do entry point (848 linhas, 54 testes); não pode ser editado.
- `taqciti/src/background/bootstrap.ts` — `export const ready` e o que o prepara.
- `taqciti/src/background/browserListeners.ts` — `registerBrowserListeners(ready)`.
- `taqciti/src/background/messageRouter.ts` — `registerMessageRouter(ready)` e `defaultTitle`.
- `taqciti/src/background/index.ts` — passa de 322 para 27 linhas; só compõe.

## Decisions Made

- O `import { ready } from './bootstrap'` ficou por último no `index.ts`, com um comentário dizendo por quê. Como `bootstrap.ts` executa código ao ser carregado (configura o encerramento e dispara a cadeia `ready`), importá-lo por último mantém a ordem original: todos os outros módulos já estão carregados quando essa cadeia começa. Foi uma escolha de fidelidade, sem mudança de comportamento.
- `contentMessageRouter.ts` (a saída prevista no plano caso `messageRouter.ts` passasse de 200) não foi necessário: ficou com 172 linhas.
- O comentário de topo do `index.ts` foi atualizado para dizer onde mora cada parte (o plano pedia isso); os demais comentários foram movidos como estavam.

## Deviations from Plan

None - plan executed exactly as written.

O teste ficou com mais casos que o mínimo do plano (54, contra "menos de 30 reprova"): além da tabela e dos listeners, cobri as falhas capturadas da cadeia `ready` (migração, relançar do vínculo, varredura do encerramento, nova rodada no `onStartup`), a espera do `ready` pelo roteador, a mensagem inválida descartada e o erro interno. Isso é cobertura a mais de comportamento já existente, não mudança de escopo.

## Issues Encountered

- **Fim de linha do Git (Windows):** ao restaurar o `index.ts` depois da mutação de teste, um `git checkout -- <arquivo>` trocou o fim de linha do arquivo de trabalho, o que apareceu como `M` mesmo sem diferença real. Recopiei os bytes originais e confirmei `git hash-object` do arquivo igual ao blob do HEAD (`1cef4bd…`); o "M" que sobrou era só estado de cache do Git (`needs update`), sem conteúdo diferente, e sumiu no commit do corte. Nada fora dos 5 arquivos do plano entrou nos commits.

## User Setup Required

None - no external service configuration required.

## Threat Flags

None. A superfície não mudou: nenhum endpoint, permissão ou acesso a arquivo novo. T-10-15 (registro tardio de listener depois da divisão) mitigado: o teste de caracterização com o `ready` pendente passa sem edição depois do corte, o `index.test.ts` está em 1 commit e o `vite build` em pasta temporária gerou o bundle com os 6 `addListener` do navegador.

## Known Stubs

None.

## Next Phase Readiness

- **Para o 10-11 (UAT 6 e 7):** os dois testes manuais rodam sobre o código já dividido e são a prova no Chrome real de que o worker acorda com os handlers (D5 do coverage, `human_judgment: true`).
- **Rollback:** `git revert 6968bb9` devolve o `index.ts` inteiro (o teste de `4bab539` continua passando contra ele, é a mesma foto); `git revert 4bab539` remove só o teste. Nenhum dado é perdido.
- TAQ-05 segue dependendo dos planos restantes da fase (10-09 a 10-12); o `requirements.mark-complete` só marca quando o último plano que o declara fechar.

## Self-Check: PASSED

- Arquivos: `index.test.ts`, `bootstrap.ts`, `browserListeners.ts`, `messageRouter.ts` e `index.ts` — FOUND.
- Commits: `4bab539` e `6968bb9` — ancestrais de HEAD; `check evaluation-scope --plan 10-08 --commits-only` devolve exatamente esses 2.
- `cd taqciti && npx vitest run src/background/index.test.ts` — 54 passados antes e depois do corte, sem edição do arquivo.
- `git log -- taqciti/src/background/index.test.ts` — 1 commit; `git show --name-only HEAD` do refator — 0 arquivos `*.test.ts`; o commit de teste contém só `index.test.ts`.
- Linhas: `bootstrap.ts` 55, `browserListeners.ts` 105, `messageRouter.ts` 172 (todos ≤ 200); `index.ts` 27 (≤ 60).
- Greps de aceitação: `export const ready` = 1, `export function registerBrowserListeners` = 1, `export function registerMessageRouter` = 1; `registerAgpQuestionsFeed(ready)` (linha 21), `registerBrowserListeners(ready)` (24), `registerMessageRouter(ready)` (27), nesta ordem.
- `cd taqciti && npx vitest run` — 104 arquivos passados, 1 pulado; **1720 testes passados, 3 pulados** (igual à linha de base da Task 1).
- `npx tsc --noEmit` e `npx eslint src` — exit 0, sem saída; `npx vite build --outDir <pasta temporária>` — ok, com os 6 `addListener` do navegador no bundle do service worker.

---
*Phase: 10-agp-question-panel-in-taqciti*
*Completed: 2026-10-30*
