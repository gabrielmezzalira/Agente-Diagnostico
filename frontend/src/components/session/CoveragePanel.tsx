import { RefreshCw } from 'lucide-react'
import type { CoverageArea, CoverageState } from '../../lib/useSessionWS'
import { groupCoverageByLens, isDiscoveryCoverage } from '../../lib/lens'
import { EmptyState, ProgressBar, type Tone } from '../ui'
import { StatusDot } from '../ui'
import PanelHeader from './PanelHeader'

const AREA_TONE: Record<string, { dot: Tone; bar: 'green' | 'amber' | 'red' }> = {
  covered: { dot: 'green', bar: 'green' },
  partial: { dot: 'amber', bar: 'amber' },
  uncovered: { dot: 'neutral', bar: 'green' },
  not_applicable: { dot: 'neutral', bar: 'green' },
}

function AreaRow({ area, info }: { area: string; info: CoverageArea }) {
  const tone = AREA_TONE[info.status] ?? AREA_TONE.uncovered
  return (
    <div className="px-3 py-2.5 rounded-lg hover:bg-white/[0.03] transition-colors" title={info.notes || undefined}>
      <div className="flex items-center gap-2.5 mb-1.5">
        <StatusDot tone={tone.dot} />
        <span className="text-[13px] text-ds-text truncate flex-1">{info.name || area}</span>
        <span className="font-mono text-[12px] text-ds-muted tabular-nums">{info.score}%</span>
      </div>
      <ProgressBar pct={info.score} tone={tone.bar} height={5} className="ml-[17px]" label={`Cobertura de ${info.name || area}`} />
    </div>
  )
}

function GroupLabel({ children }: { children: string }) {
  return <div className="px-3 pt-3 pb-1.5 ds-label">{children}</div>
}

/** Coluna esquerda: cobertura por área (vendas: lista plana; discovery: duas seções por lente). */
export default function CoveragePanel({ coverage, onForceClassify }: { coverage: CoverageState; onForceClassify: () => void }) {
  const isEmpty = Object.keys(coverage).length === 0
  const isDiscovery = !isEmpty && isDiscoveryCoverage(coverage)

  let body: React.ReactNode
  if (isEmpty) {
    // D-46: nunca inventar áreas fixas — placeholder até o initial_state chegar.
    body = <EmptyState>Aguardando classificação…</EmptyState>
  } else if (isDiscovery) {
    // D-43: duas seções por lente, na ordem do payload; cabeçalho mesmo com 0 áreas ativas.
    const grouped = groupCoverageByLens(coverage)
    body = (['produto', 'dados'] as const).map(lensKey => (
      <div key={lensKey}>
        <GroupLabel>{lensKey === 'produto' ? 'Produto' : 'Dados'}</GroupLabel>
        {grouped[lensKey]
          .filter(([, i]) => i.status !== 'not_applicable')
          .map(([area, info]) => <AreaRow key={area} area={area} info={info} />)}
      </div>
    ))
  } else {
    const active = Object.entries(coverage).filter(([, i]) => i.status !== 'not_applicable')
    const inactive = Object.entries(coverage).filter(([, i]) => i.status === 'not_applicable')
    body = (
      <>
        {active.map(([area, info]) => <AreaRow key={area} area={area} info={info} />)}
        {inactive.length > 0 && (
          <>
            <div className="mx-3 my-2 border-t border-ds-border" />
            {inactive.map(([area, info]) => (
              <div key={area} className="px-3 py-1.5 flex items-center gap-2.5 opacity-40">
                <span aria-hidden className="w-[7px] h-[7px] rounded-full border border-ds-dim shrink-0" />
                <span className="text-[13px] text-ds-muted truncate flex-1">{info.name || area}</span>
                <span className="font-mono text-[11px] text-ds-muted">N/A</span>
              </div>
            ))}
          </>
        )}
      </>
    )
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      <PanelHeader
        title="Cobertura"
        action={
          <button
            type="button"
            onClick={onForceClassify}
            title="Forçar classificação"
            aria-label="Forçar classificação"
            className="p-1.5 rounded-md text-ds-muted hover:text-ds-green hover:bg-white/[0.05] transition-colors"
          >
            <RefreshCw size={14} aria-hidden />
          </button>
        }
      />
      <div className="flex-1 overflow-y-auto px-3 py-4">{body}</div>
    </div>
  )
}
