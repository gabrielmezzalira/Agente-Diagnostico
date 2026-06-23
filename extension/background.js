// background.js — service worker: gerencia estado, envia chunks e recebe perguntas via WS

let state = {
  sessionId: null,
  backendUrl: 'https://agente-diagnostico-production.up.railway.app',
  questions: []
}

let stateLoaded = false
let ws = null

function normalizeUrl(url) {
  url = url.trim().replace(/\/+$/, '')
  if (url && !/^https?:\/\//i.test(url)) {
    url = 'https://' + url
  }
  return url
}

function loadState() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['sessionId', 'backendUrl', 'questions'], (data) => {
      if (data.sessionId) state.sessionId = data.sessionId
      if (data.backendUrl) state.backendUrl = data.backendUrl
      if (data.questions) state.questions = data.questions
      stateLoaded = true
      resolve()
    })
  })
}

function ensureState() {
  if (stateLoaded) return Promise.resolve()
  return loadState()
}

function wsUrl() {
  if (!state.sessionId || !state.backendUrl) return null
  const base = normalizeUrl(state.backendUrl)
  const proto = base.startsWith('https') ? 'wss' : 'ws'
  const host = base.replace(/^https?:\/\//, '')
  return `${proto}://${host}/ws/${state.sessionId}`
}

function connectWS() {
  if (ws) { try { ws.close() } catch {} ws = null }
  const url = wsUrl()
  if (!url) return

  try {
    ws = new WebSocket(url)
    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data)
        if (msg.event === 'question_new') {
          state.questions = [msg.data, ...state.questions].slice(0, 10)
          chrome.storage.local.set({ questions: state.questions })
        }
        if (msg.event === 'question_expired') {
          state.questions = state.questions.filter(q => q.id !== msg.data.id)
          chrome.storage.local.set({ questions: state.questions })
        }
        if (msg.event === 'initial_state' && msg.data?.questions) {
          state.questions = msg.data.questions.slice(0, 10)
          chrome.storage.local.set({ questions: state.questions })
        }
      } catch {}
    }
    ws.onclose = () => { ws = null; setTimeout(connectWS, 5000) }
    ws.onerror = () => { try { ws.close() } catch {} }
  } catch {}
}

// Load state on every service worker start
loadState().then(() => {
  if (state.sessionId) connectWS()
})

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  ensureState().then(() => {
    if (msg.type === 'GET_STATE') {
      sendResponse({ ...state, backendUrl: normalizeUrl(state.backendUrl) })
      return
    }

    if (msg.type === 'SESSION_SYNC') {
      state.sessionId = msg.sessionId || null
      state.questions = []
      chrome.storage.local.set({ sessionId: state.sessionId, questions: [] })
      connectWS()
      sendResponse({ ok: true })
      return
    }

    if (msg.type === 'SET_BACKEND_URL') {
      state.backendUrl = normalizeUrl(msg.url)
      chrome.storage.local.set({ backendUrl: state.backendUrl })
      if (state.sessionId) connectWS()
      sendResponse({ ok: true })
      return
    }

    if (msg.type === 'TRANSCRIPT_CHUNK') {
      if (!state.sessionId) {
        sendResponse({ ok: false, reason: 'no session' })
        return
      }
      const url = `${normalizeUrl(state.backendUrl)}/webhook/extension`
      fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: state.sessionId,
          text: msg.text,
          speaker: msg.speaker || null
        })
      })
      .then(r => sendResponse({ ok: r.ok, status: r.status }))
      .catch(e => sendResponse({ ok: false, error: e.message }))
      return
    }

    sendResponse({ ok: false, reason: 'unknown message type' })
  })

  // Keep the message channel open for async response
  return true
})
