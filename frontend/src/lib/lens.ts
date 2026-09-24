import type { CoverageArea, CoverageState } from './useSessionWS'

/**
 * Infere o modo da sessão a partir do payload de cobertura (D-42): se QUALQUER
 * área vier com `lens != null`, a sessão é discovery (agrupa por lente); se
 * todas vierem `null` (ou coverage vazio), cai no caminho sales (lista plana).
 * Puro, sem fetch extra — a mesma inferência usada na tela de monitoramento.
 */
export function isDiscoveryCoverage(coverage: CoverageState): boolean {
  return Object.values(coverage).some(area => area.lens != null)
}

/**
 * Particiona a cobertura por lente (Produto/Dados), preservando a ordem de
 * inserção do payload (Object.entries) — nunca reordena. As duas chaves
 * (`produto` e `dados`) estão sempre presentes, mesmo vazias, para que o
 * cabeçalho de uma lente sem áreas ativas ainda possa ser renderizado
 * (backstop zero-one-many).
 */
export function groupCoverageByLens(
  coverage: CoverageState
): { produto: [string, CoverageArea][]; dados: [string, CoverageArea][] } {
  const produto: [string, CoverageArea][] = []
  const dados: [string, CoverageArea][] = []

  for (const entry of Object.entries(coverage)) {
    const [, area] = entry
    if (area.lens === 'produto') {
      produto.push(entry)
    } else if (area.lens === 'dados') {
      dados.push(entry)
    }
  }

  return { produto, dados }
}
