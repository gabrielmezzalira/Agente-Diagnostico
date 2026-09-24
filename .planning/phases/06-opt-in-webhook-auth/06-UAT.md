---
status: diagnosed
phase: 06-opt-in-webhook-auth
source: [06-VERIFICATION.md]
started: 2026-09-24T14:28:40Z
updated: 2026-09-24T20:21:28Z
---

## Current Test

[testing complete]

## Tests

### 1. Extension envia o header quando a chave está configurada
expected: O request POST /webhook/extension carrega o header x-agente-key com o valor exatamente igual ao salvo em chrome.storage.local.
result: issue
reported: "O valor do header bateu certinho com o salvo, mas o campo 'Chave de autenticação' no popup apaga sozinho enquanto o usuário digita, antes de dar tempo de salvar. Causa raiz: o polling de status a cada 3s em popup.js (setInterval -> GET_STATE -> render()) reescreve extensionKeyInput.value com o valor salvo no state, mesmo com o campo em edição, apagando o que o usuário estava digitando. Usuário confirmou que é um problema real e urgente."
severity: major

### 2. Extension omite o header quando o campo está vazio
expected: Limpar o campo de chave, salvar de novo, disparar outro chunk real e inspecionar o mesmo POST /webhook/extension — o header x-agente-key deve estar AUSENTE da requisição (não vazio — ausente), reproduzindo byte-a-byte o comportamento atual sem a mudança desta fase.
result: pass

## Summary

total: 2
passed: 1
issues: 1
pending: 0
skipped: 0
blocked: 0

## Gaps

- gap_id: G-06-1
  truth: "O request POST /webhook/extension carrega o header x-agente-key com o valor exatamente igual ao salvo em chrome.storage.local."
  status: failed
  reason: "User reported: o campo 'Chave de autenticação (opcional)' no popup da extensão apaga o texto digitado sozinho, antes do usuário conseguir clicar em Salvar. O valor final salvo funciona (header confirmado correto), mas a UX de configurar a chave é falha e pode levar a salvar valor errado/vazio sem o usuário perceber."
  severity: major
  test: 1
  root_cause: "extension/popup.js render() (linhas 75-77) sobrescreve extensionKeyInput.value incondicionalmente a cada tick do setInterval de 3s (linhas 98-100), sem checar document.activeElement, sem debounce, sem flag de edição. state.extensionKey só é atualizado por SET_EXTENSION_KEY (background.js), disparado só ao clicar em Salvar — então qualquer digitação ainda não salva é sobrescrita pelo valor antigo (tipicamente vazio) no próximo tick. O mesmo defeito também afeta backendUrlInput (linha 76), não reportado no UAT mas com a mesma causa."
  artifacts:
    - path: "extension/popup.js"
      issue: "render() sobrescreve extensionKeyInput.value (e backendUrlInput.value) sem checar foco do elemento, mesmo com o usuário editando"
  missing:
    - "Pular a atribuição de .value em render() quando o campo está com document.activeElement (foco ativo)"
    - "Aplicar a mesma correção ao backendUrlInput, que compartilha o defeito"
    - "Fechar a brecha do Tab/clique (decisão do usuário em 2026-09-24, /gsd-plan-phase 6 --gaps): checar só o foco não basta, porque o campo perde o foco para o botão Salvar (mousedown do mouse ou Tab do teclado) ANTES do handler ler .value; se o tick de 3s cair nesse intervalo, o valor antigo é regravado e salvo com 'Salvo!'. Texto digitado e ainda não salvo nunca pode ser sobrescrito pelo polling, e é ele que o Salvar deve persistir"
  debug_session: .planning/debug/extension-key-field-clears-while-typing.md
