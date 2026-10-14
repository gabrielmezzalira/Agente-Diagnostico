import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Clock, Pencil, Trash2 } from 'lucide-react'
import type { Session } from '../../lib/api'
import { formatDateTime, sessionDurationLabel } from '../../lib/labels'
import { Card, Chip, SectionLabel } from '../ui'

interface SessionHistoryProps {
  sessions: Session[]
  onRename: (sessionId: string, name: string) => void | Promise<void>
  onDelete: (sessionId: string) => void | Promise<void>
}

/** Histórico de sessões do projeto: linha clicável com renomear e excluir. */
export default function SessionHistory({ sessions, onRename, onDelete }: SessionHistoryProps) {
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [value, setValue] = useState('')

  function startRename(s: Session, e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    setRenamingId(s.id)
    setValue(s.name ?? '')
  }

  async function commit(sessionId: string) {
    const name = value.trim()
    setRenamingId(null)
    if (name) await onRename(sessionId, name)
  }

  return (
    <section className="flex flex-col gap-3" aria-label="Sessões do projeto">
      <SectionLabel>Sessões · {sessions.length}</SectionLabel>
      <Card>
        {sessions.map((s, i) => (
          <Link
            key={s.id}
            to={`/sessions/${s.id}`}
            className={`flex items-center justify-between gap-4 px-6 py-4 transition-colors hover:bg-white/[0.03] ${i > 0 ? 'border-t border-ds-border' : ''}`}
          >
            <div className="flex items-center gap-3 min-w-0 flex-1">
              {s.status === 'active' ? <Chip tone="green" dot>ativa</Chip> : <Chip>encerrada</Chip>}
              <div className="min-w-0">
                {renamingId === s.id ? (
                  <input
                    autoFocus
                    aria-label="Nome da sessão"
                    value={value}
                    onChange={e => setValue(e.target.value)}
                    onBlur={() => commit(s.id)}
                    onClick={e => e.preventDefault()}
                    onKeyDown={e => {
                      if (e.key === 'Enter') commit(s.id)
                      if (e.key === 'Escape') setRenamingId(null)
                    }}
                    className="text-[14px] font-medium text-white border-b border-ds-green bg-transparent outline-none w-48"
                  />
                ) : (
                  <span className="text-[14px] font-medium text-white truncate block">
                    {s.name ?? formatDateTime(s.started_at)}
                  </span>
                )}
                <span className="font-mono text-[12px] text-ds-muted">{formatDateTime(s.started_at)}</span>
              </div>
            </div>
            <div className="flex items-center gap-3 shrink-0 text-[12.5px] text-ds-muted">
              <span className="flex items-center gap-1 font-mono">
                <Clock size={12} aria-hidden />
                {sessionDurationLabel(s.started_at, s.finished_at)}
              </span>
              {parseFloat(s.cost_usd) > 0 && (
                <span className="font-mono">${parseFloat(s.cost_usd).toFixed(4)}</span>
              )}
              <button
                type="button"
                onClick={e => startRename(s, e)}
                aria-label="Renomear sessão"
                title="Renomear"
                className="p-1.5 rounded-md hover:text-ds-green transition-colors"
              >
                <Pencil size={13} aria-hidden />
              </button>
              {s.status !== 'active' && (
                <button
                  type="button"
                  onClick={e => {
                    e.preventDefault()
                    e.stopPropagation()
                    void onDelete(s.id)
                  }}
                  aria-label="Excluir sessão"
                  title="Excluir"
                  className="p-1.5 rounded-md hover:text-ds-red transition-colors"
                >
                  <Trash2 size={13} aria-hidden />
                </button>
              )}
            </div>
          </Link>
        ))}
      </Card>
    </section>
  )
}
