// extension/tests/popupBackendUrlField.test.js
//
// Defeito gêmeo do G-06-1 no campo "URL do backend" (mesmo padrão de código
// do campo da chave, corrigido em popupExtensionKeyField.test.js): o
// polling de 3s do popup não pode apagar/sobrescrever o texto digitado antes
// de o usuário salvar.
//
// Rodar (a partir da raiz do repositório):
//   node --test extension/tests/popupBackendUrlField.test.js
//
// Estes cenários rodam extension/background.js e os scripts de
// extension/popup.html (extension/lib/configFieldGuard.js + extension/popup.js)
// reais, via extensionHarness.js — nenhum deles é mockado.

'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const { bootExtension } = require('./extensionHarness')

const BASE_STORAGE = { sessionId: 'sess-1', backendUrl: 'https://agente.example.app' }

test('abertura + digitação lenta: campo mostra a URL salva e não apaga o texto entre ticks', async () => {
  const ext = await bootExtension({ ...BASE_STORAGE })
  await ext.deliverAll()
  assert.strictEqual(ext.el('backend-url').value, 'https://agente.example.app')

  ext.type('backend-url', 'http://loc')
  ext.tick()
  await ext.deliverAll()
  assert.strictEqual(ext.el('backend-url').value, 'http://loc')

  ext.type('backend-url', 'http://localhost:80')
  ext.tick()
  await ext.deliverAll()
  assert.strictEqual(ext.el('backend-url').value, 'http://localhost:80')

  ext.type('backend-url', 'http://localhost:8000')
  ext.tick()
  await ext.deliverAll()
  assert.strictEqual(ext.el('backend-url').value, 'http://localhost:8000')
})

test('Tab/mousedown até Salvar grava a URL digitada e o campo mostra a URL normalizada', async () => {
  const ext = await bootExtension({ ...BASE_STORAGE })
  await ext.deliverAll()

  ext.type('backend-url', '  meu-backend.example.app/  ')
  ext.focus('save-url-btn')
  ext.tick()
  await ext.deliverAll()
  ext.click('save-url-btn')
  await ext.deliverAll()

  assert.strictEqual(ext.stored.backendUrl, 'https://meu-backend.example.app')
  assert.strictEqual(ext.el('backend-url').value, 'https://meu-backend.example.app')

  ext.sendTranscriptChunk('olá')
  await ext.deliverAll()
  const lastCall = ext.fetchCalls[ext.fetchCalls.length - 1]
  assert.strictEqual(lastCall.url, 'https://meu-backend.example.app/webhook/extension')
})

test('clicar fora do campo da URL não apaga o texto ainda não salvo', async () => {
  const ext = await bootExtension({ ...BASE_STORAGE })
  await ext.deliverAll()

  ext.type('backend-url', 'http://localhost:8000')
  ext.focus(null)
  ext.tick()
  await ext.deliverAll()

  assert.strictEqual(ext.el('backend-url').value, 'http://localhost:8000')
})

test('URL vazia continua sem ser salva; o campo é restaurado com a URL efetiva em uso e o polling volta a atualizá-lo', async () => {
  const ext = await bootExtension({ ...BASE_STORAGE })
  await ext.deliverAll()

  ext.type('backend-url', '')
  ext.click('save-url-btn')
  await ext.deliverAll()

  assert.ok(!ext.sentMessages.some((m) => m.type === 'SET_BACKEND_URL'))
  assert.strictEqual(ext.stored.backendUrl, 'https://agente.example.app')
  // O clique em Salvar com URL vazia libera o campo de novo (edição
  // resetada) e o repõe imediatamente com a URL em uso — a tela nunca deve
  // mostrar "sem backend" enquanto o background segue usando a URL antiga.
  assert.strictEqual(ext.el('backend-url').value, 'https://agente.example.app')

  // Como a edição foi resetada, o próximo tick do polling volta a atualizar
  // o campo normalmente (não fica mais travado).
  ext.tick()
  await ext.deliverAll()
  assert.strictEqual(ext.el('backend-url').value, 'https://agente.example.app')
})

test('save não confirmado (chrome.runtime.lastError) mostra erro e não relê o estado', async () => {
  const ext = await bootExtension({ ...BASE_STORAGE })
  await ext.deliverAll()
  ext.type('backend-url', 'http://novo-backend.example.app')
  ext.click('save-url-btn')
  ext.failNext('SET_BACKEND_URL', { lastError: { message: 'service worker reiniciando' } })
  await ext.deliverAll()
  assert.strictEqual(ext.el('save-url-btn').textContent, 'Erro — tente de novo')
  // Sem confirmação (lastError setado na entrega), não há releitura
  // pós-save — o campo mantém o texto digitado em vez de ser resincronizado
  // com o GET_STATE (é essa releitura que estaria ausente num cenário real
  // de porta fechada / service worker reiniciando).
  assert.strictEqual(ext.el('backend-url').value, 'http://novo-backend.example.app')
})

test('sem auto-save: digitar sozinho na URL nunca dispara SET_BACKEND_URL', async () => {
  const ext = await bootExtension({ ...BASE_STORAGE })
  await ext.deliverAll()

  ext.type('backend-url', 'rascunho.example.app')
  ext.tick()
  await ext.deliverAll()

  assert.ok(!ext.sentMessages.some((m) => m.type === 'SET_BACKEND_URL'))
  assert.strictEqual(ext.stored.backendUrl, 'https://agente.example.app')
})
