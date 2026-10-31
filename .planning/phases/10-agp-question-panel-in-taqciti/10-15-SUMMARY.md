---
phase: 10-agp-question-panel-in-taqciti
plan: 15
subsystem: taqciti-content (vigia de captura do GoogleMeetProvider, G-10-7 decisão 2)
tags: [typescript, vitest, chrome-extension, taqciti, gap-closure, comportamento]
status: complete

requires:
  - phase: 10-agp-question-panel-in-taqciti (planos 10-13 e 10-14)
    provides: aviso amarelo de legendas já posicionado na faixa do vínculo (layout)
provides:
  - "checkCaptureHealth sai cedo e limpa o stall quando a captura está pausada"
  - "publishCaptureHealth nunca conta como degradada a captura pausada (stall e parser)"
  - "setCapturePaused(true) apaga o estado de travamento e publica saudável (aviso some se estava na tela)"
  - "setCapturePaused(false) reinicia a janela de 25 s (só com legendas ligadas) e publica o estado real"
affects: [10-16 (reteste no Chrome real: pausar 60 s sem aviso amarelo), 10-17]

actuals:
  tokens: 1800
  tasks: 2
  commits: 4

commits: 4
plan_head_before: 4485c44ccd23eac22e9cbf6ecf5630a3b7302d28
plan_head_after: 5324eefc59b3ebf519ab49f70367df9e7947b2eb

tech-stack:
  added: []
  patterns:
    - "Vigia ciente de um estado deliberado (pausa): pausado publica saudável em vez de calar o callback"
    - "Teste de watchdog com DOM de estrutura conhecida + fala lida antes da pausa, para o stall não ser mascarado pelo aviso do parser nem apagado pela varredura da retomada"

key-files:
  created: []
  modified:
    - taqciti/src/content/providers/googleMeet/GoogleMeetProvider.ts
    - taqciti/src/content/providers/googleMeet/GoogleMeetProvider.test.ts

key-decisions:
  - "Decisão 2 (2026-10-31) aplicada: com a captura pausada o aviso 'legendas pararam' não aparece, por mais longa que seja a pausa"
  - "Interpretação registrada no plano: o aviso do parser também some na pausa, e o tempo pausado não conta como silêncio ao retomar (commit próprio, revertível sozinho)"

requirements-completed: [TAQ-05]

coverage:
  - id: D1
    description: "Pausado, o vigia não acusa stall nem parser; alarme já aceso some ao pausar; sem pausa o alarme continua igual"
    requirement: "TAQ-05"
    verification:
      - kind: unit
        ref: "taqciti/src/content/providers/googleMeet/GoogleMeetProvider.test.ts#GoogleMeetProvider — vigia de captura ciente da pausa"
        status: pass
    human_judgment: false
  - id: D2
    description: "Ao retomar, os 25 s recomeçam do zero (sem alarme falso logo depois), o alarme real volta no prazo, legendas desligadas não passam a esperar captura e o aviso do parser volta se continuar degradado"
    requirement: "TAQ-05"
    verification:
      - kind: unit
        ref: "taqciti/src/content/providers/googleMeet/GoogleMeetProvider.test.ts#vigia de captura ciente da pausa > retomada (A, B, C, D)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Comportamento no Chrome real: pausar por 60 s sem aviso amarelo e retomar sem aviso amarelo"
    requirement: "TAQ-05"
    verification: []
    human_judgment: true
    rationale: "Prova ponta a ponta no navegador fica para o plano 10-16 (reteste manual no Chrome real)"
---

# Phase 10 Plan 15: vigia de captura ciente da pausa Summary

**O vigia de captura do Meet (`GoogleMeetProvider`) deixa de gritar "legendas pararam de chegar" enquanto a captura está pausada, e recomeça a contar os 25 s do zero ao retomar.**

## Performance

- **Tarefas:** 2 de 2 (ciclo TDD completo em cada uma, 4 commits)
- **Arquivos:** 2 (um de produção, um de teste); nenhum arquivo de layout foi tocado

## Accomplishments

- **Task 1 (tracer):** `checkCaptureHealth` sai cedo quando pausado (limpando o stall), `publishCaptureHealth` só considera degradada a captura não pausada e `setCapturePaused(true)` publica "saudável". Efeito: o aviso amarelo não aparece na pausa, e some se já estava na tela. Como o controller recebe "saudável", ele também não tenta religar as legendas do Meet nem manda `meet/captureDegraded` por causa da pausa (T-10-24).
- **Task 2:** `setCapturePaused(false)` reinicia `captureExpectedSince` (só se as legendas estão ligadas, mesma regra do `poll`) e publica o estado real depois do recorte, de modo que o aviso do parser volta se ele continuar degradado. O tempo pausado deixa de contar como silêncio.
- 8 testes novos no `GoogleMeetProvider.test.ts` (15 -> 23), com o provider de verdade, DOM do jsdom e relógio falso. Nenhum teste antigo foi editado.

## TDD

- **RED 1 (`b725d7a`):** o controle passou; "pausado não acende alarme" (recebeu `[false,'stall']`), "alarme aceso some ao pausar" (ficou `[false,'stall']`) e "aviso do parser some ao pausar" (ficou `[false,'parser']`) falharam pela asserção planejada. Avaliação semântica: o alvo rodou e falhou pelo motivo certo (a pausa não publicava nada).
- **GREEN 1 (`8064802`):** 19 testes verdes.
- **RED 2 (`8d97e96`):** A e B falharam pela asserção de `captureStalled` (`expected true to be false`); C e D são guardas de regressão e já passavam, como previsto.
- **GREEN 2 (`5324eef`):** 23 testes verdes; suíte inteira da Taqciti verde (104 arquivos / 1779 testes).

## Task Commits

1. `b725d7a` test(10-15): vigia de captura não acusa legendas paradas durante a pausa
2. `8064802` fix(10-15): vigia de captura ciente da pausa (G-10-7, decisão 2)
3. `8d97e96` test(10-15): retomar recomeça a contagem do vigia
4. `5324eef` fix(10-15): retomar recomeça a janela de 25 s do vigia (G-10-7, decisão 2)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug de teste] Teste "alarme ligado e então pausa" montado com a DOM sem estrutura**
- **Found during:** Task 1, passo RED
- **Issue:** com a DOM sem estrutura do `<behavior>`, o reatamento do vigia emitia a fala, o que limpava o stall (`emitChunk` chama `setCaptureStalled(false)`) e deixava o parser degradado; o último evento antes da pausa era `[false,'parser']`, não `[false,'stall']`, e o teste não provava o que dizia.
- **Fix:** o teste usa a DOM de estrutura conhecida (`nMcdL`/`KcIKyf`/`bh44bd`), lê a fala antes e avança 30 s, como o plano já fazia para a Task 2. A asserção (último evento `[true, undefined]` depois de pausar) é a mesma do plano.
- **Files modified:** `taqciti/src/content/providers/googleMeet/GoogleMeetProvider.test.ts`
- **Commit:** `b725d7a`

**2. Casos A-D da Task 2 ficaram num `describe('retomada')` aninhado** dentro do `describe` da Task 1, para reaproveitar os helpers; o nome continua contendo "ciente da pausa".

**Total deviations:** 1 ajuste de montagem de teste (Rule 1) e 1 detalhe de organização. **Impact:** nenhum no comportamento entregue nem nos critérios de aceitação.

## Issues Encountered

- Uma execução da suíte inteira apresentou 1 falha em `src/background/agenteStreamerAssociation.test.ts` (arquivo não relacionado, 12,9 s, sob carga). O arquivo isolado passou (11/11) e uma segunda execução da suíte inteira passou sem falhas. Tratado como lentidão pontual, fora do escopo do plano.

## Known Stubs

Nenhum.

## Threat Flags

Nenhum: não há superfície nova de rede, autenticação ou arquivo. T-10-24 mitigado e coberto pelos testes (pausado publica "saudável", então o controller não religa legendas nem manda `meet/captureDegraded`).

## Verificação

- `npx vitest run src/content/providers/googleMeet/GoogleMeetProvider.test.ts`: 23/23
- `npx vitest run` (suíte inteira): 1779 passaram, 3 ignorados
- `npx tsc --noEmit` e `npx eslint src`: limpos
- Falta a prova manual no Chrome real (pausar 60 s sem aviso amarelo, retomar sem aviso), que é do plano 10-16.

## Rollback

`git revert 5324eef 8d97e96` desfaz só a retomada; `git revert` de `8064802 b725d7a` (depois dos da Task 2) devolve o comportamento anterior. Depois, refazer o build da Taqciti e clicar no botão de recarregar do TaqCITi em `chrome://extensions`.

## Self-Check: PASSED

- Arquivos modificados existem; 4 commits presentes no histórico da branch (`b725d7a`, `8064802`, `8d97e96`, `5324eef`).
- Verificações automáticas do plano: contagem de commits `vigia de captura` = 2, `retomar` = 2; `CAPTURE_STALL_TIMEOUT_MS` e `nMcdL` presentes no teste.
