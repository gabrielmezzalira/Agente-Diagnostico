import type { ReactNode } from 'react'

export type Tone = 'neutral' | 'green' | 'red' | 'amber' | 'violet'

const CHIP_TONES: Record<Tone, string> = {
  neutral: 'bg-white/[0.05] text-ds-text-2 border-ds-border',
  green: 'bg-ds-green-soft text-ds-green border-ds-green-line',
  red: 'bg-ds-red/10 text-ds-red border-ds-red/30',
  amber: 'bg-ds-amber/10 text-ds-amber border-ds-amber/30',
  violet: 'bg-ds-violet/10 text-ds-violet border-ds-violet/30',
}

const DOT_TONES: Record<Tone, string> = {
  neutral: 'bg-ds-dim',
  green: 'bg-ds-green shadow-[0_0_8px_#3ee06f]',
  red: 'bg-ds-red shadow-[0_0_8px_#ff6b6b]',
  amber: 'bg-ds-amber shadow-[0_0_8px_#f2c14e]',
  violet: 'bg-ds-violet shadow-[0_0_8px_#b197fc]',
}

/** Ponto de status de 7px com brilho. */
export function StatusDot({ tone = 'green', className = '' }: { tone?: Tone; className?: string }) {
  return <span aria-hidden className={`inline-block w-[7px] h-[7px] rounded-full shrink-0 ${DOT_TONES[tone]} ${className}`} />
}

interface ChipProps {
  tone?: Tone
  dot?: boolean
  children: ReactNode
  className?: string
}

/** Pílula de 12px/600 com cor suave do estado. */
export default function Chip({ tone = 'neutral', dot = false, children, className = '' }: ChipProps) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[12px] font-semibold whitespace-nowrap ${CHIP_TONES[tone]} ${className}`}
    >
      {dot && <StatusDot tone={tone} />}
      {children}
    </span>
  )
}
