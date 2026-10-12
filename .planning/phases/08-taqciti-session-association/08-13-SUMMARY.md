---
phase: 08-taqciti-session-association
plan: 13
subsystem: taqciti-history-and-discard
status: complete
tags: [taqciti, chrome-extension, history, eviction, discard, vitest, session-association]

requires:
  - phase: 08-taqciti-session-association
    provides: "08-10: serviço de associação (open/defer/bind); 08-12: portas HTTP; 08-22: ciclo de vida da associação no index.ts; 08-01: store de associações (removeAssociations)"
provides:
  - "selectRecordsToKeep (eviction.ts, pura): evicção do histórico que nunca remove reunião não enviada (teto suave)"
  - "upsertRecord usa a evicção protegida e remove a associação das reuniões evictadas"
  - "Comando ui/agente/meeting/discard: só ended-unsent fora do ar; apaga o registro local e a associação, nada no backend (D-11)"
  - "ui/history/delete (Apagar) passa a limpar também a associação"
affects: [08-17, 08-20]

actuals:
  tokens: 14000
  tasks: 3
  commits: 2

plan_head_before: 63d845211eb5d51f2b2cdf6d4e66e9728185cfcc
plan_head_after: bae4a4fb8392ddf03faf6019f0a47b25ed4e1070

tech-stack:
  added: []
  patterns:
    - "Evicção como função pura injetada com um predicado isProtected; o repositório só liga a regra ao store de associações"
    - "Porta sem volta com a regra de estado checada no service worker (não na UI)"

key-files:
  created:
    - taqciti/src/features/history/eviction.ts
    - taqciti/src/background/history.test.ts
  modified:
    - taqciti/src/background/history.ts
    - taqciti/src/shared/types/agenteMessages.ts
    - taqciti/src/background/agenteAssociationService.ts
    - taqciti/src/background/agenteAssociation.ts
    - taqciti/src/background/index.ts
    - taqciti/src/background/agenteAssociationService.test.ts

key-decisions:
  - "D-11 = confirmar-d11 (2026-10-12): apagar de vez a cópia local de uma reunião encerrada e não enviada, após confirmação na UI"
  - "Política da evicção (Open Question 5, não bloqueante): 'nunca evictar não enviada, teto suave' adotada como suposição protetiva e reversível; aviso na UI de histórico cheio de não enviadas fica para o time"
  - "Se as associações não puderem ser lidas durante a gravação, a evicção protege TUDO (melhor passar do teto por um instante do que apagar às cegas)"

requirements-completed: []

coverage:
  - deliverable: "Evicção do histórico protege reuniões não enviadas e limpa a associação das removidas"
    verification:
      - kind: test
        ref: "taqciti/src/background/history.test.ts"
        status: pass
    human_judgment: false
  - deliverable: "Comando de descarte validado por estado (só ended-unsent fora do ar), local, com zod no meetingId"
    verification:
      - kind: test
        ref: "taqciti/src/background/agenteAssociationService.test.ts#discard"
        status: pass
    human_judgment: false
  - deliverable: "Apagar (ui/history/delete) remove também a associação"
    verification: []
    human_judgment: true
    rationale: "index.ts não tem harness de teste (sem teste de roteamento no repositório); coberto por grep + typecheck e pelo teste manual D-20(c)"
---

# Phase 8 Plan 13: Evicção protegida e descarte local (D-11) Summary

**A Taqciti deixa de jogar fora em silêncio a reunião mais antiga quando ela ainda não foi enviada, e ganha o "Descartar" no service worker: validado por estado, só local, depois de confirmada a porta sem volta.**

## Task 2 — checkpoint:decision D-11 (resposta do time, registrada antes da Task 3)

- **Resposta:** `confirmar-d11` (2026-10-12). Palavras do usuário: "pode confirmar d11".
- A lixeira local fica como evolução futura (custo baixo a médio, contido atrás de `deleteRecord`; descartes feitos antes dela já estariam perdidos).

## Accomplishments

- **Task 1 (`007bc90`)** — `features/history/eviction.ts` exporta `UNSENT_STATES` (os 7 estados não enviados) e `selectRecordsToKeep`. `history.ts::upsertRecord` troca o `slice(0, MAX_HISTORY_RECORDS)` por ela e, se houver evictados, chama `removeAssociations` (falha só vai para o log). Primeiro teste do `history.ts`: 8 testes (100+1 sem proteção, mais antigo protegido sobrevive, tudo protegido = teto suave, ordem preservada, 7 estados, associação das evictadas some, sem associação é evictável).
- **Task 3 (`bae4a4f`)** — schema `ui/agente/meeting/discard` (zod no `meetingId`); `discard` no serviço: `not-found` sem associação, `invalid-state` fora de `ended-unsent` ou com a reunião ao vivo, senão `resetEndedMeeting` (se for a sessão em `ended`) -> `deleteRecord` -> `removeAssociation`. `agenteAssociation.ts` liga `deleteRecord` e `resetEndedMeeting` (despacha `RESET`). `index.ts`: case do descarte (1 linha) e `ui/history/delete` com `removeAssociation`.

## Verificação (saídas)

- `npx vitest run src/background/history.test.ts`: 8 passed.
- `npx vitest run src/background/agenteAssociationService.test.ts`: 23 passed (11 antigos + 12 novos: schema, ended-unsent, reset antes de apagar, linked/sent/sending/send-failed, 3 fases ao vivo, ended-unsent ao vivo, not-found).
- Portão do plano: `npm test` = 70 arquivos, 1003 testes passando; `npm run typecheck` e `npm run lint` sem erros.
- Greps: `slice(0, MAX_HISTORY_RECORDS)` fora de comentário = 0; `case 'ui/agente/meeting/discard'` em `index.ts` = 1.
- Acceptance criteria das Tasks 1 e 3: todos PASS.

## Deviations from Plan

None - plan executed exactly as written, com duas observações:

- `index.ts` não tem teste (não existe harness de roteamento de mensagens); a limpeza da associação no "Apagar" foi verificada por grep/typecheck e fica para o teste manual D-20(c). Registrado como `human_judgment` no bloco `coverage`.
- `agenteAssociationService.test.ts` passou de 180 para ~295 linhas (arquivo de teste; o plano manda estender o existente). A regra "ao vivo" foi duplicada em `agenteAssociationService.ts` (constante `LIVE_PHASES`) em vez de exportar `isLive` de `agenteBindFlow.ts`, que não está na lista de arquivos do plano.

## Known Stubs

None.

## Pendências / lembretes

- Fora deste plano (08-17): a janela de confirmação, o texto "Manter reunião" e a ação `discard()` do hook `useMeetingAssociation` que manda este comando. Até lá o comando existe no service worker mas nenhuma UI o envia.
- Teto suave: com muitas reuniões não enviadas o histórico pode passar de 100 e pressionar a cota de 10 MB; medir `getBytesInUse` no D-20. Aviso de "histórico cheio de não enviadas" na UI = decisão do time (sem cópia no UI-SPEC).
- Este plano não toca backend nem deploy. Lembrete geral da fase: TEM QUE CRIAR `GEMINI_API_KEY` NO RAILWAY antes de qualquer deploy/merge na `master`.
- Teste manual D-20(c): descartar com confirmação e conferir que a reunião sumiu do histórico e nada mudou no Agente.

## Threat Flags

None - sem nova superfície além do comando já previsto no threat model (T-08-26 e T-08-27 mitigados: zod + regra de estado no service worker; evicção nunca remove não enviadas).

## Next

Pronto para o próximo plano da onda 4 (08-17 depende deste).

## Self-Check: PASSED

- FOUND: taqciti/src/features/history/eviction.ts, taqciti/src/background/history.test.ts
- FOUND commits 007bc90 e bae4a4f (ancestrais de HEAD)
