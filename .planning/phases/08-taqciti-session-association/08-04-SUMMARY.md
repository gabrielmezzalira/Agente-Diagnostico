---
phase: 08-taqciti-session-association
plan: 04
subsystem: taqciti-ui
tags: [taqciti, chrome-extension, react, vitest, binding-bar, end-prompt, badge, presentational, accessibility, pt-br]

requires:
  - phase: 08-taqciti-session-association
    provides: "contrato visual aprovado 08-UI-SPEC.md (§4 barra de vínculo, §5 fim da reunião, §6 selo) e o kit Liquid Glass (Surface, Button, Badge, ProgressRail, Icon)"
provides:
  - "AgenteBindingBar + tipo BindingBarView (deferred, linking, linked, offline, rejected, stopped) — faixa de uma linha, min-h 40px"
  - "AgenteEndPrompt + tipo EndPromptView (ask, sending, sent, failed, linked-note) — cartão de fim da reunião e envio em partes, sem Cancelar e sem Continuar envio"
  - "AssociationBadge + tipo AssociationBadgeState (no-client, sending, sent, stopped) — selo do histórico mapeado para Badge warning/primary"
affects: [08-14, 08-17, 08-20]

actuals:
  tokens: 6050
  tasks: 2
  commits: 2

plan_head_before: a2eb7fa9484de7acccafd4285f409700154374f9
plan_head_after: 73069c685935ea0ec5519b15e39ae0f93ade7d01

tech-stack:
  added: []
  patterns:
    - "Modelo de visão por componente (ISP): cada peça recebe uma união discriminada própria (`kind`) em vez do tipo do domínio; a tradução domínio -> visão fica no hook de fiação (08-14)"
    - "Aviso warning reutiliza o literal do aviso de captura do PanelApp (border-[#f2c94c]/25 bg-[#f2c94c]/10 text-[#f7dd8f]) com role=status + aria-live=polite; danger nunca aparece nos estados de parada"
    - "Nome vindo de fora = texto JSX + title como atributo, com min-w-0 truncate: só o nome encolhe, prefixo e sufixo ficam inteiros (ClientLine)"
    - "switch exaustivo por kind (mesmo padrão de StatusBadge), sem estado padrão para o selo"

key-files:
  created:
    - taqciti/src/sidepanel/components/AgenteBindingBar.tsx
    - taqciti/src/sidepanel/components/AgenteBindingBar.test.tsx
    - taqciti/src/sidepanel/components/AgenteEndPrompt.tsx
    - taqciti/src/sidepanel/components/AgenteEndPrompt.test.tsx
    - taqciti/src/sidepanel/components/AssociationBadge.tsx
    - taqciti/src/sidepanel/components/AssociationBadge.test.tsx
  modified: []

key-decisions:
  - "O campo clientName do estado offline da barra não aparece no texto (a cópia do contrato é fixa); ele vai como title do aviso, para quem passar o mouse saber de qual cliente são as falas na fila"
  - "No ProgressRail do estado linking o contador '{x} de {y}' vem só do trilho (uma única ocorrência), e o texto da barra é 'Enviando o que já foi falado…' sem número"
  - "Estados stopped e rejected da barra são warning (suposição do planejador, reversível): stopped reaproveita a cópia de falha do fim da reunião; rejected mostra exatamente o texto recebido"
  - "Falha do envio em partes sem botão algum (nem Continuar envio, nem Enviar ao Agente, nem Cancelar) até a decisão B3 ser aplicada (plano 08-20)"

patterns-established:
  - "ClientLine: linha '{prefixo} {cliente}{sufixo}' em que só o nome trunca (min-w-0 truncate + title); reutilizável por outras peças que mostrem o nome do cliente"
  - "WarningRow: aviso warning acessível (role status, aria-live polite) em uma linha com min-h 40px"

requirements-completed: [TAQ-02]

coverage:
  - id: D1
    description: "Barra de vínculo mostra os 6 estados (deferred, linking, linked, offline, rejected, stopped) com as cópias exatas do UI-SPEC, linha única de no mínimo 40 px, e 'fala'/'falas' conforme o número"
    requirement: TAQ-02
    verification:
      - kind: unit
        ref: "taqciti/src/sidepanel/components/AgenteBindingBar.test.tsx"
        status: pass
    human_judgment: false
  - id: D2
    description: "Agente fora do ar é aviso warning (role status, aria-live polite) com a contagem na fila em tabular-nums; nenhum estado de parada usa text-danger"
    requirement: TAQ-02
    verification:
      - kind: unit
        ref: "taqciti/src/sidepanel/components/AgenteBindingBar.test.tsx#offline / stopped"
        status: pass
    human_judgment: false
  - id: D3
    description: "Envio em partes mostra ProgressRail '{x} de {y}' (singular '1 de 1', uma única ocorrência) e não tem botão Cancelar nem Continuar envio"
    requirement: TAQ-02
    verification:
      - kind: unit
        ref: "taqciti/src/sidepanel/components/AgenteEndPrompt.test.tsx#sending"
        status: pass
      - kind: command
        ref: "awk de 'Continuar envio|Cancelar' fora de comentários em AgenteEndPrompt.tsx e AgenteBindingBar.tsx = 0"
        status: pass
    human_judgment: false
  - id: D4
    description: "Nome do cliente (200+ caracteres) em barra, 'Enviando para', 'Reunião enviada para' e 'Enviada para' usa truncate + title; nome com HTML aparece como texto literal"
    requirement: TAQ-02
    verification:
      - kind: unit
        ref: "AgenteBindingBar.test.tsx#linked e AgenteEndPrompt.test.tsx#sending/sent/linked-note/texto literal"
        status: pass
    human_judgment: false
  - id: D5
    description: "Selo de associação mapeia no-client (warning), sending (primary com ponto animate-pulse-dot), sent (primary), stopped (warning); o estado é obrigatório (sem padrão)"
    requirement: TAQ-02
    verification:
      - kind: unit
        ref: "taqciti/src/sidepanel/components/AssociationBadge.test.tsx"
        status: pass
    human_judgment: false
  - id: D6
    description: "Aparência fiel ao UI-SPEC no painel de 320/564 px e na saída larga (uma linha da barra em 396 px, overflow do selo ao lado do StatusBadge)"
    requirement: TAQ-02
    verification: []
    human_judgment: true
    rationale: "As três peças ainda não estão montadas em nenhuma tela (fiação nos planos 08-14/08-17); o aspecto visual e o overflow só são conferidos no teste manual D-20."

duration: ~5min
completed: 2026-10-12
status: complete
---

# Phase 8 Plan 04: Barra de vínculo, cartão de fim da reunião e selo do histórico Summary

**Três componentes apresentacionais sem dependência do domínio — `AgenteBindingBar` (6 estados, Agente fora do ar como aviso warning com a fila de falas), `AgenteEndPrompt` (pergunta de fim da reunião, envio em partes com `ProgressRail` "x de y", sucesso e falha sem nenhum botão bloqueado pela decisão B3) e `AssociationBadge` — todos recebendo um modelo de visão próprio e fiéis ao UI-SPEC.**

## Performance

- **Duration:** ~5 min (03:16:57Z a 03:22:13Z)
- **Tasks:** 2
- **Files:** 6 criados, 0 alterados; `package.json` e `package-lock.json` sem diff

## Accomplishments

- **Barra de vínculo (Task 1):** `AgenteBindingBar` (134 linhas) com `BindingBarView` de 6 `kind`s. `deferred`/`linking`/`linked` em `Surface level="item"`; `offline`/`rejected`/`stopped` usam o literal warning do `PanelApp` com `role="status"` e `aria-live="polite"`. O contador "{n} fala(s) na fila" usa `tabular-nums` e `shrink-0`; o nome do cliente trunca com `title`; o botão "Selecionar cliente" tem `shrink-0`. Em `linking`, "3 de 12" aparece uma única vez (no trilho).
- **Fim da reunião (Task 2):** `AgenteEndPrompt` (154 linhas) com `EndPromptView` de 5 `kind`s e um helper interno `ClientLine` (só o nome encolhe). `ask` tem Selecionar cliente (primary, `flex-1`) e Descartar (`ghost`, `text-danger/80`, mesmo padrão do "Apagar" de `RecordDetail`) em linha; `sending` mostra o trilho; `sent` traz o `Icon check` em `text-primary`; `failed` mostra só o texto de parada (warning) e a linha de apoio, sem botão.
- **Selo (Task 2):** `AssociationBadge` (33 linhas) com `switch` exaustivo no padrão de `StatusBadge`; `state` obrigatório.
- **Portão do plano:** `cd taqciti && npm test && npm run typecheck && npm run lint` verdes (53 arquivos, 771 testes).

## Task Commits

1. **Task 1 (AgenteBindingBar):** `e2f60db`
2. **Task 2 (AgenteEndPrompt + AssociationBadge):** `73069c6`

**Plan metadata:** commit de docs ao final (SUMMARY + STATE + ROADMAP + REQUIREMENTS).

## Evidência TDD (RED -> GREEN)

- **Task 1 — RED:** exportei só os tipos e um componente que devolve `null`. 14 de 14 testes falharam por elemento ausente (`querySelector('[role="status"]')` e `firstElementChild` nulos), não por import, sintaxe ou fixture. `semanticAssessment`: o alvo executou e falhou porque o comportamento planejado não existia. **GREEN:** 14/14 (um ajuste no próprio teste: `'Cliente '.repeat(25).trim()` tinha 199 caracteres, trocado por 26 repetições para cumprir "200+").
- **Task 2 — RED:** mesma técnica (stubs que devolvem `null`). 13 de 13 falharam por elemento ausente (`Cannot read properties of null (reading 'textContent')` e variantes). `semanticAssessment`: comportamento ausente, sem erro de import. **GREEN:** 13/13.
- **Commits:** o plano (§2 e §5) pede um commit por Task, então RED e GREEN não foram commitados separados; o RED foi executado e registrado acima antes de cada implementação.

## Deviations from Plan

None - plan executed exactly as written.

Observações de detalhe (não são desvio): a Task 2 ganhou 13 testes (o plano pedia "7 casos"; os casos extras cobrem plural de partes, nome longo em `sent`, texto literal e ausência de botão); o `clientName` do estado `offline` (listado no tipo pelo plano) é usado como `title` do aviso, já que a cópia do contrato é fixa.

**Total deviations:** 0. **Impact:** nenhum critério de aceite alterado.

## Issues Encountered

- Aviso do git sobre LF/CRLF nos arquivos novos (config do Windows); sem efeito no conteúdo.

## Known Stubs

Nenhum. As três peças não são importadas por nenhuma tela ainda — a fiação é escopo declarado dos planos 08-14/08-17, não stub.

## Threat Flags

Nenhum novo. T-08-07 (XSS por nome de cliente) mitigado: o nome é filho JSX e `title` é atributo; zero `dangerouslySetInnerHTML`; testes com `<img src=x onerror=alert(1)>` renderizado literalmente na barra e no cartão. T-08-SC: nenhum pacote novo (`package.json`/`package-lock.json` sem diff).

## Decisões em aberto herdadas

- **B3 (não bloqueia este plano):** "Continuar envio" não é entregue; entra no plano 08-20 só se a B3 for aplicada. Nenhuma ocorrência de "Continuar envio" ou "Cancelar" fora de comentários nos componentes.
- Suposição do planejador (lacuna do UI-SPEC, reversível): estado `stopped` na barra ao vivo reaproveita a cópia de falha do fim da reunião; `rejected` mostra exatamente o texto recebido.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Pronto: o hook de fiação (08-14) pode traduzir o estado do domínio para `BindingBarView`/`EndPromptView`, e o mapeamento do histórico (08-17) para `AssociationBadgeState`.
- Lembrete herdado do 08-01: não distribuir build da Taqciti entre o 08-01 e o 08-14.

## Self-Check: PASSED

- Arquivos criados presentes: os 6 de `key-files.created`.
- Commits presentes no histórico: `e2f60db`, `73069c6`.
- Acceptance: exports `AgenteBindingBar`/`BindingBarView` (6 kinds), `AgenteEndPrompt`/`EndPromptView` (5 kinds), `AssociationBadge`/`AssociationBadgeState` conferidos; cópias literais do UI-SPEC presentes; `awk` de "Continuar envio|Cancelar" fora de comentários = 0; arquivos com 134, 154 e 33 linhas (todos <= 200); `AgenteBindingBar.test.tsx` 14/14, `AgenteEndPrompt.test.tsx` 9/9, `AssociationBadge.test.tsx` 4/4; `typecheck`, eslint e prettier dos arquivos tocados em 0.
- Verificação do plano: `cd taqciti && npm test && npm run typecheck && npm run lint` verdes (53 arquivos, 771 testes).

---
*Phase: 08-taqciti-session-association*
*Completed: 2026-10-12*
