// content_meet.js — captura legendas (CC) do Google Meet

(function () {
  let dead = false
  let currentText = ''
  let currentSpeaker = null
  let lastChangeTs = 0
  let lastEmitTs = 0
  let emittedTail = []          // últimas palavras já enviadas (para diff)

  const PAUSE_MS = 1200          // silêncio que marca fim de uma fala
  const MAX_WAIT_MS = 6000       // emite mesmo em fala contínua longa
  const TAIL_KEEP = 80           // quantas palavras manter como histórico de diff
  const ANCHOR = 4               // palavras usadas como âncora para achar o ponto novo

  const NOISE = /^(pressione|configurações|legendas|a legenda|desativar|ativar|compartilhar|sair|levantar|cronômetro|notificações|mãos|ferramentas|controles|chat|beta|padrão|tamanho|cor da fonte|abrir|keyboard|closed_caption|more_vert|call_end|mic|videocam|mood|back_hand|meeting_room|computer|frame_person|visual_effects|info|lock_person|format_size|circle|settings|apps|esta chamada|altofalantes|sua câmera|sua mão|seu microfone|mais opções|enviar uma reação|você está participando|arrow_drop|olá, estou transcrevendo|tactiq)/i

  function log(...args) { console.log('[AgenteDiag]', ...args) }

  function cleanup() {
    dead = true
    log('content script desativado (extensão recarregada). Recarregue a aba do Meet.')
  }

  function safeSend(msg) {
    try {
      if (!chrome.runtime?.id) { cleanup(); return }
      chrome.runtime.sendMessage(msg, (resp) => {
        if (chrome.runtime.lastError) { cleanup(); return }
        log('ENVIADO ->', JSON.stringify(msg.text), '| resp:', resp)
      })
    } catch { cleanup() }
  }

  function isNoise(text) {
    if (!text || text.length < 3) return true
    if (NOISE.test(text.trim())) return true
    if (/^[a-z_]+$/i.test(text.trim())) return true
    return false
  }

  function norm(w) {
    return w.toLowerCase().replace(/[.,!?;:]/g, '')
  }

  let diagCount = 0

  // Pega todo o texto de legenda visível (pode conter várias frases)
  function getCaption() {
    const known = document.querySelectorAll(
      'div[jsname="tgaKEf"], .bh44bd, .iTTPOb, .ygicle, .CNusmb'
    )
    for (let i = known.length - 1; i >= 0; i--) {
      const text = known[i].innerText?.trim()
      if (text && !isNoise(text)) return { speaker: speakerOf(known[i]), text }
    }

    const candidates = document.querySelectorAll('div[jscontroller] span, div[jscontroller] div')
    let best = null
    for (const el of candidates) {
      const rect = el.getBoundingClientRect()
      if (rect.height === 0 || rect.width === 0) continue
      if (rect.top < window.innerHeight * 0.65) continue
      if (rect.height > 160) continue
      if (el.querySelector('button, input, select, svg, [role="button"]')) continue
      const text = el.innerText?.trim()
      if (!text || isNoise(text)) continue
      const style = window.getComputedStyle(el)
      if (style.display === 'none' || style.visibility === 'hidden') continue
      if (!best || rect.top > best.top) best = { el, text, top: rect.top }
    }
    if (best) return { speaker: speakerOf(best.el), text: best.text }

    if (++diagCount % 12 === 0) {
      const sample = []
      document.querySelectorAll('div[jscontroller]').forEach(el => {
        const rect = el.getBoundingClientRect()
        if (rect.top < window.innerHeight * 0.65 || rect.height === 0) return
        const t = el.innerText?.trim()
        if (t && t.length < 120) sample.push(t)
      })
      log('NADA encontrado. Textos na faixa inferior:', sample.slice(0, 15))
    }
    return null
  }

  function speakerOf(el) {
    const row = el.closest('.nMcdL') || el.parentElement?.parentElement
    if (!row) return null
    const nameEl = row.querySelector('.zs7s8d, .KcIKyf, [class*="jxFHg"]')
    const name = nameEl?.innerText?.trim()
    if (name && name.length < 40) return name
    return null
  }

  // Emite só as PALAVRAS NOVAS no fim da legenda, ignorando o que já foi enviado
  function emitNew() {
    if (!currentText) return
    const words = currentText.replace(/\n/g, ' ').split(/\s+/).filter(Boolean)
    if (!words.length) return

    let startIdx = 0
    if (emittedTail.length) {
      let found = false
      // Tenta âncoras de tamanho decrescente (ANCHOR → 1) para ser robusto a resets parciais da legenda
      for (let aLen = Math.min(ANCHOR, emittedTail.length); aLen >= 1 && !found; aLen--) {
        const anchor = emittedTail.slice(-aLen).map(norm).join(' ')
        for (let i = words.length - aLen; i >= 0; i--) {
          if (words.slice(i, i + aLen).map(norm).join(' ') === anchor) {
            startIdx = i + aLen
            found = true
            break
          }
        }
      }
    }

    const newWords = words.slice(startIdx)
    if (!newWords.length) return

    emittedTail = emittedTail.concat(newWords).slice(-TAIL_KEEP)
    lastEmitTs = Date.now()

    const text = newWords.join(' ').trim()
    if (!text || isNoise(text)) return
    safeSend({ type: 'TRANSCRIPT_CHUNK', text, speaker: currentSpeaker })
  }

  function poll() {
    if (dead) return
    const cap = getCaption()
    if (!cap) return

    if (cap.text !== currentText) {
      currentText = cap.text
      currentSpeaker = cap.speaker || currentSpeaker
      lastChangeTs = Date.now()
    }
  }

  function checkEmit() {
    if (dead || !currentText) return
    const now = Date.now()
    const paused = now - lastChangeTs >= PAUSE_MS
    const maxedOut = now - lastEmitTs >= MAX_WAIT_MS
    if (paused || maxedOut) emitNew()
  }

  setInterval(poll, 400)
  setInterval(checkEmit, 500)

  new MutationObserver(() => { if (!dead) poll() }).observe(document.body, {
    childList: true, subtree: true, characterData: true
  })

  log('content script ativo. Aguardando legendas do Meet...')
})()
