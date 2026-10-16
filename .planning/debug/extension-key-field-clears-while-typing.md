---
status: resolved
trigger: "O valor do header bateu certinho com o salvo, mas o campo 'Chave de autenticação' no popup apaga sozinho enquanto o usuário digita, antes de dar tempo de salvar. Causa raiz: o polling de status a cada 3s em popup.js (setInterval -> GET_STATE -> render()) reescreve extensionKeyInput.value com o valor salvo no state, mesmo com o campo em edição, apagando o que o usuário estava digitando. Usuário confirmou que é um problema real e urgente."
created: 2026-09-24T00:00:00Z
updated: 2026-09-24T00:00:00Z
---

## Current Focus

hypothesis: CONFIRMED — o polling `setInterval` de 3s em `extension/popup.js` chama `render(state)`, que sobrescreve `extensionKeyInput.value = state.extensionKey || ''` incondicionalmente (sem checar foco/edição), apagando o texto que o usuário está digitando antes de clicar em "Salvar". Mesmo defeito atinge `backendUrlInput` na linha imediatamente acima (linha 76), por ser o mesmo padrão de código.
test: leitura completa e direta de extension/popup.js (141 linhas), extension/popup.html (259 linhas) e extension/background.js (139 linhas) — busca por qualquer guarda de foco, debounce, ou flag "usuário editando" que pudesse mitigar a sobrescrita.
expecting: se a hipótese for verdadeira, popup.js NÃO deve conter nenhum `document.activeElement` check, nenhum debounce/throttle, nenhuma flag de edição antes da atribuição de `.value` em `render()`.
next_action: nenhuma — goal é find_root_cause_only (fluxo de UAT). Fix será planejado em /gsd-plan-phase --gaps.

## Symptoms

expected: O request POST /webhook/extension carrega o header x-agente-key com o valor exatamente igual ao salvo em chrome.storage.local. Implícito: o usuário consegue digitar e salvar essa chave no popup sem o campo se apagar sozinho no meio do processo.
actual: Ao digitar no campo "Chave de autenticação (opcional)" (input#extension-key em extension/popup.html), o conteúdo digitado é apagado/sobrescrito automaticamente antes que o usuário consiga clicar em "Salvar", em alguns casos. O usuário só conseguiu salvar digitando rápido ou colando o valor. O header em si, quando efetivamente salvo, bate certinho com o valor persistido (Teste 1 do UAT passou nesse aspecto específico).
errors: Nenhuma mensagem de erro — comportamento silencioso (campo perde o texto digitado sem feedback).
reproduction: Teste 1 do UAT (.planning/phases/06-opt-in-webhook-auth/06-UAT.md). Abrir o popup da extensão (extension/popup.html), clicar no campo "Chave de autenticação (opcional)" (input#extension-key) e digitar um valor devagar (mais de ~3 segundos) sem clicar em "Salvar".
started: Descoberto durante o UAT da Fase 06 (2026-09-24), na verificação da feature de header opcional x-agente-key (opt-in webhook auth).

## Eliminated

(nenhuma hipótese eliminada — a hipótese de partida foi confirmada diretamente por leitura de código, sem necessidade de hipóteses alternativas)

## Evidence

- timestamp: 2026-09-24
  checked: extension/popup.js linhas 94-100 (bloco de inicialização e polling)
  found: |
    ```js
    // Carrega estado atual ao abrir o popup
    chrome.runtime.sendMessage({ type: 'GET_STATE' }, render)

    // Atualiza perguntas a cada 3s enquanto o popup estiver aberto
    setInterval(() => {
      chrome.runtime.sendMessage({ type: 'GET_STATE' }, render)
    }, 3000)
    ```
    Confirma que existe, de fato, um `setInterval` de 3000ms que chama `GET_STATE` -> `render` repetidamente enquanto o popup estiver aberto, além da chamada inicial ao abrir.
  implication: A hipótese de que existe um polling de 3s chamando render() é verdadeira e incondicional — não há nenhuma condição de guarda antes de disparar o request.

- timestamp: 2026-09-24
  checked: extension/popup.js linhas 75-92 (função `render`)
  found: |
    ```js
    function render(state) {
      backendUrlInput.value = state.backendUrl || ''
      extensionKeyInput.value = state.extensionKey || ''
      ...
    }
    ```
  implication: `render()` sobrescreve `extensionKeyInput.value` de forma incondicional a cada chamada — não há checagem de `document.activeElement`, não há comparação com o valor atual do campo, não há flag de "usuário está editando". A cada tick do polling (a cada 3s) e também na chamada inicial, o campo é resetado para `state.extensionKey`. O mesmo padrão idêntico atinge `backendUrlInput` (linha 76), então o campo de URL do backend tem exatamente o mesmo defeito estrutural, ainda que não tenha sido reportado no UAT (provavelmente por ser digitado/colado mais rápido ou por já vir pré-preenchido).

- timestamp: 2026-09-24
  checked: extension/background.js linhas 105-110 (handler `SET_EXTENSION_KEY`) e linha 3-8 (estado inicial `state.extensionKey`)
  found: |
    ```js
    let state = { sessionId: null, backendUrl: '...', questions: [], extensionKey: '' }
    ...
    if (msg.type === 'SET_EXTENSION_KEY') {
      state.extensionKey = msg.key || ''
      chrome.storage.local.set({ extensionKey: state.extensionKey })
      sendResponse({ ok: true })
      return
    }
    ```
  implication: `state.extensionKey` no service worker SÓ é atualizado quando a mensagem `SET_EXTENSION_KEY` é recebida — e essa mensagem só é enviada pelo handler de clique do botão "Salvar" (`saveKeyBtn`, popup.js linha 134-140). Enquanto o usuário digita e não clica em Salvar, `state.extensionKey` permanece com o valor antigo (tipicamente string vazia, no caso de configuração pela primeira vez, conforme o default em `background.js` linha 7). Isso confirma o mecanismo exato do bug: o polling busca esse valor "antigo" via `GET_STATE` e o `render()` o escreve de volta no campo, apagando o que o usuário digitou.

- timestamp: 2026-09-24
  checked: extension/popup.js — arquivo inteiro (141 linhas), busca por qualquer mitigação
  found: Nenhuma ocorrência de `activeElement`, `focus`, `blur`, `debounce`, `isEditing`, `editing`, ou qualquer variável de estado local que rastreie "usuário está digitando neste campo agora". O único listener no campo `extensionKeyInput` é o `click` do `saveKeyBtn` (linha 134-140), que lê `extensionKeyInput.value` no momento do clique — não há listener de `input`/`keydown` no próprio campo que pudesse suspender o polling ou marcar o campo como "sujo".
  implication: Confirma explicitamente a segunda parte da hipótese do code review: não existe NENHUMA proteção existente (nem checagem de foco, nem debounce, nem flag de edição) que mitigasse a sobrescrita. O bug é 100% real e sem salvaguarda.

- timestamp: 2026-09-24
  checked: extension/popup.html linhas 244-250 (markup do campo)
  found: |
    ```html
    <div class="section">
      <label>Chave de autenticação (opcional)</label>
      <div class="manual-row">
        <input type="password" id="extension-key" placeholder="deixe em branco para não usar" />
        <button id="save-key-btn">Salvar</button>
      </div>
    </div>
    ```
  implication: Confirma que `input#extension-key` é o elemento `extensionKeyInput` referenciado em popup.js (linha 15: `document.getElementById('extension-key')`) e que não há atributo especial (ex: `readonly` condicional, `data-editing`) que interaja com o polling. O comportamento é puramente controlado pelo JS descrito acima.

- timestamp: 2026-09-24
  checked: .planning/phases/06-opt-in-webhook-auth/06-UAT.md e .planning/STATE.md
  found: UAT Teste 1 (linhas 15-19) registra `result: issue`, `severity: major`, com o texto do usuário idêntico ao trigger recebido. Gap G-06-1 (linhas 36-43) já documenta a mesma causa raiz apontada pelo code review anterior, mas explicitamente marcada como não confirmada por investigação de debug formal até este momento. STATE.md confirma D-02 da Fase 06: "campo da extensao usa input type=password e chrome.storage.local (nunca .sync)" — nada relacionado a esse bug de polling foi decidido ou mitigado nas decisões da fase.
  implication: Não há decisão de arquitetura registrada que justifique a ausência da proteção — é uma lacuna de implementação, não uma escolha deliberada. Nenhum debug anterior sobre esse tema.

## Resolution

root_cause: "extension/popup.js linhas 98-100: um `setInterval(() => { chrome.runtime.sendMessage({ type: 'GET_STATE' }, render) }, 3000)` chama `render(state)` a cada 3 segundos (código). Combinado com `render()` (linhas 75-77) que faz `extensionKeyInput.value = state.extensionKey || ''` de forma incondicional, sem checar se o elemento está com foco ou em edição (código/lacuna de implementação — falta de guarda). Como `state.extensionKey` no service worker (background.js) só é atualizado pelo handler `SET_EXTENSION_KEY`, disparado exclusivamente pelo clique em 'Salvar' (popup.js linhas 134-140), qualquer digitação do usuário que não termine com um clique em Salvar antes do próximo tick do polling é sobrescrita pelo valor antigo (tipicamente vazio) vindo do state. Categoria única (code) é suficiente — não há componente de config/ambiente/dado contribuindo; o AND-gate é 'não': a falha ocorre com uma única condição (usuário digita por mais tempo do que o intervalo restante até o próximo tick de 3s), sem necessidade de nenhuma outra condição simultânea."
fix: "Corrigido em cdb5558 (campo da chave) e 7c9f44e (campo da URL do backend): render() deixa de sobrescrever o campo enquanto ele está em edição."
verification: ""
files_changed: []
