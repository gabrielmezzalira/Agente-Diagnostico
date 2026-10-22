import { describe, expect, it } from 'vitest'
import { buttonClasses } from './buttonStyles'

describe('buttonClasses', () => {
  it('primário: verde com texto escuro e brilho', () => {
    const cls = buttonClasses('primary')
    expect(cls).toContain('bg-ds-green')
    expect(cls).toContain('text-[#04120a]')
    expect(cls).toContain('h-[38px]')
  })

  it('perigo: texto e borda vermelhos, sem preenchimento', () => {
    const cls = buttonClasses('danger')
    expect(cls).toContain('text-ds-red')
    expect(cls).toContain('bg-transparent')
  })

  it('hero ocupa a largura toda e tem 64px', () => {
    const cls = buttonClasses('primary', 'hero')
    expect(cls).toContain('h-16')
    expect(cls).toContain('w-full')
  })

  it('anexa classes extras no fim', () => {
    expect(buttonClasses('secondary', 'sm', 'ml-auto').endsWith('ml-auto')).toBe(true)
  })
})
