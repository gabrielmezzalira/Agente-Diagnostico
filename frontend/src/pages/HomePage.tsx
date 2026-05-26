import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Activity, Database } from 'lucide-react'
import { api, type Project } from '../lib/api'

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

export default function HomePage() {
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api.projects
      .list()
      .then(setProjects)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="min-h-screen bg-[var(--color-bg-page)]">
      <div className="border-b border-[var(--color-border-std)] bg-[var(--color-surface)]">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Database size={18} className="text-[var(--color-accent)]" />
            <span className="font-semibold text-[var(--color-text-primary)] text-sm">
              Agente Diagnóstico
            </span>
          </div>
          <Link
            to="/projects/new"
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--color-accent)] text-white rounded-md text-sm font-medium hover:bg-[var(--color-accent-hover)] transition-colors"
          >
            <Plus size={14} />
            Novo projeto
          </Link>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-8">
        <h1 className="text-lg font-semibold text-[var(--color-text-primary)] mb-5">Projetos</h1>

        {loading && (
          <p className="text-sm text-[var(--color-text-secondary)]">Carregando...</p>
        )}

        {error && (
          <div className="text-sm text-[var(--color-red)] bg-[var(--color-red-bg)] border border-[var(--color-border-red)] rounded-md px-4 py-3">
            {error}
          </div>
        )}

        {!loading && !error && projects.length === 0 && (
          <div className="text-center py-16 text-[var(--color-text-secondary)]">
            <Database size={28} className="mx-auto mb-3 opacity-25" />
            <p className="text-sm">Nenhum projeto ainda.</p>
            <Link
              to="/projects/new"
              className="text-sm text-[var(--color-accent)] hover:underline mt-1 inline-block"
            >
              Criar o primeiro projeto
            </Link>
          </div>
        )}

        <div className="space-y-2">
          {projects.map(project => (
            <Link
              key={project.id}
              to={`/projects/${project.id}`}
              className="flex items-center justify-between gap-4 bg-[var(--color-surface)] border border-[var(--color-border-std)] rounded-lg px-5 py-4 hover:border-[var(--color-border-hover)] transition-colors"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm text-[var(--color-text-primary)] truncate">
                    {project.name}
                  </span>
                  {project.has_active_session && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-[var(--color-green-bg-tag)] text-[var(--color-accent)] border border-[var(--color-border-green)] shrink-0">
                      <Activity size={9} />
                      ao vivo
                    </span>
                  )}
                </div>
                <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">{project.client}</p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {project.project_type && (
                  <span className="text-xs px-2 py-0.5 rounded bg-[var(--color-muted)] text-[var(--color-text-secondary)]">
                    {PROJECT_TYPE_LABELS[project.project_type] ?? project.project_type}
                  </span>
                )}
                {project.data_maturity_score && (
                  <span className="text-xs text-[var(--color-text-secondary)]">
                    DMS {project.data_maturity_score} · {DMS_LABELS[project.data_maturity_score]}
                  </span>
                )}
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
