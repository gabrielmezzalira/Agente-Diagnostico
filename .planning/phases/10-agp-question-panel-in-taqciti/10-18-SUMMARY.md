---
phase: 10-agp-question-panel-in-taqciti
plan: 18
subsystem: taqciti-background (roteador de mensagens, regra das duas abas)
tags: [typescript, vitest, chrome-extension, taqciti, review-fix, comportamento]
status: complete
review_findings: [WR-01]
commits: 2
key-files:
  modified:
    - taqciti/src/background/messageRouter.ts
    - taqciti/src/background/index.test.ts
---

# 10-18 — Só a aba dona alimenta a transcrição (WR-01)

**Decisão do usuário (2026-11-17):** filtrar.

## O que foi feito

| Commit | O que |
|--------|-------|
| `1ae5d9f` | `test(10-18)`: plano + três casos no roteador. Antes do conserto: 1 falha (fala de outra aba), 56 passam. |
| `cd7a3fe` | `fix(10-18)`: `case 'meet/chunk'` ignora a fala de uma aba diferente de `session.tabId`. A atividade da aba continua sendo anotada (`noteTabCaptionActivity`) antes do filtro, para qualquer aba, porque é ela que mantém a regra das duas abas (D-03). |

Sem aba dona conhecida (`tabId` nulo ou nenhuma reunião), o comportamento fica igual ao de antes.

## Verificação

- `index.test.ts`, `meetingTwoTabs.test.ts` e `meetingEndedTwoTabs.test.ts`: 110 passaram.
- Suíte inteira da Taqciti: 1791 passaram e 3 foram pulados (a fumaça AGP opt-in). `tsc --noEmit` sem erro, `eslint` limpo nos arquivos mexidos e `npm run build` ok.

## Sobras (sem decisão, registradas)

- `meet/participants` e `meet/captions` de uma aba que não é a dona continuam aceitos. A revisão aponta um efeito menor: uma aba parada na pré-entrada pode sobrescrever `presentNow` ou `captionsEnabled`. O usuário só decidiu sobre a fala.
- Caso de borda para os testes manuais do fim: a dona é a **última** aba que entrou na call. Se ela estiver com a legenda desligada e só a outra tiver legenda, a fala deixa de entrar até a legenda ser ligada na dona (o painel já pede para ligar).

## Verificação manual pendente (testes do fim)

Mesma call em duas abas, com legenda nas duas, e três frases faladas. Cada frase deve aparecer uma vez só, na Taqciti e na sessão do Agente.
