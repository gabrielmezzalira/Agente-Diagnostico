// extension/tests/popupExtensionKeyField.test.js
//
// Fecha o gap G-06-1 (06-UAT.md, teste 1): o polling de 3s do popup não pode
// apagar/sobrescrever o texto digitado no campo "Chave de autenticação
// (opcional)" antes de o usuário salvar — nem quando o foco já saiu do campo
// para o botão "Salvar" (Tab ou mousedown), nem depois de um clique fora.
//
// Rodar (a partir da raiz do repositório):
//   node --test extension/tests/popupExtensionKeyField.test.js
//
// Estes cenários rodam extension/background.js e os scripts de
// extension/popup.html (extension/lib/configFieldGuard.js + extension/popup.js)
// reais, via extensionHarness.js — nenhum deles é mockado.

'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const { popupScriptOrder, bootExtension } = require('./extensionHarness')

const BASE_STORAGE = { sessionId: 'sess-1', backendUrl: 'https://agente.example.app' }

// Devolve os headers do último fetch registrado; falha se não houve nenhum.
function lastFetchHeaders(ext) {
  if (ext.fetchCalls.length === 0) throw new Error('lastFetchHeaders: nenhum fetch foi registrado')
  return ext.fetchCalls[ext.fetchCalls.length - 1].init.headers
}

test('ordem de scripts: lib/configFieldGuard.js carrega antes de popup.js', () => {
  const order = popupScriptOrder()
  const guardIndex = order.indexOf('lib/configFieldGuard.js')
  const popupIndex = order.indexOf('popup.js')
  assert.ok(guardIndex !== -1, 'lib/configFieldGuard.js não está entre os scripts do popup.html')
  assert.ok(popupIndex !== -1, 'popup.js não está entre os scripts do popup.html')
  assert.ok(guardIndex < popupIndex, 'lib/configFieldGuard.js deve carregar antes de popup.js')
})

test('abertura: o campo mostra a chave já salva', async () => {
  const ext = await bootExtension({ ...BASE_STORAGE, extensionKey: 'chave-salva' })
  await ext.deliverAll()
  assert.strictEqual(ext.el('extension-key').value, 'chave-salva')
})

test('(i) digitação lenta não apaga o texto entre ticks do polling de 3s', async () => {
  const ext = await bootExtension({ ...BASE_STORAGE })
  await ext.deliverAll()
  for (const value of ['n', 'no', 'nov', 'nova-chave']) {
    ext.type('extension-key', value)
    ext.tick()
    await ext.deliverAll()
    assert.strictEqual(ext.el('extension-key').value, value)
  }
})

test('(ii) Tab até Salvar, esperar um tick e Enter grava o texto digitado', async () => {
  const ext = await bootExtension({ ...BASE_STORAGE })
  await ext.deliverAll()
  ext.type('extension-key', 'nova-chave')
  ext.focus('save-key-btn')
  ext.tick()
  await ext.deliverAll()
  ext.click('save-key-btn')
  await ext.deliverAll()
  assert.strictEqual(ext.stored.extensionKey, 'nova-chave')
  assert.strictEqual(ext.el('extension-key').value, 'nova-chave')
  assert.strictEqual(ext.el('save-key-btn').textContent, 'Salvo!')
})

test('(iii) mousedown até Salvar, esperar um tick e soltar (click) grava o texto digitado', async () => {
  const ext = await bootExtension({ ...BASE_STORAGE, extensionKey: 'chave-antiga' })
  await ext.deliverAll()
  ext.type('extension-key', 'chave-nova')
  ext.focus('save-key-btn')
  ext.tick()
  await ext.deliverAll()
  ext.click('save-key-btn')
  await ext.deliverAll()
  assert.strictEqual(ext.stored.extensionKey, 'chave-nova')
  assert.strictEqual(ext.el('extension-key').value, 'chave-nova')
  assert.strictEqual(ext.el('save-key-btn').textContent, 'Salvo!')
})

test('clicar fora do campo com texto não salvo não apaga o texto; Salvar posterior grava esse texto', async () => {
  const ext = await bootExtension({ ...BASE_STORAGE })
  await ext.deliverAll()
  ext.type('extension-key', 'digitada')
  ext.focus(null)
  ext.tick()
  await ext.deliverAll()
  ext.tick()
  await ext.deliverAll()
  assert.strictEqual(ext.el('extension-key').value, 'digitada')
  ext.click('save-key-btn')
  await ext.deliverAll()
  assert.strictEqual(ext.stored.extensionKey, 'digitada')
})

test('(iv) apagar a chave até vazio salva vazio e o header some do próximo POST', async () => {
  const ext = await bootExtension({ ...BASE_STORAGE, extensionKey: 'chave-antiga' })
  await ext.deliverAll()
  ext.type('extension-key', '')
  ext.tick()
  await ext.deliverAll()
  assert.strictEqual(ext.el('extension-key').value, '')
  ext.click('save-key-btn')
  await ext.deliverAll()
  assert.strictEqual(ext.stored.extensionKey, '')
  ext.sendTranscriptChunk('olá')
  await ext.deliverAll()
  assert.strictEqual(Object.prototype.hasOwnProperty.call(lastFetchHeaders(ext), 'x-agente-key'), false)
})

test('(v) com edição não salva, o polling continua atualizando status/sessão/perguntas', async () => {
  const ext = await bootExtension({ ...BASE_STORAGE })
  await ext.deliverAll()
  ext.type('extension-key', 'em-edicao')
  ext.pushQuestionViaWs({ id: 'q1', text: 'Qual o gargalo?', status: 'queued', block: 'negocio' })
  ext.tick()
  await ext.deliverAll()
  assert.strictEqual(ext.el('session-id-display').textContent, 'sess-1')
  assert.ok(ext.el('status-text').innerHTML.includes('Capturando'))
  assert.ok(ext.el('dot').classList.contains('active'))
  assert.strictEqual(ext.el('session-panel').style.display, 'block')
  assert.ok(ext.el('questions-list').innerHTML.includes('Qual o gargalo?'))
  assert.strictEqual(ext.el('extension-key').value, 'em-edicao')
})

test('(vi) todo POST /webhook/extension carrega x-agente-key com o último valor salvo', async () => {
  const ext = await bootExtension({ ...BASE_STORAGE, extensionKey: 'chave-salva' })
  await ext.deliverAll()
  ext.sendTranscriptChunk('primeiro chunk')
  await ext.deliverAll()
  assert.strictEqual(lastFetchHeaders(ext)['x-agente-key'], 'chave-salva')

  ext.type('extension-key', 'segredo')
  ext.tick()
  await ext.deliverAll()
  ext.type('extension-key', 'segredo-123')
  ext.focus('save-key-btn')
  ext.tick()
  await ext.deliverAll()
  ext.click('save-key-btn')
  await ext.deliverAll()

  ext.sendTranscriptChunk('segundo chunk')
  await ext.deliverAll()
  assert.strictEqual(lastFetchHeaders(ext)['x-agente-key'], 'segredo-123')
  assert.strictEqual(ext.fetchCalls[ext.fetchCalls.length - 1].url, 'https://agente.example.app/webhook/extension')
})

test('resposta atrasada do polling (pedida antes do save) não sobrescreve o valor salvo', async () => {
  const ext = await bootExtension({ ...BASE_STORAGE, extensionKey: 'chave-antiga' })
  await ext.deliverAll()
  ext.type('extension-key', 'chave-nova')
  ext.tick()
  const held = await ext.holdResponse('GET_STATE')
  ext.click('save-key-btn')
  await ext.deliverAll()
  held.callback(held.response)
  assert.strictEqual(ext.el('extension-key').value, 'chave-nova')
  assert.strictEqual(ext.stored.extensionKey, 'chave-nova')
})

test('redigitar durante o save preserva o texto digitado mais recente', async () => {
  const ext = await bootExtension({ ...BASE_STORAGE })
  await ext.deliverAll()
  ext.type('extension-key', 'abc')
  ext.click('save-key-btn')
  ext.type('extension-key', 'abcd')
  await ext.deliverAll()
  ext.tick()
  await ext.deliverAll()
  assert.strictEqual(ext.el('extension-key').value, 'abcd')
  // O valor gravado deve ser o lido no momento do clique ('abc') — se o save
  // lesse o campo tarde demais (já com 'abcd'), essa asserção pegaria a
  // regressão mesmo com o campo mostrando o texto certo.
  assert.strictEqual(ext.stored.extensionKey, 'abc')
})

test('save não confirmado (chrome.runtime.lastError) mostra erro e não relê o estado', async () => {
  const ext = await bootExtension({ ...BASE_STORAGE, extensionKey: 'chave-antiga' })
  await ext.deliverAll()
  ext.type('extension-key', 'chave-nova')
  ext.click('save-key-btn')
  ext.failNext('SET_EXTENSION_KEY', { lastError: { message: 'service worker reiniciando' } })
  await ext.deliverAll()
  assert.strictEqual(ext.el('save-key-btn').textContent, 'Erro — tente de novo')
  // Sem confirmação (lastError setado na entrega), não há releitura
  // pós-save — o campo mantém o texto digitado em vez de ser resincronizado
  // com o GET_STATE (é essa releitura que estaria ausente num cenário real
  // de porta fechada / service worker reiniciando).
  assert.strictEqual(ext.el('extension-key').value, 'chave-nova')
})

test('sem auto-save: digitar sozinho nunca dispara SET_EXTENSION_KEY nem grava no storage', async () => {
  const ext = await bootExtension({ ...BASE_STORAGE, extensionKey: 'chave-salva' })
  await ext.deliverAll()
  ext.type('extension-key', 'rascunho')
  ext.tick()
  await ext.deliverAll()
  assert.ok(!ext.sentMessages.some((m) => m.type === 'SET_EXTENSION_KEY'))
  assert.strictEqual(ext.stored.extensionKey, 'chave-salva')
})
