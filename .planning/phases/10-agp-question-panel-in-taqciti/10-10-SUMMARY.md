---
phase: 10-agp-question-panel-in-taqciti
plan: 10
subsystem: uat-e-portao-automatico (roteiro de prova real + build local da Taqciti)
tags: [uat, documentacao, portao-automatico, vitest, vite-build, chrome-extension, taqciti]

# Dependency graph
requires:
  - phase: 10-agp-question-panel-in-taqciti
    provides: planos 10-01 a 10-09 (WR-05, duas abas, permissão tabs, feed em pausa, faixa fixa, abas acessíveis), CONTEXT D-09 corrigido e UI-SPEC com o contrato de copy
provides:
  - "10-UAT.md reescrito de 7 para 12 testes, cada um com depende_de_ia, origem, expected (uma linha), como fazer (passo a passo), esperado e result: [pending]"
  - "Seções Preparo comum (backend em 127.0.0.1:8000, web app em :5173, ↻ da Taqciti, clientes ZZ-TESTE, crédito do Gemini como ação humana) e Ordem sugerida (sem IA x com IA, D-13/D-19)"
  - "Portão automático da fase inteira verde (suíte 1737/0, tsc, eslint, fumaça 3/3, frontend 25/25, backend/supabase e D-12 sem diff)"
  - "taqciti/dist reconstruído com 127.0.0.1:8000 e envio ligado, com tabs no manifest.json"
affects: [10-11 (a pessoa roda o roteiro no Chrome real e a Task 3 grava os resultados), 10-12, /gsd-verify-work 10]

# Actuals (#2632) — chars/4 sobre o diff realizado (linhas adicionadas no 10-UAT.md)
actuals:
  tokens: 7691
  tasks: 2
  commits: 2

# Measured commit ledger (#3968)
commits: 2
plan_head_before: cb33f4ff44de1fce806eb1b81aee6cb068c7cdd1
plan_head_after: bb871bc74e73f1e889efc049088dddf73da74ee3

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "UAT escrito para quem não é técnico: cada teste com passos numerados, o que clicar, quanto esperar e o texto exato que aparece na tela (copiado do código, não da memória)"
    - "Campo expected: de uma linha ao lado do esperado: detalhado, para o leitor de UAT do GSD (uat render-checkpoint) continuar funcionando"
    - "Comandos de console do DevTools como uma linha só entre crases (nada de bloco com cerca), para o leitor de UAT não cortar o teste na primeira cerca"

key-files:
  created: []
  modified:
    - .planning/phases/10-agp-question-panel-in-taqciti/10-UAT.md

key-decisions:
  - "Textos de tela do roteiro foram lidos do código (QuestionsPanel, ControlsBar, AgenteEndPrompt, ClientPicker, AgpQuestionsPanel), então o botão do site é 'Gerar' (o UAT antigo dizia 'Gerar agora') e o painel tem 'Comprimir'/'Expandir'"
  - "A tela larga se abre por chrome-extension://<ID>/src/sidepanel/index.html (side_panel.default_path do manifesto): o botão 'Abrir numa aba' do painel do Meet abre o histórico, não a transcrição ao vivo, e o ícone da extensão não tem popup"
  - "O teste 9 tem duas rodadas (A: duas abas na call; B: segunda aba só na pré-entrada), porque a prova da pré-entrada exige encerrar a reunião e a prova de 'sair nas duas' exige uma reunião ainda viva"
  - "Teste 8 marcado como procedimento assistido: o truque (bloqueio de URL e limitação de rede no DevTools do service worker) não pôde ser ensaiado aqui, sem Chrome; fica descrito como foi planejado, com a instrução de anotar em evidence: se não funcionar"
  - "Teste 12 oferece a alternativa Pausar/Retomar para forçar a reconexão, além de derrubar e subir o backend (a do plano)"

patterns-established:
  - "Roteiro sem IA separado do roteiro com IA na seção Ordem sugerida; o backend falso nunca vale como prova final"
  - "Instrução de limpeza dos dados de teste aponta para o item M9 do TESTES-MANUAIS-POS-FASE-10.md, sem repetir comando de apagar no roteiro"

requirements-completed: [TAQ-05]

# Coverage metadata (#1602)
coverage:
  - id: D1
    description: "10-UAT.md tem exatamente 12 testes, cada um com depende_de_ia, como fazer, esperado e result: [pending]; a frase do D-09 corrigido aparece uma vez (teste 12) e o teste 10 traz a medição com getPermissionWarningsByManifest; nenhum passo menciona arquivo de segredo"
    requirement: "TAQ-05"
    verification:
      - kind: other
        ref: "grep -c '^### [0-9]*\\. ' 10-UAT.md (12); trio como fazer / result pending / depende_de_ia = '12 12 12'; frase D-09 = 1; getPermissionWarningsByManifest = 2; busca por arquivo de segredo = 0"
        status: pass
      - kind: other
        ref: "gsd-tools uat render-checkpoint sobre cópias descartáveis, uma por teste (uat-parse-check.cjs): 12/12 testes lidos"
        status: pass
    human_judgment: false
  - id: D2
    description: "Uma pessoa do time que não é técnica consegue seguir o roteiro no Chrome real sem perguntar como fazer cada passo"
    requirement: "TAQ-05"
    verification: []
    human_judgment: true
    rationale: "Clareza dos passos e o resultado dos truques de Chrome (bloqueio e limitação de rede do teste 8, comandos do teste 10, o prompt 'Sair do site?') só se provam executando o roteiro de verdade no plano 10-11"
  - id: D3
    description: "Portão automático da fase verde: suíte da Taqciti, tsc, eslint, fumaça AGP, testes do frontend; backend/ e supabase/ sem mudança desde eb3bf01 (D-10); arquivos do D-12 e o backend falso intactos (D-19)"
    requirement: "TAQ-05"
    verification:
      - kind: unit
        ref: "cd taqciti && npx vitest run (104 arquivos, 1737 testes passados, 3 pulados, 0 falhas)"
        status: pass
      - kind: other
        ref: "cd taqciti && npx tsc --noEmit && npx eslint src (exit 0 nos dois)"
        status: pass
      - kind: integration
        ref: "AGP_PYTHON=python AGP_SMOKE_SERVER=scripts/agp-fake-backend.py npx vitest run src/background/agpBackendSmoke.test.ts (3 passed)"
        status: pass
      - kind: unit
        ref: "npm --prefix frontend test (4 arquivos, 25 testes passados)"
        status: pass
      - kind: other
        ref: "git diff --name-only eb3bf01 -- backend/ supabase/ (vazio) e git diff --quiet eb3bf01 nos 6 arquivos do D-12/D-19 (exit 0)"
        status: pass
    human_judgment: false
  - id: D4
    description: "taqciti/dist reconstruído com VITE_AGENTE_BACKEND_URL=http://127.0.0.1:8000 e VITE_AGENTE_STREAMING_ENABLED=true, com tabs no manifest.json"
    requirement: "TAQ-05"
    verification:
      - kind: other
        ref: "VITE_AGENTE_BACKEND_URL=http://127.0.0.1:8000 VITE_AGENTE_STREAMING_ENABLED=true npm --prefix taqciti run build (built in 3.78s); grep -c '\"tabs\"' dist/manifest.json = 1; arquivos de dist/assets com 127.0.0.1:8000 = 1"
        status: pass
    human_judgment: false
  - id: D5
    description: "A prova no Chrome real: carregar o build com ↻ e executar os 12 testes (os de IA dependem do crédito do Gemini)"
    requirement: "TAQ-05"
    verification: []
    human_judgment: true
    rationale: "É o plano 10-11 (D-13): só uma pessoa com Chrome, Meet e Gemini com crédito prova as suposições A1 a A4 e os testes 2 e 3 com IA real; este plano só deixa o roteiro e o build prontos"

# Metrics
duration: 16min
completed: 2026-10-30
status: complete
---

# Phase 10 Plan 10: UAT de 12 testes com passo a passo e portão automático da fase Summary

**Roteiro `10-UAT.md` reescrito de 7 para 12 testes, cada um com o "como fazer" para quem não é técnico e o texto exato de tela lido do código; portão automático da fase todo verde (1737 testes, tsc, eslint, fumaça 3/3, frontend 25/25, backend e supabase intactos) e `taqciti/dist` reconstruído para `127.0.0.1:8000` com o envio ligado.**

## Performance

- **Duration:** 16 min
- **Started:** 2026-10-30T14:18:22Z
- **Completed:** 2026-10-30T14:35:00Z (aprox.)
- **Tasks:** 2
- **Files modified:** 1 (`10-UAT.md`); o `taqciti/dist` foi reconstruído mas é ignorado pelo git

## Accomplishments

- **Roteiro de 12 testes:** os 7 do Gabriel ampliados (contador oculto e 2ª frase na saída larga no 1; lente e contador no 2; faixa fixa no 4; teclado, degraus do painel e quebra de texto no 7) mais os 5 novos: 8 (WR-05, recusa silenciosa), 9 (duas abas, em duas rodadas), 10 (Nova Guia com `chrome://` e a medição dos avisos com `getPermissionWarningsByManifest`), 11 (feed em pausa ou com o envio desligado) e 12 (divergência site x Taqciti, com a frase do D-09 corrigido).
- **Para quem não é técnico:** cada teste diz onde clicar, quanto esperar e o que olhar, com os textos exatos que aparecem na tela. A seção `## Preparo comum` explica o vocabulário (painel do Meet, tela larga, aba AGP, vincular, terminal do backend) e o preparo; `## Ordem sugerida` separa os testes sem IA (1, 4A, 5, 6, 7A, 8, 9, 10) dos que esperam o Gemini com crédito (2, 3, 4B, 7B, 11, 12) e dá dicas de quais dá para juntar na mesma chamada.
- **Portão automático da fase verde:** suíte inteira da Taqciti 104 arquivos / 1737 passados / 3 pulados (a fumaça opt-in) / 0 falhas (piso do plano: 1513); `tsc --noEmit` e `eslint src` limpos; fumaça AGP 3 de 3; frontend 25 de 25; `backend/` e `supabase/` sem nenhum arquivo diferente desde `eb3bf01` (D-10); os 6 arquivos do D-12 e o backend falso sem diff (D-19).
- **Build local pronto:** `taqciti/dist` refeito com `VITE_AGENTE_BACKEND_URL=http://127.0.0.1:8000` e `VITE_AGENTE_STREAMING_ENABLED=true` na mesma linha; `"tabs"` presente no `manifest.json` e `127.0.0.1:8000` dentro do bundle. Falta só o ↻ em `chrome://extensions`, registrado no `## Preparo comum`.

## Task Commits

1. **Task 1 (tracer): reescrever o 10-UAT.md com 12 testes** - `05613d1` (docs). Tracer verificado de ponta a ponta antes da Task 2 (modo interativo, `end-of-phase`, `<verify>` só com `<automated>`: reexecutado, passou, expansão liberada sem checkpoint).
2. **Task 2: portão automático da fase inteira e build local (D-15)** - `bb871bc` (docs) — só o `updated:` e a linha do build em `## Preparo comum`; o restante da task não gera commit de código.

**Plan metadata:** commit `docs(10-10)` do SUMMARY e commit seguinte de STATE/ROADMAP.

## Files Created/Modified

- `.planning/phases/10-agp-question-panel-in-taqciti/10-UAT.md` - roteiro de 12 testes, `## Preparo comum`, `## Ordem sugerida` (297 linhas)
- `taqciti/dist/` - build local reconstruído (não versionado)

## Decisions Made

- Os textos de tela do roteiro vêm do código, não de memória. Isso corrigiu três coisas do UAT antigo e do `TESTES-MANUAIS-POS-FASE-10.md`: o botão do site chama-se **"Gerar"** (não "Gerar agora" nem "Gerar perguntas"); o painel tem **"Comprimir"/"Expandir"** para os degraus; e a transcrição ao vivo na tela larga se abre por `chrome-extension://<ID>/src/sidepanel/index.html`, porque o botão "Abrir numa aba" do painel do Meet abre o histórico (comentário em `PanelApp.tsx` e `route.ts`) e a extensão não tem popup.
- O teste 9 virou duas rodadas (A e B) em vez de uma sequência única: a prova de que "a 2ª aba na pré-entrada não segura a reunião" obriga a encerrar a reunião, e a prova de "sair nas duas encerra uma vez" exige uma reunião ainda viva.
- O teste 8 ficou como procedimento assistido, exatamente como o plano pediu, com o aviso de que se o truque do DevTools não funcionar a pessoa anota em `evidence:` em vez de forçar.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Campo `expected:` de uma linha, além do `esperado:` pedido pelo plano**
- **Found during:** Task 1 (leitura do formato do leitor de UAT do GSD)
- **Issue:** o plano pede `esperado:` em cada teste, mas `gsd-tools uat render-checkpoint` (o que o `/gsd-verify-work 10` usa depois) só lê a chave `expected:` e, sem ela, devolve "Pending UAT test N is missing an expected field". Com só `esperado:` o `/gsd-verify-work 10` travaria no primeiro teste pendente.
- **Fix:** cada teste ganhou uma linha `expected:` (resumo de uma frase) logo abaixo de `origem:`, e o `esperado:` detalhado do plano ficou onde o plano manda. Os comandos de console do teste 10 ficaram em linhas únicas entre crases (sem bloco com cerca), porque o leitor corta o teste na primeira cerca.
- **Files modified:** `.planning/phases/10-agp-question-panel-in-taqciti/10-UAT.md`
- **Verification:** `uat render-checkpoint` leu os 12 testes como "primeiro pendente", um por vez, sobre cópias descartáveis na pasta temporária (12/12); `git status` não mostrou nenhum arquivo novo no repositório.
- **Committed in:** `05613d1` (Task 1)

---

**Total deviations:** 1 auto-fixed (1 bloqueio de ferramenta posterior)
**Impact on plan:** só acrescenta uma linha por teste; todos os gates de contagem do plano seguem iguais (12 / "12 12 12" / 1 / 2).

## Issues Encountered

- **Observação do orquestrador sobre a suíte paralela:** não se repetiu. A primeira rodada completa da Taqciti (rodando sozinha, sem outro comando em paralelo) fechou 104 arquivos / 1737 passados / 0 falhas em 88 s, sem nenhum timeout de 5000 ms em `AgenteConfigScreenBack.test.tsx` nem em `agenteSessionFinisher.test.ts`. Não foi preciso repetir a suíte.
- **Hook de segredos bloqueou um `grep`:** o primeiro comando de conferência continha o texto do padrão de arquivo de segredo e foi barrado pelo hook do ambiente. Nenhum arquivo de segredo foi lido; a conferência foi refeita com a ferramenta Grep (0 ocorrências no UAT).
- **O leitor de UAT recusou as cópias de teste no Temp** (só aceita arquivos dentro da raiz em que roda); resolvido rodando o leitor com a pasta temporária do assistente como raiz.

## Known Stubs

None. O plano só produz documentação e um build; nenhum dado vazio, texto provisório ou componente sem fonte de dados.

## Threat Flags

None. Nenhuma superfície nova de rede, autenticação ou arquivo. T-10-17 mitigado: o roteiro exige clientes `ZZ-TESTE-<assunto> <data>`, proíbe cliente real e manda a limpeza para o item M9 do `TESTES-MANUAIS-POS-FASE-10.md`. T-10-18 mitigado: nenhum passo manda abrir, ler ou colar arquivo de segredo (0 ocorrências), e crédito ou troca da chave do Gemini aparece como ação de quem tem acesso à chave.

## User Setup Required

None - nenhuma configuração de serviço externo neste plano. Para rodar o roteiro (plano 10-11) a pessoa precisa de: Chrome com a Taqciti recarregada (↻ em `chrome://extensions`), backend em `127.0.0.1:8000`, web app em `:5173` e, para os testes 2, 3, 4B, 7B, 11 e 12, a chave do Gemini com crédito (ação de quem tem acesso a ela).

## Next Phase Readiness

- **Pronto para o 10-11:** roteiro de 12 testes e build local prontos; falta o ↻ no Chrome.
- **Atenção para quem executa o 10-11:**
  - O teste 8 (procedimento assistido) usa bloqueio de URL (`*/webhook/extension`) e limitação de rede no DevTools do service worker, e depende de esperar de 5 a 5,5 minutos pelo encerramento automático. Não pôde ser ensaiado sem Chrome; se o truque não funcionar do jeito descrito, registrar em `evidence:`.
  - O teste 11 conta linhas `WebSocket /ws/` no terminal do backend: o roteiro manda fechar a página da sessão no site antes, porque ela também abre conexões `/ws`.
  - As suposições A1 a A4 da pesquisa só se medem nos testes 9 e 10.
- **Rollback:** `git revert 05613d1` devolve o UAT de 7 testes (o commit `bb871bc` mexe só em duas linhas do mesmo arquivo; reverter primeiro `bb871bc`, depois `05613d1`). Build errado: refazer o mesmo comando com as duas variáveis e dar ↻; nada versionado muda.

## Self-Check: PASSED

- Arquivos: `10-UAT.md` e `taqciti/dist/manifest.json` existem em disco.
- Commits `05613d1` e `bb871bc` são ancestrais do HEAD; `check evaluation-scope --plan 10-10 --commits-only` devolveu os 2 commits (`commits: 2` medido pelo ledger, base `cb33f4f`).
- Critérios de aceitação das duas tasks reexecutados e passando (12 testes; "12 12 12"; frase do D-09 = 1; `getPermissionWarningsByManifest` = 2; seções `Preparo comum` e `Ordem sugerida` presentes; nenhum passo menciona arquivo de segredo; build com `"tabs"` e `127.0.0.1:8000`).

---
*Phase: 10-agp-question-panel-in-taqciti*
*Completed: 2026-10-30*
