---
phase: 06-opt-in-webhook-auth
plan: 02
subsystem: extension
tags: [chrome-extension, popup, race-condition, node-test, vm, gap-closure]

# Dependency graph
requires:
  - phase: 06-opt-in-webhook-auth
    provides: "extension/popup.js, extension/popup.html e extension/background.js no estado deixado pelo commit e3b9571 da 06-01 (campo da chave, header condicional x-agente-key)"
provides:
  - "extension/lib/configFieldGuard.js — helper puro de rastreio de edição por campo de configuração (6 funções)"
  - "extension/popup.js — render() e os listeners de Salvar (chave e URL) param de sobrescrever campos em edição; releitura pós-save só com save confirmado e sem edição nova"
  - "extension/tests/extensionHarness.js — primeiro harness node:test da extensão: roda background.js + popup.html/popup.js reais sobre um chrome falso compartilhado (dois vm contexts)"
  - "3 arquivos de teste (22 cenários) que fecham G-06-1 para os campos 'Chave de autenticação' e 'URL do backend'"
affects: ["06-VALIDATION", "07-taqciti-integration"]

# Actuals (#2632)
actuals:
  tokens: 6600
  tasks: 2
  commits: 2

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Rastreio de edição por campo (editCount) em vez de guarda de foco — sobrevive a Tab/mousedown até o botão Salvar e a clique fora, que uma guarda de document.activeElement não fecharia"
    - "Harness de extensão via node:vm: dois vm.createContext (background e popup) compartilhando um único objeto chrome fake — replica o isolamento de realm real do Chrome (service worker vs. popup) e evita mockar o próprio código sob teste"
    - "Carimbo (snapshot) tirado no clique em Salvar + releitura condicional pós-confirmação — evita tanto sobrescrever edição em andamento quanto perder uma resposta de polling atrasada"

key-files:
  created:
    - extension/lib/configFieldGuard.js
    - extension/tests/extensionHarness.js
    - extension/tests/popupExtensionKeyField.test.js
    - extension/tests/popupBackendUrlField.test.js
    - extension/tests/configFieldGuard.test.js
  modified:
    - extension/popup.html
    - extension/popup.js

key-decisions:
  - "Mecanismo escolhido nesta sessão (substitui o 06-02 anterior, commit 3f0d1e8): rastreio de edição por campo + releitura pós-save confirmado — não guarda de foco. A guarda de foco não fecha o G-06-1 porque o foco sai do campo para o botão Salvar (Tab ou mousedown) antes do clique/Enter, e um tick do polling nessa janela reescreveria o valor antigo mesmo com uma checagem de document.activeElement"
  - "extension/lib/configFieldGuard.js só declara `function` no topo (nenhum const/let/var) — script clássico carregado por <script src> antes de popup.js; ambos compartilham o mesmo escopo global do popup, e um nome duplicado quebraria o carregamento"
  - "O helper nunca recebe o valor digitado — só contadores (editCount) e booleanos — para não abrir um caminho novo por onde a chave pudesse vazar"
  - "extensionHarness.js e popupExtensionKeyField.test.js foram compactados (sem mudar comportamento) para ficar abaixo de 200 linhas, atendendo ao critério de aceite da Task 2 e à regra do CLAUDE.md sobre tamanho de arquivo"

patterns-established:
  - "Harness node:vm reutilizável para testar a extensão Chrome inteira (popup + service worker) sem navegador real — extensível para futuros testes de extension/content_app.js e extension/content_meet.js"

requirements-completed: [TAQ-03]

coverage:
  - id: D1
    description: "(i) Digitar devagar no campo da chave, atravessando vários ticks do polling de 3s, não apaga nem altera o texto digitado"
    requirement: "TAQ-03"
    verification:
      - kind: integration
        ref: "extension/tests/popupExtensionKeyField.test.js#(i) digitação lenta não apaga o texto entre ticks do polling de 3s"
        status: pass
    human_judgment: false
  - id: D2
    description: "(ii) Tab até Salvar (foco sai do campo), um tick do polling acontece, Enter grava exatamente o texto digitado"
    requirement: "TAQ-03"
    verification:
      - kind: integration
        ref: "extension/tests/popupExtensionKeyField.test.js#(ii) Tab até Salvar, esperar um tick e Enter grava o texto digitado"
        status: pass
    human_judgment: false
  - id: D3
    description: "(iii) mousedown sobre Salvar (tira o foco), um tick acontece antes de soltar (click), grava exatamente o texto digitado"
    requirement: "TAQ-03"
    verification:
      - kind: integration
        ref: "extension/tests/popupExtensionKeyField.test.js#(iii) mousedown até Salvar, esperar um tick e soltar (click) grava o texto digitado"
        status: pass
    human_judgment: false
  - id: D4
    description: "Clicar fora do campo com texto não salvo e esperar vários ticks não apaga o texto; um Salvar posterior grava esse texto"
    requirement: "TAQ-03"
    verification:
      - kind: integration
        ref: "extension/tests/popupExtensionKeyField.test.js#clicar fora do campo com texto não salvo não apaga o texto; Salvar posterior grava esse texto"
        status: pass
    human_judgment: false
  - id: D5
    description: "(iv) Apagar a chave até vazio e salvar funciona: o polling não repõe a chave antiga, o valor vazio é gravado e o próximo POST sai sem o header x-agente-key (ausente, não vazio)"
    requirement: "TAQ-03"
    verification:
      - kind: integration
        ref: "extension/tests/popupExtensionKeyField.test.js#(iv) apagar a chave até vazio salva vazio e o header some do próximo POST"
        status: pass
    human_judgment: false
  - id: D6
    description: "(v) Com um campo em edição não salva, o polling de 3s continua atualizando status, painel/ID da sessão e a lista de perguntas (inclusive pergunta nova via WebSocket)"
    requirement: "TAQ-03"
    verification:
      - kind: integration
        ref: "extension/tests/popupExtensionKeyField.test.js#(v) com edição não salva, o polling continua atualizando status/sessão/perguntas"
        status: pass
    human_judgment: false
  - id: D7
    description: "(vi) Todo POST /webhook/extension carrega x-agente-key com o último valor salvo (antes e depois de trocar a chave); header ausente quando a chave salva é vazia; background.js byte-idêntico ao commit e3b9571 da 06-01"
    requirement: "TAQ-03"
    verification:
      - kind: integration
        ref: "extension/tests/popupExtensionKeyField.test.js#(vi) todo POST /webhook/extension carrega x-agente-key com o último valor salvo"
        status: pass
      - kind: unit
        ref: "git diff --quiet e3b9571 -- extension/background.js (BACKGROUND_UNCHANGED_OK)"
        status: pass
    human_judgment: false
  - id: D8
    description: "Ao abrir o popup os campos mostram os valores salvos; depois de um Salvar confirmado o campo mostra o valor salvo (exceto se o usuário voltou a digitar); nenhuma resposta de polling atrasada reescreve o valor recém-salvo"
    requirement: "TAQ-03"
    verification:
      - kind: integration
        ref: "extension/tests/popupExtensionKeyField.test.js#abertura: o campo mostra a chave já salva"
        status: pass
      - kind: integration
        ref: "extension/tests/popupExtensionKeyField.test.js#resposta atrasada do polling (pedida antes do save) não sobrescreve o valor salvo"
        status: pass
      - kind: integration
        ref: "extension/tests/popupExtensionKeyField.test.js#redigitar durante o save preserva o texto digitado mais recente"
        status: pass
    human_judgment: false
  - id: D9
    description: "O campo 'URL do backend' tem a mesma proteção: digitação lenta, Tab/mousedown/clique fora não apagam o texto; Salvar grava o texto normalizado; URL vazia continua sem ser salva"
    requirement: "TAQ-03"
    verification:
      - kind: integration
        ref: "extension/tests/popupBackendUrlField.test.js (5 cenários — abertura+digitação lenta, Tab/mousedown->Salvar, clique fora, URL vazia, sem auto-save)"
        status: pass
    human_judgment: false

duration: ~35min
completed: 2026-09-24
status: complete
---

# Phase 6 Plan 2: Proteção do popup contra o polling de 3s (G-06-1) Summary

**Rastreio de edição por campo (não guarda de foco) em `extension/popup.js`, com as regras isoladas em `extension/lib/configFieldGuard.js` e um primeiro harness `node:test`/`node:vm` que roda `background.js` e os scripts do popup reais — fecha G-06-1 para os campos "Chave de autenticação" e "URL do backend", sem regressão em TAQ-03.**

## Performance
- **Duration:** ~35min
- **Started:** 2026-09-24T22:30:00Z (aprox.)
- **Completed:** 2026-09-24T23:06:00Z
- **Tasks:** 2 (Task 1 tracer/TDD + Task 2 auto/TDD)
- **Files modified:** 7 (2 modificados, 5 novos)

## Accomplishments
- `extension/lib/configFieldGuard.js` criado: seis funções puras (`createConfigFieldState`, `recordConfigFieldEdit`, `canRenderOverwriteConfigField`, `takeConfigFieldSnapshot`, `canResyncConfigFieldAfterSave`, `isConfigSaveConfirmed`) que nunca tocam DOM/chrome/storage e nunca recebem o valor digitado — só contadores e booleanos.
- `extension/popup.js`: `render()` parou de sobrescrever incondicionalmente os campos "Chave de autenticação" e "URL do backend"; a escrita agora passa por `renderConfigInputs(state)`, que só atualiza um campo se o usuário não o editou nesta abertura do popup. Os dois listeners de "Salvar" tiram um carimbo (`takeConfigFieldSnapshot`) antes do envio e, após a confirmação do background (`isConfigSaveConfirmed`), releem o estado (`resyncConfigInputAfterSave`) e só reescrevem o campo se não houve edição nova.
- `extension/tests/extensionHarness.js` criado: primeiro harness automatizado da extensão Chrome — sobe `extension/background.js` real num `vm.createContext` e os scripts de `extension/popup.html` (na ordem do HTML) real em outro, compartilhando um único `chrome` falso entre os dois "realms", exatamente como Chrome isola service worker e popup de verdade.
- 22 cenários automatizados em 3 arquivos de teste (`configFieldGuard.test.js`, `popupExtensionKeyField.test.js`, `popupBackendUrlField.test.js`), todos verdes, cobrindo os 9 `must_haves.truths` do plano — inclusive a janela silenciosa de Tab/mousedown até o "Salvar" que a variante "guarda de foco" do plano anterior não fechava.
- `extension/background.js` permanece byte-idêntico ao commit `e3b9571` da 06-01 (confirmado por `git diff --quiet` nas duas tasks) — nenhuma regressão em TAQ-03.

## Task Commits

Cada task foi commitada atomicamente:

1. **Task 1 (TRACER, TDD): campo "Chave de autenticação" protegido do polling ponta a ponta** - `cdb5558` (fix)
2. **Task 2 (TDD): mesma proteção no campo "URL do backend" + testes unitários das regras puras** - `7c9f44e` (fix)

**Plan metadata:** commit final de documentação será registrado após este SUMMARY.

_Nota: `workflow.tdd_mode` está `false` neste projeto (gate de hard-halt do RED desativado), então cada task gerou um único commit no fim do ciclo RED→GREEN, conforme o contrato de escopo de commit do plano — não dois/três commits separados de RED/GREEN/REFACTOR._

### Saída RED — Task 1 (antes da correção, contra o código herdado da 06-01)

```
✖ ordem de scripts: lib/configFieldGuard.js carrega antes de popup.js
✔ abertura: o campo mostra a chave já salva
✖ (i) digitação lenta não apaga o texto entre ticks do polling de 3s
✖ (ii) Tab até Salvar, esperar um tick e Enter grava o texto digitado
✖ (iii) mousedown até Salvar, esperar um tick e soltar (click) grava o texto digitado
✖ clicar fora do campo com texto não salvo não apaga o texto; Salvar posterior grava esse texto
✖ (iv) apagar a chave até vazio salva vazio e o header some do próximo POST
✖ (v) com edição não salva, o polling continua atualizando status/sessão/perguntas
✖ (vi) todo POST /webhook/extension carrega x-agente-key com o último valor salvo
✖ resposta atrasada do polling (pedida antes do save) não sobrescreve o valor salvo
✖ redigitar durante o save preserva o texto digitado mais recente
✔ sem auto-save: digitar sozinho nunca dispara SET_EXTENSION_KEY nem grava no storage
ℹ tests 12 · pass 2 · fail 10
```
Exatamente o RED previsto no plano (passam só "abertura" e "sem auto-save", que são de não-regressão).

### Saída RED — Task 2 (antes da correção, contra o estado deixado pela Task 1)

```
✖ abertura + digitação lenta: campo mostra a URL salva e não apaga o texto entre ticks
✖ Tab/mousedown até Salvar grava a URL digitada e o campo mostra a URL normalizada
✖ clicar fora do campo da URL não apaga o texto ainda não salvo
✖ URL vazia continua sem ser salva; o polling não repõe a URL antiga no campo
✔ sem auto-save: digitar sozinho na URL nunca dispara SET_BACKEND_URL
ℹ tests 5 · pass 1 · fail 4
```
Defeito gêmeo confirmado no campo URL, exatamente como previsto.

### Saída GREEN final (as três suítes juntas)

```
node --test extension/tests/configFieldGuard.test.js extension/tests/popupExtensionKeyField.test.js extension/tests/popupBackendUrlField.test.js
ℹ tests 22
ℹ pass 22
ℹ fail 0
```

### Resultado de cada gate do `<verify>`

| Gate | Resultado |
|------|-----------|
| `node --test` (3 arquivos, 22 cenários) | `ℹ fail 0` — PASS |
| `RENDER_KEY_GUARDED_OK` (Task 1) | impresso — PASS |
| `RENDER_WIRED_OK` (Task 1) | impresso — PASS |
| `BACKGROUND_UNCHANGED_OK` (Tasks 1 e 2) | impresso nas duas tasks — PASS |
| `RENDER_FULLY_GUARDED_OK` (Task 2) | impresso — PASS |
| `NO_SECRET_SIDE_CHANNEL_OK` (Task 2) | impresso, nenhuma linha de log/storage lateral encontrada — PASS |
| `KEY_FIELD_MASKED_OK` (Task 2) | impresso, `type="password" id="extension-key"` presente — PASS |
| `POPUP_UNDER_200_LINES_OK` (Task 2) | impresso, `extension/popup.js` com 177 linhas — PASS |
| Regressão backend `pytest tests/test_webhook_auth.py -x -q` | `4 passed` — PASS |
| Cada arquivo de `extension/tests/` com menos de 200 linhas (acceptance criteria) | 73 / 199 / 100 / 182 linhas — PASS |

## Files Created/Modified
- `extension/lib/configFieldGuard.js` - (novo) 6 funções puras de rastreio de edição, script clássico sem const/let de topo
- `extension/tests/extensionHarness.js` - (novo) harness node:vm que roda background.js + popup.html/popup.js reais
- `extension/tests/popupExtensionKeyField.test.js` - (novo) 12 cenários do campo da chave (ordem de scripts, i-vi, clique fora, resposta atrasada, redigitação, abertura, sem auto-save)
- `extension/tests/popupBackendUrlField.test.js` - (novo) 5 cenários do campo URL do backend
- `extension/tests/configFieldGuard.test.js` - (novo) 5 testes unitários das seis funções puras, num vm.createContext({}) vazio
- `extension/popup.html` - (alterado) uma linha: `<script src="lib/configFieldGuard.js"></script>` imediatamente antes de `popup.js`
- `extension/popup.js` - (alterado) `configInputs`/`configInputEdits`, `renderConfigInputs`, `resyncConfigInputAfterSave`; `render()` e os dois listeners de Salvar passam a usar o rastreio de edição

## Decisions Made
- Mecanismo de rastreio de edição por campo (não guarda de foco) — decisão já tomada na sessão de replanejamento (registrada no PLAN.md, seção 6, "Já decidido nesta sessão"); este plano só a implementou.
- `kind: integration` usado nas entradas de `coverage` em vez de `e2e`, porque os cenários rodam via `node:vm` (não um Chrome real) — a UAT manual do `<human-check>` da Task 2 é o passo `e2e`/`manual_procedural` real, ainda pendente no fim da fase.

## Deviations from Plan

None - plan executado exatamente como escrito. Os dois arquivos que ficariam acima de 200 linhas na primeira escrita (`extension/tests/extensionHarness.js` e `extension/tests/popupExtensionKeyField.test.js`) foram compactados ainda dentro da própria Task 2, antes do commit — não é uma mudança de comportamento nem uma correção de bug, é o próprio critério de aceite da task sendo satisfeito (não conta como desvio de Regra 1-4; é execução normal do passo "rodar os gates do `<verify>`").

## Issues Encountered
None.

## User Setup Required

None - nenhuma configuração de serviço externo é necessária para este plano.

**Importante:** o roteiro `<human-check>` da Task 2 (UAT manual no Chrome real, reproduzindo o teste 1 do UAT e revalidando o teste 2) ainda não foi executado por um humano — fica registrado para o fim da fase, junto com o roteiro já pendente da 06-01 (D5 do 06-01-SUMMARY.md). `EXTENSION_SHARED_KEY` continua sem ser setada em produção (D-03, decisão em aberto do time, fora do escopo deste plano).

## Next Phase Readiness
- G-06-1 fechado por testes automatizados que rodam o `background.js` e os scripts do popup reais — a extensão está pronta para a UAT manual de fim de fase (roteiro dos 8 passos do `<human-check>` da Task 2).
- A linha "extension manual-only" do `06-VALIDATION.md` ficou desatualizada (agora há testes automatizados da extensão) — atualizar via `/gsd-validate-phase 06`, não é tarefa deste executor.
- `extension/tests/extensionHarness.js` fica disponível como base reutilizável para testar `extension/content_app.js` e `extension/content_meet.js` em fases futuras, se necessário.
- Fases 7-8 (integração Taqciti) não dependem deste plano, mas a extensão custom (que este plano corrige) segue viva até o cutover da Fase 9.

## Self-Check: PASSED

- FOUND: extension/lib/configFieldGuard.js
- FOUND: extension/tests/extensionHarness.js
- FOUND: extension/tests/popupExtensionKeyField.test.js
- FOUND: extension/tests/popupBackendUrlField.test.js
- FOUND: extension/tests/configFieldGuard.test.js
- FOUND: extension/popup.html contém `<script src="lib/configFieldGuard.js"></script>`
- FOUND: extension/popup.js contém `renderConfigInputs`, `resyncConfigInputAfterSave`, `configInputs.backendUrl`, `configInputs.extensionKey`
- FOUND commit cdb5558 (Task 1)
- FOUND commit 7c9f44e (Task 2)
- CONFIRMED: `git diff --quiet e3b9571 -- extension/background.js` — background.js byte-idêntico
- CONFIRMED: `node --test` das 3 suítes — 22/22 pass
- CONFIRMED: `pytest tests/test_webhook_auth.py -x -q` — 4 passed

---
*Phase: 06-opt-in-webhook-auth*
*Completed: 2026-09-24*
