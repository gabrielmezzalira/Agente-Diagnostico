---
phase: 08-taqciti-session-association
plan: 10
subsystem: taqciti-service-worker
tags: [taqciti, chrome-extension, service-worker, zod, vitest, dependency-injection, bulk-upload, session-binding]

requires:
  - phase: 08-taqciti-session-association
    provides: "08-01: reducer/store de associações, política de destino e reevaluateAgenteStreamer; 08-03: portas ClientDirectory/AgenteSessionGateway e fakes; 08-05: planMeetingUpload, seedFromParts e runMeetingUpload"
provides:
  - "Comandos ui/agente/clients/list, meeting/open, meeting/defer e meeting/bind validados por zod, espalhados em uiMessageSchema, com AgenteCommandResult tipado"
  - "createAgenteAssociationService: listClients (ordenada, ou unavailable), open e defer idempotentes, bind delegando ao fluxo"
  - "createBindFlow: vínculo ao vivo (ID manual, cliente, cliente novo) com sessão criada uma vez e tudo o que já foi falado enviado em partes antes de liberar o envio ao vivo (D-12)"
  - "Envio da reunião encerrada e guardada: ended-unsent -> sending -> sent | send-failed, em blocos de 20 com pausa de 1 s e progresso por índice (D-09, D-10)"
  - "agenteAssociation.ts: raiz de composição (portas indisponíveis por padrão, onLinked = reevaluateAgenteStreamer) + configureAgenteAssociation como seam de teste"
affects: [08-11, 08-12, 08-13, 08-14, 08-17, 08-18, 08-19, 08-20, 08-22]

actuals:
  tokens: 14100
  tasks: 3
  commits: 3

plan_head_before: 390a8a762619e9d6ed97f885897a1e7599246024
plan_head_after: f4b9c94b62343d1e31ede545fec1ed187f15fe8d

tech-stack:
  added: []
  patterns:
    - "UI só emite comando validado por zod; toda lógica de vínculo e de envio roda no service worker, e cada case do index.ts é uma linha que delega a agenteAssociation"
    - "Guarda síncrona por reunião (Set) + link-started/send-started gravados pela fila serializada do store ANTES de criar a sessão: dois comandos nunca criam duas sessões nem dois clientes"
    - "Evento do envio em partes escolhido pelo estado atual da associação: tenta link-* e depois send-*; o reducer recusa (applied=false) a família errada, sem ler-e-depois-aplicar"
    - "Progresso aplicado em cadeia (promise chain) e aguardado antes da conclusão, para a conclusão nunca passar na frente do último progresso"

key-files:
  created:
    - taqciti/src/shared/types/agenteMessages.ts
    - taqciti/src/background/agenteAssociationService.ts
    - taqciti/src/background/agenteAssociationService.test.ts
    - taqciti/src/background/agenteBindFlow.ts
    - taqciti/src/background/agenteBindFlow.test.ts
    - taqciti/src/background/agenteBindUpload.ts
    - taqciti/src/background/agenteBindTarget.ts
    - taqciti/src/background/agenteAssociation.ts
  modified:
    - taqciti/src/shared/types/messages.ts
    - taqciti/src/background/index.ts

key-decisions:
  - "Contra a sugestão literal do plano, o fluxo não lê o estado antes de cada evento do envio em partes: aplica link-* e, se o reducer recusa, send-* (e vice-versa). Mesmo resultado, sem a janela de corrida entre ler e aplicar"
  - "Guarda síncrona inFlight por reunião além do estado linking: sem ela, dois bind simultâneos com cliente novo criariam dois clientes antes de qualquer um gravar link-started"
  - "open em choosing e defer em deferred respondem ok (idempotentes) em vez de invalid-state: a UI pode reenviar sem erro"
  - "Se a reunião saiu da tela durante o vínculo (nova reunião começou), o 'tudo o que foi falado' vem do histórico guardado, não de uma lista vazia"
  - "Rótulo do vínculo manual 'Sessão {8 primeiros caracteres}' e nome da sessão = título da reunião (suposições do plano, reversíveis); corte em 200 caracteres fica na porta HTTP (08-12)"

patterns-established:
  - "Fluxo -> alvo -> envio em três módulos de uma responsabilidade (agenteBindFlow / agenteBindTarget / agenteBindUpload), todos abaixo de 200 linhas"
  - "Teste de módulo com resetModules importa as classes de erro da mesma instância do código sob teste (fakes carregados dinamicamente depois do resetModules)"

requirements-completed: []

coverage:
  - id: D1
    description: "A UI só emite comandos zod; ids com tamanho máximo, UUID por regex no ID manual, nome de cliente aparado de 1 a 120; resultado do comando tipado com erro fechado"
    requirement: TAQ-02
    verification:
      - kind: unit
        ref: "taqciti/src/background/agenteAssociationService.test.ts#uiMessageSchema — comandos ui/agente/*"
        status: pass
      - kind: command
        ref: "awk dos cases ui/agente/* do index.ts (todo case seguido de 'return agenteAssociation.') imprime 0"
        status: pass
    human_judgment: false
  - id: D2
    description: "listClients ordena pelo cliente ou responde unavailable (cai no plano B); open/defer com transições do reducer, idempotentes e com not-found/invalid-state"
    requirement: TAQ-02
    verification:
      - kind: unit
        ref: "taqciti/src/background/agenteAssociationService.test.ts#createAgenteAssociationService"
        status: pass
    human_judgment: false
  - id: D3
    description: "Vínculo ao vivo por ID manual: 3 falas em ordem para a sessão manual, resposta antes do fim do envio, linking com progresso durante, linked com a semente, onLinked uma vez, semente {} com 0 segmentos, send-failed com progresso preservado"
    requirement: TAQ-02
    verification:
      - kind: integration
        ref: "taqciti/src/background/agenteBindFlow.test.ts#vínculo ao vivo — ID manual"
        status: pass
    human_judgment: false
  - id: D4
    description: "Vínculo por cliente cria UMA sessão; cliente novo; duplicate sem mudar estado; falha de criação volta a deferred sem POST; reunião encerrada durante a criação que falha termina em ended-unsent; dois bind simultâneos criam uma sessão e um cliente"
    requirement: TAQ-02
    verification:
      - kind: integration
        ref: "taqciti/src/background/agenteBindFlow.test.ts#vínculo ao vivo — cliente / bordas"
        status: pass
    human_judgment: false
  - id: D5
    description: "Reunião encerrada: 45 falas em 45 POSTs ordenados, 2 pausas de 1 s, progresso 1..45, sent com seedSent; falha na parte 7 vira send-failed 6/45 sem enviar depois; ID manual; send-failed/sent recusam; registro ausente; sala retomada no meio do envio termina linked com onLinked uma vez"
    requirement: TAQ-02
    verification:
      - kind: integration
        ref: "taqciti/src/background/agenteBindFlow.test.ts#enviar a reunião encerrada (D-09, D-10)"
        status: pass
    human_judgment: false
  - id: D6
    description: "A chave x-agente-key só existe no request: o storage cru nunca a contém depois de um vínculo completo"
    requirement: TAQ-02
    verification:
      - kind: integration
        ref: "taqciti/src/background/agenteBindFlow.test.ts#a chave x-agente-key só vai no request"
        status: pass
    human_judgment: false
  - id: D7
    description: "Transmissão de ponta a ponta com os botões reais (painel, seletor, saída larga)"
    requirement: TAQ-02
    verification: []
    human_judgment: true
    rationale: "Nenhuma tela dispara os comandos ainda (fiação nos planos 08-14, 08-17 e 08-18) e as rotas reais do backend (B1) entram no 08-12; só o teste manual D-20 prova a cadeia inteira."

duration: ~25min
completed: 2026-10-12
status: complete
---

# Phase 8 Plan 10: Comandos do vínculo e envio em partes no service worker Summary

**A UI agora tem comandos zod (`ui/agente/clients/list`, `meeting/open|defer|bind`) e o service worker cumpre o vínculo: cria o cliente (se novo), abre UMA sessão, manda em partes e na ordem tudo o que já foi falado — ou a reunião guardada, no fim — e só então libera o envio ao vivo, sem nunca duplicar sessão. O plano B do ID manual já transmite de ponta a ponta.**

## Performance

- **Duration:** ~25 min (aprox. 11:15Z a 14:30Z no relógio do host, que mistura fusos; o trabalho útil foi de uns 25 min)
- **Tasks:** 3 (um commit por task, como o plano manda)
- **Files:** 8 criados, 2 alterados (`messages.ts` +2 linhas, `index.ts` +10 linhas); `package.json` e `package-lock.json` sem diff

## Accomplishments

- **Comandos validados (Task 1):** `agenteMessages.ts` guarda os schemas e o `AgenteCommandResult`; `messages.ts` só ganhou o import e o `...agenteUiMessageSchemas`. `createAgenteAssociationService` entrega `listClients` (ordenada por `sortClients`, ou `unavailable` se a porta cair), `open` e `defer`.
- **Vínculo ao vivo (Task 2):** `createBindFlow` grava `link-started` antes de criar a sessão, cria uma sessão pela porta, responde `{ ok: true }` e continua em segundo plano: monta as partes do que já foi falado, envia pela esteira do 08-05 com a config relida a cada parte, grava `link-completed` com `seedFromParts(parts)` e chama `onLinked` (produção: `reevaluateAgenteStreamer`). Se a reunião terminou durante o vínculo e a sessão não nasceu, aplica `meeting-ended` depois de `link-failed` (vai a `ended-unsent`).
- **Raiz de composição:** `agenteAssociation.ts` monta as dependências de produção (portas "indisponível" até o 08-12) e o `index.ts` ganhou 4 `case`s de uma linha cada.
- **Reunião encerrada (Task 3):** com `ended-unsent`, o mesmo fluxo aplica `send-started`/`send-session-created`, envia em blocos de 20 com pausa de 1 s, grava progresso por índice e termina em `sent` (com `seedSent`) ou `send-failed` (progresso preservado). Os eventos do envio seguem o estado atual: se a sala for retomada no meio, as partes seguintes viram `link-*`, a associação termina `linked` e `onLinked` sai uma vez.
- **Gate do plano:** `cd taqciti && npm test` (57 arquivos, 825 testes), `npm run typecheck` e `npm run lint` verdes. Arquivos novos de produção: 179, 107, 67, 66, 65 e 58 linhas (todos abaixo de 200).

## Task Commits

1. **Task 1 — comandos zod + serviço (listar/abrir/adiar):** `bf4da23`
2. **Task 2 — vínculo ao vivo + raiz de composição + cases do index:** `6627b52`
3. **Task 3 — envio da reunião encerrada:** `f4b9c94`

**Plan metadata:** commit de docs ao final (SUMMARY + STATE + ROADMAP).

## Evidência TDD (RED -> GREEN)

- **Task 1 — RED:** a primeira execução do teste falhou por import (módulos ainda inexistentes, `Failed to resolve import`), o que não conta como RED semântico; nenhum stub neutro foi criado. **GREEN:** 11/11.
- **Task 2 — RED:** não foi executado de forma isolada: escrevi o arquivo de teste e a implementação na sequência e só rodei depois do código. Registro honesto; o GREEN (17/17 no arquivo) e a revisão dos casos cobrem os 12 comportamentos pedidos, mas o RED desta task não foi observado.
- **Task 3 — RED:** os 7 testes novos rodaram contra o fluxo só-ao-vivo da Task 2 e falharam nas asserções planejadas (`invalid-state` no lugar de `ok`/`create-session`/`not-found`, `ended-unsent` no lugar de `sent`, progresso `undefined`). `semanticAssessment`: comportamento ausente, não erro de import. **GREEN:** 24/24 em `agenteBindFlow.test.ts`.
- **Commits:** um por task (plano §2 e §5), então RED e GREEN não foram commitados separados.

## Files Created/Modified

- `taqciti/src/shared/types/agenteMessages.ts` — schemas `ui/agente/*`, alvo do vínculo, erro e resultado do comando (67 linhas)
- `taqciti/src/shared/types/messages.ts` — espalha `agenteUiMessageSchemas` em `uiMessageSchema` (+2 linhas)
- `taqciti/src/background/agenteAssociationService.ts` — `listClients`, `open`, `defer`, `bind` (58 linhas)
- `taqciti/src/background/agenteBindFlow.ts` — ordem do vínculo (ao vivo e encerrada), guarda por reunião, `whenIdle` (179 linhas)
- `taqciti/src/background/agenteBindTarget.ts` — resolve ID manual / cliente / cliente novo (65 linhas)
- `taqciti/src/background/agenteBindUpload.ts` — envio em partes, progresso em cadeia, eventos pelo estado atual, `onLinked` (107 linhas)
- `taqciti/src/background/agenteAssociation.ts` — raiz de composição e `configureAgenteAssociation` (66 linhas)
- `taqciti/src/background/index.ts` — 4 `case`s `ui/agente/*`, cada um só delega (+10 linhas)
- Testes: `agenteAssociationService.test.ts` (11 casos), `agenteBindFlow.test.ts` (24 casos, harness com storage simulado)

## Decisions Made

Ver `key-decisions` no frontmatter. Em resumo: eventos do envio escolhidos por "tentar a família certa" (sem corrida), guarda síncrona por reunião, `open`/`defer` idempotentes, histórico como reserva do "tudo o que já foi falado" e as suposições reversíveis do rótulo manual e do nome da sessão.

## Deviations from Plan

### Auto-fixed / additive

**1. [Rule 3 - Blocking de tamanho] `agenteBindUpload.ts` e `agenteBindTarget.ts` (arquivos não listados no frontmatter)**
- **Found during:** Tasks 2 e 3
- **Issue:** `agenteBindFlow.ts` com envio, resolução de alvo e as duas modalidades passaria de 200 linhas; o plano prevê a extração do envio (`agenteBindUpload.ts`) e o CLAUDE.md pede um arquivo, uma responsabilidade.
- **Fix:** envio em partes em `agenteBindUpload.ts` (Task 2) e resolução do alvo em `agenteBindTarget.ts` (Task 3, mesmo commit, extração mecânica).
- **Consequência para os critérios de aceite:** os literais `runMeetingUpload(`, `link-completed` e `send-progress`/`send-completed` agora moram em `agenteBindUpload.ts`, não em `agenteBindFlow.ts`; `link-started`, `send-started` e `send-failed` ficam no fluxo. Comportamento idêntico.
- **Commits:** `6627b52`, `f4b9c94`

**2. [Rule 1 - Bug evitado] Eventos do envio sem "ler estado e depois aplicar"**
- **Found during:** Task 3
- **Issue:** o plano sugere ler o estado atual do store antes de cada aplicação. Entre a leitura e a aplicação a sala pode ser retomada (`sending` -> `linking`), e o evento sairia da família errada.
- **Fix:** `applyForCurrentState` tenta `link-*` e, se o reducer recusa, `send-*` (a fila serializada do store já decide sem corrida). Resultado igual ao pedido, coberto pelo teste "a mesma sala volta no meio do envio".
- **Commit:** `f4b9c94`

**3. [Rule 2 - Critical] Guarda síncrona `inFlight` por reunião**
- **Found during:** Task 2
- **Issue:** só o estado `linking` não impede que dois `bind` com cliente novo passem juntos da validação e criem DOIS clientes antes de qualquer um gravar `link-started`.
- **Fix:** `Set` de reuniões em validação; o segundo comando recebe `invalid-state` na hora. Teste "dois bind simultâneos com cliente novo: um único cliente e uma única sessão".
- **Commit:** `6627b52`

**4. Pequenos ajustes de contrato (sem mudar critério)**
- `createAgenteAssociationService` recebe `BindFlowDeps` (superset de `{ directory, sessions }`); o helper do teste da Task 1 ganhou as portas vazias na Task 2.
- `open` já em `choosing` e `defer` já em `deferred` respondem `ok` (idempotente), além do `invalid-state` do plano para os demais casos.
- O "tudo o que já foi falado" cai no histórico quando a reunião deixou de ser a da tela durante o vínculo.
- Os testes carregam os fakes com `import()` depois do `resetModules` para a classe `DuplicateClientError` ser a mesma do código sob teste.

**Total deviations:** 3 auto-fixed (1 de tamanho, 1 bug evitado, 1 crítico) + ajustes de contrato. **Impact:** nenhum critério de aceite alterado em comportamento.

## Issues Encountered

- Aviso do git sobre LF/CRLF nos arquivos novos (config do Windows); sem efeito no conteúdo.
- `.planning/config.json` (só fim de linha) e `08-DECISOES-PENDENTES.md` ficaram de fora de todos os commits, como pedido.
- O Prettier do projeto não faz parte do gate (`lint` = eslint); rodei nos arquivos novos. `messages.ts` já não estava formatado no HEAD e não foi reformatado (diff de 2 linhas).

## Riscos que continuam abertos (para os próximos planos)

- **Service worker morto no meio do envio:** a associação fica em `linking` (ou `sending`) sem ninguém continuando. A recuperação de boot (`linking` sem sessão -> `deferred`; "Continuar envio") é dos planos 08-22 e 08-20; até lá nenhuma associação nasce sozinha em produção, então não há o que recuperar.
- **Sessão órfã:** se o service worker morrer entre o POST da sessão e a gravação de `session-created`, a nova tentativa cria outra sessão. Risco aceito no plano (§3).
- **`bind` responde `ok` antes do fim do envio** e não há "Cancelar" (UI-SPEC); a UI acompanha o progresso pelo store.
- **A3 (suposição):** bloco de 20 e pausa de 1 s continuam a validar no teste manual D-20(a).
- **B3 (chunk_id, plano 08-09/08-19):** este plano NÃO depende dela; o reenvio de uma parte que já tinha chegado segue sem idempotência até lá (a retentativa do envio em partes reaproveita a política da Fase 7).

## Known Stubs

Nenhum. `unavailableClientDirectory`/`unavailableSessionGateway` são o padrão de produção documentado (rotas B1 entram no 08-12), não placeholder esquecido. Os comandos ainda não têm tela que os dispare — fiação declarada dos planos 08-14, 08-17 e 08-18.

## Threat Flags

Nenhum novo. T-08-17 (comandos forjados): zod com ids limitados, UUID por regex e nome de 1 a 120, sem `externally_connectable`. T-08-18 (vínculo duplo): `link-started`/`send-started` antes do POST, guarda síncrona e testes de concorrência (1 sessão, 1 cliente). T-08-19 (sessão errada): `sessionId` do alvo gravado na associação e conferido em cada POST nos testes. T-08-SC: nenhum pacote novo (`package.json`/`package-lock.json` sem diff).

## Decisões em aberto herdadas

- **B1/B2 (já respondidas pelo time):** este plano não toca as rotas nem a chave do servidor. **Lembrete obrigatório:** `GEMINI_API_KEY` AINDA NÃO existe no Railway — criar antes de qualquer deploy, merge na `master` ou junção com o AGM.
- **B3, B4-b, B5, D-11:** não bloqueiam este plano.
- **Aviso herdado do 08-01:** não distribuir build da Taqciti entre o 08-01 e o 08-14 (sem associação `linked` nada sai e ainda não há tela de vínculo).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Pronto: as telas dos planos 08-14, 08-17 e 08-18 podem emitir `ui/agente/*` e ler o progresso pelo store; o 08-12 implementa as portas reais (`ClientDirectory`/`AgenteSessionGateway`) contra as rotas B1 e as injeta com `configureAgenteAssociation`; o 08-22 dispara `created`/`meeting-ended`/`meeting-resumed` e recupera `linking`/`sending` no boot.

## Self-Check: PASSED

- Arquivos presentes: os 8 de `key-files.created`.
- Commits presentes no histórico: `bf4da23`, `6627b52`, `f4b9c94`; `git rev-list --count 390a8a7..HEAD` = 3 no momento da escrita.
- Acceptance: `...agenteUiMessageSchemas` em `messages.ts`; `onLinked: () => reevaluateAgenteStreamer()` em `agenteAssociation.ts`; awk dos cases `ui/agente/*` = 0; nenhum arquivo novo com linha 201.
- Verificação do plano: `cd taqciti && npm test && npm run typecheck && npm run lint` verdes (57 arquivos, 825 testes).

---
*Phase: 08-taqciti-session-association*
*Completed: 2026-10-12*
