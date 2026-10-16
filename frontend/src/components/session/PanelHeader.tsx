import type { ReactNode } from 'react'
import { SectionLabel } from '../ui'

/** Cabeçalho de 56px das colunas laterais da sessão ao vivo. */
export default function PanelHeader({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <div className="h-14 shrink-0 flex items-center justify-between px-5 border-b border-ds-border">
      <SectionLabel>{title}</SectionLabel>
      {action}
    </div>
  )
}
