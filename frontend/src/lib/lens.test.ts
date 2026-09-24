import { describe, expect, it } from 'vitest'
import type { CoverageArea, CoverageState } from './useSessionWS'
import { groupCoverageByLens, isDiscoveryCoverage } from './lens'

function fakeArea(name: string, lens: CoverageArea['lens']): CoverageArea {
  return { status: 'covered', score: 100, notes: '', name, lens }
}

describe('lens.ts', () => {
  it('sales byte-idêntico: coverage com lens todo null não vira discovery e preserva conjunto/ordem', () => {
    const coverage: CoverageState = {
      negocio: fakeArea('Negócio', null),
      eng_dados: fakeArea('Eng. de Dados', null),
      parceria: fakeArea('Parceria', null),
    }

    expect(isDiscoveryCoverage(coverage)).toBe(false)

    // A fatia sales não reordena nem some com áreas: o conjunto e a ordem das
    // chaves permanecem idênticos ao input.
    expect(Object.keys(coverage)).toEqual(['negocio', 'eng_dados', 'parceria'])
  })

  it('discovery agrupa: coverage com áreas produto e dados intercaladas -> isDiscoveryCoverage true e groupCoverageByLens separa por lente na ordem do input', () => {
    const coverage: CoverageState = {
      gargalo: fakeArea('Gargalo', 'produto'),
      qualidade_fontes: fakeArea('Fontes e Qualidade dos Dados', 'dados'),
      viabilidade_solucao: fakeArea('Viabilidade da Solução', 'produto'),
      lgpd_seguranca: fakeArea('LGPD/Segurança', 'dados'),
    }

    expect(isDiscoveryCoverage(coverage)).toBe(true)

    const grouped = groupCoverageByLens(coverage)
    expect(grouped.produto.map(([key]) => key)).toEqual(['gargalo', 'viabilidade_solucao'])
    expect(grouped.dados.map(([key]) => key)).toEqual(['qualidade_fontes', 'lgpd_seguranca'])
  })

  it('empty (D-46/UI-03): coverage {} não é discovery e groupCoverageByLens devolve produto/dados vazios', () => {
    const coverage: CoverageState = {}

    expect(isDiscoveryCoverage(coverage)).toBe(false)
    expect(groupCoverageByLens(coverage)).toEqual({ produto: [], dados: [] })
  })

  it('one-lens-empty (backstop zero-one-many): coverage só com áreas produto ainda devolve a chave dados: []', () => {
    const coverage: CoverageState = {
      gargalo: fakeArea('Gargalo', 'produto'),
      frente_atuacao: fakeArea('Frente de Atuação', 'produto'),
    }

    const grouped = groupCoverageByLens(coverage)
    expect(grouped.produto).toHaveLength(2)
    expect(grouped.dados).toEqual([])
  })
})
