import type { ReactNode } from 'react'

/** Rótulo de seção: mono 11px, caixa alta, cor muted. */
export function SectionLabel({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <span className={`ds-label ${className}`}>{children}</span>
}

/** Eyebrow verde com traço de 18×2px antes do texto. */
export function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-center gap-2.5">
      <span aria-hidden className="w-[18px] h-0.5 bg-ds-green" />
      <span className="font-mono text-[11px] tracking-[0.16em] uppercase text-ds-green font-medium">{children}</span>
    </div>
  )
}

interface PageHeaderProps {
  eyebrow?: string
  title: string
  subtitle?: ReactNode
  actions?: ReactNode
}

/** Cabeçalho de página: eyebrow, H1 de 44px e subtítulo, com ações à direita. */
export function PageHeader({ eyebrow, title, subtitle, actions }: PageHeaderProps) {
  return (
    <div className="flex items-end justify-between gap-6">
      <div className="flex flex-col gap-3 min-w-0">
        {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
        <h1 className="m-0 text-[44px] leading-[1.05] font-bold tracking-[-0.035em] text-white">{title}</h1>
        {subtitle && <p className="m-0 text-[15.5px] leading-[1.55] text-ds-muted text-pretty">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2.5 shrink-0">{actions}</div>}
    </div>
  )
}
