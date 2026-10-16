import { useEffect, useState } from 'react'
import { Check, MessageSquarePlus, Pin, X } from 'lucide-react'
import type { WSQuestion } from '../../lib/useSessionWS'
import { blockLabel } from '../../lib/lens'
import { Button, Chip, EmptyState, ProgressBar } from '../ui'
import LensBadge from './LensBadge'
import PanelHeader from './PanelHeader'

/** Barra de TTL por pergunta: verde > 60%, âmbar 30–60%, vermelha < 30%. */
function TTLBar({ expiresAt }: { expiresAt: string }) {
  const [pct, setPct] = useState(100)

  useEffect(() => {
    const exp = new Date(expiresAt).getTime()
    const total = exp - Date.now()
    if (total <= 0) return
    const tick = () => setPct(Math.max(0, ((exp - Date.now()) / total) * 100))
    tick()
    const id = setInterval(tick, 200)
    return () => clearInterval(id)
  }, [expiresAt])

  return (
    <ProgressBar
      pct={pct}
      tone={pct > 60 ? 'green' : pct > 30 ? 'amber' : 'red'}
      height={3}
      className="mt-3"
      label="Tempo restante da pergunta"
    />
  )
}

interface QuestionActions { onPin: () => void; onDismiss: () => void; onUse: () => void }

function IconAction({ label, onClick, hover, children }: { label: string; onClick: () => void; hover: string; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className={`p-1.5 rounded-md text-ds-muted hover:bg-white/[0.06] transition-colors ${hover}`}
    >
      {children}
    </button>
  )
}

function QuestionCard({ question, onPin, onDismiss, onUse }: { question: WSQuestion } & QuestionActions) {
  return (
    <div className="bg-ds-inner border border-ds-inner-border rounded-xl px-3.5 py-3">
      <div className="flex items-start justify-between gap-1.5 mb-2">
        {question.lens != null ? (
          <div className="flex flex-col gap-1 min-w-0 items-start">
            <LensBadge lens={question.lens} />
            <span className="text-[11px] text-ds-muted truncate">{blockLabel(question.block)}</span>
          </div>
        ) : (
          <Chip tone="green">{blockLabel(question.block)}</Chip>
        )}
        <div className="flex items-center shrink-0 -mr-1">
          <IconAction label="Fixar" onClick={onPin} hover="hover:text-ds-green"><Pin size={13} aria-hidden /></IconAction>
          <IconAction label="Marcar como usada" onClick={onUse} hover="hover:text-ds-green"><Check size={13} aria-hidden /></IconAction>
          <IconAction label="Descartar" onClick={onDismiss} hover="hover:text-ds-red"><X size={13} aria-hidden /></IconAction>
        </div>
      </div>
      <p className="m-0 text-[14px] text-ds-text leading-[1.5]">{question.text}</p>
      {question.source === 'pre_mapped' && <p className="m-0 mt-1.5 text-[11px] text-ds-dim">pré-mapeada</p>}
      {question.status === 'queued' && question.expires_at && <TTLBar expiresAt={question.expires_at} />}
    </div>
  )
}

interface QuestionsPanelProps {
  questions: WSQuestion[]
  onGenerateQuestions: () => void
  onPin: (id: string) => void
  onDismiss: (id: string) => void
  onUse: (id: string) => void
}

/** Coluna direita: perguntas pré-mapeadas, fixadas e fila (com TTL). */
export default function QuestionsPanel({ questions, onGenerateQuestions, onPin, onDismiss, onUse }: QuestionsPanelProps) {
  const preMapped = questions.filter(q => q.status === 'pinned' && q.source === 'pre_mapped')
  const pinned = questions.filter(q => q.status === 'pinned' && q.source !== 'pre_mapped')
  const queued = questions.filter(q => q.status === 'queued')

  const group = (title: string | null, list: WSQuestion[]) =>
    list.length > 0 && (
      <div className="flex flex-col gap-2">
        {title && <p className="m-0 ds-label">{title}</p>}
        {list.map(q => (
          <QuestionCard
            key={q.id}
            question={q}
            onPin={() => onPin(q.id)}
            onDismiss={() => onDismiss(q.id)}
            onUse={() => onUse(q.id)}
          />
        ))}
      </div>
    )

  return (
    <div className="flex flex-col h-full min-h-0">
      <PanelHeader
        title="Perguntas"
        action={
          <Button variant="active" size="sm" onClick={onGenerateQuestions}>
            <MessageSquarePlus size={13} aria-hidden /> Gerar
          </Button>
        }
      />
      <div className="flex-1 overflow-y-auto px-5 py-5 flex flex-col gap-4">
        {group('Pré-reunião', preMapped)}
        {group('Fixadas', pinned)}
        {group(pinned.length > 0 ? 'Fila' : null, queued)}
        {preMapped.length === 0 && pinned.length === 0 && queued.length === 0 && (
          <EmptyState>Nenhuma pergunta na fila</EmptyState>
        )}
      </div>
    </div>
  )
}
