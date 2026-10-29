---
phase: 10-agp-question-panel-in-taqciti
plan: 03
subsystem: taqciti-background (feed do painel AGP: quando o WebSocket do Agente abre, fecha e mantém as perguntas)
tags: [typescript, vitest, chrome-extension, service-worker, websocket, pure-functions, taqciti]

# Dependency graph
requires:
  - phase: 10-agp-question-panel-in-taqciti
    provides: "feed do painel AGP do Gabriel (agpQuestionsFeed.ts, agpTarget.ts, agpQuestionsStore.ts) já integrado; plano 10-02 deixou o worker dormir mais (a memória das abas só em RAM)"
provides:
  - "decideAgpFollow (agpTarget.ts): regra pura follow | hold | none por fase da reunião x vínculo explícito x streamingEnabled; selectAgpTarget intacto"
  - "'paused' em AgpConnection e em CONNECTIONS (agpQuestionsStore.ts): sobrevive ao writeAgpFeed -> loadAgpFeed; valor desconhecido continua virando 'idle'"
  - "agpQuestionsFeedHold.ts (novo, puro, 88 linhas): AgpFeedHold, AgpHeldSession (com endedByBackend), decideAgpHold (none | pause | mark), decideAgpResume (connect | blocked) e heldFromStored"
  - "Ramo hold no feed: fecha o socket e o timer (detach), publica 'paused' com as perguntas mantidas; a retomada reconecta passando por 'connecting' COM a lista; dependência opcional readStored lê o feed salvo uma vez no boot do worker"
  - "agpQuestionsFeedInstance.ts decide pela fase real da reunião e por config.streamingEnabled; readStored: loadAgpFeed ligado em produção"
  - "agpQuestionsFeedInstance.test.ts: prova da composição de produção (sessionController, associações e config reais; só o WebSocket global é falso)"
affects: [10-07 (UI do estado 'paused': faixa com ícone e corpo vazio), 10-10 (UAT 11: pausar >30 s e retomar; envio desligado sem conexão nova no log do backend), 10-11]

# Actuals (#2632) — chars/4 sobre o diff realizado em taqciti/ (linhas adicionadas)
actuals:
  tokens: 10141
  tasks: 3
  commits: 3

# Measured commit ledger (#3968)
commits: 3
plan_head_before: 591f38421116459f6c0e1e7df7430c0d19896293
plan_head_after: a1f9a556ed0aa166bf972c9c5ca6ff80b8ef13e0

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Decisão pura + executor fino: todo 'o que fazer com as perguntas' (hold, retomada, hidratação, marcador do 4004) mora em agpQuestionsFeedHold.ts; o feed só executa o passo devolvido (uniões discriminadas por kind)"
    - "Estrutura mínima no lugar de tipo novo: decideAgpHold recebe o próprio following do feed (forma estrutural AgpFollowedSession), sem montar cópia"
    - "Teste de composição de produção sem vi.mock: só o WebSocket global é falso; fase trocada gravando o taq:state real no storage simulado + hydrate(); cada caso com controle positivo (a mesma montagem abre quando o único impedimento some)"
    - "Teste de reinício do worker = segunda chamada a createAgpQuestionsFeed sobre o mesmo storage simulado, com readStored"

key-files:
  created:
    - taqciti/src/background/agpQuestionsFeedHold.ts
    - taqciti/src/background/agpQuestionsFeedHold.test.ts
    - taqciti/src/background/agpQuestionsFeedInstance.test.ts
  modified:
    - taqciti/src/features/agente/agpTarget.ts
    - taqciti/src/shared/config/agpQuestionsStore.ts
    - taqciti/src/background/agpQuestionsFeed.ts
    - taqciti/src/background/agpQuestionsFeedInstance.ts
    - taqciti/src/features/agente/agpTarget.test.ts
    - taqciti/src/shared/config/agpQuestionsStore.test.ts

key-decisions:
  - "D-11 implementado: o socket do /ws só abre com a reunião em 'recording' + vínculo explícito (linked, com origem e sessionId, não encerrada) + streamingEnabled; pausa, captionsRequired ou envio desligado = hold (fecha, mantém a lista, publica 'paused'); URL do backend inválida = nada (limpa), igual a hoje"
  - "A lista de fases ao vivo de decideAgpFollow é uma constante local em features/agente/agpTarget.ts (captionsRequired, recording, paused), e não um import de isLivePhase de background/: a camada features/ continua sem depender de background/"
  - "O 4004 vira marcador em memória (endedByBackend no Following e na sessão segurada) e, depois do sono do worker, o salvo 'idle' da mesma sessão vale como marcador: hold não troca 'idle' por 'paused' e follow da mesma sessão não reabre; só um alvo novo ou o boot (que ignora a marca do salvo) tenta de novo, como já era"
  - "readStored só é chamado na primeira reconciliação da instância e só quando há alvo (selectTarget != null): sem alvo não há o que hidratar e economiza uma leitura de storage"
  - "Hidratação só com o mesmo sessionId (T-10-06): feed salvo de outra sessão nunca entra, nem como lista de partida nem como pausa"

patterns-established:
  - "Mutação como prova: ignorar streamingEnabled na composição, remover a marca do 4004 e hidratar de qualquer sessão derrubam testes (1, 1 e 4 respectivamente); arquivos restaurados"

requirements-completed: [TAQ-05]

# Coverage metadata (#1602)
coverage:
  - id: D1
    description: "Regra D-11 pura: decideAgpFollow só devolve follow com recording + vínculo elegível + envio ligado; pausa, captionsRequired ou envio desligado devolvem hold; ended, idle, sem reunião ou vínculo inelegível (sem associação, sem origem, deferred, linking, sessionFinished) devolvem none"
    requirement: "TAQ-05"
    verification:
      - kind: unit
        ref: "taqciti/src/features/agente/agpTarget.test.ts#decideAgpFollow (D-11) — 10 linhas fase x envio, 15 casos de vínculo inelegível, meetingId null, associação de outra reunião"
        status: pass
    human_judgment: false
  - id: D2
    description: "Armadilha 1: 'paused' sobrevive a writeAgpFeed -> loadAgpFeed (cada um dos 5 valores de conexão); valor desconhecido continua virando 'idle'; a ordem das perguntas é mantida"
    requirement: "TAQ-05"
    verification:
      - kind: unit
        ref: "taqciti/src/shared/config/agpQuestionsStore.test.ts#connection — ida e volta (D-11, Armadilha 1)"
        status: pass
    human_judgment: false
  - id: D3
    description: "O feed fecha o socket sem agendar timer (nem reconexão pendente) ao segurar, mantém as perguntas como 'paused', ignora o onclose do socket antigo, não regrava em hold repetido, não leva perguntas de outra sessão; a retomada abre um socket NOVO passando por 'connecting' com a lista mantida e o initial_state substitui; hold seguido de null limpa (EMPTY_AGP_FEED)"
    requirement: "TAQ-05"
    verification:
      - kind: integration
        ref: "taqciti/src/background/agpQuestionsFeedHold.test.ts#segurar a conexão (fluxo do feed) — 8 casos, store real e socket/timers falsos"
        status: pass
      - kind: unit
        ref: "taqciti/src/background/agpQuestionsFeedHold.test.ts#decideAgpHold (puro) e decideAgpResume (puro)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Composição de produção (D-11 e T-10-05): com sessionController, associações e config reais, gravando + vínculo + envio ligado abre exatamente 1 socket na URL certa e nunca manda nada; envio desligado, pausa e captionsRequired fecham e publicam 'paused' sem abrir outro; religar ou voltar a gravar abre um socket novo; reunião encerrada, sem vínculo ou URL do backend inválida deixam EMPTY_AGP_FEED sem socket (com controle positivo)"
    requirement: "TAQ-05"
    verification:
      - kind: integration
        ref: "taqciti/src/background/agpQuestionsFeedInstance.test.ts (10 testes; só o WebSocket global é falso, sem vi.mock)"
        status: pass
    human_judgment: false
  - id: D5
    description: "Armadilha 2 e T-10-06: depois do sono do worker (nova instância do feed sobre o mesmo storage, com readStored) o hold da mesma sessão republica 'paused' com as mesmas perguntas na mesma ordem, a retomada começa por 'connecting' com [a, b], storage de outra sessão nunca entra (hold = lista vazia, alvo = connecting vazio) e hold seguido de null limpa"
    requirement: "TAQ-05"
    verification:
      - kind: integration
        ref: "taqciti/src/background/agpQuestionsFeedHold.test.ts#a pausa sobrevive ao sono do service worker (Armadilha 2) — 5 casos"
        status: pass
      - kind: unit
        ref: "taqciti/src/background/agpQuestionsFeedHold.test.ts#heldFromStored (puro) e o marcador do 4004 e o salvo do boot nas decisões puras"
        status: pass
    human_judgment: false
  - id: D6
    description: "D-12 e T-10-07: depois de um 4004, hold não troca 'idle' por 'paused' (nenhuma escrita) e follow da mesma sessão não abre socket nem timer; alvo de outra sessão abre normalmente e limpa o marcador; storage 'idle' no boot + hold não escreve 'paused', e storage 'idle' + alvo tenta de novo (como hoje); backoff 1000,2000,4000,8000,16000,30000,30000 e 30000 (attempt 20) inalterado"
    requirement: "TAQ-05"
    verification:
      - kind: integration
        ref: "taqciti/src/background/agpQuestionsFeedHold.test.ts#4004 (sessão não ativa) não vira paused nem reabre (D-12) — 5 casos"
        status: pass
      - kind: unit
        ref: "taqciti/src/background/agpQuestionsFeed.test.ts#agpReconnectDelayMs (arquivo antigo, sem edição)"
        status: pass
    human_judgment: false
  - id: D7
    description: "Sem regressão e limites do CLAUDE.md: testes antigos do feed, da fumaça contra o roteador WS real e de agpQuestions passam sem edição (git diff --quiet eb3bf01); fumaça 3/3 com AGP_PYTHON=python; tsc --noEmit e eslint src limpos; AgpSocket sem send; agpQuestionsFeed.ts 186 linhas ao fim da Task 1 (teto 192) e 193 ao fim da Task 3 (teto 200); demais arquivos de produção com no máximo 88 linhas; módulo puro sem chrome/WebSocket/timer"
    requirement: "TAQ-05"
    verification:
      - kind: integration
        ref: "cd taqciti && AGP_PYTHON=python AGP_SMOKE_SERVER=scripts/agp-fake-backend.py npx vitest run src/background/agpBackendSmoke.test.ts (3 passed)"
        status: pass
      - kind: other
        ref: "cd taqciti && npx tsc --noEmit && npx eslint src (exit 0); awk 'END {print NR}' nos 5 arquivos de produção; git diff --quiet eb3bf01 nos 5 arquivos protegidos"
        status: pass
    human_judgment: false
  - id: D8
    description: "Comportamento real no Chrome: pausar a captura por mais de 30 s (o worker pode dormir) e retomar mostra as mesmas perguntas e depois a lista nova; desligar o envio fecha a conexão e o log do backend não mostra conexão nova durante a pausa"
    requirement: "TAQ-05"
    verification: []
    human_judgment: true
    rationale: "Os testes simulam o WebSocket, o storage e o ciclo de vida do worker; só o teste 11 do 10-UAT.md (planos 10-10/10-11, Chrome e backend reais) confirma o sono do service worker de verdade e a ausência de conexão no log do backend. A faixa visual de 'Pausado' é do plano 10-07"

# Metrics
duration: 27min
completed: 2026-10-29
status: complete
---

# Phase 10 Plan 03: D-11 (WR-04) — o feed do AGP só liga a IA gravando e mantém as perguntas na pausa Summary

**`decideAgpFollow` (follow | hold | none), estado `paused` no store e o módulo puro `agpQuestionsFeedHold.ts`: o `/ws/{session_id}` só abre com a reunião gravando, vínculo explícito e envio ligado; em pausa, sem legendas ou com o envio desligado o socket fecha, as perguntas ficam na tela (`paused`) e sobrevivem ao sono do service worker sem nunca misturar sessões nem reabrir um 4004.**

## Performance

- **Duration:** 27 min
- **Started:** 2026-10-29T21:00:00Z (aprox.)
- **Completed:** 2026-10-29T21:27:00Z (aprox.)
- **Tasks:** 3
- **Files modified:** 9 (3 novos: `agpQuestionsFeedHold.ts`, `agpQuestionsFeedHold.test.ts`, `agpQuestionsFeedInstance.test.ts`; 6 modificados)

## Accomplishments

- **A IA do backend deixa de ligar à toa (D-11, T-10-05):** conectar no `/ws` cria o pipeline de IA (laços de 15/30 s, gasto de Gemini). Agora o socket só abre com a reunião em `recording`, vínculo explícito (`linked`, com origem e `sessionId`, não encerrada) e `streamingEnabled`; em `paused`, `captionsRequired` ou com o envio desligado o feed vira "segurar": fecha o socket e o timer, mantém as perguntas e publica `paused`.
- **A pausa não perde a lista:** ao voltar a gravar, o feed reconecta passando por `connecting` com a lista mantida (mesma ordem) até o `initial_state` do backend substituí-la.
- **Armadilha 1 fechada:** `'paused'` entra no tipo E em `CONNECTIONS`, então não vira `idle` em silêncio; teste de ida e volta para cada um dos 5 valores, e valor desconhecido continua virando `idle`.
- **Armadilha 2 fechada (T-10-06):** com `readStored` (lê o feed salvo uma vez na primeira reconciliação), um worker que acordou em hold republica `paused` com as mesmas perguntas, e um que acordou gravando começa `connecting` com elas; o feed salvo só vale com o mesmo `sessionId` (storage de outra sessão = lista vazia).
- **D-12 intacto (T-10-07):** o 4004 vira marcador (`endedByBackend`): depois dele, hold continua `idle` (nenhuma escrita) e follow da mesma sessão não abre socket nem timer; só um alvo novo ou o boot tenta de novo. Backoff, código 4004 e zeragem de `attempt` só no `initial_state` não foram tocados.
- **Composição de produção provada de verdade:** `agpQuestionsFeedInstance.test.ts` usa o `sessionController`, o store de associações e o leitor de config reais; só o `WebSocket` global é falso. A fase real e o `streamingEnabled` real decidem abrir, segurar ou limpar (10 testes, cada "nada a seguir" com controle positivo).
- **Limite de tamanho do CLAUDE.md respeitado sem mover código do Gabriel:** toda decisão nova mora no módulo puro (88 linhas); `agpQuestionsFeed.ts` foi de 167 para 186 linhas na Task 1 (teto 192) e 193 na Task 3 (teto 200). O diff do feed acrescenta linhas e altera só três linhas existentes (`selectTarget` com o tipo novo, `shouldClear`, e a criação do `Following`/`connecting` com as perguntas de partida).

## Task Commits

1. **Task 1 (tracer): pausar ou desligar o envio fecha o socket e a aba guarda as perguntas como 'paused'** - `4ab5b94` (feat)
2. **Task 2: tabela follow/hold/none, ida e volta do store e a composição de produção exercitada com a fase e o envio reais** - `3f9a7e7` (test)
3. **Task 3: a pausa sobrevive ao sono do service worker, nunca mistura sessões e respeita o 4004** - `a1f9a55` (feat)

**Plan metadata:** commit docs(10-03) logo após este SUMMARY (STATE/ROADMAP).

## Files Created/Modified

- `taqciti/src/features/agente/agpTarget.ts` - `AgpFollowDecision` e `decideAgpFollow` por cima de `selectAgpTarget` (59 linhas)
- `taqciti/src/shared/config/agpQuestionsStore.ts` - `'paused'` no tipo e em `CONNECTIONS` (55 linhas)
- `taqciti/src/background/agpQuestionsFeedHold.ts` - novo, puro (88 linhas): decisões do hold, da retomada e da hidratação
- `taqciti/src/background/agpQuestionsFeed.ts` - executor do hold, retomada com a lista, `readStored`, marcador do 4004 (186 linhas após a Task 1, 193 após a Task 3)
- `taqciti/src/background/agpQuestionsFeedInstance.ts` - `selectTarget` com `decideAgpFollow` e `readStored: loadAgpFeed` (61 linhas)
- `taqciti/src/background/agpQuestionsFeedHold.test.ts` - novo (34 testes): fluxo com o store real, sono do worker, 4004 e casos puros
- `taqciti/src/background/agpQuestionsFeedInstance.test.ts` - novo (10 testes): composição de produção, só o WebSocket falso
- `taqciti/src/features/agente/agpTarget.test.ts` - só acréscimo (+54 linhas, 0 removidas)
- `taqciti/src/shared/config/agpQuestionsStore.test.ts` - só acréscimo (+29 linhas, 0 removidas)

## Decisions Made

- A lista de fases ao vivo do `decideAgpFollow` é uma constante local em `features/agente/agpTarget.ts` em vez de importar `isLivePhase` de `background/agenteAssociationLifecycle.ts` (a camada `features/` não depende de `background/`; as duas listas são idênticas: `captionsRequired`, `recording`, `paused`). Escolha de implementação dentro do que o plano deixou livre, sem mudar contrato.
- O marcador do 4004 vive no estado em memória e, depois do sono do worker, o salvo `idle` da mesma sessão faz o mesmo papel; o boot ignora a marca do salvo no alvo (tenta de novo, como já era — decisão do plano seção 6, mantida).
- `readStored` só roda na primeira reconciliação e só com alvo (sem alvo não há o que hidratar). Se a leitura rejeitar, a reconciliação cai no `onError` do `reconcile` e a próxima tenta de novo (`needsInitialClear` continua verdadeiro).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug no roteiro do teste] A composição precisa criar a associação antes de vinculá-la**
- **Found during:** Task 2 (`agpQuestionsFeedInstance.test.ts`)
- **Issue:** o plano manda aplicar `link-started` + `link-completed` para `m1`, mas o reducer só aceita `link-started` de uma associação que já exista (`pending`/`choosing`/`deferred`). Sem o evento `created`, a associação nunca chegava a `linked`, nenhum socket abria e 6 testes falharam (os de "nada a seguir" passavam, mas por motivo errado).
- **Fix:** `applyAssociationEvent(m1, { type: 'created' })` antes do `link-started`; cada caso de "nada a seguir" ganhou um controle positivo (a mesma montagem abre quando o único impedimento some: fase `recording`, URL válida), para não passar por acidente.
- **Files modified:** `taqciti/src/background/agpQuestionsFeedInstance.test.ts`
- **Verification:** 10/10 verdes; mutação (ignorar `streamingEnabled` na composição) derruba o teste de envio desligado.
- **Committed in:** `3f9a7e7` (Task 2)

**2. [Rule 1 - Bug no roteiro do teste] `agenteBackendUrl: 'nada'` não é uma URL inválida depois da normalização**
- **Found during:** Task 2 (caso "URL do backend inválida")
- **Issue:** `normalizeAgenteConfig` prefixa `https://` em host sem protocolo, então `'nada'` vira `https://nada`, que é válida e abriria `wss://nada/ws/...`. O exemplo do plano não exercitava o caso.
- **Fix:** usei `http://exemplo.com` (http em host que não é loopback), que a normalização preserva e `isValidAgenteBackendUrl` recusa; com o controle positivo trocando para `http://127.0.0.1:8000`.
- **Files modified:** `taqciti/src/background/agpQuestionsFeedInstance.test.ts`
- **Committed in:** `3f9a7e7` (Task 2)

**3. [Rule 2 - Robustez do teste] Prazo de 30 s no teste da composição**
- **Found during:** Task 2
- **Issue:** os imports dinâmicos do `sessionController` levam ~0,9 s sozinhos e já houve estouro do prazo padrão de 5 s em testes parecidos sob a suíte inteira carregada (risco 3(c) do plano).
- **Fix:** `vi.setConfig({ testTimeout: 30_000 })` no topo do arquivo novo.
- **Files modified:** `taqciti/src/background/agpQuestionsFeedInstance.test.ts`
- **Committed in:** `3f9a7e7` (Task 2)

---

**Total deviations:** 3 auto-fixed (2 Rule 1 sobre o roteiro dos testes, 1 Rule 2). **Impact on plan:** só testes; nenhum arquivo de produção mudou por causa deles. Sem alteração de contrato, dependência ou comportamento fora do planejado.

Observações de execução, sem desvio de regra:

- **Formato do commit nas tasks com TDD:** o plano define um commit único por task (`feat` na Task 1 com o teste do fluxo junto, `test` na Task 2, `feat` na Task 3) para o rollback por `git revert <sha>`; o plano vence. O RED de cada task foi rodado antes da implementação e não foi commitado em separado.
- **`agpTarget.test.ts`: segundo `import` no meio do arquivo.** O portão da Task 2 exige zero linhas removidas nos dois testes existentes, então não dava para editar a linha de import de `./agpTarget`; os imports de `decideAgpFollow` e `MeetingPhase` foram acrescentados logo antes do `describe` novo (válido em ES modules, eslint limpo).

## Notas de TDD

- **RED (Task 1):** `agpQuestionsFeedHold.test.ts` falhou porque o módulo `agpQuestionsFeedHold.ts` ainda não existia (erro de resolução de import). Avaliação semântica: é um RED de "símbolo ausente", não de assertiva; o GREEN trouxe 14/14 e os 36 testes antigos seguiram verdes.
- **RED (Task 3):** 11 dos 34 testes falharam antes da implementação, por assertiva ou símbolo ausente (`heldFromStored is not a function`; `expected { kind: 'pause' } to deeply equal { kind: 'mark' }`; `expected { kind: 'connect' } to deeply equal { kind: 'blocked' }`; reinício do worker com `connecting` vazio em vez de [a, b]; 4004 -> hold -> alvo abrindo socket novo). Os outros 23 já passavam porque cobriam o comportamento da Task 1.
- **Prova por mutação:** ignorar `streamingEnabled` na composição derrubou 1 teste; remover `current.endedByBackend = true` derrubou 1 (4004 -> hold -> alvo); hidratar de qualquer sessão (tirar a comparação de `sessionId` em `heldFromStored`) derrubou 4. Arquivos restaurados e conferidos (`git diff` vazio e `diff` byte a byte).
- Plano é `type: execute` (não `tdd`), então não há seção "TDD Gate Compliance".

## Issues Encountered

- **Suíte completa (`cd taqciti && npx vitest run`, 102 arquivos, 1635 testes): 3 falhas, todas por estourar o prazo padrão de 5 s (~5,1 s)** em `agenteAssociationHttp.test.ts`, `agenteStreamer.test.ts` e `AgenteConfigScreen.test.tsx`. Os três arquivos passam sozinhos (74/74) e nenhum importa o feed do AGP, `agpTarget` ou `agpQuestionsStore`. Mesma classe do teste instável já registrado no plano 10-02. Fora de escopo; acrescentado ao `deferred-items.md` desta fase.
- **Janela entre ondas (prevista no plano, risco 3(e)):** até o plano 10-07 entrar, a UI atual trata todo estado diferente de `live` como "Reconectando ao Agente…", então um `paused` aparece com esse texto. Aceita: o build não é distribuído entre as ondas.

## User Setup Required

None - no external service configuration required.

## Threat Flags

None. O plano só diminui superfície: o socket deixa de abrir fora de gravando + vínculo + envio ligado (T-10-05), a hidratação exige o mesmo `sessionId` (T-10-06) e o 4004 continua parando o laço (T-10-07). A interface `AgpSocket` segue sem `send` (T-10-08 aceito: a Taqciti só lê); o teste da composição afirma que nenhum socket recebeu `send`.

## Known Stubs

None.

## Next Phase Readiness

- Pronto para o 10-07: o valor `paused` já existe no store e chega ao painel; falta só a parte visual (faixa "Pausado · mostrando as últimas perguntas" com ícone e o corpo vazio "Nenhuma pergunta foi recebida antes da pausa.").
- **Pendência de validação real:** teste 11 do `10-UAT.md` (planos 10-10/10-11, Chrome e backend reais): pausar por mais de 30 s para o worker poder dormir e retomar; desligar o envio e conferir no log do backend que não há conexão nova durante a pausa. Os testes simulam o ciclo de vida do worker, não o Chrome.
- **Rollback:** `git revert a1f9a55` volta a pausa a perder a lista se o worker dormir e deixa de respeitar o marcador do 4004 no hold (o módulo puro volta ao estado da Task 1); `git revert 3f9a7e7` remove só testes; `git revert 4ab5b94` volta a conectar como hoje, pausa incluída (o valor `'paused'` eventualmente gravado vira `'idle'` na leitura antiga). Emergência: apagar a chave `taq:agpQuestions` do storage; a UI cai no estado "sem vínculo".

## Self-Check: PASSED

- Arquivos: `agpQuestionsFeedHold.ts`, `agpQuestionsFeedHold.test.ts`, `agpQuestionsFeedInstance.test.ts`, `agpQuestionsFeed.ts`, `agpQuestionsFeedInstance.ts`, `agpTarget.ts`, `agpQuestionsStore.ts` — todos FOUND.
- Commits: `4ab5b94`, `3f9a7e7` e `a1f9a55` — todos ancestrais de HEAD; `evaluation-scope --plan 10-03 --commits-only` devolve os três (`commits: 3` medido pelo ledger, base `591f384`).
- Critérios de aceitação re-rodados: os 5 arquivos de teste do plano 114/114 (`agpQuestionsFeedHold` 34, `agpQuestionsFeedInstance` 10, `agpQuestionsFeed` 14, `agpTarget` 22, `agpQuestionsStore` 34 menos os já contados nos antigos; total 114); fumaça contra o roteador WS real 3/3; `git diff --quiet eb3bf01` nos 5 arquivos protegidos sai 0; `git diff --numstat` dos dois testes acrescidos = 0 linhas removidas; `'paused'` em `agpQuestionsStore.ts` = 2; `send` na interface `AgpSocket` = 0; tamanhos: feed 193, hold 88, instance 61, target 59, store 55 (todos <= 200); módulo puro sem `chrome.`/`new WebSocket`/`setTimeout(`/`setInterval(` = 0; `decideAgpFollow(`, `streamingEnabled` e `.phase` na composição = 1 cada, `readStored: loadAgpFeed` = 1, `deps.readStored` no feed = 1, `heldFromStored(` no módulo puro = 3; `tsc --noEmit` e `eslint src` exit 0.

---
*Phase: 10-agp-question-panel-in-taqciti*
*Completed: 2026-10-29*
