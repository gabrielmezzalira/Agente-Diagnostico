import type { ReactNode } from 'react'
import Card from './Card'
import { SectionLabel } from './Typography'

export default function StatCard({ label, value }: { label: string; value: ReactNode }) {
  return (
    <Card className="px-[26px] py-6 flex flex-col gap-3">
      <SectionLabel>{label}</SectionLabel>
      <span className="text-[36px] font-bold tracking-[-0.03em] text-white leading-none">{value}</span>
    </Card>
  )
}
