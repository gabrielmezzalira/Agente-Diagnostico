// extension/lib/configFieldGuard.js
//
// Regras puras de rastreio de edição dos campos de configuração do popup
// (G-06-1). Carregado como script clássico via
// <script src="lib/configFieldGuard.js"> imediatamente antes de popup.js —
// por isso só declara `function` no escopo de topo (scripts clássicos
// compartilham o mesmo escopo global; um `const`/`let` de topo com nome
// repetido em popup.js quebraria o carregamento). Nenhuma função aqui toca
// document, chrome, window ou qualquer armazenamento, e nenhuma recebe o
// valor digitado no campo — só contadores e booleanos.

// Estado inicial de um campo de configuração: nenhuma edição ainda nesta
// abertura do popup.
function createConfigFieldState() {
  return { editCount: 0 }
}

// Marca uma edição do usuário no campo (evento `input`). Devolve um objeto
// novo — nunca muta o argumento — para casar com o padrão do resto do popup
// e evitar aliasing acidental entre chamadas.
function recordConfigFieldEdit(fieldState) {
  return { editCount: fieldState.editCount + 1 }
}

// O re-render do polling de 3s só pode escrever no campo se o usuário ainda
// não editou nada nele nesta abertura do popup.
function canRenderOverwriteConfigField(fieldState) {
  return fieldState.editCount === 0
}

// "Carimbo" tirado no momento do clique em Salvar (antes do envio da
// mensagem) — usado para detectar se o usuário voltou a digitar depois do
// clique, antes da releitura pós-save.
function takeConfigFieldSnapshot(fieldState) {
  return fieldState.editCount
}

// A releitura pós-save só pode escrever no campo se não houve NENHUMA edição
// nova entre o clique em Salvar (quando o carimbo foi tirado) e a
// confirmação do background.
function canResyncConfigFieldAfterSave(fieldState, snapshot) {
  return fieldState.editCount === snapshot
}

// O save só é considerado confirmado sem erro de runtime (chrome.runtime.lastError)
// e com uma resposta explícita { ok: true } do background — nunca por
// ausência de erro sozinha.
function isConfigSaveConfirmed(response, lastError) {
  return !lastError && Boolean(response) && response.ok === true
}
