import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Activity, ChevronLeft, Clock, Edit2, Play, Trash2 } from 'lucide-react'
import { api, type Project, type Session } from '../lib/api'

const PROJECT_TYPE_LABELS: Record<string, string> = {
  bi: 'BI',
  ml: 'ML',
  data_engineering: 'Eng. de Dados',
  automation: 'Automação',
  integration: 'Integração',
  science: 'Ciência de Dados',
}

const DMS_LABELS: Record<number, string> = {
  1: 'Inicial',
  2: 'Gerenciado',
  3: 'Definido',
  4: 'Quantificado',
  5: 'Otimizado',
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 px-4 py-3">
      <span className="text-sm text-[var(--color-text-secondary)] shrink-0">{label}</span>
      <span className="text-sm text-[var(--color-text-primary)] text-right">{children}</span>
    </div>
  )
}

function sessionDuration(session: Session): string {
  const start = new Date(session.started_at)
  const end = session.finished_at ? new Date(session.finished_at) : new Date()
  const mins = Math.floor((end.getTime() - start.getTime()) / 60000)
  if (mins < 1) return '< 1 min'
  return `${mins} min`
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [project, setProject] = useState<Project | null>(null)
  const [sessions, setSessions] = useState<Session[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    if (!id) return
    Promise.all([api.projects.get(id), api.sessions.list(id)])
      .then(([p, s]) => {
        setProject(p)
        setSessions(s)
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
  }, [id])

  async function handleDelete() {
    if (!id || !confirm('Excluir este projeto?')) return
    setDeleting(true)
    try {
      await api.projects.delete(id)
      navigate('/')
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erro ao excluir')
      setDeleting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--color-bg-page)] flex items-center justify-center">
        <span className="text-sm text-[var(--color-text-secondary)]">Carregando...</span>
      </div>
    )
  }

  if (error || !project) {
    return (
      <div className="min-h-screen bg-[var(--color-bg-page)] flex items-center justify-center">
        <span className="text-sm text-[var(--color-red)]">{error ?? 'Projeto não encontrado'}</span>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[var(--color-bg-page)]">
      <div className="border-b border-[var(--color-border-std)] bg-[var(--color-surface)]">
        <div className="max-w-2xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              to="/"
              className="text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors"
            >
              <ChevronLeft size={18} />
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-semibold text-sm text-[var(--color-text-primary)]">
                  {project.name}
                </h1>
                {project.has_active_session && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-[var(--color-green-bg-tag)] text-[var(--color-accent)] border border-[var(--color-border-green)]">
                    <Activity size={9} />
                    ao vivo
                  </span>
                )}
              </div>
              <p className="text-xs text-[var(--color-text-secondary)]">{project.client}</p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <Link
              to={`/projects/${id}/edit`}
              className="p-2 text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] rounded-md transition-colors"
            >
              <Edit2 size={15} />
            </Link>
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="p-2 text-[var(--color-text-secondary)] hover:text-[var(--color-red)] rounded-md transition-colors disabled:opacity-50"
            >
              <Trash2 size={15} />
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-6 py-8 space-y-5">
        {error && (
          <div className="text-sm text-[var(--color-red)] bg-[var(--color-red-bg)] border border-[var(--color-border-red)] rounded-md px-4 py-3">
            {error}
          </div>
        )}

        {/* CTA principal */}
        <Link
          to={`/projects/${id}/sessions/new`}
          className="w-full flex items-center justify-center gap-2 py-3 bg-[var(--color-accent)] text-white rounded-lg text-sm font-medium hover:bg-[var(--color-accent-hover)] transition-colors"
        >
          <Play size={15} />
          Nova sessão
        </Link>

        {/* Dados do projeto */}
        <div className="bg-[var(--color-surface)] border border-[var(--color-border-std)] rounded-lg divide-y divide-[var(--color-border-std)]">
          <Row label="Tipo de projeto">
            {project.project_type
              ? (PROJECT_TYPE_LABELS[project.project_type] ?? project.project_type)
              : '—'}
          </Row>
          <Row label="Data Maturity Score">
            {project.data_maturity_score
              ? `${project.data_maturity_score} · ${DMS_LABELS[project.data_maturity_score]}`
              : '—'}
          </Row>
          <Row label="Fonte de transcrição">
            <span className="capitalize">{project.source}</span>
          </Row>
          <Row label="Budget de IA">
            {project.budget_usd ? `$${project.budget_usd}` : 'Sem limite'}
          </Row>
          <Row label="TTL de perguntas">{project.question_ttl_seconds}s</Row>
          <Row label="Chave Gemini">
            {project.has_api_key ? (
              <span className="text-[var(--color-accent)] text-xs font-medium">Configurada</span>
            ) : (
              <span className="text-[var(--color-red)] text-xs">Não configurada</span>
            )}
          </Row>
          {project.meeting_url && (
            <Row label="URL da reunião">
              <a
                href={project.meeting_url}
                target="_blank"
                rel="noreferrer"
                className="text-[var(--color-accent)] hover:underline truncate max-w-xs block"
              >
                {project.meeting_url}
              </a>
            </Row>
          )}
        </div>

        {project.pre_meeting_context && (
          <div className="bg-[var(--color-surface)] border border-[var(--color-border-std)] rounded-lg p-4">
            <p className="text-xs font-medium text-[var(--color-text-secondary)] mb-2">
              Contexto pré-reunião
            </p>
            <p className="text-sm text-[var(--color-text-primary)] whitespace-pre-wrap">
              {project.pre_meeting_context}
            </p>
          </div>
        )}

        {project.description && (
          <div className="bg-[var(--color-surface)] border border-[var(--color-border-std)] rounded-lg p-4">
            <p className="text-xs font-medium text-[var(--color-text-secondary)] mb-2">Descrição</p>
            <p className="text-sm text-[var(--color-text-primary)]">{project.description}</p>
          </div>
        )}

        {/* Histórico de sessões */}
        {sessions.length > 0 && (
          <div>
            <h2 className="text-sm font-medium text-[var(--color-text-primary)] mb-3">Sessões</h2>
            <div className="space-y-2">
              {sessions.map(s => (
                <Link
                  key={s.id}
                  to={`/sessions/${s.id}`}
                  className="flex items-center justify-between gap-4 bg-[var(--color-surface)] border border-[var(--color-border-std)] rounded-lg px-4 py-3 hover:border-[var(--color-border-hover)] transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {s.status === 'active' ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-[var(--color-green-bg-tag)] text-[var(--color-accent)] border border-[var(--color-border-green)] shrink-0">
                        <Activity size={9} />
                        ativa
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-[var(--color-muted)] text-[var(--color-text-secondary)] shrink-0">
                        encerrada
                      </span>
                    )}
                    <span className="text-xs text-[var(--color-text-secondary)] truncate">
                      {formatDate(s.started_at)}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 shrink-0 text-xs text-[var(--color-text-secondary)]">
                    <span className="flex items-center gap-1">
                      <Clock size={11} />
                      {sessionDuration(s)}
                    </span>
                    {parseFloat(s.cost_usd) > 0 && (
                      <span>${parseFloat(s.cost_usd).toFixed(4)}</span>
                    )}
                    <span className="capitalize">{s.source}</span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
