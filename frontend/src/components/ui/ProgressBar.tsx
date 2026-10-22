type BarTone = 'green' | 'amber' | 'red'

const FILL: Record<BarTone, string> = { green: 'bg-ds-green', amber: 'bg-ds-amber', red: 'bg-ds-red' }

interface ProgressBarProps {
  pct: number
  tone?: BarTone
  height?: number
  className?: string
  label?: string
}

export default function ProgressBar({ pct, tone = 'green', height = 6, className = '', label }: ProgressBarProps) {
  const value = Math.max(0, Math.min(100, pct))
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuenow={Math.round(value)}
      aria-valuemin={0}
      aria-valuemax={100}
      className={`rounded-[3px] bg-white/[0.08] overflow-hidden ${className}`}
      style={{ height }}
    >
      <div className={`h-full transition-all duration-500 ${FILL[tone]}`} style={{ width: `${value}%` }} />
    </div>
  )
}
