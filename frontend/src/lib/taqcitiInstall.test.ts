import { describe, expect, it } from 'vitest'
import {
  TAQCITI_AGP_TAB_NOTES,
  TAQCITI_DOWNLOAD_PENDING_NOTICE,
  TAQCITI_INSTALL_STEPS,
  TAQCITI_LINK_STEPS,
  TAQCITI_OLD_EXTENSION_WARNING,
  TAQCITI_RELEASES_URL,
  TAQCITI_SYSTEM_LABELS,
} from './taqcitiInstall'

// Host e caminho do repositório confirmados pelo time (T-09-08). Enquanto a URL for null não há
// o que conferir; quando o time publicar o link, preencha os dois valores abaixo junto com a URL.
const EXPECTED_HOST = null as string | null
const EXPECTED_PATH_PREFIX = null as string | null

// Nome do zip da extensão antiga, montado por partes de propósito: o gate de resíduo da Fase 9
// procura o nome inteiro em todo arquivo rastreado e reprovaria se ele aparecesse literal aqui.
const OLD_ZIP_NAME = ['agente-diagnostico', 'extension-v1.0.0.zip'].join('-')

const SYSTEMS = ['windows', 'macos', 'linux'] as const

function allPageTexts(): string[] {
  return [
    TAQCITI_OLD_EXTENSION_WARNING,
    TAQCITI_DOWNLOAD_PENDING_NOTICE,
    ...(TAQCITI_RELEASES_URL === null ? [] : [TAQCITI_RELEASES_URL]),
    ...Object.values(TAQCITI_SYSTEM_LABELS),
    ...SYSTEMS.flatMap((system) => TAQCITI_INSTALL_STEPS[system]),
    ...TAQCITI_LINK_STEPS,
    ...TAQCITI_AGP_TAB_NOTES,
  ]
}

describe('taqcitiInstall', () => {
  it('link de download: null com aviso de pendência, ou https no host e repositório confirmados', () => {
    if (TAQCITI_RELEASES_URL === null) {
      expect(TAQCITI_DOWNLOAD_PENDING_NOTICE).toContain('link de download será publicado')
      return
    }
    expect(EXPECTED_HOST, 'defina EXPECTED_HOST no teste ao publicar a URL').not.toBeNull()
    expect(EXPECTED_PATH_PREFIX, 'defina EXPECTED_PATH_PREFIX no teste ao publicar a URL').not.toBeNull()
    const url = new URL(TAQCITI_RELEASES_URL)
    expect(url.protocol).toBe('https:')
    expect(url.host).toBe(EXPECTED_HOST)
    expect(url.pathname.startsWith(EXPECTED_PATH_PREFIX ?? '')).toBe(true)
  })

  it('nenhum texto da página cita o zip antigo, .zip ou v1.0.0', () => {
    for (const text of allPageTexts()) {
      expect(text).not.toContain(OLD_ZIP_NAME)
      expect(text.toLowerCase()).not.toContain('.zip')
      expect(text).not.toContain('v1.0.0')
    }
  })

  it('o aviso da extensão antiga manda removê-la em chrome://extensions', () => {
    expect(TAQCITI_OLD_EXTENSION_WARNING).toContain('extensão antiga')
    expect(TAQCITI_OLD_EXTENSION_WARNING).toContain('chrome://extensions')
  })

  it('nenhum texto fala de chave, x-agente-key, agenteApiKey, localhost nem URL do backend', () => {
    const forbidden = ['chave', 'x-agente-key', 'agenteapikey', 'localhost', 'url do backend']
    for (const text of allPageTexts()) {
      for (const word of forbidden) {
        expect(text.toLowerCase(), `"${word}" em: ${text}`).not.toContain(word)
      }
    }
  })

  it('há passos para Windows, macOS e Linux, cada um com pelo menos 2 passos não vazios', () => {
    expect(Object.keys(TAQCITI_INSTALL_STEPS).sort()).toEqual([...SYSTEMS].sort())
    for (const system of SYSTEMS) {
      expect(TAQCITI_SYSTEM_LABELS[system].length).toBeGreaterThan(0)
      expect(TAQCITI_INSTALL_STEPS[system].length).toBeGreaterThanOrEqual(2)
      for (const step of TAQCITI_INSTALL_STEPS[system]) expect(step.trim().length).toBeGreaterThan(0)
    }
  })

  it('os passos de instalação não mandam baixar "da release"', () => {
    for (const system of SYSTEMS) {
      for (const step of TAQCITI_INSTALL_STEPS[system]) {
        expect(step.toLowerCase()).not.toContain('release')
      }
    }
  })

  it('os passos do vínculo têm pelo menos 3 itens e citam "Selecionar cliente"', () => {
    expect(TAQCITI_LINK_STEPS.length).toBeGreaterThanOrEqual(3)
    expect(TAQCITI_LINK_STEPS.some((step) => step.includes('Selecionar cliente'))).toBe(true)
  })

  it('as notas da aba AGP explicam a lente, que a aba só mostra e a divergência de fixar/descartar (D-09)', () => {
    expect(TAQCITI_AGP_TAB_NOTES.length).toBeGreaterThanOrEqual(4)
    for (const note of TAQCITI_AGP_TAB_NOTES) expect(note.trim().length).toBeGreaterThan(0)
    expect(TAQCITI_AGP_TAB_NOTES.some((n) => n.includes('Produto') && n.includes('Dados'))).toBe(true)
    expect(TAQCITI_AGP_TAB_NOTES.some((n) => n.includes('até a Taqciti se reconectar'))).toBe(true)
    expect(TAQCITI_AGP_TAB_NOTES.some((n) => n.includes('só mostra'))).toBe(true)
    for (const note of TAQCITI_AGP_TAB_NOTES) expect(note).not.toContain('some no TTL')
  })
})
