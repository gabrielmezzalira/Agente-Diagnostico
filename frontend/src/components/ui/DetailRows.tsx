import type { ReactNode } from 'react'
import Card from './Card'

export interface DetailRow {
  label: string
  value: ReactNode
}

/** Lista "rótulo à esquerda, valor à direita" dentro de um cartão, com linhas separadas por borda. */
export default function DetailRows({ rows, className = '' }: { rows: DetailRow[]; className?: string }) {
  return (
    <Card className={className}>
      {rows.map((row, i) => (
        <div
          key={row.label}
          className={`flex items-center justify-between gap-5 px-6 py-[18px] ${i > 0 ? 'border-t border-ds-border' : ''}`}
        >
          <span className="text-[14px] text-ds-muted shrink-0">{row.label}</span>
          <span className="text-[14.5px] text-white font-medium text-right min-w-0 break-words">{row.value}</span>
        </div>
      ))}
    </Card>
  )
}
