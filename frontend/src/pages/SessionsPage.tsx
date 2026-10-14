import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import { api, type Project, type Session } from '../lib/api'
import { formatDateTime, sessionDurationLabel } from '../lib/labels'
import AppShell from '../components/layout/AppShell'
import { Card, Chip, EmptyState, ErrorNotice, PageHeader } from '../components/ui'

interface SessionRow {
  session: Session
  project: Project
}

/** Todas as sessões de todos os projetos, da mais recente para a mais antiga. */
export default function SessionsPage() {
  const [rows, setRows] = useState<SessionRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [partial, setPartial] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const projects = await api.projects.list()
        const results = await Promise.allSettled(projects.map(p => api.sessions.list(p.id)))
        if (cancelled) return
        const all: SessionRow[] = []
        results.forEach((r, i) => {
          if (r.status === 'fulfilled') r.value.forEach(session => all.push({ session, project: projects[i] }))
        })
        all.sort((a, b) => new Date(b.session.started_at).getTime() - new Date(a.session.started_at).getTime())
        setRows(all)
        setPartial(results.some(r => r.status === 'rejected'))
      } catch (e: unknown) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Erro ao carregar sessões')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => { cancelled = true }
  }, [])

  const live = rows.filter(r => r.session.status === 'active').length

  return (
    <AppShell>
      <PageHeader
        eyebrow="Diagnóstico"
        title="Sessões"
        subtitle={
          loading || error
            ? undefined
            : rows.length === 0
              ? 'Nenhuma sessão ainda.'
              : `${rows.length} ${rows.length === 1 ? 'sessão' : 'sessões'}${live > 0 ? ` · ${live} ao vivo` : ''}.`
        }
      />

      {loading && <p className="text-[14px] text-ds-muted">Carregando…</p>}
      {error && <ErrorNotice>{error}</ErrorNotice>}
      {partial && <ErrorNotice>Não foi possível carregar as sessões de alguns projetos.</ErrorNotice>}
      {!loading && !error && rows.length === 0 && <EmptyState>Inicie uma sessão a partir de um projeto.</EmptyState>}

      {rows.length > 0 && (
        <Card>
          {rows.map(({ session: s, project }, i) => (
            <Link
              key={s.id}
              to={`/sessions/${s.id}`}
              className={`group grid grid-cols-[auto_minmax(0,1fr)_auto_auto_20px] items-center gap-[18px] px-6 py-4 transition-colors hover:bg-white/[0.03] ${i > 0 ? 'border-t border-ds-border' : ''}`}
            >
              {s.status === 'active' ? <Chip tone="green" dot>ao vivo</Chip> : s.status === 'cancelled' ? <Chip tone="amber">cancelada</Chip> : <Chip>encerrada</Chip>}
              <div className="flex flex-col gap-1 min-w-0">
                <span className="text-[15px] font-semibold text-white truncate">{s.name ?? formatDateTime(s.started_at)}</span>
                <span className="text-[13px] text-ds-muted truncate">{project.name} · {project.client}</span>
              </div>
              <span className="font-mono text-[12px] text-ds-muted text-right">
                {sessionDurationLabel(s.started_at, s.finished_at)}
                {parseFloat(s.cost_usd) > 0 && <> · ${parseFloat(s.cost_usd).toFixed(4)}</>}
              </span>
              <span className="font-mono text-[12px] text-ds-dim hidden md:block">{formatDateTime(s.started_at)}</span>
              <ChevronRight size={16} aria-hidden className="text-ds-muted group-hover:text-ds-text transition-colors" />
            </Link>
          ))}
        </Card>
      )}
    </AppShell>
  )
}
