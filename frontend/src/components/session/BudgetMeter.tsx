import { ProgressBar } from '../ui'

interface BudgetMeterProps {
  used: number
  limit: number | null
  estimated: number
  status: string
}

const fmt = (v: number) => `$${v.toFixed(4)}`

/** Orçamento de IA no topo da sessão: barra, "$x de $y" e aviso quando o saldo não cobre o relatório. */
export default function BudgetMeter({ used, limit, estimated, status }: BudgetMeterProps) {
  const pct = limit ? Math.min((used / limit) * 100, 100) : 0
  const tone = status === 'insufficient' || status === 'critical' ? 'red' : status === 'warning' ? 'amber' : 'green'

  return (
    <div className="flex items-center gap-3">
      <ProgressBar pct={pct} tone={tone} className="w-[220px]" label="Orçamento de IA consumido" />
      <span className="font-mono text-[12px] text-ds-muted whitespace-nowrap">
        {limit ? `${fmt(used)} de ${fmt(limit)}` : `${fmt(used)} consumido`}
      </span>
      {status === 'insufficient' && (
        <span className="text-[12px] text-ds-red font-medium whitespace-nowrap">
          Saldo insuficiente para relatório (~{fmt(estimated)})
        </span>
      )}
    </div>
  )
}
