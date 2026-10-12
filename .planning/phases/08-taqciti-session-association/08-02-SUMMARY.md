---
phase: 08-taqciti-session-association
plan: 02
subsystem: taqciti-ui
tags: [taqciti, chrome-extension, react, tailwind, vitest, ui-kit, accessibility]

requires:
  - phase: 08-taqciti-session-association
    provides: "contrato visual aprovado 08-UI-SPEC.md (ícone '!', cartão de decisão, override do rótulo de recusa)"
provides:
  - "Icon 'alert': exclamação sem círculo, traço 1.8, currentColor"
  - "Keyframe/animação 'nudge' (classe animate-nudge): 5 s, só transform translateY, nunca opacidade"
  - "ConfirmModal.cancelLabel opcional (padrão 'Cancelar'), retrocompatível"
  - "AgenteNudge: bolha '!' warning (#F2C94C) de 20 px com alvo de 32 px e duas ancoragens (capsule, header)"
  - "AgenteDecisionCard: cartão 'Esta reunião é de qual cliente?' com Selecionar cliente agora / Depois / × e Esc contido"
affects: [08-10, 08-14, 08-18, 08-22]

actuals:
  tokens: 4200
  tasks: 2
  commits: 2

plan_head_before: 9f92daa5a35be83cb242b6356982b4002461192e
plan_head_after: 892724107d748607f9afe5db152625cea48b536b

tech-stack:
  added: []
  patterns:
    - "Componente apresentacional com duas ancoragens no mesmo arquivo (AgenteNudge): quem compõe decide quando animar via bouncing"
    - "Animação de aviso só por transform (lição do dock-in): a visibilidade nunca depende de o quadro de animação rodar"
    - "Esc contido no próprio cartão (stopPropagation + stopImmediatePropagation) para não minimizar o painel que ouve Esc em document"

key-files:
  created:
    - taqciti/src/shared/ui/ConfirmModal.test.tsx
    - taqciti/src/sidepanel/components/AgenteNudge.tsx
    - taqciti/src/sidepanel/components/AgenteNudge.test.tsx
    - taqciti/src/sidepanel/components/AgenteDecisionCard.tsx
    - taqciti/src/sidepanel/components/AgenteDecisionCard.test.tsx
  modified:
    - taqciti/src/shared/ui/Icon.tsx
    - taqciti/tailwind.config.ts
    - taqciti/src/shared/ui/ConfirmModal.tsx

key-decisions:
  - "A animação do AgenteNudge roda no círculo interno, não no botão de 32 px: o alvo de clique fica parado enquanto a bolha pula"
  - "Na ancoragem capsule a bolha é só enfeite (aria-hidden, pointer-events-none, -right-1 -top-1); o clique é da cápsula inteira, como manda o UI-SPEC"
  - "Anel de foco da bolha usa outline-primary/70 (o mesmo anel do Button do kit); o fundo da bolha continua warning, nunca bg-primary"

patterns-established:
  - "Todo uso novo do ConfirmModal na Fase 8 deve passar cancelLabel explícito (Manter reunião / Manter no histórico)"

requirements-completed: [TAQ-02]

coverage:
  - id: D1
    description: "O kit tem o ícone alert (traço 1.8, currentColor) e o keyframe nudge de 5 s só com transform; o bloco do keyframe não contém opacity"
    requirement: TAQ-02
    verification:
      - kind: command
        ref: "awk no bloco nudge de taqciti/tailwind.config.ts: bloco encontrado (1), ocorrências de opacity (0); grep -c 'nudge 5s' = 1"
        status: pass
    human_judgment: false
  - id: D2
    description: "ConfirmModal aceita cancelLabel (padrão Cancelar); Esc, clique no fundo e botão de recusa chamam onCancel; clique na caixa não; fechado não renderiza"
    requirement: TAQ-02
    verification:
      - kind: unit
        ref: "taqciti/src/shared/ui/ConfirmModal.test.tsx"
        status: pass
    human_judgment: false
  - id: D3
    description: "AgenteNudge: aria-label/title exatos, caixa 32 px, círculo 20 px warning, animate-nudge só com bouncing, cápsula decorativa, sem foco roubado"
    requirement: TAQ-02
    verification:
      - kind: unit
        ref: "taqciti/src/sidepanel/components/AgenteNudge.test.tsx"
        status: pass
    human_judgment: false
  - id: D4
    description: "AgenteDecisionCard: cópia exata do UI-SPEC; botão Depois, × e Esc chamam onDefer; Esc não chega ao listener de document; sem foco roubado"
    requirement: TAQ-02
    verification:
      - kind: unit
        ref: "taqciti/src/sidepanel/components/AgenteDecisionCard.test.tsx"
        status: pass
    human_judgment: false
  - id: D5
    description: "O aviso de reunião detectada não interrompe a reunião (sem som, sem notificação do sistema, sem foco roubado) e o pulo/aparência estão fiéis ao UI-SPEC no Meet real"
    requirement: TAQ-02
    verification:
      - kind: command
        ref: "awk sem autoFocus/bg-primary/Notification/new Audio nos dois componentes = 0; testes de foco verdes"
        status: pass
    human_judgment: true
    rationale: "O aspecto visual e o 'não atrapalha a reunião' no Meet real só são conferidos com a fiação do plano 08-14 (teste manual D-20); aqui só há prova automática da ausência de foco/som."

duration: ~15min
completed: 2026-10-12
status: complete
---

# Phase 8 Plan 02: Peças visuais do aviso de reunião detectada Summary

**Bolha "!" warning que pula a cada 5 s só por transform (`AgenteNudge`, com ancoragens header/cápsula), cartão "Esta reunião é de qual cliente?" com Esc contido (`AgenteDecisionCard`) e `cancelLabel` opcional no `ConfirmModal`, tudo apresentacional e testado, pronto para a fiação do plano 08-14.**

## Performance

- **Duration:** ~15 min
- **Completed:** 2026-10-12T03:00Z
- **Tasks:** 2
- **Files:** 8 (5 criados, 3 alterados); `package.json` e `package-lock.json` sem diff

## Accomplishments

- **Kit:** ícone `alert` (dois traços, sem círculo), keyframe `nudge` (0 -> -4px -> 0 -> -2px -> 0 nos primeiros 20% de 5 s, repouso no resto, nenhuma chave `opacity`) e `ConfirmModal.cancelLabel` com padrão `'Cancelar'`. Nenhum chamador existente foi tocado.
- **AgenteNudge:** `header` é um botão 32x32 com círculo de 20 px `bg-[#F2C94C]`, `aria-label` e `title` com a cópia exata; `capsule` é um enfeite `aria-hidden` / `pointer-events-none` deslocado 4 px para fora do canto. Só recebe `animate-nudge` com `bouncing`.
- **AgenteDecisionCard:** `Surface level="card"` com título, corpo, "Selecionar cliente agora" (primary, flex-1), "Depois" (ghost) e × "Fechar aviso". Esc no cartão chama `onDefer` uma vez e não chega a um listener de `keydown` em `document`.
- **Portão do plano:** `npm test` (48 arquivos, 710 testes), `npm run typecheck` e `npm run lint` verdes.

## Task Commits

1. **Task 1 (kit):** `f3b067c` — ícone alert, keyframe nudge e ConfirmModal.cancelLabel
2. **Task 2 (componentes):** `8927241` — AgenteNudge e AgenteDecisionCard

**Plan metadata:** commit de docs ao final (SUMMARY + STATE + ROADMAP + REQUIREMENTS).

## Evidência TDD (RED -> GREEN)

- **Task 1 — RED:** `ConfirmModal.test.tsx` contra o modal com "Cancelar" fixo: 3 de 4 testes passaram (são guardas de regressão do comportamento já existente) e 1 falhou na asserção planejada ("com cancelLabel o botão de recusa mostra o texto novo": recebeu o botão `Cancelar` onde esperava `undefined`). `semanticAssessment`: o alvo executou e falhou na asserção planejada, não por import, sintaxe ou fixture. **GREEN:** 4/4.
- **Task 2 — RED:** para não confundir falha de import com RED, criei antes stubs que renderizam `null` (`AgenteNudge`, `AgenteDecisionCard`, só com as props). Resultado: 9 de 11 falharam porque o elemento planejado não existia (`getAttribute`/`click` em `null`/`undefined`); os 2 que passaram são os de "montar não muda o foco", que já são verdade para um componente vazio e viram guarda de regressão. `semanticAssessment`: os testes executaram e falharam porque o comportamento planejado estava ausente (nenhum erro de import, sintaxe ou fixture). Os stubs foram substituídos pela implementação antes do commit. **GREEN:** 11/11.
- **Commits:** o plano (§2 e §5) pede um commit por Task (um `git revert` por task), então RED e GREEN não foram commitados separados; o RED foi executado e registrado acima antes da implementação.

## Deviations from Plan

None - plan executed exactly as written.

(Escolha de detalhe dentro do que o plano deixa em aberto: a classe `animate-nudge` foi aplicada ao círculo interno do botão, e não ao botão, para o alvo de clique não se mover. Não altera nenhum critério de aceite.)

## Issues Encountered

- Aviso do git sobre LF/CRLF nos arquivos novos (config do Windows); sem efeito no conteúdo.
- O glifo "!" usa o `strokeWidth` fixo 1.8 do `Icon`; o UI-SPEC cita "600" de peso, que não se aplica a um ícone de traço. Não foi criado prop nova no `Icon`. Conferir o aspecto no teste manual D-20.

## Known Stubs

Nenhum. Os dois componentes ainda não são importados por ninguém — isso é escopo declarado do plano 08-14 (fiação no painel), não stub.

## Threat Flags

Nenhum novo. T-08-04 (confirmação destrutiva acidental) mitigado: Esc, clique no fundo e botão de recusa continuam cancelando, com teste dos três caminhos. T-08-SC: nenhum pacote novo (`package.json`/`package-lock.json` sem diff).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Pronto: o plano **08-14** pode compor `AgenteNudge` (com `bouncing` decidido por quem compõe) e `AgenteDecisionCard` no painel, e usar `ConfirmModal` com `cancelLabel` ("Manter reunião" / "Manter no histórico").
- Lembrete herdado do 08-01: não distribuir build da Taqciti entre o 08-01 e o 08-14.

## Self-Check: PASSED

- Arquivos criados presentes: `ConfirmModal.test.tsx`, `AgenteNudge.tsx`, `AgenteNudge.test.tsx`, `AgenteDecisionCard.tsx`, `AgenteDecisionCard.test.tsx`.
- Commits presentes no histórico: `f3b067c`, `8927241`.
- Acceptance: `| 'alert'` e `alert:` em `Icon.tsx`; keyframe `nudge` sem `opacity` e `nudge 5s ... infinite` (grep = 1); `cancelLabel = 'Cancelar'` e `{cancelLabel}` em `ConfirmModal.tsx`; componentes com 60 e 70 linhas; grep negativo de `autoFocus|bg-primary|Notification|new Audio` = 0.
- Verificação do plano: `cd taqciti && npm test && npm run typecheck && npm run lint` verdes (48 arquivos, 710 testes).

---
*Phase: 08-taqciti-session-association*
*Completed: 2026-10-12*
