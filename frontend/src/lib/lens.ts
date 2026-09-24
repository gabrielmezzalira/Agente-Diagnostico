import type { CoverageArea, CoverageState } from './useSessionWS'

/**
 * Labels de bloco temático exibidos como sub-label do card de pergunta.
 * Combina as 8 chaves sales (vocabulário original de `SessionActivePage.tsx`)
 * com as 18 chaves discovery (`DISCOVERY_AREA_SET`, labels VERBATIM do
 * registro em `backend/app/services/coverage_areas.py:91-115`). Não usa o
 * vocabulário de 12 blocos do Precificador — é outra taxonomia (UI-SPEC,
 * Impl Note 1).
 */
export const BLOCK_LABELS: Record<string, string> = {
  // Sales (8) — preservado verbatim do mapa local removido de SessionActivePage.tsx
  negocio: 'Negócio',
  eng_dados: 'Eng. Dados',
  visualizacao: 'Visualização',
  ciencia_dados: 'C. de Dados',
  automacao: 'Automação',
  integracao: 'Integração',
  consumo: 'Consumo',
  parceria: 'Parceria',
  // Discovery (18) — DISCOVERY_AREA_SET, labels verbatim (coverage_areas.py:91-115)
  gargalo: 'Gargalo',
  frente_atuacao: 'Frente de Atuação',
  impacto_usuario: 'Impacto no Usuário',
  mapeamento_processos: 'Mapeamento do Fluxo de Processos',
  fluxo_dados: 'Fluxo dos Dados',
  desenho_solucao: 'Desenho da Solução',
  expectativa_solucao: 'Expectativa de Solução',
  viabilidade_solucao: 'Viabilidade da Solução',
  qualidade_fontes: 'Fontes e Qualidade dos Dados',
  metricas: 'Métricas',
  lgpd_seguranca: 'LGPD/Segurança',
  quick_wins: 'Quick Wins',
  analise_dados: 'Análise de Dados',
  engenharia_dados: 'Engenharia de Dados',
  machine_learning: 'Machine Learning',
  sistemas_nuvem: 'Sistemas em Nuvem',
  automacoes: 'Automações',
}

/** Label de um bloco temático; fallback para a própria chave quando desconhecida. */
export function blockLabel(block: string): string {
  return BLOCK_LABELS[block] ?? block
}

/** Texto da badge de lente; '' quando não há lente (sales). */
export function lensLabel(lens: 'produto' | 'dados' | null): string {
  if (lens === 'produto') return 'Produto'
  if (lens === 'dados') return 'Dados'
  return ''
}

/**
 * Variante de badge de lente — o componente escolhe as classes (cores) por
 * variante; este helper só decide QUAL variante, nunca a classe CSS.
 * 'none' cobre tanto `lens === null` quanto qualquer valor fora do enum
 * (nunca deriva uma classe arbitrária a partir de um valor desconhecido).
 */
export function lensBadgeVariant(lens: 'produto' | 'dados' | null): 'produto' | 'dados' | 'none' {
  if (lens === 'produto') return 'produto'
  if (lens === 'dados') return 'dados'
  return 'none'
}

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
/**
 * Decide a visibilidade do botão manual "Relatório" da topbar da sessão ativa
 * (dispara `POST /sessions/{id}/report`, sem gate de readiness no backend —
 * ver threat T-05-01). Fail-closed: só pode aparecer depois que o primeiro
 * `initial_state` do WebSocket chegou — nunca decide a partir de um
 * `coverage` que nasce `{}` (montagem do componente ou reconexão, já que
 * `useSessionWS` não reconecta sozinho) — E quando a cobertura indica sales
 * (nenhuma lente). Em discovery, a geração do PRD migra para a página do
 * projeto (D-47), então o botão permanece oculto mesmo pós-initial_state.
 */
export function shouldShowManualReportButton(
  hasReceivedInitialState: boolean,
  coverage: CoverageState
): boolean {
  return hasReceivedInitialState && !isDiscoveryCoverage(coverage)
}

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
