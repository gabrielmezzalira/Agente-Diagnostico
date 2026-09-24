// extension/tests/extensionHarness.js
//
// Emula o runtime da extensão Chrome (service worker + popup) para os testes
// node:test deste plano (06-02, G-06-1). Este arquivo NÃO contém nenhuma
// lógica de produção — só simula o `chrome` da extensão, o `document` do
// popup e as pontes de rede (fetch, WebSocket), para que
// extension/background.js e os scripts carregados por extension/popup.html
// (extension/lib/configFieldGuard.js + extension/popup.js) rodem como código
// real, sem nenhuma reescrita ou mock do próprio comportamento deles.
//
// Cuidado de realm: background.js e os scripts do popup rodam em contextos
// vm separados (como no Chrome real, service worker e popup são realms
// diferentes). Objetos criados DENTRO desses contextos (ex.: `state`,
// `headers`, o `response` de um GET_STATE) têm protótipos de outro realm —
// os testes que consomem este harness devem comparar só valores primitivos
// (strings, números, booleanos) e usar
// `Object.prototype.hasOwnProperty.call(...)` para checar ausência de chave;
// nunca `assert.deepStrictEqual` entre um objeto do vm e um literal do teste.

'use strict'

const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')

const EXTENSION_ROOT = path.join(__dirname, '..')

// Lê extension/popup.html e devolve os `src` das tags <script>, na ordem em
// que aparecem no documento. Lança erro se alguma tag <script> não tiver
// `src` (script inline — proibido pela CSP padrão do Manifest V3 para
// páginas da extensão).
function popupScriptOrder() {
  const htmlPath = path.join(EXTENSION_ROOT, 'popup.html')
  const html = fs.readFileSync(htmlPath, 'utf8')
  const scriptTagPattern = /<script\b([^>]*)>/gi
  const srcs = []
  let match
  while ((match = scriptTagPattern.exec(html)) !== null) {
    const attrs = match[1]
    const srcMatch = attrs.match(/\bsrc\s*=\s*"([^"]*)"/i) || attrs.match(/\bsrc\s*=\s*'([^']*)'/i)
    if (!srcMatch) {
      throw new Error(
        `popupScriptOrder: tag <script> sem src (script inline, proibido pela CSP do MV3): <script${attrs}>`
      )
    }
    srcs.push(srcMatch[1])
  }
  return srcs
}

function createFakeElement(id) {
  const listeners = Object.create(null)
  const classSet = new Set()
  return {
    id,
    value: '',
    textContent: '',
    innerHTML: '',
    disabled: false,
    style: {},
    dataset: {},
    classList: {
      add(name) { classSet.add(name) },
      remove(name) { classSet.delete(name) },
      contains(name) { return classSet.has(name) }
    },
    addEventListener(type, fn) {
      if (!listeners[type]) listeners[type] = []
      listeners[type].push(fn)
    },
    dispatch(type) {
      (listeners[type] || []).forEach((fn) => fn({ type, target: this }))
    },
    querySelectorAll() { return [] },
    querySelector() { return null },
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

// Sobe o background.js real + os scripts do popup.html reais (na ordem do
// HTML), sobre um `chrome` falso único, compartilhado pelos dois contextos.
// `storage` é o conteúdo inicial de chrome.storage.local — por exemplo:
// { sessionId: 'sess-1', backendUrl: 'https://agente.example.app', extensionKey: 'chave-salva' }
async function bootExtension(storage) {
  const stored = Object.assign({}, storage)
  const sentMessages = []
  const pendingResponses = []
  const fetchCalls = []
  const sockets = []
  let backgroundListener = null
  let pollingTick = null

  const chrome = {
    runtime: {
      lastError: undefined,
      onMessage: {
        addListener(fn) {
          backgroundListener = fn
        }
      },
      sendMessage(msg, callback) {
        sentMessages.push(msg)
        const sendResponse = (response) => {
          pendingResponses.push({ msg, callback, response })
        }
        if (backgroundListener) {
          backgroundListener(msg, {}, sendResponse)
        }
      }
    },
    storage: {
      local: {
        get(keys, cb) {
          Promise.resolve().then(() => {
            const result = {}
            for (const key of keys) {
              if (Object.prototype.hasOwnProperty.call(stored, key)) {
                result[key] = stored[key]
              }
            }
            cb(result)
          })
        },
        set(obj) {
          Object.assign(stored, obj)
        }
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

  const backgroundContext = vm.createContext({
    chrome,
    WebSocket: FakeWebSocket,
    setTimeout: () => {},
    fetch: backgroundFetch
  })

  const backgroundPath = path.join(EXTENSION_ROOT, 'background.js')
  const backgroundCode = fs.readFileSync(backgroundPath, 'utf8')
  vm.runInContext(backgroundCode, backgroundContext, { filename: backgroundPath })

  // Espera os microtasks de loadState()/connectWS() assentarem — o
  // background precisa estar pronto (stateLoaded) antes de o popup subir.
  await new Promise((resolve) => setImmediate(resolve))

  const document = createFakeDocument()

  function popupFetch() {
    return Promise.resolve({ ok: true })
  }

  const popupContext = vm.createContext({
    chrome,
    document,
    setInterval(fn) {
      pollingTick = fn
      return 1
    },
    setTimeout: () => {},
    fetch: popupFetch
  })

  const scriptSrcs = popupScriptOrder()
  for (const src of scriptSrcs) {
    const scriptPath = path.join(EXTENSION_ROOT, src)
    const code = fs.readFileSync(scriptPath, 'utf8')
    vm.runInContext(code, popupContext, { filename: scriptPath })
  }

  // Entrega, em ordem, todas as respostas pendentes (inclusive as que os
  // próprios callbacks disparam ao rodar, como a releitura pós-save).
  async function deliverAll() {
    let iterations = 0
    for (;;) {
      await new Promise((resolve) => setImmediate(resolve))
      if (pendingResponses.length === 0) break
      const item = pendingResponses.shift()
      item.callback(item.response)
      iterations += 1
      if (iterations > 50) {
        throw new Error('deliverAll: mais de 50 iterações — possível loop infinito de mensagens')
      }
    }
  }

  // Retira (sem entregar) a resposta pendente mais antiga do tipo pedido —
  // simula uma resposta de polling atrasada, que o teste entrega depois, na
  // hora que quiser, chamando o `.callback` devolvido.
  async function holdResponse(type) {
    await new Promise((resolve) => setImmediate(resolve))
    const index = pendingResponses.findIndex((item) => item.msg && item.msg.type === type)
    if (index === -1) {
      throw new Error(`holdResponse: nenhuma resposta pendente do tipo "${type}"`)
    }
    const [item] = pendingResponses.splice(index, 1)
    return item
  }

  function tick() {
    if (!pollingTick) {
      throw new Error('tick: setInterval do polling ainda não foi registrado por popup.js')
    }
    pollingTick()
  }

  function type(id, value) {
    const element = document.getElementById(id)
    document.activeElement = element
    element.value = value
    element.dispatch('input')
  }

  function focus(idOrNull) {
    document.activeElement = idOrNull ? document.getElementById(idOrNull) : null
  }

  function click(id) {
    const element = document.getElementById(id)
    document.activeElement = element
    element.dispatch('click')
  }

  function pushQuestionViaWs(question) {
    if (sockets.length === 0) {
      throw new Error('pushQuestionViaWs: nenhuma instância de WebSocket foi criada (sem sessão ativa?)')
    }
    const socket = sockets[sockets.length - 1]
    socket.onmessage({ data: JSON.stringify({ event: 'question_new', data: question }) })
  }

  function sendTranscriptChunk(text) {
    chrome.runtime.sendMessage({ type: 'TRANSCRIPT_CHUNK', text, speaker: null }, () => {})
  }

  return {
    document,
    el: (id) => document.getElementById(id),
    stored,
    fetchCalls,
    sentMessages,
    deliverAll,
    holdResponse,
    tick,
    type,
    focus,
    click,
    pushQuestionViaWs,
    sendTranscriptChunk
  }
}

module.exports = { popupScriptOrder, bootExtension }
