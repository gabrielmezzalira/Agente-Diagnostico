---
phase: 08-taqciti-session-association
plan: 01
subsystem: taqciti-streaming
tags: [taqciti, chrome-extension, service-worker, typescript, vitest, state-machine, chrome-storage]

requires:
  - phase: 07-taqciti-live-streaming
    provides: "streamer ao vivo (janela por fala, fila serializada, vínculo CR-01 em taq:agenteBinding) e o helper installChromeStorageMock"
provides:
  - "MeetingAssociation + reduceAssociation: vínculo reunião -> sessão do Agente, com reducer puro e completo (fim, retomada e conclusão definidos para cada estado)"
  - "agenteAssociationStore: store de escritor único (fila serializada, valor inteiro, lista branca de campos) da chave taq:agenteAssociations + subscribeAssociations para a UI"
  - "StreamDestinationPolicy: configDestination (Fase 7) e createAssociationDestination (Fase 8) — só 'linked' envia, sempre para association.sessionId"
  - "reevaluateAgenteStreamer(): um passo do streamer com o último estado visto, para chamar logo depois de link-completed"
  - "createBindingRecorder: memória do vínculo CR-01 extraída do instance (commit mecânico)"
affects: [08-02, 08-10, 08-14, 08-18, 08-22, 08-23]

actuals:
  tokens: 15700
  tasks: 2
  commits: 4

plan_head_before: b11504df6dfc375dc129dd85d509e038c135e5af
plan_head_after: f08d486944dfa86d92fcbf0c4d5df420a637d630

tech-stack:
  added: []
  patterns:
    - "Política de destino injetável (StreamDestinationPolicy) separada da mecânica de janela/fila do streamer"
    - "Reducer puro que devolve a MESMA referência em transição ilegal; o store só grava quando a referência muda"
    - "Store de escritor único: fila serializada + valor inteiro + cache atualizado na mesma operação que grava"
    - "Semente do vínculo (seedSent) adotada como cursor inicial; {} é semente válida (nada enviado ainda)"

key-files:
  created:
    - taqciti/src/background/agenteStreamerBindingRecorder.ts
    - taqciti/src/background/agenteStreamDestination.ts
    - taqciti/src/background/agenteStreamerAssociation.test.ts
    - taqciti/src/features/agente/association.ts
    - taqciti/src/features/agente/associationSend.ts
    - taqciti/src/features/agente/association.test.ts
    - taqciti/src/shared/config/agenteAssociationStore.ts
    - taqciti/src/shared/config/agenteAssociationStore.test.ts
  modified:
    - taqciti/src/background/agenteStreamerInstance.ts
    - taqciti/src/background/agenteStreamer.ts
    - taqciti/src/background/agenteStreamerDeps.ts
    - taqciti/src/background/agenteStreamer.test.ts
    - taqciti/src/shared/config/constants.ts
    - taqciti/src/shared/config/agenteConfig.ts

key-decisions:
  - "O destino da fala em produção é só a associação 'linked' da reunião (D-01/D-04); o config.agenteSessionId global deixa de ser destino e configDestination fica como política explícita, usada hoje só pelos testes de mecânica da Fase 7"
  - "createAssociationDestination.usesMeetingBinding = false: o CR-01 (taq:agenteBinding) não é consultado nem regravado para destinos de associação"
  - "idle (reunião sem vínculo) só zera o cursor da reunião atual e não descarta falas já endereçadas; só disabled (toggle desligado / URL inválida) descarta tudo (D-09 da Fase 7 preservado)"
  - "Semente {} é válida ('nada enviado ainda, mande tudo'); só null significa 'sem semente' e cai no prime da Fase 7"
  - "Retomada da mesma sala: ended-unsent -> pending; sending -> linking; sent -> linked (só com sessionId, mantendo a semente); send-failed e linking ficam como estão"

patterns-established:
  - "Mudança de comportamento do streamer entra por política injetada em deps.destination, nunca por if dentro da mecânica"
  - "Teste ponta a ponta do tracer monta o streamer como em produção (sem sobrescrever destination) e prova o fetch"

requirements-completed: [TAQ-02]

coverage:
  - id: D1
    description: "Na composição de produção nenhuma fala sai se a reunião não tiver associação linked (mesmo com agenteSessionId salvo na config); linked manda sempre para association.sessionId, qualquer que seja a origem (picker ou manual-id)"
    requirement: TAQ-02
    verification:
      - kind: integration
        ref: "taqciti/src/background/agenteStreamerAssociation.test.ts#sem associação linked nada sai (SC3, D-01, D-04)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Vínculo em andamento (linking) segura o envio sem perder o cursor; a semente (inclusive {}) evita perda e duplicata, é consumida depois de adotada, e reevaluateAgenteStreamer manda uma vez o que veio depois da semente quando a reunião acabou durante o vínculo"
    requirement: TAQ-02
    verification:
      - kind: integration
        ref: "taqciti/src/background/agenteStreamerAssociation.test.ts#vínculo em andamento e semente (linking -> linked)"
        status: pass
    human_judgment: false
  - id: D3
    description: "idle não cancela falas já endereçadas da reunião anterior; disabled descarta tudo (D-09); o CR-01 da Fase 7 não bloqueia nem é regravado para uma associação manual-id"
    requirement: TAQ-02
    verification:
      - kind: integration
        ref: "taqciti/src/background/agenteStreamerAssociation.test.ts#idle e disabled; o vínculo CR-01 da Fase 7 não manda em destino de associação"
        status: pass
    human_judgment: false
  - id: D4
    description: "Reducer completo da associação com fim da reunião, retomada da mesma sala e conclusão definidos para cada um dos 9 estados; transição ilegal devolve a mesma referência"
    requirement: TAQ-02
    verification:
      - kind: unit
        ref: "taqciti/src/features/agente/association.test.ts"
        status: pass
    human_judgment: false
  - id: D5
    description: "Store de associações: escritas concorrentes serializadas, lista branca sem segredo, semente {} preservada, remoção pontual e assinatura para a UI"
    requirement: TAQ-02
    verification:
      - kind: unit
        ref: "taqciti/src/shared/config/agenteAssociationStore.test.ts"
        status: pass
    human_judgment: false
  - id: D6
    description: "A mecânica de janela, retry e vínculo CR-01 da Fase 7 continua intacta (rodando com a política configDestination explícita)"
    verification:
      - kind: unit
        ref: "taqciti/src/background/agenteStreamer.test.ts"
        status: pass
    human_judgment: false

duration: ~20min
completed: 2026-10-12
status: complete
---

# Phase 8 Plan 01: Associação reunião → sessão decide o destino do streamer Summary

**O streamer da Taqciti agora só envia a fala de uma reunião quando ela tem associação `linked`, sempre para `association.sessionId`: política de destino injetável, store de escritor único em `taq:agenteAssociations`, reducer puro com todos os 9 estados e `reevaluateAgenteStreamer()` para fechar a borda do vínculo.**

## Performance

- **Duration:** ~20 min
- **Started:** 2026-10-12T02:36Z (aprox.)
- **Completed:** 2026-10-12T02:53:25Z
- **Tasks:** 2 (1 tracer em 3 commits atômicos + 1 expansão)
- **Files modified:** 14 (8 criados, 6 alterados; `package.json` e `package-lock.json` sem diff)

## Accomplishments

- **Tracer ponta a ponta no service worker:** dispatch real da máquina -> store de associação no storage simulado -> política de produção -> `fetch`. Prova "sem `linked` nada sai (mesmo com ID na config)", "`linked` manda para a sessão da associação" (picker e manual-id), "linking segura e a semente evita perda e duplicata", "semente `{}` manda tudo", "reevaluate depois do fim manda o resto uma vez", "CR-01 não bloqueia manual-id" e "idle não cancela a reunião anterior".
- **Reducer completo** (`association.ts` + `associationSend.ts`): os 9 estados do UI-SPEC, cada um com resultado definido para fim da reunião, retomada da mesma sala e conclusão do vínculo; a retomada só leva a `linked` quando a associação já tem `sessionId`.
- **Store** (`agenteAssociationStore.ts`): fila serializada (duas escritas simultâneas nunca se apagam), lista branca de campos (nenhum header ou chave entra), `seedSent: {}` preservado.
- **Arrumação de tamanho:** a memória do vínculo CR-01 saiu do instance para `agenteStreamerBindingRecorder.ts` (commit mecânico) e a política de destino virou `agenteStreamDestination.ts` (commit mecânico). Mecânica da Fase 7 intacta.
- **Gate do plano:** `npm test` (45 arquivos, 695 testes), `npm run typecheck` e `npm run lint` verdes.

## Task Commits

1. **Task 1 (tracer) — commit 0** (refactor mecânico): `c2897ab` — extrai a memória do vínculo CR-01 (`createBindingRecorder`); instance 288 -> 255 linhas
2. **Task 1 (tracer) — commit 1** (refactor mecânico): `2c93ce5` — extrai a política de destino (`StreamTarget`, `StreamDestinationPolicy`, `configDestination`)
3. **Task 1 (tracer) — commit 2** (comportamento): `4dfe299` — destino do streamer vem da associação da reunião
4. **Task 2:** `f08d486` — reducer completo da associação + testes do reducer e do store

**Plan metadata:** commit de docs ao final (SUMMARY + STATE + ROADMAP).

## Evidência TDD (RED -> GREEN)

- **Task 1 — RED:** `agenteStreamerAssociation.test.ts` contra a composição ainda sem a política de associação (com os passos 1-4 do commit 2 já presentes): 9 de 11 testes falharam em assertivas do comportamento planejado (ex.: `expected "spy" to not be called at all, but actually been called 1 times` em "sem associação nada sai"; `session_id` da config no lugar de `OTHER_SESSION_ID`). Os 2 que passaram no RED (JSON cru sem `s3cr3t`; toggle desligado descarta) são guardas de regressão do que já era verdade. `semanticAssessment`: o alvo executou e falhou na asserção planejada, não por import, sintaxe ou fixture. **GREEN:** 11/11 + `agenteStreamer.test.ts` 46/46.
- **Task 2 — RED:** `association.test.ts` + `agenteAssociationStore.test.ts` contra o reducer só com o caminho feliz: 22 falhas, todas em `toEqual`/`toBe` das transições novas (opened, deferred, meeting-ended, meeting-resumed, link-progress, link-failed, send-*) e na escrita concorrente do store. `semanticAssessment`: falha na asserção planejada. **GREEN:** 65/65 nos dois arquivos.
- **Commits:** o plano (§2 e §5) pede um único commit por Task (um `git revert` por task), então RED e GREEN não foram commitados separados; o RED foi executado e registrado acima, antes da implementação.

## Files Created/Modified

- `taqciti/src/features/agente/association.ts` — tipos `MeetingAssociation`/`AssociationState`/`AssociationEvent` e `reduceAssociation` (178 linhas)
- `taqciti/src/features/agente/associationSend.ts` — transições do envio de reunião já encerrada (`carryIdentity`, `reduceSendFlow`)
- `taqciti/src/shared/config/agenteAssociationStore.ts` — store de escritor único + `subscribeAssociations` (177 linhas)
- `taqciti/src/background/agenteStreamDestination.ts` — `StreamTarget`, `StreamDestinationPolicy`, `configDestination`, `createAssociationDestination`, `cursorFromSeed`
- `taqciti/src/background/agenteStreamerBindingRecorder.ts` — memória do vínculo CR-01 (extração mecânica)
- `taqciti/src/background/agenteStreamerInstance.ts` — consulta `deps.destination ?? configDestination`, `settleTarget`, `reevaluate()` (293 linhas)
- `taqciti/src/background/agenteStreamer.ts` — dependência de produção `destination` e export `reevaluateAgenteStreamer`
- `taqciti/src/background/agenteStreamerDeps.ts` — campo opcional `destination`
- `taqciti/src/shared/config/constants.ts` — `STORAGE_KEYS.agenteAssociations`
- `taqciti/src/shared/config/agenteConfig.ts` — `isValidAgenteBackendUrl` exportada (1 inserção, 1 remoção)
- Testes: `agenteStreamerAssociation.test.ts`, `association.test.ts`, `agenteAssociationStore.test.ts` (novos); `agenteStreamer.test.ts` (política explícita)

## Decisions Made

Ver `key-decisions` no frontmatter. Em resumo: o destino em produção é só a associação `linked`; `configDestination` ficou preservada e explícita; o CR-01 não vale para destinos de associação; `idle` não descarta falas já endereçadas; `{}` é semente válida.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Quatro pontos de "reinício do service worker" em `agenteStreamer.test.ts` também precisaram da política da Fase 7**
- **Found during:** Task 1, commit 2 (primeiro GREEN)
- **Issue:** o plano dizia que só a linha do `fresh()` mudava. Mas 4 testes de reinício fazem `vi.resetModules()` e reimportam `./agenteStreamer`, o que devolve a composição de produção (política de associação) sem passar pelo `fresh()`. Três deles ficaram vermelhos ("expected spy to be called 2 times, but got 1"; "waitingMeetingId: null").
- **Fix:** depois de cada `const restartedStreamer = await import('./agenteStreamer')`, a linha `restartedStreamer.configureAgenteStreamer({ destination: undefined })` reafirma a política da Fase 7 (mecânica sob teste). Nenhuma asserção mudou.
- **Files modified:** `taqciti/src/background/agenteStreamer.test.ts`
- **Verification:** `agenteStreamer.test.ts` 46/46 verde.
- **Committed in:** `4dfe299`

**2. [Rule 2 - Missing critical] A semente é consumida sempre que presente, não só quando adotada**
- **Found during:** Task 1, commit 2 (desenho do `settleTarget`)
- **Issue:** o plano consumia a semente só quando `cursorFromSeed` devolvia cursor. Se o cursor já fosse da mesma reunião e sessão, a semente ficava no storage e, num reinício que perdesse o cursor, seria adotada de novo e reenviaria palavras (duplicata em massa, o risco do §3).
- **Fix:** `settleTarget` consome a semente sempre que `seed !== null`; antes de consumir, persiste o cursor (`persister.persist`) para um reinício entre as duas gravações não perder palavras. Falha ao consumir só vai para o log e não trava o envio.
- **Files modified:** `taqciti/src/background/agenteStreamerInstance.ts`
- **Verification:** casos "linking segura..." e "semente vazia" provam que `seedSent` some do storage.
- **Committed in:** `4dfe299`

**3. [Contingência prevista no plano] `associationSend.ts` extra**
- **Found during:** Task 2
- **Issue:** com o reducer completo, `association.ts` chegou a 222 linhas (limite 200).
- **Fix:** as transições do envio de reunião encerrada e o helper `carryIdentity` foram para `associationSend.ts` (código novo no mesmo commit, como o plano manda); a API pública continua `reduceAssociation` em `association.ts`.
- **Files modified:** `taqciti/src/features/agente/association.ts`, `taqciti/src/features/agente/associationSend.ts`
- **Committed in:** `f08d486`

---

**Total deviations:** 3 (1 Rule 3, 1 Rule 2, 1 contingência prevista no plano)
**Impact on plan:** todos necessários para correção e para os limites de tamanho. Sem mudança de escopo.

## Issues Encountered

- `agenteStreamerInstance.ts` ficou com **293 linhas** (o plano esperava ~270). O limite de 300 foi respeitado, mas sobram só 7 linhas para o plano **08-23**, que também mexe nesse arquivo. Se o 08-23 precisar de mais, a saída é mover `settleTarget` (e a adoção da semente) para `agenteStreamDestination.ts` como função pura/auxiliar, num commit mecânico à parte.
- Aviso do git sobre LF/CRLF nos arquivos novos (config do Windows); sem efeito no conteúdo.

## Atenção para quem testa (comportamento visível)

Depois do commit `4dfe299`, **o ID de sessão colado na tela de configuração deixa de enviar sozinho**: sem associação `linked` nada sai. Até o seletor de cliente / plano B chegarem (planos **08-10** e **08-14**), ninguém consegue transmitir. **Não distribuir build da Taqciti entre este plano e o 08-14.** Reversível por `git revert 4dfe299` (o streamer volta a enviar pelo ID da config).

## Decisões em aberto (não bloqueiam este plano)

- **B5:** papel do ID salvo na tela de configuração e destino do cartão CR-01 — gate no plano 08-18; este plano não mexe na tela.
- Remoção da política `configDestination` e da lógica CR-01 (`agenteStreamerBindingRecorder.ts`, `confirmedMeetingId`, `taq:agenteBinding`) quando não forem mais necessárias: remoção de código é do time; aqui só foram preservadas.

## Known Stubs

Nenhum. Os eventos `meeting-ended`/`meeting-resumed` e o fluxo de vínculo ainda não têm quem os dispare — isso é escopo declarado dos planos 08-22 e 08-10, não stub (o reducer só decide transições).

## Threat Flags

Nenhum novo. A única superfície nova é a chave local `taq:agenteAssociations`, já coberta pelo threat model do plano (T-08-01 destino só por associação; T-08-02 lista branca + teste de `s3cr3t`; T-08-03 fila serializada; T-08-SC sem pacote novo).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Pronto: o fluxo de vínculo do **08-10** pode chamar `applyAssociationEvent(...)` e, logo depois de `link-completed`, `reevaluateAgenteStreamer()`; o **08-22** pode disparar `created`, `meeting-ended` e `meeting-resumed` pela máquina da reunião e recuperar no boot.
- Cuidado: folga de 7 linhas em `agenteStreamerInstance.ts` para o 08-23 (ver Issues Encountered).

## Self-Check: PASSED

- Arquivos criados presentes: `agenteStreamerBindingRecorder.ts`, `agenteStreamDestination.ts`, `agenteStreamerAssociation.test.ts`, `association.ts`, `associationSend.ts`, `association.test.ts`, `agenteAssociationStore.ts`, `agenteAssociationStore.test.ts`.
- Commits presentes no histórico: `c2897ab`, `2c93ce5`, `4dfe299`, `f08d486`.
- Acceptance: `destination: createAssociationDestination` aparece 1 vez em `agenteStreamer.ts`; nenhum arquivo novo passa de 200 linhas; instance com 293 linhas (<= 300); `agenteConfig.ts` com 1 inserção e 1 remoção; `package.json`/`package-lock.json` sem diff.
- Verificação do plano: `cd taqciti && npm test && npm run typecheck && npm run lint` verdes (45 arquivos, 695 testes).

---
*Phase: 08-taqciti-session-association*
*Completed: 2026-10-12*
