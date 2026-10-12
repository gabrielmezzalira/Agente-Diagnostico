---
phase: 08-taqciti-session-association
plan: 17
subsystem: taqciti-end-of-meeting-and-history
status: complete
tags: [taqciti, chrome-extension, history, end-of-meeting, discard, useSyncExternalStore, vitest, session-association]

requires:
  - phase: 08-taqciti-session-association
    provides: "08-13: comando ui/agente/meeting/discard (D-11 confirmado); 08-14: useMeetingAssociation, bindingView, harness de teste; 08-04: AgenteEndPrompt e AssociationBadge; 08-02/03: ConfirmModal com cancelLabel e ClientPicker"
provides:
  - "useAssociations / useAssociation: mapa de associações com UMA assinatura do storage compartilhada (useSyncExternalStore)"
  - "AssociationBadgeFor: selo do histórico a partir do id da reunião (HistoryCard e RecordDetail)"
  - "discard() no hook useMeetingAssociation (ui/agente/meeting/discard)"
  - "AgenteEndSlot: cartão/botão 'Enviar ao Agente', seletor em modo encerrada, progresso, sucesso, falha e descarte confirmado"
  - "Fiação no MeetingScreen (painel do Meet) e no RecordDetail (saída larga); frase de D-11 no 'Apagar' de reunião já enviada"
affects: [08-20]

actuals:
  tokens: 14000
  tasks: 3
  commits: 3

plan_head_before: 537350078f910748c5e6fa5285d9311a74914079
plan_head_after: ff619d02647ddfc333cd36db196a80c8c02c2dff

tech-stack:
  added: []
  patterns:
    - "Store externo de módulo + useSyncExternalStore: um ouvinte de chrome.storage para N selos; zera o cache ao sair o último"
    - "Contêiner (AgenteEndSlot) só compõe hooks + peças apresentacionais; a regra de estado do descarte continua no service worker"

key-files:
  created:
    - taqciti/src/shared/hooks/useAssociations.ts
    - taqciti/src/sidepanel/components/AssociationBadgeFor.tsx
    - taqciti/src/sidepanel/components/AssociationBadgeFor.test.tsx
    - taqciti/src/sidepanel/components/AgenteEndSlot.tsx
    - taqciti/src/sidepanel/components/AgenteEndSlot.test.tsx
  modified:
    - taqciti/src/shared/hooks/useMeetingAssociation.ts
    - taqciti/src/sidepanel/components/HistoryCard.tsx
    - taqciti/src/sidepanel/components/RecordDetail.tsx
    - taqciti/src/content/ui/PanelApp.tsx

key-decisions:
  - "O descarte só sai do botão 'Descartar' do ConfirmModal; Esc, fundo e 'Manter reunião' cancelam sem mandar comando (T-08-34)"
  - "Na variante 'button' (histórico) 'enviada' vira só a linha de apoio 'Enviada para {cliente}' (o selo já diz o resto); na variante 'card' aparece 'Reunião enviada para {cliente}.'"
  - "Na variante 'button' não há 'Descartar': no histórico a saída é o 'Apagar' (que desde o 08-13 também limpa a associação)"
  - "send-failed mostra só a falha e o apoio: sem 'Enviar ao Agente' (reenviar do zero duplicaria as partes) e sem 'Continuar envio' (entra no 08-20, depende da B3)"

requirements-completed: []

coverage:
  - deliverable: "Selo de associação no histórico, com uma única assinatura do storage para todos os cartões"
    verification:
      - kind: test
        ref: "taqciti/src/sidepanel/components/AssociationBadgeFor.test.tsx"
        status: pass
    human_judgment: false
  - deliverable: "Fim da reunião: cartão/botão, seletor encerrado, progresso '3 de 30', 'Reunião enviada para {cliente}.' e descarte confirmado"
    verification:
      - kind: test
        ref: "taqciti/src/sidepanel/components/AgenteEndSlot.test.tsx"
        status: pass
    human_judgment: false
  - deliverable: "Fiação no PanelApp/RecordDetail e frase 'A cópia que já foi enviada ao Agente continua lá.' no Apagar"
    verification: []
    human_judgment: true
    rationale: "PanelApp e RecordDetail não têm teste de composição no repositório; coberto por typecheck, build e greps de gate. Falta a checagem visual D-20 (a, c), inclusive o ConfirmModal contido no painel do Meet (scale-100)."
---

# Phase 8 Plan 17: Fim da reunião e histórico (enviar em partes, descartar com confirmação) Summary

**No fim de uma reunião sem cliente a Taqciti pergunta "Enviar esta reunião ao Agente?" (cartão ou botão no histórico), envia em partes com progresso, ou descarta só depois de um modal "Manter reunião / Descartar"; o histórico ganha o selo de associação com uma única assinatura do storage.**

## O que foi feito

- **Task 1 (`e050805`)** — `useAssociations.ts` (cache de módulo + `useSyncExternalStore`, uma chamada a `subscribeAssociations` para todos os selos; ao desmontar o último ela é encerrada e o cache volta ao vazio). `AssociationBadgeFor` traduz com `toBadgeState` e não desenha nada sem associação. `HistoryCard` e `RecordDetail` mostram o selo ao lado do `StatusBadge`.
- **Task 2 (`bd012f4`)** — `discard()` no `useMeetingAssociation` (reusa `sendAgenteCommand`, resposta validada por `agenteCommandResultSchema`). `AgenteEndSlot` (146 linhas): cartão (`card`) ou botão (`button`), `ClientPicker` em modo `ended`, progresso/sucesso/falha via `AgenteEndPrompt`, e `ConfirmModal` do descarte com as cópias exatas do UI-SPEC (`cancelLabel="Manter reunião"`, `danger`). Na saída larga o seletor vai dentro de um `AppShell` em tela cheia.
- **Task 3 (`ff619d0`)** — `MeetingScreen` renderiza `<AgenteEndSlot>` (prop nova `agenteVariant`; `'card'` em "Transcrição salva", `'button'` na reunião aberta pelo histórico). `RecordDetail` renderiza o slot e, quando a reunião já foi enviada (`sent`/`stopped`), o "Apagar" ganha "A cópia que já foi enviada ao Agente continua lá." e o botão de recusa "Manter no histórico".

## Verificação

- `npx vitest run src/sidepanel/components/AssociationBadgeFor.test.tsx` — 4 testes passando.
- `npx vitest run src/sidepanel/components/AgenteEndSlot.test.tsx` — 13 testes passando (cartão -> seletor encerrado -> um único bind -> "3 de 30" -> enviada; erro no seletor; Voltar; AppShell na saída larga; modal com cópias exatas; "Manter reunião" e Esc sem comando; "Descartar" manda um `discard`; descarte recusado não avisa o hospedeiro; botão sem "Descartar"; send-failed sem botão e sem "Continuar envio"; linked; sem associação).
- Portão do plano: `npm test` — 72 arquivos, 1020 testes passando; `npm run typecheck`, `npm run lint` e `npm run build` saem 0.
- Gates: `PanelApp.tsx` +8 linhas, 0 hook novo; frase de D-11 aparece 1 vez em `RecordDetail.tsx`; "Continuar envio" fora de comentário no slot = 0.

## Deviations from Plan

### Auto-fixed / pequenos ajustes

**1. [Rule 2 - função necessária] Prop opcional `onDiscarded` no `AgenteEndSlot`**
- **Found during:** Task 2/3
- **Issue:** no `RecordDetail` (saída larga) a reunião descartada deixa de existir, e a tela de detalhe ficaria aberta sobre um registro apagado.
- **Fix:** o slot aceita `onDiscarded?: () => void`, chamado só quando o comando de descarte volta `ok`; o `RecordDetail` passa `onBack`. No painel do Meet não é preciso (o service worker zera a fase e a rota cai na lista).
- **Files modified:** `AgenteEndSlot.tsx`, `RecordDetail.tsx`
- **Commit:** `bd012f4`, `ff619d0`

**2. [Detalhe de acabamento] `cancelLabel` do "Apagar" é uma expressão, não um literal**
- O critério de aceite cita `cancelLabel="Manter no histórico"`; como o rótulo só muda para reuniões já enviadas, ficou `cancelLabel={hasAgenteCopy ? 'Manter no histórico' : 'Cancelar'}` (o resto do modal continua como estava). A intenção do critério é atendida; só o grep literal não casaria.

**3. `toPickerError` duplicado**
- O mapeamento erro-do-comando -> erro-do-seletor existe igual no `AgenteLiveSlot` e agora também no `AgenteEndSlot` (função de 4 linhas). Extrair exigiria mexer no `AgenteLiveSlot`, fora dos arquivos do plano. Sugestão para depois: mover para `bindingView.ts`.

### Pontos de atenção (não são desvios)

- Reunião `deferred`/`pending` fora do ar: o plano cita o botão também para esses estados, mas `toEndPromptView` (08-14) só pergunta em `ended-unsent`, e o reducer já converte `pending/choosing/deferred` em `ended-unsent` no fim da reunião. Nenhum estado fica sem tela; não tratei esses dois separadamente.
- Backend/deploy: este plano só mexe na extensão (`taqciti/`); não há mudança de backend nem deploy.

## Known Stubs

Nenhum.

## Threat Flags

Nenhum: não há endpoint, caminho de autenticação ou acesso a arquivo novos. T-08-34 (descarte sem confirmação) mitigado e testado; T-08-35 (título no modal) mitigado — texto JSX, sem `dangerouslySetInnerHTML`; T-08-SC: nenhum pacote novo (manifestos sem diff).

## Para o time (pendente de verificação manual — D-20 a, c)

- Terminar uma reunião do Meet com falas, sem cliente: conferir o cartão, "Selecionar cliente" -> escolher -> barra "x de y" -> "Reunião enviada para …".
- Outra reunião: "Descartar" -> modal com "Manter reunião" (desiste) e "Descartar" (some do histórico, nada muda no Agente).
- Conferir se o `ConfirmModal` no painel do Meet fica contido na caixa do painel (efeito do `scale-100`, aceitável pelo UI-SPEC §5) e se um título longo não estoura.
- Selos ao lado de "Guardada" no histórico; "Apagar" de reunião enviada mostra a frase da cópia no Agente.

## Self-Check: PASSED

- Arquivos criados presentes: `useAssociations.ts`, `AssociationBadgeFor.tsx` (+ teste), `AgenteEndSlot.tsx` (+ teste).
- Commits presentes no histórico: `e050805`, `bd012f4`, `ff619d0`.
