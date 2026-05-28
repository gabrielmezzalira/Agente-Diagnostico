// popup.js — lógica do popup da extensão

const dot = document.getElementById('dot')
const statusText = document.getElementById('status-text')
const sessionPanel = document.getElementById('session-panel')
const sessionIdDisplay = document.getElementById('session-id-display')
const noSessionPanel = document.getElementById('no-session-panel')
const manualIdInput = document.getElementById('manual-id')
const manualBtn = document.getElementById('manual-btn')
const overrideIdInput = document.getElementById('override-id')
const overrideBtn = document.getElementById('override-btn')
const backendUrlInput = document.getElementById('backend-url')
const saveUrlBtn = document.getElementById('save-url-btn')

function render(state) {
  backendUrlInput.value = state.backendUrl || 'http://localhost:8000'

  if (state.sessionId) {
    dot.classList.add('active')
    statusText.innerHTML = '<strong>Capturando</strong> — sessão ativa'
    sessionPanel.style.display = 'block'
    noSessionPanel.style.display = 'none'
    sessionIdDisplay.textContent = state.sessionId
  } else {
    dot.classList.remove('active')
    statusText.innerHTML = '<span>Aguardando sessão</span>'
    sessionPanel.style.display = 'none'
    noSessionPanel.style.display = 'block'
  }
}

// Carrega estado atual ao abrir o popup
chrome.runtime.sendMessage({ type: 'GET_STATE' }, render)

// Trocar sessão quando já há uma ativa
overrideBtn.addEventListener('click', () => {
  const id = overrideIdInput.value.trim()
  if (!id) return
  chrome.runtime.sendMessage({ type: 'SESSION_SYNC', sessionId: id }, () => {
    chrome.runtime.sendMessage({ type: 'GET_STATE' }, render)
    overrideIdInput.value = ''
  })
})

// Botão de override manual — útil se a detecção falhar
manualBtn.addEventListener('click', () => {
  const id = manualIdInput.value.trim()
  if (!id) return
  chrome.runtime.sendMessage({ type: 'SESSION_SYNC', sessionId: id }, () => {
    chrome.runtime.sendMessage({ type: 'GET_STATE' }, render)
    manualIdInput.value = ''
  })
})

// Salvar URL do backend
saveUrlBtn.addEventListener('click', () => {
  const url = backendUrlInput.value.trim().replace(/\/$/, '')
  if (!url) return
  chrome.runtime.sendMessage({ type: 'SET_BACKEND_URL', url }, () => {
    saveUrlBtn.textContent = 'Salvo!'
    setTimeout(() => { saveUrlBtn.textContent = 'Salvar' }, 1500)
  })
})
