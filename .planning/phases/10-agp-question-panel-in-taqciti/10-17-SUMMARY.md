---
phase: 10-agp-question-panel-in-taqciti
plan: 17
subsystem: taqciti-content-ui (layout do painel compacto do Meet, G-10-7 opções a e b)
tags: [typescript, react, vitest, chrome-extension, taqciti, gap-closure, layout]
status: complete

requires:
  - phase: 10-agp-question-panel-in-taqciti (plano 10-14)
    provides: PanelApp.tsx com o aviso de legendas dentro da faixa do vínculo e o wrapper do aviso de conta com empty:hidden
provides:
  - "compactLayoutFor(size): regra pura do que o compacto esconde ou junta (showMeetingTitleField, statsInControlsRow)"
  - "Cabeçalho do compacto sem o campo 'Nome da reunião' (médio e alto mantêm o campo e o renomear)"
  - "Linha 'N falas · N pessoas · N palavras' (e o aviso rápido) dentro da linha dos botões no compacto, entre o copiar e o 'Finalizar'"
affects: [10-16 (reteste no Chrome real: medir a lista do compacto, passos 5 e 9c do roteiro)]

actuals:
  tokens: 2650
  tasks: 2
  commits: 4

commits: 4
plan_head_before: 8567f128182b25ef7eb00681f35d183985a6c10b
plan_head_after: c14ad89a79e3290e798317552d9e9526555f5e14

tech-stack:
  added: []
  patterns:
    - "Regra de layout como função pura (compactLayoutFor) funcionando como interruptor por tamanho, testada nos três tamanhos, em vez de condicionais soltas no JSX"
    - "Elemento único montado no LiveBody e entregue a um de dois lugares (linha própria OU slot do LiveControls), nunca aos dois"

key-files:
  created:
    - taqciti/src/content/ui/compactLayout.ts
  modified:
    - taqciti/src/content/ui/PanelApp.tsx
    - taqciti/src/content/ui/panelLayout.test.ts

key-decisions:
  - "Opções (a) e (b) de 2026-10-31 aplicadas literalmente, só no compacto; painel segue em 320 px e não cresce sozinho"
  - "Opção (a) vale em toda tela do compacto onde o campo existia (ao vivo, Preparando e Transcrição salva), porque o title do PanelHeader é decidido num ponto só"
  - "DECISÃO EM ABERTO do plano (contrato 'um cartão inteiro' para 3 linhas e para os estados abaixo de ~105 px) NÃO foi decidida nem tocada"

requirements-completed: [TAQ-05]

coverage:
  - id: D1
    description: "No compacto o campo 'Nome da reunião' não aparece no cabeçalho; médio e alto mantêm o campo (regra e ligação no title do PanelHeader)"
    requirement: "TAQ-05"
    verification:
      - kind: unit
        ref: "taqciti/src/content/ui/panelLayout.test.ts#PanelApp — o compacto esconde o nome da reunião e junta as estatísticas aos botões (10-17, G-10-7)"
        status: pass
    human_judgment: false
  - id: D2
    description: "No compacto as estatísticas e o aviso rápido ficam na linha dos botões, entre o copiar e o 'Finalizar'; nos outros tamanhos seguem na linha própria com as mesmas classes"
    requirement: "TAQ-05"
    verification:
      - kind: unit
        ref: "taqciti/src/content/ui/panelLayout.test.ts#PanelApp — o compacto esconde o nome da reunião e junta as estatísticas aos botões (10-17, G-10-7)"
        status: pass
    human_judgment: false
  - id: D3
    description: "No Chrome real (compacto, gravando e pausado) a lista da aba AGP mede pelo menos ~105 px e um cartão de 2 linhas aparece inteiro; nada cobre a linha dos botões com as estatísticas"
    requirement: "TAQ-05"
    verification: []
    human_judgment: true
    rationale: "jsdom não mede altura; a prova visual é o reteste manual do plano 10-16 (backstop)"
---

# Phase 10 Plan 17: compacto sem o nome da reunião e com as estatísticas na linha dos botões Summary

**No tamanho compacto do painel do Meet, o campo "Nome da reunião" sai do cabeçalho e a linha "N falas · N pessoas · N palavras" (com o aviso rápido) passa para a linha dos botões, entre o copiar e o "Finalizar"; médio, alto e a tela larga não mudam.**

## Performance

- **Tarefas:** 2 de 2 (ciclo RED/GREEN em cada uma, 4 commits)
- **Arquivos:** 3 (1 novo, 2 editados); só apresentação, nenhuma regra de captura, vínculo ou envio mudou

## Accomplishments

- **Task 1 (tracer):** novo `compactLayout.ts` com `compactLayoutFor(size)`; `PanelApp` calcula `layout` logo depois do `panelBox` e o `title` do `PanelHeader` vira `null` quando `!layout.showMeetingTitleField`, o mesmo `null` que já escondia o campo no histórico. O `input` "Nome da reunião" (`aria-label`, `onBlur`, `onRename`) ficou intacto.
- **Task 2:** `statsInControlsRow` na regra (verdadeiro só no compacto). `LiveStats` ganhou `placement` (`line` com as classes de hoje, `row` com `min-w-0 flex-1 px-1 text-caption leading-tight`, sem corte por reticências). `LiveControls` ganhou a prop `stats` desenhada entre o copiar e o "Finalizar" (que mantém o `ml-auto`). `LiveBody` monta o `LiveStats` uma vez e o entrega à linha própria OU ao `LiveControls`, nunca aos dois. `PanelBody` liga a regra com `compactLayoutFor(panelSize)`.
- 8 testes novos no `panelLayout.test.ts` (3 de regra/ligação da Task 1, 4 da Task 2, mais a trava de preservação do campo): a regra nos três tamanhos e travas de fonte (título do cabeçalho, posição de `{stats}` entre `<CopyIcon />` e `name="stop"`, `statsInControlsRow` e `stats={` no `LiveBody`, classes contadas uma vez só). Nenhuma linha antiga do arquivo de teste foi alterada (só acréscimos).

## TDD

- **RED 1 (`d85d2e1`):** como o arquivo de teste importa `compactLayoutFor`, o commit RED inclui um stub de `compactLayout.ts` que não esconde nada (importar um módulo inexistente seria falha de carga, não RED válido). Falharam pela asserção planejada: `showMeetingTitleField` do compacto (`expected true to be false`) e a ligação no `title` do `PanelHeader` (trecho sem `showMeetingTitleField`). Os outros 5 testes passaram (guardas de regressão e testes já existentes). Avaliação semântica: o alvo rodou e falhou pelo motivo certo.
- **GREEN 1 (`4a17fb2`):** 7/7 verdes, `tsc` e `eslint` limpos.
- **RED 2 (`61e80fd`):** 4 testes novos falharam pelas asserções planejadas (regra do compacto, `{stats}` ausente no `LiveControls`, `statsInControlsRow`/`stats={` ausentes no `LiveBody`, variante `row` ausente na contagem de classes). Avaliação semântica: motivo certo.
- **GREEN 2 (`c14ad89`):** 11/11 verdes; suíte inteira da Taqciti verde (104 arquivos passaram, 1 ignorado; 1786 testes passaram, 3 ignorados); `tsc` e `eslint src` limpos.
- O classificador `gsd_run check tdd-red-evidence` não foi rodado (o plano não é `type: tdd` e o executor não tinha o `gsd_run` carregado como função); a evidência RED foi conferida pela saída do Vitest e pela leitura das mensagens de asserção.

## Task Commits

1. `d85d2e1` test(10-17): falha esperada — compacto sem o campo do nome da reunião (G-10-7, opção a)
2. `4a17fb2` fix(10-17): painel compacto sem o campo do nome da reunião (G-10-7, opção a)
3. `61e80fd` test(10-17): falha esperada — estatísticas na linha dos botões no compacto (G-10-7, opção b)
4. `c14ad89` fix(10-17): estatísticas na linha dos botões no painel compacto (G-10-7, opção b)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Bloqueio] Stub de `compactLayout.ts` no commit RED**
- **Found during:** Task 1, passo RED
- **Issue:** o teste importa `./compactLayout`, que ainda não existia; sem o arquivo o Vitest falharia na carga (INVALID_RED), não na asserção planejada.
- **Fix:** o commit RED traz um stub da função que devolve o comportamento antigo (campo sempre visível; depois `statsInControlsRow` sempre falso). O GREEN substitui o corpo pela regra real.
- **Files modified:** `taqciti/src/content/ui/compactLayout.ts`
- **Commits:** `d85d2e1`, `61e80fd`

**2. Dois commits por tarefa em vez de "commit único"**: o plano descreve um commit `fix(...)` por task; a instrução de execução pediu RED antes de GREEN, então cada task gerou um `test(10-17)` e um `fix(10-17)` com a mensagem prevista no plano. Nenhum efeito no código entregue.

**Total deviations:** 1 ajuste de montagem de RED (Rule 3) e 1 detalhe de organização de commits. **Impact:** nenhum no comportamento entregue nem nos critérios de aceitação.

## Issues Encountered

- Os arquivos do repositório usam CRLF no disco (`core.autocrlf=true`); as edições foram feitas preservando CRLF para o diff do git mostrar só as linhas acrescentadas.

## Known Stubs

Nenhum (o stub do commit RED é substituído no GREEN da mesma task).

## Threat Flags

Nenhum: sem superfície nova de rede, autenticação ou arquivo. T-10-27 mitigado: o título continua como `value` do `input`, as estatísticas continuam como nós de texto do React e `dangerouslySetInnerHTML` aparece 0 vezes em `PanelApp.tsx` e em `compactLayout.ts`. T-10-SC aceito: nenhum pacote instalado.

## Pendências para o reteste (plano 10-16) e para o time

- A altura da lista (~116 px gravando/pausado) é ESTIMATIVA lida do CSS; a medição no Chrome real é do plano 10-16 (compacto sem o nome no passo 5; o nome volta com "Expandir" no passo 9c; anotar em quantas linhas as estatísticas ficaram e medir a lista).
- A DECISÃO EM ABERTO da seção 6 do plano (contrato "um cartão inteiro" para cartões de 3 linhas e para os estados da tabela abaixo de ~105 px, como estatísticas em 4 linhas, aviso de legendas dentro da barra, barras de alerta, aviso "Conta do Meet" e aviso de idioma) continua do time. Nada foi compactado além de (a) e (b).

## Verificação

- `npx vitest run src/content/ui/panelLayout.test.ts`: 11/11
- `npx vitest run` (suíte inteira): 1786 passaram, 3 ignorados
- `npx tsc --noEmit` e `npx eslint src`: limpos
- Travas do plano: `export function compactLayoutFor` = 1; `compactLayoutFor` no PanelApp = 2; `aria-label="Nome da reunião"` = 1; `statsInControlsRow` no PanelApp = 6; classes da variante `row` = 1, da linha própria = 1, raiz do LiveControls = 1; `truncate`/`line-clamp` na linha da variante = 0; `git diff --numstat` do arquivo de teste contra `0989f74` sem remoções.

## Rollback

`compactLayoutFor` é um interruptor: `showMeetingTitleField` verdadeiro devolve o campo ao compacto; `statsInControlsRow` falso devolve a linha própria (mais a asserção correspondente no teste, em commit `revert(10-17): ...`). Para desfazer tudo: `git revert c14ad89 61e80fd` e depois `git revert 4a17fb2 d85d2e1` (nessa ordem). Depois, refazer o build da Taqciti e clicar no botão de recarregar do TaqCITi em `chrome://extensions`. Nenhum dado é afetado.

## Self-Check: PASSED

- Arquivos existem: `taqciti/src/content/ui/compactLayout.ts`, `taqciti/src/content/ui/PanelApp.tsx`, `taqciti/src/content/ui/panelLayout.test.ts`.
- 4 commits presentes no histórico da branch: `d85d2e1`, `4a17fb2`, `61e80fd`, `c14ad89`.
