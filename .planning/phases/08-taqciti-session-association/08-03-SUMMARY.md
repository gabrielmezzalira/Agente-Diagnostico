---
phase: 08-taqciti-session-association
plan: 03
subsystem: taqciti-ui
tags: [taqciti, chrome-extension, react, vitest, client-picker, dependency-inversion, accessibility, pt-br]

requires:
  - phase: 08-taqciti-session-association
    provides: "contrato visual aprovado 08-UI-SPEC.md (picker, criar cliente, plano B do ID manual) e o kit Liquid Glass (OptionCard, Field, Button, Surface)"
provides:
  - "Portas ClientDirectory { list(); create(name) } e AgenteSessionGateway { createSession(clientId, name) }, tipo ClientSummary { id, client, name }"
  - "DuplicateClientError, ClientDirectoryUnavailableError e as implementações unavailableClientDirectory / unavailableSessionGateway (padrão de produção até a decisão B1)"
  - "clientSearch.ts puro: foldText, filterClients, sortClients, isDuplicateClientName, clientHint, countLabel (sem acento, pt-BR)"
  - "Fakes de teste: createFakeClientDirectory e createFakeSessionGateway"
  - "ClientPicker apresentacional (lista, busca, seleção em dois passos, contador, estados carregando/vazio/erro) + ClientPickerList"
  - "ClientCreateForm (criar cliente só com o nome) e ManualSessionIdForm (plano B, só com a lista em erro)"
  - "containEscape: Esc contido (para a propagação React e nativa antes de voltar um passo)"
affects: [08-07, 08-10, 08-14, 08-18]

actuals:
  tokens: 15800
  tasks: 3
  commits: 5

plan_head_before: 2e448c394c8910412b865a2e857e06b8831a61ed
plan_head_after: f2f2e043dfe94f0a83bf04143282c66a798ec819

tech-stack:
  added: []
  patterns:
    - "Inversão de dependência na tela: o seletor só conhece ClientDirectory/AgenteSessionGateway; a origem real (rotas B1 ou AGM) entra depois sem mexer na UI"
    - "Seleção em dois passos: clicar na linha só marca (aria-pressed); o vínculo sai do botão do rodapé (evita sessão órfã no Agente)"
    - "Esc contido em cada camada: o campo trata o Esc no próprio onKeyDown (o TextField já para a propagação do React), o contêiner trata o Esc vindo de botões/linhas"
    - "Estado local só de apresentação; texto digitado sobrevive a erro porque o formulário não é desmontado quando o `error` muda"

key-files:
  created:
    - taqciti/src/features/agente/clientDirectory.ts
    - taqciti/src/features/agente/clientSearch.ts
    - taqciti/src/features/agente/clientSearch.test.ts
    - taqciti/src/test/fakeClientDirectory.ts
    - taqciti/src/sidepanel/components/ClientPicker.tsx
    - taqciti/src/sidepanel/components/ClientPickerList.tsx
    - taqciti/src/sidepanel/components/ClientCreateForm.tsx
    - taqciti/src/sidepanel/components/ManualSessionIdForm.tsx
    - taqciti/src/sidepanel/components/ClientPicker.test.tsx
    - taqciti/src/sidepanel/components/containEscape.ts
  modified: []

key-decisions:
  - "Estado vazio sem clientes usa a ação 'Criar cliente novo' da linha fixa acima da lista (uma só instância do botão), em vez de repetir o botão dentro do estado vazio; a busca sem resultado traz a ação própria 'Criar cliente “{busca}”'"
  - "Só vale a seleção de uma linha visível: filtrar a busca e esconder a linha marcada desabilita o CTA (nunca age sobre cliente oculto)"
  - "Recusa de nome duplicado vinda do servidor mantém o CTA desabilitado até o texto mudar (compara o nome enviado com o atual, sem acento/caixa)"
  - "Mensagem de formato do ID manual usa text-muted com aria-live polite (não é falha de ação do usuário; danger fica para falha de ação, UI-SPEC §Color)"
  - "Erro 'create-session' aparece no formulário de cliente novo e também na vista da lista (acima do rodapé), pois a falha pode vir de confirmar um cliente existente"

patterns-established:
  - "containEscape(event, onEscape): devolve true quando tratou o Esc; usar em todo campo/contêiner que o painel do Meet minimizaria por engano"
  - "Harness de teste de componente compartilhado entre describes (usePickerHarness) quando o mesmo componente tem vários grupos de casos"

requirements-completed: [TAQ-02]

coverage:
  - id: D1
    description: "A origem dos clientes fica atrás de ClientDirectory/AgenteSessionGateway; as implementações de produção 'indisponível' rejeitam com ClientDirectoryUnavailableError e o seletor nunca chama API"
    requirement: TAQ-02
    verification:
      - kind: unit
        ref: "taqciti/src/features/agente/clientSearch.test.ts#implementações indisponível"
        status: pass
      - kind: command
        ref: "grep de platform.send|fetch|chrome. nos componentes do seletor = 0"
        status: pass
    human_judgment: false
  - id: D2
    description: "Busca local insensível a maiúsculas e acentos em pt-BR, por cliente ou projeto; ordenação por Intl.Collator('pt-BR'); duplicidade, dica da linha e contador"
    requirement: TAQ-02
    verification:
      - kind: unit
        ref: "taqciti/src/features/agente/clientSearch.test.ts"
        status: pass
    human_judgment: false
  - id: D3
    description: "Picker: estados carregando (4 esqueletos + texto polite, busca/criar desabilitados), vazio, busca sem resultado, populado com contador, seleção em dois passos e CTA por modo (live/ended), busy e erro de carregamento"
    requirement: TAQ-02
    verification:
      - kind: unit
        ref: "taqciti/src/sidepanel/components/ClientPicker.test.tsx#ClientPicker — lista, busca e seleção"
        status: pass
    human_judgment: false
  - id: D4
    description: "Criar cliente inline: trim, vazio/espacos desabilita, duplicado sem acento/caixa recusado, preenchido pela busca, 'Criando…' inerte, erro preserva o texto, Esc volta à lista sem chegar ao document"
    requirement: TAQ-02
    verification:
      - kind: unit
        ref: "taqciti/src/sidepanel/components/ClientPicker.test.tsx#ClientPicker — criar cliente inline"
        status: pass
    human_judgment: false
  - id: D5
    description: "Plano B do ID manual: campo só com status error (ausente em ready/loading), UUID validado antes de habilitar, ID limpo (trim) enviado, busy preserva o valor"
    requirement: TAQ-02
    verification:
      - kind: unit
        ref: "taqciti/src/sidepanel/components/ClientPicker.test.tsx#ClientPicker — plano B do ID manual (D-02)"
        status: pass
    human_judgment: false
  - id: D6
    description: "Nome de cliente é sempre texto: nenhum dangerouslySetInnerHTML, teste com nome HTML renderizado literalmente, title com o nome completo"
    requirement: TAQ-02
    verification:
      - kind: unit
        ref: "taqciti/src/sidepanel/components/ClientPicker.test.tsx#nome com HTML aparece como texto literal"
        status: pass
      - kind: command
        ref: "awk de dangerouslySetInnerHTML fora de comentários nos 4 componentes = 0"
        status: pass
    human_judgment: false
  - id: D7
    description: "Aparência fiel ao UI-SPEC no painel de 320/564 px e na saída larga (truncate, scroll-region, rodapé fixo, 3 linhas visíveis em 564 px)"
    requirement: TAQ-02
    verification: []
    human_judgment: true
    rationale: "O seletor ainda não está montado em nenhuma tela (fiação nos planos 08-10/08-14); o aspecto visual e o overflow só são conferidos no teste manual D-20."

duration: ~25min
completed: 2026-10-12
status: complete
---

# Phase 8 Plan 03: Seletor de clientes e plano B do ID manual Summary

**`ClientPicker` apresentacional (busca sem acento em pt-BR, seleção em dois passos, criar cliente só com o nome e plano B de ID manual validado como UUID só quando a lista falha), construído contra as portas `ClientDirectory`/`AgenteSessionGateway` com fakes de teste — a origem real dos clientes entra depois sem mexer na tela.**

## Performance

- **Duration:** ~25 min
- **Completed:** 2026-10-12T03:15Z
- **Tasks:** 3
- **Files:** 10 criados, 0 alterados; `package.json` e `package-lock.json` sem diff

## Accomplishments

- **Portas e busca (Task 1):** `ClientDirectory`, `AgenteSessionGateway`, `ClientSummary` (só `{id, client, name}`, minimização LGPD), erros próprios e implementações "indisponível" (o padrão de produção enquanto a decisão B1 não for aplicada: a lista falha e o seletor cai no plano B). `clientSearch.ts` é puro: `NFD` + `\p{M}` + `toLocaleLowerCase('pt-BR')`, `Intl.Collator('pt-BR', { sensitivity: 'base' })`, nada de regex de acento feita à mão.
- **Picker (Task 2):** `ClientPicker` (182 linhas) + `ClientPickerList` (126). Carregando = 4 esqueletos `glass-subtle animate-typing` + "Carregando clientes…" (polite) com busca e criar desabilitados; vazio, busca sem resultado, contador (`1 cliente` / `N clientes` / `Resultados · N`). Clicar na linha só alterna `aria-pressed`; o CTA do rodapé ("Vincular reunião" / "Enviar reunião") só habilita com seleção visível. `↓` no campo de busca foca a primeira linha; Esc volta e não chega ao `document`.
- **Formulários (Task 3):** `ClientCreateForm` (nome com `trim`, `maxLength={120}`, duplicado recusado antes da rede, erro com `aria-live="assertive"` preservando o texto, Esc volta à lista descartando o texto) e `ManualSessionIdForm` (`isValidAgenteSessionId` antes de habilitar; só renderizado no ramo `status === 'error'`).
- **Portão do plano:** `npm test` (50 arquivos, 744 testes), `npm run typecheck` e `npm run lint` verdes.

## Task Commits

1. **Task 1 (portas, busca, fakes):** `9fd96e9`
2. **Task 2 (ClientPicker + lista):** `c260540`
3. **Task 3 (criar cliente + plano B):** `7725968`
4. **Ajustes de estilo (sem mudança de comportamento):** `bedee7a` (mantém `maxLength={120}` literal), `f2f2e04` (prettier nos arquivos novos)

**Plan metadata:** commit de docs ao final (SUMMARY + STATE + ROADMAP + REQUIREMENTS).

## Evidência TDD (RED -> GREEN)

- **Task 1 — RED:** a primeira execução falhou por import (módulos ainda inexistentes), o que não conta como RED. Criei `clientDirectory.ts` real (mecânico) e um stub neutro de `clientSearch.ts` (devolvia valores errados de propósito). Resultado: 7 de 9 falharam nas asserções planejadas (ex.: `filterClients` devolvendo duplicado, `countLabel` devolvendo vazio); os 2 que passaram são guardas (o array não é alterado e as implementações "indisponível" já eram reais). `semanticAssessment`: o alvo executou e falhou porque o comportamento planejado estava ausente, não por import/sintaxe/fixture. **GREEN:** 9/9.
- **Task 2 — RED:** stub de `ClientPicker` que renderiza `null`. 10 de 10 falharam pelo elemento planejado ausente (`querySelector` -> `undefined`/`null`). `semanticAssessment`: comportamento ausente, sem erro de import. **GREEN:** 10/10.
- **Task 3 — RED:** testes novos contra o picker da Task 2 (sem formulário). 14 de 15 novos falharam pelo comportamento ausente (formulário e plano B inexistentes); o que passou é a guarda "campo de ID não existe com ready/loading", já verdadeira. **GREEN:** 25/25 no arquivo.
- **Commits:** o plano (§2 e §5) pede um commit por Task, então RED e GREEN não foram commitados separados; o RED foi executado e registrado acima antes de cada implementação.

## Deviations from Plan

### Auto-fixed / additive

**1. [Rule 3 - Blocking] Helper `containEscape.ts` (arquivo não listado no frontmatter)**
- **Found during:** Task 2
- **Issue:** `SearchField`/`TextField` chamam `event.stopPropagation()` do React antes do `onKeyDown` da página, então um `onKeyDown` só no contêiner nunca vê o Esc digitado no campo. O comportamento exigido ("Esc volta e não propaga para document") precisa tratar o Esc em dois níveis (campo e contêiner), em dois componentes (picker e formulário).
- **Fix:** função pura de 5 linhas `containEscape(event, onEscape)` em vez de duplicar a lógica de contenção em cada componente (DRY, mesma técnica do `AgenteDecisionCard`).
- **Files modified:** `taqciti/src/sidepanel/components/containEscape.ts` (novo)
- **Commit:** `c260540`

**2. [Rule 1 - Bug, de estilo] `maxLength={120}` literal**
- **Found during:** Task 3 (acceptance)
- **Issue:** a constante `NAME_MAX_LENGTH` não casa com o critério literal `maxLength={120}`; e um comentário inline fez o Prettier quebrar a prop em várias linhas.
- **Fix:** valor literal na prop e o comentário da suposição B1 movido para fora do JSX.
- **Commit:** `bedee7a`

**3. Estado vazio sem clientes:** o plano pede a ação "Criar cliente novo" no estado vazio; usei a linha fixa acima da lista (que já existe e fica habilitada) em vez de duplicar o botão com o mesmo rótulo dentro do estado vazio. Critério do `<behavior>` (ação presente e habilitada) continua verdadeiro e testado.

**Total deviations:** 2 auto-fixed (1 Rule 3, 1 Rule 1/estilo) + 1 escolha de detalhe. **Impact:** nenhum critério de aceite alterado; um arquivo a mais (5 linhas).

## Issues Encountered

- Aviso do git sobre LF/CRLF nos arquivos novos (config do Windows); sem efeito no conteúdo.
- O ambiente não tem Python; um script de refatoração de teste foi refeito com a ferramenta de escrita. Sem impacto.

## Known Stubs

Nenhum. `ClientPicker`, os formulários e as portas ainda não são importados por nenhuma tela — a fiação é escopo declarado dos planos 08-10/08-14 (e a origem real dos clientes depende da decisão B1 do plano 08-07), não stub. `unavailableClientDirectory`/`unavailableSessionGateway` são o padrão de produção documentado, não placeholder esquecido.

## Threat Flags

Nenhum novo. T-08-05 (XSS por nome de cliente) mitigado: texto como filho JSX e `title` como atributo, zero `dangerouslySetInnerHTML`, teste com `<img src=x onerror=alert(1)>` renderizado literalmente. T-08-06 (ID manual como destino arbitrário) mitigado: `isValidAgenteSessionId` antes de habilitar, campo só com a lista em erro, testes de ausência (ready/loading) e de formato. T-08-SC: nenhum pacote novo (`package.json`/`package-lock.json` sem diff).

## Decisões em aberto herdadas

- **B1 (não bloqueia este plano):** formato real da lista, limite do nome e códigos de erro das rotas novas. Assumido o contrato `{id, client, name}` e nome de 1 a 120 caracteres, isolados atrás da interface (a troca do limite é um único `maxLength`).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Pronto: planos de fiação (08-10/08-14) podem compor `ClientPicker` com `ClientDirectory`/`AgenteSessionGateway` injetados, e o 08-07 pode implementar as portas contra as rotas B1.
- Lembrete herdado do 08-01: não distribuir build da Taqciti entre o 08-01 e o 08-14.

## Self-Check: PASSED

- Arquivos criados presentes: os 10 de `key-files.created`.
- Commits presentes no histórico: `9fd96e9`, `c260540`, `7725968`, `bedee7a`, `f2f2e04`.
- Acceptance: exports de `clientDirectory.ts` e `clientSearch.ts` conferidos; nenhum `chrome`/`fetch`/`platform.send` nos módulos e componentes; `maxLength={120}` presente; zero `dangerouslySetInnerHTML`; componentes com 120, 182, 126 e 69 linhas (todos <= 200); `clientSearch.test.ts` 9/9 e `ClientPicker.test.tsx` 25/25.
- Verificação do plano: `cd taqciti && npm test && npm run typecheck && npm run lint` verdes (50 arquivos, 744 testes).

---
*Phase: 08-taqciti-session-association*
*Completed: 2026-10-12*
