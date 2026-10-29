---
phase: 10-agp-question-panel-in-taqciti
plan: 01
subsystem: taqciti-background (vínculo reunião -> sessão do Agente)
tags: [typescript, vitest, chrome-extension, service-worker, injeção-de-dependência, taqciti]

# Dependency graph
requires:
  - phase: 08-seletor-de-cliente-por-reuniao
    provides: agenteSessionFinisher.isClosing (agendador do encerramento B4-b), "Continuar envio" (resumeSend/prepareResume) e o reducer de associação com finishBy/finishTries/finishGaveUp
provides:
  - "Guarda isClosing em prepareResume: 'Continuar envio' com o encerramento da sessão em voo é recusado em silêncio (invalid-state, D-18) antes de apagar as marcas de encerramento (WR-05, D-02)"
  - "Porta opcional isClosing em ResumeDeps e BindFlowDeps, com padrão neutro (ausente = não recusa)"
  - "Ligação de produção isClosing -> agenteSessionFinisher.isClosing na composição agenteAssociation.ts"
  - "agenteBindResume.test.ts: teste pela composição real que falha sem a correção + 4 casos de borda da regra"
affects: [10-10 (UAT teste 8 do WR-05), fase 10 em geral (critério 4 do ROADMAP: não atrapalhar captura/envio das Fases 7-8)]

# Actuals (#2632) — chars/4 sobre o diff realizado em taqciti/ (linhas adicionadas)
actuals:
  tokens: 2746
  tasks: 2
  commits: 2

# Measured commit ledger (#3968)
commits: 2
plan_head_before: b2ecc83af22948864127f976cb9f1c0054db6b27
plan_head_after: 94257b4cc3bb86155e97c1084b1f128fd82af578

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Porta opcional com padrão neutro (deps.isClosing?.(id) === true) para não quebrar fixtures existentes (mesmo precedente de agenteFreshStart.isClosing)"
    - "Ligação de produção por lambda (meetingId) => agenteSessionFinisher.isClosing(meetingId), resolvida em tempo de chamada, para vi.spyOn e configureAgenteSessionFinisher valerem"
    - "Teste de composição real: configureAgenteAssociation com portas falsas SEM injetar a porta nova, provando a ligação de produção"

key-files:
  created:
    - taqciti/src/background/agenteBindResume.test.ts
  modified:
    - taqciti/src/background/agenteBindResume.ts
    - taqciti/src/background/agenteBindFlow.ts
    - taqciti/src/background/agenteAssociation.ts

key-decisions:
  - "A checagem de isClosing fica logo depois da guarda de estado de prepareResume e ANTES de getRecord/loadConfig/send-resumed: o evento send-resumed apaga finishBy/finishTries/finishGaveUp, então a recusa tem que vir antes dele"
  - "A porta isClosing é opcional (padrão neutro) em ResumeDeps e BindFlowDeps, para os fixtures de agenteBindFlow.test.ts continuarem sem edição"
  - "Nenhuma recusa nova por sessionFinished: a DA-2 (retomar com a sessão já encerrada) continua valendo e é travada por teste"
  - "Janela residual entre a checagem e a gravação do send-resumed aceita (T-10-02): herdada do desenho assíncrono, pior caso = comportamento de antes"

patterns-established:
  - "Recusa silenciosa (D-18): invalid-state sem texto novo de UI; AgenteEndSlot.tsx e useMeetingAssociation não mudam"
  - "Teste de regra de ordem provado por mutação: mover a guarda para depois do send-resumed derruba o teste que confere finishBy/finishTries intactos"

requirements-completed: [TAQ-05]

# Coverage metadata (#1602)
coverage:
  - id: D1
    description: "Com o encerramento da sessão em voo, agenteAssociation.resumeSend devolve { ok: false, error: 'invalid-state' }, não envia nada e a associação segue send-failed com finishBy e finishTries intactos (a guarda vem antes do send-resumed)"
    requirement: "TAQ-05"
    verification:
      - kind: integration
        ref: "taqciti/src/background/agenteBindResume.test.ts#com o encerramento em voo: recusa invalid-state, não envia e mantém finishBy e finishTries"
        status: pass
      - kind: unit
        ref: "taqciti/src/background/agenteBindResume.test.ts#isClosing true: recusa invalid-state antes de ler registro e config, com o prazo de encerramento intacto"
        status: pass
    human_judgment: false
  - id: D2
    description: "Fora da janela de encerramento (isClosing false ou porta ausente) o 'Continuar envio' segue igual a hoje, inclusive com sessionFinished true (DA-2); a ordem das recusas existentes (not-found) não muda"
    requirement: "TAQ-05"
    verification:
      - kind: unit
        ref: "taqciti/src/background/agenteBindResume.test.ts#porta ausente (padrão neutro): devolve o plano e a associação vai para sending sem finishBy nem finishTries"
        status: pass
      - kind: unit
        ref: "taqciti/src/background/agenteBindResume.test.ts#DA-2: isClosing false com a sessão já encerrada (sessionFinished): a retomada continua permitida"
        status: pass
      - kind: integration
        ref: "cd taqciti && npx vitest run src/background/agenteBindFlow.test.ts src/background/agenteAssociationService.test.ts src/features/agente/association.test.ts (139 testes, sem edição)"
        status: pass
    human_judgment: false
  - id: D3
    description: "A composição de produção liga isClosing a agenteSessionFinisher.isClosing, perguntando pela reunião certa"
    requirement: "TAQ-05"
    verification:
      - kind: integration
        ref: "taqciti/src/background/agenteBindResume.test.ts#confere o encerramento da reunião certa (isClosing recebe m2)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Comportamento real no navegador: clicar 'Continuar envio' enquanto o POST /finish está em voo não reenvia partes para a sessão fechada"
    requirement: "TAQ-05"
    verification: []
    human_judgment: true
    rationale: "Os testes espionam agenteSessionFinisher.isClosing; a corrida real com o service worker e o backend só é exercitada à mão no teste 8 do 10-UAT.md (plano 10-10)"

# Metrics
duration: 16min
completed: 2026-10-29
status: complete
---

# Phase 10 Plan 01: WR-05 — "Continuar envio" não apaga o prazo de encerramento Summary

**Guarda `isClosing` em `prepareResume` (porta opcional ligada a `agenteSessionFinisher.isClosing` na composição) que recusa o "Continuar envio" em silêncio enquanto o `POST /finish` está em voo, antes de `send-resumed` apagar `finishBy`/`finishTries`/`finishGaveUp`.**

## Performance

- **Duration:** 16 min (início aproximado: o horário de início não foi gravado no começo; estimado pelo primeiro vitest da sessão)
- **Started:** 2026-10-29T20:27:00Z (aprox.)
- **Completed:** 2026-10-29T20:43:00Z (aprox.)
- **Tasks:** 2
- **Files modified:** 4 (3 de produção, 1 teste novo)

## Accomplishments

- **Correção do WR-05 (D-02):** com um encerramento da sessão em voo, `agenteAssociation.resumeSend(meetingId)` devolve `{ ok: false, error: 'invalid-state' }`, não chama `send` e a associação continua `send-failed` com `finishBy` e `finishTries` intactos. A guarda vem antes de `getRecord`, `loadConfig` e do evento `send-resumed`.
- **Recusa silenciosa (D-18):** nenhum texto novo de UI; `AgenteEndSlot.tsx` e `useMeetingAssociation` não mudaram. Passado o fechamento, o botão volta a funcionar como antes.
- **Caminho normal e DA-2 preservados:** com `isClosing` falso ou a porta ausente nada muda, inclusive com `sessionFinished === true`. Os 139 testes existentes de vínculo passam sem nenhuma edição (`git diff --quiet eb3bf01` sai 0).
- **Cinco casos de borda travados por teste**, e a regra de ordem provada por mutação (ver "Notas de TDD").

## Task Commits

1. **Task 1 (tracer): "Continuar envio" durante o encerramento é recusado em silêncio** - `6c49e9b` (fix)
2. **Task 2: casos de borda da regra prepareResume (porta ausente, false, DA-2, ordem)** - `94257b4` (test)

**Plan metadata:** commit docs(10-01) logo após este SUMMARY (STATE/ROADMAP/REQUIREMENTS).

## Files Created/Modified

- `taqciti/src/background/agenteBindResume.ts` - `ResumeDeps.isClosing?` e a guarda `deps.isClosing?.(meetingId) === true` antes do `send-resumed` (81 linhas)
- `taqciti/src/background/agenteBindFlow.ts` - mesma porta opcional em `BindFlowDeps` (o `resumeSend` já repassava `deps`)
- `taqciti/src/background/agenteAssociation.ts` - `activeDeps.isClosing` ligado a `agenteSessionFinisher.isClosing` (sem import novo, sem ciclo novo)
- `taqciti/src/background/agenteBindResume.test.ts` - novo, 7 testes: 3 pela composição real (um deles é o controle) + 4 casos de borda de `prepareResume`

## Decisions Made

- Porta opcional com padrão neutro em vez de obrigatória: os fixtures de `agenteBindFlow.test.ts` montam `createBindFlow` sem ela e continuam sem edição.
- A ligação de produção é uma lambda (`(meetingId) => agenteSessionFinisher.isClosing(meetingId)`), não a referência direta: assim `vi.spyOn` e `configureAgenteSessionFinisher` valem em tempo de chamada.
- O comentário da guarda não cita `sessionFinished` pelo nome, porque o critério de aceitação exige a mesma contagem de `sessionFinished` do commit `eb3bf01` (0) em `agenteBindResume.ts`.
- Janela residual entre a checagem e a gravação do `send-resumed` (T-10-02) aceita e registrada, como previsto no plano (RESEARCH Armadilha 4).

## Deviations from Plan

None - plan executed exactly as written.

Notas de processo (não são desvios de regra, mas valem registro):

- **RED da Task 1 observado, mas não commitado à parte.** O despacho pediu "RED commit before implementation"; o plano define para a Task 1 um commit único `fix(10-01)` e um rollback por `git revert` desse commit, que um commit de teste separado quebraria (o revert deixaria o teste falhando). Segui o plano e capturei o RED localmente antes de implementar: com o código sem a correção, 2 testes falharam e 1 (o controle) passou.
  - `expected { ok: true } to deeply equal { ok: false, error: 'invalid-state' }`
  - `expected "isClosing" to be called with arguments: [ 'm2' ]` / `Number of calls: 0`
  - Avaliação semântica: os testes-alvo executaram e falharam exatamente nas asserções planejadas (não por erro de sintaxe, fixture ou import); o controle passou.
- **Task 2 (`tdd="true"`) passou verde de primeira por construção:** a implementação já tinha entrado na Task 1, então estes casos travam fronteiras de uma regra existente. Para provar que eles detectam regressão, apliquei quatro mutações temporárias em `agenteBindResume.ts` (restaurado depois com `git checkout -- <arquivo>`, idêntico ao HEAD):

  | Mutação | Testes que falharam |
  |---------|---------------------|
  | M1: guarda removida | os 2 de composição de recusa + "isClosing true: recusa ... prazo intacto" |
  | M2: guarda movida para depois do `send-resumed` | composição "recusa ... mantém finishBy" + "isClosing true: ..." |
  | M3: recusa também por `sessionFinished` | "DA-2: ... retomada continua permitida" |
  | M4: guarda antes da checagem `not-found` | "associação inexistente: not-found mesmo com isClosing true" |

## Issues Encountered

None. Um aviso de lint (`import()` type annotation) no arquivo de teste novo foi corrigido antes do commit da Task 1; `npx eslint src` fecha limpo.

## Verification (plano)

- `npx vitest run src/background/agenteBindResume.test.ts src/background/agenteBindFlow.test.ts src/background/agenteAssociationService.test.ts src/features/agente/association.test.ts` -> 4 arquivos, 146 testes verdes.
- `npx tsc --noEmit` -> exit 0. `npx eslint src` -> exit 0, sem avisos.
- `git diff --quiet eb3bf01 -- <3 testes existentes>` -> exit 0 (nenhum teste antigo editado).
- `grep -c "agenteSessionFinisher.isClosing" agenteAssociation.ts` -> 1 (linha de base era 0).
- `grep -n` em `agenteBindResume.ts`: guarda na linha 59, `send-resumed` na linha 69 (guarda antes). `sessionFinished`: 0 ocorrências, igual a `eb3bf01`.
- Portão do tracer (modo interativo, `end-of-phase`, `<verify>` só com `<automated>`): `<verify>` reexecutado de ponta a ponta com sucesso, tracer verificado, expansão liberada sem checkpoint.

## Threat Model

- **T-10-01 (Tampering, marcas `finishBy`/`finishTries`):** mitigado — guarda antes do `send-resumed` + teste pela composição real que falha sem a correção.
- **T-10-02 (janela entre a checagem e a gravação):** aceito — janela de milissegundos herdada do desenho assíncrono; pior caso é o comportamento de antes.

## Known Stubs

None.

## Threat Flags

None — sem superfície nova de rede, autenticação ou arquivo; só uma guarda de memória.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Pronto para o próximo plano da Fase 10. O teste manual do WR-05 (teste 8 do `10-UAT.md`) será escrito no plano 10-10 e cobre o item D4 do bloco `coverage` (corrida real com o backend).
- Sem bloqueios. Fora do escopo e NÃO decidido aqui: recusar por `sessionFinished` (sugestão do 10-REVIEW.md que contradiz a DA-2).

## Self-Check: PASSED

- Arquivos: `agenteBindResume.ts`, `agenteBindFlow.ts`, `agenteAssociation.ts` e `agenteBindResume.test.ts` existem em disco.
- Commits `6c49e9b` e `94257b4` são ancestrais do HEAD; `check evaluation-scope --plan 10-01 --commits-only` devolveu os 2 commits.
- Todos os `<acceptance_criteria>` das duas tasks reexecutados e passando.

---
*Phase: 10-agp-question-panel-in-taqciti*
*Completed: 2026-10-29*
