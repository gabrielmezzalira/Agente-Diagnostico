---
phase: 08-taqciti-session-association
plan: 28
subsystem: taqciti-extension
tags: [chrome-extension, google-meet, service-worker, content-script, vitest, gap-closure, cr-02]

requires:
  - phase: 08-taqciti-session-association
    provides: "isStillInMeetingRoom / onMeetingTabNavigated (DA-4, plano 08-24) e o formato /meet/<código> no content script (commit 861db11)"
provides:
  - "meetingCodeFromPath: regra única e pura de 'qual é a sala desta URL' (dois formatos, modo exato e com subcaminho)"
  - "Service worker que não encerra mais a reunião ao vivo quando a URL muda dentro da mesma sala em /meet/<código> (CR-02, SC5)"
  - "Content script e service worker decidindo a sala com a MESMA função (sem segunda regra de endereço)"
  - "CR-02 registrado como fixed no 08-REVIEW-DISPOSITION.md"
affects: [08-verify-work, 08-reverificacao-da-fase, TAQ-02]

plan_head_before: 538e0f9b7d4deda277cbd52e8d7903ac2f83467e
plan_head_after: 924807c2510a93a9802cf416f35b16586a19f4c2

actuals:
  tokens: 4600
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - "Gramática de endereço definida uma vez (3-4-3, prefixo meet/ opcional) e derivada em dois modos de ancoragem"
    - "Teste de fluxo com a máquina real (transition) em arquivo separado, sem fixture copiado"

key-files:
  created:
    - taqciti/src/features/meeting/meetingCode.ts
    - taqciti/src/features/meeting/meetingCode.test.ts
    - taqciti/src/background/meetingTabNavigatedFlow.test.ts
  modified:
    - taqciti/src/background/meetingTabNavigated.ts
    - taqciti/src/background/meetingTabNavigated.test.ts
    - taqciti/src/content/providers/googleMeet/GoogleMeetProvider.ts
    - taqciti/src/content/providers/googleMeet/selectors.ts
    - .planning/phases/08-taqciti-session-association/08-REVIEW-DISPOSITION.md

key-decisions:
  - "Service worker usa o modo allowSubpath (tolerante a /<código>/algo, erra para o lado de não encerrar); content script usa o modo exato (erra para o lado de não ver reunião onde não há) — mesma gramática, uma função só"
  - "Correção (service worker) e refator (content script) em commits separados, como exige o CLAUDE.md"
  - "DA-4 e DA-5 NÃO foram tocadas: sair de verdade da sala continua encerrando"

patterns-established:
  - "Uma regra só para 'qual é a sala desta URL': qualquer lado que precise do código da sala importa meetingCodeFromPath"

requirements-completed: [TAQ-02]

coverage:
  - id: D1
    description: "Reunião ao vivo em meet.google.com/meet/<código> não é encerrada por mudança de URL dentro da mesma sala (?authuser=1, #hash, maiúsculas, troca de formato), inclusive em chamadas repetidas e simultâneas"
    requirement: "TAQ-02"
    verification:
      - kind: unit
        ref: "taqciti/src/background/meetingTabNavigated.test.ts#endereço /meet/<código> no meio da call (CR-02)"
        status: pass
      - kind: integration
        ref: "taqciti/src/background/meetingTabNavigatedFlow.test.ts#fluxo com a máquina real: troca de URL no meio da call"
        status: pass
    human_judgment: false
  - id: D2
    description: "DA-4 preservado: sair de verdade da sala (outro site, outra sala nos dois formatos, /landing, /meet/ sem código, host parecido) continua encerrando a reunião, uma vez só mesmo repetido ou em paralelo"
    requirement: "TAQ-02"
    verification:
      - kind: unit
        ref: "taqciti/src/background/meetingTabNavigated.test.ts#isStillInMeetingRoom (saiu da sala) e DA-4 no formato novo"
        status: pass
      - kind: integration
        ref: "taqciti/src/background/meetingTabNavigatedFlow.test.ts#sair de verdade encerra com endedAt do relógio; duas saídas simultâneas"
        status: pass
    human_judgment: false
  - id: D3
    description: "Regra única meetingCodeFromPath usada pelo content script e pelo service worker; detecção do content script com o mesmo resultado de antes (GoogleMeetProvider.test.ts intocado, 15 testes)"
    requirement: "TAQ-02"
    verification:
      - kind: unit
        ref: "taqciti/src/features/meeting/meetingCode.test.ts (32 testes, tabela dos dois modos)"
        status: pass
      - kind: unit
        ref: "taqciti/src/content/providers/googleMeet/GoogleMeetProvider.test.ts (15 testes, intocado)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Comportamento real no Meet com a build nova: painel da Taqciti segue 'ao vivo' e a sessão do Agente segue ativa depois de mudar a URL na call; sair de verdade ainda encerra"
    requirement: "TAQ-02"
    verification: []
    human_judgment: true
    rationale: "Depende do Meet real, da extensão carregada no Chrome e do backend; é o roteiro manual (seção 7 do plano) do /gsd-verify-work 08"

duration: 5min
completed: 2026-10-27
status: complete
---

# Phase 8 Plan 28: CR-02 — regra única da sala Summary

**`meetingCodeFromPath` como regra única de "qual é a sala desta URL" (formatos `/<código>` e `/meet/<código>`), fazendo o service worker parar de encerrar reuniões ao vivo a cada mudança de URL na mesma sala, sem tocar a DA-4**

## Performance

- **Duration:** 5 min
- **Started:** 2026-10-26T23:54:49Z
- **Completed:** 2026-10-27T00:00:07Z (código e docs; o SUMMARY e o STATE vêm logo depois)
- **Tasks:** 3
- **Files modified:** 8 (3 criados, 5 alterados; mais o registro de achados)

## Accomplishments

- Criado o módulo puro `meetingCodeFromPath` (34 linhas) com dois modos da mesma gramática: exato (content script) e com subcaminho (service worker).
- `isStillInMeetingRoom` agora reconhece `/meet/<código>`; mudar `?query`, `#hash`, a caixa ou o formato dentro da mesma sala não dispara mais `MEETING_FINISHED`. O corpo de `onMeetingTabNavigated`, a interface e `MEET_HOST` ficaram caractere por caractere iguais (gate de diff).
- O content script passou a usar a mesma função (refator em commit separado) e o `selectors.ts` perdeu a expressão de endereço própria: sobra uma regra só.
- Idempotência e concorrência provadas em teste: repetir a mesma URL ou notificar em paralelo na mesma sala não dispara nada; saída de verdade repetida/paralela deixa a reunião `ended` uma vez só, com o `endedAt` da primeira.
- CR-02 registrado como `fixed` em `08-REVIEW-DISPOSITION.md` (`open: 21`).

## Vermelho antes da correção (TDD)

Com os testes novos escritos e o código ainda antigo: `npx vitest run src/background/meetingTabNavigated.test.ts src/background/meetingTabNavigatedFlow.test.ts` deu `Test Files 2 failed (2)` / `Tests 13 failed | 28 passed (41)`. Os 13 vermelhos foram: 4 casos de `isStillInMeetingRoom` com `/meet/<código>` (`expected false to be true`), 7 casos do handler no `describe` do CR-02 (`expected "spy" to not be called at all`) e 2 do fluxo com a máquina real (`expected 'ended' to be 'recording'` e o caso simultâneo na mesma sala). Os casos de DA-4 já passavam (comportamento preservado). `meetingCode.test.ts` ficou vermelho só por falta do módulo (`Failed to resolve import "./meetingCode"`), então a prova de vermelho real é a dos dois arquivos acima. Depois da correção: 73 testes verdes nos 3 arquivos.

## Task Commits

1. **Task 1 (tracer): regra única + service worker reconhece /meet/<código>** — `ed6b961` (fix)
2. **Task 2: content script usa a mesma meetingCodeFromPath** — `2b40de1` (refactor)
3. **Task 3: portão completo + CR-02 registrado como corrigido** — `924807c` (docs)

**Plan metadata:** commit `docs(08-28): complete ...` (SUMMARY, STATE, ROADMAP)

## Gates mecânicos (todos exit 0)

- Task 1, logo após o commit: lista exata de 5 arquivos; trecho de 20 linhas (interface + `MEET_HOST` + corpo de `onMeetingTabNavigated`) idêntico ao commit anterior; `meetingTabNavigated.test.ts` com `60 0` no `--numstat` (0 linhas removidas).
- Task 2, logo após o commit: lista exata de 2 arquivos; `selectors.ts` com `0 8` no `--numstat` (só remoções); `MEETING_CODE_PATTERN` sem nenhuma referência de código em `taqciti/src`.
- Task 3: âncora (só os 7 arquivos do plano mudaram em `taqciti/` desde `aa924ff`); commit só com o registro de achados e `3 3` no `--numstat`.
- `taqciti/package.json` e `package-lock.json` sem diff; `.planning/config.json` fora de todos os commits.

## Portão completo da Taqciti

`cd taqciti && npm test && npm run typecheck && npm run lint && npm run build`: tudo exit 0.

- Vitest: **Test Files 89 passed (89)**, **Tests 1393 passed (1393)**.
- Conta do plano: 1340 + (37 − 20) + 32 + 4 = **1393** (bate exatamente). Linhas: `meetingTabNavigated.test.ts` 37, `meetingCode.test.ts` 32, `meetingTabNavigatedFlow.test.ts` 4; `GoogleMeetProvider.test.ts` segue com 15.
- Regressão vizinha (7 arquivos): 139 testes verdes.
- Build gerou `taqciti/dist` (ignorado pelo git), pronto para o ↻ em `chrome://extensions` no teste manual.

## Files Created/Modified

- `taqciti/src/features/meeting/meetingCode.ts` — `meetingCodeFromPath(pathname, options?)`, regra única e pura.
- `taqciti/src/features/meeting/meetingCode.test.ts` — tabela dos formatos nos dois modos e chamada repetida sem estado escondido.
- `taqciti/src/background/meetingTabNavigated.ts` — `isStillInMeetingRoom` sobre a regra única (modo com subcaminho) + cabeçalho citando o CR-02.
- `taqciti/src/background/meetingTabNavigated.test.ts` — só linhas acrescentadas (casos `/meet/<código>`, repetidos, simultâneos, DA-4 no formato novo).
- `taqciti/src/background/meetingTabNavigatedFlow.test.ts` — fluxo com a máquina real.
- `taqciti/src/content/providers/googleMeet/GoogleMeetProvider.ts` — `detectMeeting` sobre a regra única.
- `taqciti/src/content/providers/googleMeet/selectors.ts` — sai a expressão de endereço própria.
- `.planning/phases/08-taqciti-session-association/08-REVIEW-DISPOSITION.md` — CR-02 `fixed`.

## Decisions Made

- Modos diferentes por lado, mesma gramática: service worker tolerante a subcaminho (não encerra por engano), content script exato (não vê reunião onde não há) — comportamento idêntico ao de antes nos dois lados.
- Três commits atômicos (correção, refator, docs), cada um revertível sozinho; reverter o 2 antes do 1 se precisar desfazer os dois.
- DA-4 (navegar para fora encerra) e DA-5 continuam em aberto, não decididas aqui.

## Deviations from Plan

None - plan executed exactly as written.

Observação sem desvio: o vermelho do `meetingCode.test.ts` foi "módulo inexistente" (import não resolvido), não falha de asserção; o vermelho de asserção veio dos dois arquivos de teste do service worker, como o plano pede (Passo 1).

## Issues Encountered

None.

## Known Stubs

None.

## Threat Flags

None — nenhuma superfície nova de rede, autenticação, arquivo ou esquema. T-08-57 a T-08-60 mitigadas como planejado (host por igualdade estrita mantida, expressões sem flags `g`/`y`, refator em commit separado); T-08-SC: nenhum pacote instalado.

## User Setup Required

None - no external service configuration required.

Lembretes obrigatórios (fora deste plano): `GEMINI_API_KEY` ainda NÃO existe no Railway e precisa ser criada antes de qualquer deploy, merge na `main`/`master` ou junção com o AGM; `EXTENSION_SHARED_KEY` também precisa estar ativa antes de expor as rotas (WR-01/T-08-10).

## Next Phase Readiness

- Falta o teste manual no Meet real (roteiro da seção 7 do plano, passos 1 a 8) dentro do `/gsd-verify-work 08`, e a re-verificação da fase para fechar o SC5. Só então o TAQ-02 vira concluído em `REQUIREMENTS.md`.
- Depois de rodar o roteiro: `cd taqciti && npm run build` (já feito aqui) e clicar no ↻ da Taqciti em `chrome://extensions`. Dados de teste vão para o Supabase de produção: anotar o id da sessão na lista de limpeza do `08-UAT.md`.
- Rollback, se preciso: `git revert 924807c` (docs), `git revert 2b40de1` (refator) e por último `git revert ed6b961` (correção).

## Self-Check: PASSED

- Arquivos criados existem: `meetingCode.ts`, `meetingCode.test.ts`, `meetingTabNavigatedFlow.test.ts` (FOUND).
- Commits `ed6b961`, `2b40de1`, `924807c` são ancestrais de HEAD (FOUND).
- `commits: 3` medido por `git rev-list --count 538e0f9..HEAD`.

---
*Phase: 08-taqciti-session-association*
*Completed: 2026-10-27*
