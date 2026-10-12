---
phase: 08-taqciti-session-association
plan: 14
subsystem: taqciti-panel-ui
tags: [taqciti, chrome-extension, react, hooks, storage-local, vitest, meet-panel, session-association]

requires:
  - phase: 08-taqciti-session-association
    provides: "08-01/08-02/08-03/08-04: reducer e store de associações, bolha, cartão, seletor e barra (apresentacionais); 08-10: comandos ui/agente/* e AgenteCommandResult; 08-11: status de entrega em storage.local"
provides:
  - "bindingView.ts: tradução pura associação + entrega -> barra, cartão de fim, selo, bolha e toast (inclusive os estados da sala retomada)"
  - "useMeetingAssociation (open/defer/bind por comando zod, leitura só de storage.local) e sendAgenteCommand reaproveitável"
  - "useClientDirectory: lista de clientes sob demanda (loading/ready/error + retry)"
  - "AgenteLiveSlot: cartão -> seletor -> barra durante a reunião; minimizar = Depois; compacto sobe para regular"
  - "AgenteNudgeAnchor: bolha '!' na cápsula (decorativa) e no cabeçalho (abre o cartão), só em pending"
  - "PanelApp.tsx só com fiação (25 linhas, nenhum hook novo)"
affects: [08-17, 08-18, 08-20, 08-22]

actuals:
  tokens: 13700
  tasks: 3
  commits: 3

plan_head_before: 8755e970702ba09d416a22b03f58efb4585fc94f
plan_head_after: b06b75469db5a5e3f6d83949a1b49244f93e4023

tech-stack:
  added: []
  patterns:
    - "Contêiner (AgenteLiveSlot) = hooks + peças apresentacionais; o PanelApp só costura por props e por um ReactNode (liveSlot)"
    - "Painel do Meet lê só storage.local (subscribeAssociations/subscribeDelivery) e age só por platform.send com resposta validada por zod"
    - "Harness de teste de componente com plataforma falsa e chrome.storage simulado (src/test/agentePanelHarness.tsx)"

key-files:
  created:
    - taqciti/src/features/agente/bindingView.ts
    - taqciti/src/features/agente/bindingView.test.ts
    - taqciti/src/shared/hooks/useMeetingAssociation.ts
    - taqciti/src/shared/hooks/useClientDirectory.ts
    - taqciti/src/sidepanel/components/AgenteLiveSlot.tsx
    - taqciti/src/sidepanel/components/AgenteLiveSlot.test.tsx
    - taqciti/src/sidepanel/components/AgenteNudgeAnchor.tsx
    - taqciti/src/sidepanel/components/AgenteNudgeAnchor.test.tsx
    - taqciti/src/test/agentePanelHarness.tsx
  modified:
    - taqciti/src/shared/config/agenteStatus.ts
    - taqciti/src/sidepanel/components/ClientPicker.tsx
    - taqciti/src/content/ui/PanelApp.tsx

key-decisions:
  - "O slot renderiza o seletor enquanto a associação estiver em choosing ou deferred e o passo 'picker' estiver à vista; entrou em linking/linked o passo volta para 'card' sozinho. Assim a falha ao criar a sessão (que volta a reunião para deferred) mantém o seletor aberto com o erro, como pede o plano"
  - "Em pending o slot não desenha nada: o convite é a bolha '!' (cabeçalho ou cápsula); o cartão só aparece depois do open"
  - "O PanelApp recebe o slot pronto como ReactNode (liveSlot) em vez de três props novas por camada: menos linhas e nenhum estado novo"
  - "toEndPromptView também mapeia linking (reunião já encerrada, vínculo ainda enviando) para o cartão 'sending'; o plano não cobria esse caso"
  - "Painel e seletor: o wrapper do seletor usa flex-[2] para dividir a altura com a transcrição (valor a conferir no teste manual D-20)"

patterns-established:
  - "Teste de contêiner com createAgenteHarness: start(associação, entrega) -> render -> writeAssociation/writeDelivery simulam o service worker"

requirements-completed: []

coverage:
  - id: D1
    description: "Tradução pura associação + entrega -> barra, fim da reunião, selo, bolha e toast, com os três estados da sala retomada ao vivo e nenhum estado ao vivo sem tela"
    requirement: TAQ-02
    verification:
      - kind: unit
        ref: "taqciti/src/features/agente/bindingView.test.ts"
        status: pass
    human_judgment: false
  - id: D2
    description: "Cartão -> Depois -> barra; seletor -> vincular com comando único; plano B por ID; minimizar = Depois; cápsula abre com cartão; compacto sobe para regular uma vez; toast de volta do Agente"
    requirement: TAQ-02
    verification:
      - kind: unit
        ref: "taqciti/src/sidepanel/components/AgenteLiveSlot.test.tsx"
        status: pass
    human_judgment: false
  - id: D3
    description: "Bolha '!' só em pending; botão no cabeçalho manda um open; círculo decorativo na cápsula sem comando ao montar"
    requirement: TAQ-02
    verification:
      - kind: unit
        ref: "taqciti/src/sidepanel/components/AgenteNudgeAnchor.test.tsx"
        status: pass
    human_judgment: false
  - id: D4
    description: "Painel sem storage.session nem fetch; PanelApp com no máximo 25 linhas novas e sem hook novo"
    requirement: TAQ-02
    verification:
      - kind: command
        ref: "awk de storage.session|readSession|fetch( nos 3 arquivos = 0; git show --numstat do PanelApp = 25; awk de hooks novos = 0"
        status: pass
    human_judgment: false
  - id: D5
    description: "Experiência real no Meet: bolha pulando a cada ~5 s na cápsula, clique abrindo o painel com o cartão, arraste da cápsula intacto, Esc no cartão sem minimizar, seletor com ao menos 3 linhas em 564 px"
    requirement: TAQ-02
    verification: []
    human_judgment: true
    rationale: "Animação, arraste (useFloating), captura de ponteiro, altura real do seletor no painel e shadow DOM não são exercitados pelo jsdom; é o human-check da Task 3 e o teste manual D-20"

duration: 11min
completed: 2026-10-12
status: complete
---

# Phase 8 Plan 14: Bolha, cartão, seletor e barra de vínculo no painel do Meet Summary

**O painel da Taqciti no Meet agora conduz a pessoa do aviso ao vínculo: bolha "!" (cápsula e cabeçalho) -> cartão "Esta reunião é de qual cliente?" -> seletor com plano B -> barra "Enviando ao vivo para {cliente}" com progresso e aviso de Agente fora do ar, tudo lido só de `storage.local` e comandado só por `platform.send`.**

## Performance

- **Duration:** ~11 min (14:49Z a 15:00Z no relógio do host)
- **Tasks:** 3 (um commit por task)
- **Files:** 9 criados, 3 alterados (`agenteStatus.ts` +1 palavra, `ClientPicker.tsx` +9/-5, `PanelApp.tsx` +25); `package.json` e `package-lock.json` sem diff

## Accomplishments

- **Tradução pura (Task 1):** `bindingView.ts` (114 linhas) cobre barra, cartão de fim, selo, bolha e toast; os estados `ended-unsent`, `sending` e `sent` com a reunião ao vivo (sala retomada, 08-22) mostram `deferred`, progresso e `linked`. `rejectionText` passou a ser exportada. `useMeetingAssociation` expõe `open`, `defer`, `bind` e a função `sendAgenteCommand` (resposta nula, inválida ou ponte quebrada vira `unavailable`); `useClientDirectory` busca a lista só com o seletor aberto.
- **Contêiner ao vivo (Task 2):** `AgenteLiveSlot` (152 linhas) decide entre cartão, seletor e barra; "Depois", × e Esc adiam; minimizar com o cartão aberto manda `defer` uma vez; a cápsula abre o painel e o slot manda `open`; abrir o seletor em 320 px sobe para 564 px uma vez; um `bind` por vez (travado por `ref` e por estado); toast de 2,2 s na volta do Agente.
- **Bolha e fiação (Task 3):** `AgenteNudgeAnchor` renderiza a bolha só em `pending` (botão no cabeçalho que manda `open`, enfeite sem clique na cápsula). `PanelApp.tsx` recebeu só 25 linhas (2 imports, `meetingId`, 2 ancoragens, o slot e o repasse por props), nenhum `useState`/`useEffect`/`useMemo`/`useCallback` novo.
- **Portão do plano:** `npm test` 67 arquivos / 953 testes, `npm run typecheck`, `npm run lint` e `npm run build` verdes.

## Task Commits

1. **Task 1 — tradução pura + hooks:** `3fa39ec`
2. **Task 2 — AgenteLiveSlot (+ harness de teste e ajuste do ClientPicker):** `4895b78`
3. **Task 3 — AgenteNudgeAnchor + fiação no PanelApp:** `b06b754`

**Plan metadata:** commit de docs ao final (SUMMARY + STATE + ROADMAP).

## Evidência TDD (RED -> GREEN)

- **Task 1:** RED = falha de import (`bindingView.ts` ainda não existia), não semântico, sem stub neutro. GREEN 30/30. Os hooks não têm teste próprio: são exercitados pelos testes do slot e da âncora (que passam pelo storage simulado e pela plataforma falsa).
- **Task 2:** escrevi teste e implementação em sequência; o primeiro run já foi GREEN (19/19, depois 20/20). Para provar que o teste pega regressão fiz mutação: sem a guarda `busyRef` e sem a comparação `wasExpanded === expanded`, 6 testes falharam; revertido.
- **Task 3:** teste da âncora escrito antes da implementação; GREEN 8/8 na primeira rodada após implementar (RED não observado isoladamente).
- Commits por task (plano §2), então RED e GREEN não foram commitados separados.

## Files Created/Modified

- `taqciti/src/features/agente/bindingView.ts` — funções puras de tradução (114 linhas)
- `taqciti/src/shared/hooks/useMeetingAssociation.ts` — associação, entrega, `open`/`defer`/`bind`, `sendAgenteCommand` (93 linhas)
- `taqciti/src/shared/hooks/useClientDirectory.ts` — lista de clientes sob demanda (46 linhas)
- `taqciti/src/sidepanel/components/AgenteLiveSlot.tsx` — cartão/seletor/barra (152 linhas)
- `taqciti/src/sidepanel/components/AgenteNudgeAnchor.tsx` — bolha ligada ao estado (31 linhas)
- `taqciti/src/test/agentePanelHarness.tsx` — harness compartilhado dos testes de componente
- `taqciti/src/shared/config/agenteStatus.ts` — `export function rejectionText` (só a palavra `export`)
- `taqciti/src/sidepanel/components/ClientPicker.tsx` — erro de criar sessão também no plano B
- `taqciti/src/content/ui/PanelApp.tsx` — fiação (+25 linhas)
- Testes novos: `bindingView.test.ts` (30), `AgenteLiveSlot.test.tsx` (20), `AgenteNudgeAnchor.test.tsx` (8)

## Decisions Made

Ver `key-decisions` no frontmatter. Em resumo: seletor visível em `choosing`/`deferred` (mantém o erro de criar sessão na tela), `pending` sem cartão (a bolha é o convite), slot passado ao `PanelApp` como `ReactNode`, `linking` no fim da reunião mostra progresso, e `flex-[2]` no seletor como valor inicial a validar.

## Deviations from Plan

### Auto-fixed / additive

**1. [Rule 2 - Critical] Erro do plano B (ID manual) invisível no `ClientPicker`**
- **Found during:** Task 2
- **Issue:** quando o vínculo por ID manual falhava no service worker, o seletor em estado `error` não mostrava nada (a mensagem de `create-session` só existia na ramificação da lista). A pessoa clicaria e nada aconteceria.
- **Fix:** o parágrafo de erro virou uma constante (`sessionError`) usada nas duas ramificações; teste novo no slot ("o erro do vínculo por ID manual também aparece no plano B, sem perder o campo"). Os 25 testes do `ClientPicker` continuam verdes.
- **Files modified:** `taqciti/src/sidepanel/components/ClientPicker.tsx`, `AgenteLiveSlot.test.tsx`
- **Commit:** `4895b78`

**2. [Rule 3 - Blocking] Harness de teste compartilhado, arquivo não listado no plano**
- **Found during:** Task 2
- **Issue:** o plano manda reaproveitar a plataforma falsa e o storage simulado do teste do slot no teste da âncora; copiar o setup duplicaria ~70 linhas.
- **Fix:** `taqciti/src/test/agentePanelHarness.tsx`, usado pelos dois testes. Só teste, nada entra no bundle.
- **Commit:** `4895b78`

**3. Ajustes de contrato (sem mudar critério)**
- `sendAgenteCommand` ficou exportada de `useMeetingAssociation.ts` (o plano a chamava "interna") para o `useClientDirectory` e os planos 08-17/08-20 reaproveitarem.
- `toEndPromptView` trata `linking` (reunião encerrada com o vínculo ainda enviando) como `sending`; o plano não definia esse caso.
- `useClientDirectory` trata `ok: true` sem `clients` como erro (resposta fora do contrato), para não mostrar "Nenhum cliente cadastrado" por engano.

**Total deviations:** 1 crítica (Rule 2), 1 de apoio de teste (Rule 3) e ajustes de contrato. **Impact:** nenhum critério de aceite mudou.

## Issues Encountered

- Aviso do git sobre LF/CRLF nos arquivos novos (config do Windows); `PanelApp.tsx` ficou com diff limpo de 25 linhas.
- `.planning/config.json` (só fim de linha) e `08-DECISOES-PENDENTES.md` ficaram de fora de todos os commits, como pedido.
- `TAQ-02` **não** foi marcado como concluído (outros planos da fase ainda o declaram).

## Riscos que continuam abertos (para os próximos planos)

- **A bolha ainda não aparece em produção:** nenhum código dispara o evento `created` da associação (grep em `src`: só o tipo existe). Quem o dispara é o plano 08-22; até lá o painel não vê associação nenhuma e fica sem bolha, cartão e barra. Por isso o human-check ("bolha pulando numa reunião real") só vale depois do 08-22.
- **`discard()` fica para o 08-17**, junto do comando do 08-13; o hook deste plano só tem `open`/`defer`/`bind`.
- **Altura do seletor no painel (D-20):** `flex-[2]` ao lado da transcrição é uma estimativa; conferir "ao menos 3 linhas visíveis em 564 px" e o cartão sem corte em 320 px.
- **Bolha na cápsula:** a cápsula é `fixed` (já contém o `absolute`), mas só o teste manual confirma que a bolha não é cortada e que o arraste da cápsula segue funcionando.
- **Estado `choosing` preso com o painel minimizado:** se o `open` for aplicado depois de a pessoa minimizar (abrir o seletor pela barra e minimizar em seguida), o estado fica `choosing` até a próxima transição de `expanded`. Sem perda de dado e sem envio; o cartão aparece ao reabrir.
- **Aviso herdado do 08-01:** não distribuir build da Taqciti antes de fechar o 08-22 (sem `created` ninguém vincula).
- **Lembrete obrigatório (decisão B2):** `GEMINI_API_KEY` AINDA NÃO existe no Railway — criar antes de qualquer deploy, merge na `master` ou junção com o AGM. Este plano não toca o backend.
- **B3 (`chunk_id`/reenvio), B4-b, B5, D-11:** não bloqueiam este plano.

## Known Stubs

Nenhum.

## Threat Flags

Nenhum novo. T-08-28: o painel só lê as chaves de `storage.local` (associação e entrega, sem transcrição nem segredo) e nenhum arquivo novo toca `storage.session` nem `setAccessLevel`; awk negativo = 0. T-08-29: nenhuma chamada direta à API (`fetch(` = 0), só `platform.send` com a resposta validada por `agenteCommandResultSchema`. T-08-SC: nenhum pacote novo.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Pronto: o 08-17 monta o fim da reunião e o `discard()` sobre `sendAgenteCommand`, `toEndPromptView` e `toBadgeState`; o 08-18 usa `useClientDirectory` na tela "Agente Diagnóstico"; o 08-22 precisa disparar `created`/`meeting-ended`/`meeting-resumed` para a bolha e a barra aparecerem de verdade.
- Pendente: human-check consolidado D-20 no fim da fase.

## Self-Check: PASSED

- Arquivos presentes: os 9 de `key-files.created` e os 3 de `key-files.modified`.
- Commits no histórico: `3fa39ec`, `4895b78`, `b06b754`; `git rev-list --count 8755e97..HEAD` = 3 no momento da escrita.
- Acceptance: `export function rejectionText` em `agenteStatus.ts`; `bindingView.ts` exporta as 5 funções; `useMeetingAssociation` expõe `open`/`defer`/`bind` (sem `discard`); `<AgenteNudgeAnchor` 2x e `<AgenteLiveSlot` 1x no `PanelApp`; `PanelApp` +25 linhas e 0 hooks novos; `AgenteLiveSlot.tsx` com 152 linhas (linha 201 inexistente).
- Verificação do plano: `cd taqciti && npm test && npm run typecheck && npm run lint && npm run build` verdes (67 arquivos, 953 testes).

---
*Phase: 08-taqciti-session-association*
*Completed: 2026-10-12*
