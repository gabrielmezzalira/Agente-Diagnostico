// extension/tests/extensionHarness.js
//
// Emula o runtime da extensão Chrome (service worker + popup) para os testes
// deste plano (06-02, G-06-1) — sem lógica de produção, só simula `chrome`,
// `document` e as pontes de rede (fetch, WebSocket) para que
// extension/background.js e os scripts do popup.html rodem como código real.
//
// Cuidado de realm: background.js e o popup rodam em vm contexts separados
// (como no Chrome real) — objetos criados DENTRO desses contextos têm
// protótipos de outro realm. Compare só primitivos e use
// Object.prototype.hasOwnProperty.call(...) para ausência de chave; nunca
// assert.deepStrictEqual entre objeto do vm e literal do teste.

'use strict'

const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')

const EXTENSION_ROOT = path.join(__dirname, '..')

// Lê popup.html e devolve os `src` das tags <script>, na ordem do documento.
// Lança erro se alguma tag não tiver `src` (script inline, proibido pela
// CSP padrão do Manifest V3 para páginas da extensão).
function popupScriptOrder() {
  const html = fs.readFileSync(path.join(EXTENSION_ROOT, 'popup.html'), 'utf8')
  const pattern = /<script\b([^>]*)>/gi
  const srcs = []
  let match
  while ((match = pattern.exec(html)) !== null) {
    const attrs = match[1]
    const srcMatch = attrs.match(/\bsrc\s*=\s*"([^"]*)"/i) || attrs.match(/\bsrc\s*=\s*'([^']*)'/i)
    if (!srcMatch) {
      throw new Error(`popupScriptOrder: <script> sem src (inline, proibido pela CSP do MV3): <script${attrs}>`)
    }
    srcs.push(srcMatch[1])
  }
  return srcs
}

function createFakeElement(id) {
  const listeners = Object.create(null)
  const classSet = new Set()
  return {
    id, value: '', textContent: '', innerHTML: '', disabled: false, style: {}, dataset: {},
    classList: { add: (n) => classSet.add(n), remove: (n) => classSet.delete(n), contains: (n) => classSet.has(n) },
    addEventListener(type, fn) { (listeners[type] = listeners[type] || []).push(fn) },
    dispatch(type) { (listeners[type] || []).forEach((fn) => fn({ type, target: this })) },
    querySelectorAll: () => [],
    querySelector: () => null,
    remove() {}
  }
}

function createFakeDocument() {
  const elements = new Map()
  return {
    activeElement: null,
    getElementById(id) {
      if (!elements.has(id)) elements.set(id, createFakeElement(id))
      return elements.get(id)
    }
  }
}

// Sobe background.js real + os scripts do popup.html reais (na ordem do
// HTML), sobre um `chrome` falso único, compartilhado pelos dois contextos.
// `storage` é o conteúdo inicial de chrome.storage.local.
async function bootExtension(storage) {
  const stored = Object.assign({}, storage)
  const sentMessages = []
  const pendingResponses = []
  const fetchCalls = []
  const sockets = []
  let backgroundListener = null
  let pollingTick = null

  // Mapa de overrides de falha "de um tiro" por tipo de mensagem — ver
  // failNext() abaixo. Consumido em deliverAll() na hora de entregar a
  // resposta ao callback do popup (não na hora de enfileirar), então a ordem
  // entre a chamada que dispara a mensagem e a chamada a failNext() não
  // importa, desde que ambas aconteçam antes do deliverAll() correspondente.
  const failNextByType = new Map()

  const chrome = {
    runtime: {
      lastError: undefined,
      onMessage: { addListener(fn) { backgroundListener = fn } },
      sendMessage(msg, callback) {
        sentMessages.push(msg)
        const sendResponse = (response) => pendingResponses.push({ msg, callback, response })
        if (backgroundListener) backgroundListener(msg, {}, sendResponse)
      }
    },
    storage: {
      local: {
        get(keys, cb) {
          Promise.resolve().then(() => {
            const result = {}
            for (const key of keys) {
              if (Object.prototype.hasOwnProperty.call(stored, key)) result[key] = stored[key]
            }
            cb(result)
          })
        },
        set(obj) { Object.assign(stored, obj) }
      }
    }
  }

  class FakeWebSocket {
    constructor(url) {
      this.url = url
      this.onmessage = null
      this.onclose = null
      this.onerror = null
      sockets.push(this)
    }
    close() {}
  }

  function backgroundFetch(url, init) {
    fetchCalls.push({ url, init })
    return Promise.resolve({ ok: true, status: 202 })
  }

  const backgroundContext = vm.createContext({ chrome, WebSocket: FakeWebSocket, setTimeout: () => {}, fetch: backgroundFetch })
  const backgroundPath = path.join(EXTENSION_ROOT, 'background.js')
  vm.runInContext(fs.readFileSync(backgroundPath, 'utf8'), backgroundContext, { filename: backgroundPath })

  // Espera loadState()/connectWS() assentarem — o background precisa estar
  // pronto (stateLoaded) antes de o popup subir.
  await new Promise((resolve) => setImmediate(resolve))

  const document = createFakeDocument()
  const popupFetch = () => Promise.resolve({ ok: true })
  const popupContext = vm.createContext({
    chrome,
    document,
    setInterval(fn) { pollingTick = fn; return 1 },
    setTimeout: () => {},
    fetch: popupFetch
  })

  for (const src of popupScriptOrder()) {
    const scriptPath = path.join(EXTENSION_ROOT, src)
    vm.runInContext(fs.readFileSync(scriptPath, 'utf8'), popupContext, { filename: scriptPath })
  }

  // Entrega, em ordem, as respostas pendentes (inclusive as disparadas pelos próprios callbacks, como a releitura pós-save).
  async function deliverAll() {
    let iterations = 0
    for (;;) {
      await new Promise((resolve) => setImmediate(resolve))
      if (pendingResponses.length === 0) break
      const item = pendingResponses.shift()
      if (item.msg && failNextByType.has(item.msg.type)) {
        const opts = failNextByType.get(item.msg.type)
        failNextByType.delete(item.msg.type)
        const hadLastError = Object.prototype.hasOwnProperty.call(chrome.runtime, 'lastError')
        const previousLastError = chrome.runtime.lastError
        chrome.runtime.lastError = Object.prototype.hasOwnProperty.call(opts, 'lastError')
          ? opts.lastError
          : { message: 'forced failure (extensionHarness.failNext)' }
        try {
          item.callback(Object.prototype.hasOwnProperty.call(opts, 'response') ? opts.response : undefined)
        } finally {
          if (hadLastError) chrome.runtime.lastError = previousLastError
          else delete chrome.runtime.lastError
        }
      } else {
        item.callback(item.response)
      }
      if (++iterations > 50) throw new Error('deliverAll: mais de 50 iterações — possível loop infinito de mensagens')
    }
  }

  // Faz a PRÓXIMA resposta pendente do tipo `type` ser entregue como uma
  // falha de save: por padrão, response === undefined e
  // chrome.runtime.lastError definido durante o callback (restaurado ao
  // valor anterior logo depois) — simula porta fechada / service worker
  // reiniciando. `opts.response` e `opts.lastError` sobrescrevem os
  // defaults. Efeito de um único tiro: consumido na próxima entrega
  // daquele tipo e removido do mapa.
  function failNext(type, opts = {}) {
    failNextByType.set(type, opts)
  }

  // Retira (sem entregar) a resposta pendente mais antiga do tipo pedido —
  // simula uma resposta de polling atrasada; o teste entrega depois, na hora
  // que quiser, chamando o `.callback` devolvido.
  async function holdResponse(type) {
    await new Promise((resolve) => setImmediate(resolve))
    const index = pendingResponses.findIndex((item) => item.msg && item.msg.type === type)
    if (index === -1) throw new Error(`holdResponse: nenhuma resposta pendente do tipo "${type}"`)
    return pendingResponses.splice(index, 1)[0]
  }

  function tick() {
    if (!pollingTick) throw new Error('tick: setInterval do polling ainda não foi registrado por popup.js')
    pollingTick()
  }

  function type(id, value) {
    const element = document.getElementById(id)
    document.activeElement = element; element.value = value; element.dispatch('input')
  }

  function focus(idOrNull) {
    document.activeElement = idOrNull ? document.getElementById(idOrNull) : null
  }

  function click(id) {
    const element = document.getElementById(id)
    document.activeElement = element; element.dispatch('click')
  }

  function pushQuestionViaWs(question) {
    if (sockets.length === 0) throw new Error('pushQuestionViaWs: nenhuma instância de WebSocket foi criada (sem sessão ativa?)')
    sockets[sockets.length - 1].onmessage({ data: JSON.stringify({ event: 'question_new', data: question }) })
  }

  function sendTranscriptChunk(text) {
    chrome.runtime.sendMessage({ type: 'TRANSCRIPT_CHUNK', text, speaker: null }, () => {})
  }

  return {
    document, el: (id) => document.getElementById(id), stored, fetchCalls, sentMessages,
    deliverAll, holdResponse, failNext, tick, type, focus, click, pushQuestionViaWs, sendTranscriptChunk
  }
}

module.exports = { popupScriptOrder, bootExtension }
