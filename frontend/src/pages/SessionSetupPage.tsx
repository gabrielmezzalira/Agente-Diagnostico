import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ChevronLeft, Play } from 'lucide-react'
import { api, type Project, type SessionCreate } from '../lib/api'

const inputCls =
  'w-full px-3 py-2 text-sm border border-[var(--color-border-std)] rounded-md bg-[var(--color-surface)] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-secondary)] focus:outline-none focus:border-[var(--color-accent)] transition-colors'

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium text-[var(--color-text-primary)]">{label}</label>
      {children}
    </div>
  )
}

export default function SessionSetupPage() {
  const { id: projectId } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [project, setProject] = useState<Project | null>(null)
  const [loadingProject, setLoadingProject] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [meetingUrl, setMeetingUrl] = useState('')
  const [source, setSource] = useState<'extension' | 'recall'>('extension')
  const [additionalContext, setAdditionalContext] = useState('')
  const [budgetUsd, setBudgetUsd] = useState<number | undefined>(undefined)

  useEffect(() => {
    if (!projectId) return
    api.projects
      .get(projectId)
      .then(p => {
        setProject(p)
        setMeetingUrl(p.meeting_url ?? '')
        setSource(p.source === 'recall' ? 'recall' : 'extension')
        setBudgetUsd(p.budget_usd ? Number(p.budget_usd) : undefined)
        setLoadingProject(false)
      })
      .catch((e: Error) => {
        setError(e.message)
        setLoadingProject(false)
      })
  }, [projectId])

  async function handleStart(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!projectId) return
    setSubmitting(true)
    setError(null)

    const payload: SessionCreate = {
      project_id: projectId,
      source,
      ...(meetingUrl ? { meeting_url: meetingUrl } : {}),
      ...(additionalContext ? { additional_context: additionalContext } : {}),
      ...(budgetUsd !== undefined ? { budget_usd: budgetUsd } : {}),
    }

    try {
      const session = await api.sessions.create(payload)
      navigate(`/sessions/${session.id}`)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erro ao iniciar sessão')
      setSubmitting(false)
    }
  }

  if (loadingProject) {
    return (
      <div className="min-h-screen bg-[var(--color-bg-page)] flex items-center justify-center">
        <span className="text-sm text-[var(--color-text-secondary)]">Carregando...</span>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[var(--color-bg-page)]">
      <div className="border-b border-[var(--color-border-std)] bg-[var(--color-surface)]">
        <div className="max-w-2xl mx-auto px-6 py-4 flex items-center gap-3">
          <Link
            to={`/projects/${projectId}`}
            className="text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors"
          >
            <ChevronLeft size={18} />
          </Link>
          <div>
            <h1 className="font-semibold text-sm text-[var(--color-text-primary)]">Nova sessão</h1>
            {project && (
              <p className="text-xs text-[var(--color-text-secondary)]">
                {project.name} · {project.client}
              </p>
            )}
          </div>
        </div>
      </div>

      <form onSubmit={handleStart} className="max-w-2xl mx-auto px-6 py-8 space-y-5">
        {error && (
          <div className="text-sm text-[var(--color-red)] bg-[var(--color-red-bg)] border border-[var(--color-border-red)] rounded-md px-4 py-3">
            {error}
          </div>
        )}

        <Field label="URL da reunião">
          <input
            type="url"
            value={meetingUrl}
            onChange={e => setMeetingUrl(e.target.value)}
            placeholder="https://meet.google.com/..."
            className={inputCls}
          />
        </Field>

        <Field label="Fonte de transcrição">
          <div className="flex gap-5 mt-0.5">
            {([
              { value: 'extension', label: 'Extensão Chrome (gratuito)' },
              { value: 'recall', label: 'Recall.ai (bot automático)' },
            ] as const).map(({ value, label }) => (
              <label key={value} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="source"
                  value={value}
                  checked={source === value}
                  onChange={() => setSource(value)}
                  className="accent-[var(--color-accent)]"
                />
                <span className="text-sm">{label}</span>
              </label>
            ))}
          </div>
        </Field>

        <Field label="Contexto adicional desta reunião">
          <textarea
            rows={3}
            value={additionalContext}
            onChange={e => setAdditionalContext(e.target.value)}
            placeholder="Algo específico desta reunião que o agente deve saber..."
            className={inputCls}
          />
          {project?.pre_meeting_context && (
            <p className="text-xs text-[var(--color-text-secondary)]">
              Complementa o contexto do projeto já configurado.
            </p>
          )}
        </Field>

        <Field label="Budget desta sessão (USD)">
          <input
            type="number"
            min={0}
            step={0.01}
            value={budgetUsd ?? ''}
            onChange={e => setBudgetUsd(e.target.value ? Number(e.target.value) : undefined)}
            placeholder={
              project?.budget_usd
                ? `Herda do projeto ($${project.budget_usd})`
                : 'Sem limite'
            }
            className={inputCls}
          />
        </Field>

        <div className="flex items-center gap-3 pt-2">
          <button
            type="submit"
            disabled={submitting}
            className="flex items-center gap-2 px-5 py-2.5 bg-[var(--color-accent)] text-white rounded-md text-sm font-medium hover:bg-[var(--color-accent-hover)] transition-colors disabled:opacity-50"
          >
            <Play size={14} />
            {submitting ? 'Iniciando...' : 'Iniciar sessão'}
          </button>
          <Link
            to={`/projects/${projectId}`}
            className="text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors"
          >
            Cancelar
          </Link>
        </div>
      </form>
    </div>
  )
}
