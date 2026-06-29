// popup.js — lógica do popup da extensão

const dot = document.getElementById('dot')
const statusText = document.getElementById('status-text')
const sessionPanel = document.getElementById('session-panel')
const sessionIdDisplay = document.getElementById('session-id-display')
const noSessionPanel = document.getElementById('no-session-panel')
const questionsList = document.getElementById('questions-list')
const manualIdInput = document.getElementById('manual-id')
const manualBtn = document.getElementById('manual-btn')
const overrideIdInput = document.getElementById('override-id')
const overrideBtn = document.getElementById('override-btn')
const backendUrlInput = document.getElementById('backend-url')
const saveUrlBtn = document.getElementById('save-url-btn')

function generateQuestions() {
  chrome.runtime.sendMessage({ type: 'GET_STATE' }, (state) => {
    if (!state.backendUrl || !state.sessionId) return
    const btn = document.getElementById('generate-btn')
    if (btn) { btn.textContent = 'Gerando...'; btn.disabled = true }
    fetch(`${state.backendUrl}/sessions/${state.sessionId}/questions/generate`, { method: 'POST' })
      .then(() => {
        if (btn) { btn.textContent = '✓ Enviado'; setTimeout(() => { btn.textContent = '⚡ Gerar'; btn.disabled = false }, 2000) }
      })
      .catch(() => {
        if (btn) { btn.textContent = '⚡ Gerar'; btn.disabled = false }
      })
  })
}

function renderQuestions(questions) {
  const visible = (questions || []).filter(q => q.status === 'queued' || q.status === 'pinned')

  questionsList.innerHTML = `
    <button id="generate-btn" style="width:100%;padding:6px;margin-bottom:8px;background:#22a267;color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:12px;">⚡ Gerar</button>
    ${visible.length === 0
      ? '<div class="no-questions">Nenhuma pergunta ainda.</div>'
      : visible.map(q => `
        <div class="question-card" data-id="${q.id}">
          ${q.block ? `<div class="q-block">${q.block}</div>` : ''}
          <div class="q-text">${q.text}</div>
          <div class="q-actions">
            <button class="btn-pin" data-action="pinned" data-id="${q.id}">${q.status === 'pinned' ? 'Fixada' : 'Fixar'}</button>
            <button class="btn-used" data-action="used" data-id="${q.id}">Usada</button>
            <button class="btn-dismiss" data-action="dismissed" data-id="${q.id}">Descartar</button>
          </div>
        </div>
      `).join('')
    }
  `

  document.getElementById('generate-btn').addEventListener('click', generateQuestions)

  questionsList.querySelectorAll('.q-actions button').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.id
      const status = btn.dataset.action
      // Optimistic removal: remove card immediately from DOM
      const card = questionsList.querySelector(`.question-card[data-id="${id}"]`)
      if (card) card.remove()
      chrome.runtime.sendMessage({ type: 'GET_STATE' }, (state) => {
        if (!state.backendUrl || !id) return
        fetch(`${state.backendUrl}/questions/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status })
        }).catch(() => {})
      })
    })
  })
}

function render(state) {
  backendUrlInput.value = state.backendUrl || ''

  if (state.sessionId) {
    dot.classList.add('active')
    statusText.innerHTML = '<strong>Capturando</strong> — sessão ativa'
    sessionPanel.style.display = 'block'
    noSessionPanel.style.display = 'none'
    sessionIdDisplay.textContent = state.sessionId
    renderQuestions(state.questions || [])
  } else {
    dot.classList.remove('active')
    statusText.innerHTML = '<span>Aguardando sessão</span>'
    sessionPanel.style.display = 'none'
    noSessionPanel.style.display = 'block'
  }
}

// Carrega estado atual ao abrir o popup
chrome.runtime.sendMessage({ type: 'GET_STATE' }, render)

// Atualiza perguntas a cada 3s enquanto o popup estiver aberto
setInterval(() => {
  chrome.runtime.sendMessage({ type: 'GET_STATE' }, render)
}, 3000)

// Trocar sessão quando já há uma ativa
overrideBtn.addEventListener('click', () => {
  const id = overrideIdInput.value.trim()
  if (!id) return
  chrome.runtime.sendMessage({ type: 'SESSION_SYNC', sessionId: id }, () => {
    chrome.runtime.sendMessage({ type: 'GET_STATE' }, render)
    overrideIdInput.value = ''
  })
})

// Botão de override manual
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
  const url = backendUrlInput.value.trim().replace(/\/+$/, '')
  if (!url) return
  chrome.runtime.sendMessage({ type: 'SET_BACKEND_URL', url }, () => {
    saveUrlBtn.textContent = 'Salvo!'
    setTimeout(() => { saveUrlBtn.textContent = 'Salvar' }, 1500)
  })
})
