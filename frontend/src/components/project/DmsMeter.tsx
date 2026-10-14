import { DMS_LABELS } from '../../lib/labels'

/** Cinco barrinhas (nível de maturidade) + rótulo "3 · Definido". */
export default function DmsMeter({ score }: { score: number | null }) {
  if (!score) return <span className="text-ds-dim">—</span>
  return (
    <span className="inline-flex items-center gap-2.5">
      <span className="inline-flex gap-[3px]" aria-hidden>
        {[1, 2, 3, 4, 5].map(n => (
          <span key={n} className={`w-3.5 h-1.5 rounded-sm ${n <= score ? 'bg-ds-green' : 'bg-white/10'}`} />
        ))}
      </span>
      {score} · {DMS_LABELS[score]}
    </span>
  )
}
