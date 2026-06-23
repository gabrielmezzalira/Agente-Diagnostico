// content_app.js — detecta sessão ativa no app web e sincroniza com a extensão

(function () {
  let lastSessionId = null

  function detectSessionId() {
    // 1. Check URL path: /sessions/:id
    const pathMatch = window.location.pathname.match(/\/sessions?\/([\w-]{36})/)
    if (pathMatch) return pathMatch[1]

    // 2. Check localStorage (frontend stores it as 'agente_session_id')
    const stored = localStorage.getItem('agente_session_id')
    if (stored) return stored

    // 3. Check data attribute on body or root element
    const root = document.querySelector('[data-session-id]')
    if (root) return root.getAttribute('data-session-id')

    return null
  }

  function sync() {
    const sessionId = detectSessionId()
    if (sessionId && sessionId !== lastSessionId) {
      lastSessionId = sessionId
      chrome.runtime.sendMessage({ type: 'SESSION_SYNC', sessionId })
    }
    if (!sessionId && lastSessionId) {
      lastSessionId = null
      chrome.runtime.sendMessage({ type: 'SESSION_SYNC', sessionId: null })
    }
  }

  setInterval(sync, 2000)
  sync()
})()
