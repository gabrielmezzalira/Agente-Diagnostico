---
phase: 06-opt-in-webhook-auth
reviewed: 2026-09-24T18:00:00Z
depth: standard
files_reviewed: 7
files_reviewed_list:
  - extension/lib/configFieldGuard.js
  - extension/popup.html
  - extension/popup.js
  - extension/tests/configFieldGuard.test.js
  - extension/tests/extensionHarness.js
  - extension/tests/popupBackendUrlField.test.js
  - extension/tests/popupExtensionKeyField.test.js
findings:
  critical: 0
  warning: 2
  info: 4
  total: 6
status: issues_found
---

# Phase 6: Code Review Report (incremental — plano 06-02, gap closure G-06-1)

**Reviewed:** 2026-09-24T18:00:00Z
**Depth:** standard
**Files Reviewed:** 7
**Status:** issues_found

> Escopo: diff incremental desde `78853ef` (review anterior da fase, que cobriu o plano 06-01).
> O relatório do 06-01 continua disponível no histórico do git (`git show 78853ef:.planning/phases/06-opt-in-webhook-auth/06-REVIEW.md`).
> Nada de `backend/app/routers/webhook.py` nem `extension/background.js` foi re-revisado aqui.

## Summary

Revisei a correção do G-06-1: o helper puro `extension/lib/configFieldGuard.js`, a integração em
`extension/popup.js` (rastreio de edição por campo, carimbo no clique em Salvar e releitura pós-save),
a tag nova em `popup.html` e as três suítes `node:test` com o harness que sobe `background.js` e o
popup reais em contextos `vm` separados.

O núcleo da correção está certo. Tracei os cenários de corrida relevantes: (a) resposta de polling
pedida antes da primeira edição e entregue depois — bloqueada, porque `canRenderOverwriteConfigField`
é avaliado na entrega, não no envio; (b) polling em voo durante o save — bloqueado pelo mesmo motivo;
(c) redigitação entre o clique e a confirmação — bloqueada pelo carimbo (`takeConfigFieldSnapshot`
vs `canResyncConfigFieldAfterSave`); (d) ordem de processamento no background — as mensagens são
atendidas em ordem de chegada via `ensureState().then(...)`, então a releitura pós-save sempre vê o
valor já gravado. O helper realmente não toca DOM/`chrome`, não declara `const`/`let` de topo (sem
risco de colisão de escopo global com `popup.js`) e os testes confirmam a ordem das tags `<script>`.
Rodei as três suítes localmente (Node 24): 22/22 passam.

Não há bloqueador. Os dois avisos são sobre o mesmo efeito colateral do mecanismo escolhido: como o
campo fica "travado" para o polling pelo resto da abertura do popup após a primeira edição, o polling
deixa de funcionar como sinal visual de que um save **não** aconteceu. Isso piora dois caminhos que já
existiam (save não confirmado exibindo "Salvo!" e URL vazia ignorada em silêncio). O primeiro já está
registrado como DECISÃO EM ABERTO no `06-02-PLAN.md`; reporto porque a correção muda o impacto dele.
O XSS pré-existente via `innerHTML` em `renderQuestions` (IN-04 do review anterior) continua aberto e
não foi tocado por este plano.

## Warnings

### WR-01: "Salvo!" em save não confirmado — e agora o campo trava no valor não gravado

**File:** `extension/popup.js:160-164` e `extension/popup.js:172-176`

**Issue:** O callback de `SET_BACKEND_URL`/`SET_EXTENSION_KEY` mostra `'Salvo!'` incondicionalmente,
mesmo quando `isConfigSaveConfirmed(response, chrome.runtime.lastError)` é `false` (service worker
reiniciando, porta fechada, `{ ok: false }`). O predicado de confirmação foi criado justamente neste
plano, mas só é usado para decidir a releitura, não o feedback.

Antes do 06-02, um save que falhasse era "denunciado" em até 3 s: o polling reescrevia o campo com o
valor antigo. Agora, como `configInputEdits[stateKey].editCount > 0` pelo resto da abertura do popup,
o campo continua exibindo o texto digitado para sempre, junto com "Salvo!". O usuário sai convencido
de que gravou a chave (ou a URL) e só descobre o contrário quando os POSTs começarem a voltar 401
durante a reunião — exatamente o sintoma "achei que salvei e não salvei" que o G-06-1 queria eliminar.

**Fix:** usar o predicado que já existe para escolher o feedback (texto de erro é mudança de
comportamento pequena e reversível; se o time preferir manter só "Salvo!", no mínimo não exibi-lo em
falha):
```js
chrome.runtime.sendMessage({ type: 'SET_EXTENSION_KEY', key }, (response) => {
  const confirmed = isConfigSaveConfirmed(response, chrome.runtime.lastError)
  saveKeyBtn.textContent = confirmed ? 'Salvo!' : 'Erro — tente de novo'
  setTimeout(() => { saveKeyBtn.textContent = 'Salvar' }, 1500)
  if (confirmed) resyncConfigInputAfterSave('extensionKey', snapshot)
})
```
(Mesma alteração em `saveUrlBtn`.) Acrescentar um cenário no harness com `chrome.runtime.lastError`
definido — ver IN-02.

### WR-02: Apagar a URL e clicar em Salvar é ignorado em silêncio, e o campo fica vazio enquanto a URL antiga continua em uso

**File:** `extension/popup.js:156-158`; teste que trava o comportamento em
`extension/tests/popupBackendUrlField.test.js:76-88`

**Issue:** Com URL vazia, `saveUrlBtn` faz `return` antes de qualquer feedback (sem "Salvo!", sem
erro). Antes desta correção, o próximo tick do polling repunha a URL salva no campo, deixando claro que
nada mudou. Agora o campo fica permanentemente vazio (edição registrada, polling bloqueado), enquanto
o `background.js` continua mandando chunks e abrindo o WebSocket para a URL antiga. A tela mostra uma
configuração ("sem backend") diferente da que está de fato em vigor, e o teste
`'URL vazia continua sem ser salva; o polling não repõe a URL antiga no campo'` consolida essa
divergência como comportamento esperado (`assert.strictEqual(ext.el('backend-url').value, '')`).

**Fix:** no early return, restaurar o valor efetivo e liberar o campo para o polling, por exemplo:
```js
if (!url) {
  configInputEdits.backendUrl = createConfigFieldState()
  chrome.runtime.sendMessage({ type: 'GET_STATE' }, (s) => { if (s) backendUrlInput.value = s.backendUrl || '' })
  return
}
```
ou, no mínimo, dar um feedback explícito no botão ("URL obrigatória"). Ajustar a asserção do teste
para o comportamento escolhido. Como muda comportamento visível, é decisão do time — registrar como
DECISÃO EM ABERTO se não houver consenso.

## Info

### IN-01: `render(state)` não protege `state` indefinido, ao contrário de `resyncConfigInputAfterSave`

**File:** `extension/popup.js:33-39`, `extension/popup.js:109-110`, `extension/popup.js:128-133`

**Issue:** `resyncConfigInputAfterSave` checa `freshState &&` (linha 46), mas `render` — chamado a
cada 3 s — passa `state` direto para `renderConfigInputs`, que faz `state[stateKey]`. Se o
`GET_STATE` voltar `undefined` (`chrome.runtime.lastError` no despertar do service worker MV3), o tick
lança `TypeError` e ainda gera "Unchecked runtime.lastError" no console. É pré-existente
(`state.backendUrl` já quebrava antes), mas a nova função perpetua o padrão e deixa os dois caminhos
inconsistentes.

**Fix:** `function render(state) { if (chrome.runtime.lastError || !state) return; ... }`.

### IN-02: Nenhum teste de integração cobre o ramo "save não confirmado"

**File:** `extension/tests/extensionHarness.js:78-86`

**Issue:** O harness fixa `chrome.runtime.lastError = undefined` e sempre responde via o background
real (que sempre devolve `{ ok: true }` para os SETs). O ramo `isConfigSaveConfirmed === false` — sem
releitura, campo mantém o texto digitado — só é coberto pelo teste unitário do predicado, não pelo
fluxo ponta a ponta. É justamente o ramo do WR-01.

**Fix:** expor no harness algo como `failNext(type, { lastError, response })` que faz o próximo
`sendResponse` daquele tipo entregar `undefined`/`{ ok: false }` com `chrome.runtime.lastError`
definido durante o callback, e adicionar um cenário por campo.

### IN-03: Asserções incompletas em dois cenários

**File:** `extension/tests/popupExtensionKeyField.test.js:69-79` e
`extension/tests/popupExtensionKeyField.test.js:162-172`

**Issue:** O cenário (iii) só verifica `stored.extensionKey`, sem checar o valor do campo nem o
"Salvo!" (o (ii) checa os três). O cenário "redigitar durante o save" verifica que o campo mantém
`'abcd'`, mas não que o valor gravado foi `'abc'` (o lido no clique) — uma regressão que fizesse o
save ler o campo tarde demais passaria despercebida.

**Fix:** acrescentar `assert.strictEqual(ext.el('extension-key').value, 'chave-nova')` no (iii) e
`assert.strictEqual(ext.stored.extensionKey, 'abc')` no cenário de redigitação.

### IN-04: Suítes da extensão não estão ligadas a nenhum runner/CI

**File:** `extension/tests/*.test.js`

**Issue:** Não há `package.json` em `extension/` nem workflow em `.github/workflows` que rode estas
suítes; elas só rodam se alguém lembrar do comando manual em cada cabeçalho. Além disso,
`node --test extension/tests/` (passando o diretório) falha com `MODULE_NOT_FOUND` — o comando correto
é listar os arquivos ou usar glob (`node --test "extension/tests/*.test.js"`). Sem isso, a proteção
do G-06-1 pode regredir silenciosamente.

**Fix:** adicionar um `extension/package.json` mínimo com
`"scripts": { "test": "node --test \"tests/*.test.js\"" }` (zero dependências) e/ou um passo no CI.

---

_Reviewed: 2026-09-24T18:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
