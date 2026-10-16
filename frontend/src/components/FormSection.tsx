import type { ReactNode } from 'react'
import { Card, SectionLabel } from './ui'

/** Bloco do formulário: rótulo de seção + cartão com os campos. */
export default function FormSection({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-col gap-1 px-1">
        <SectionLabel>{title}</SectionLabel>
        {description && <p className="m-0 text-[13px] text-ds-muted">{description}</p>}
      </div>
      <Card className="px-[26px] py-6 flex flex-col gap-5">{children}</Card>
    </section>
  )
}
