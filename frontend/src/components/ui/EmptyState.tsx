import type { ReactNode } from 'react'

/** Estado vazio: borda tracejada e texto apagado. */
export default function EmptyState({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`px-3 py-7 border border-dashed border-ds-border-strong rounded-xl text-center text-[13px] text-ds-dim ${className}`}
    >
      {children}
    </div>
  )
}

/** Aviso de erro em cartão vermelho suave. */
export function ErrorNotice({ children }: { children: ReactNode }) {
  return (
    <div role="alert" className="text-[13.5px] text-ds-red bg-ds-red/10 border border-ds-red/30 rounded-xl px-4 py-3">
      {children}
    </div>
  )
}
