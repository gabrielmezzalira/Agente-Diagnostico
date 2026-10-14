import { describe, expect, it } from 'vitest'
import { DMS_LABELS, sessionDurationLabel } from './labels'

describe('labels', () => {
  it('duração menor que 1 minuto', () => {
    expect(sessionDurationLabel('2026-06-21T18:00:00Z', '2026-06-21T18:00:30Z')).toBe('< 1 min')
  })

  it('duração em minutos', () => {
    expect(sessionDurationLabel('2026-06-21T18:39:57Z', '2026-06-21T18:46:30Z')).toBe('6 min')
  })

  it('os 5 níveis de maturidade têm rótulo', () => {
    expect(Object.keys(DMS_LABELS)).toHaveLength(5)
    expect(DMS_LABELS[3]).toBe('Definido')
  })
})
