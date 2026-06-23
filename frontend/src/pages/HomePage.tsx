import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Activity, Database, Puzzle, ChevronDown, Download, CheckCircle } from 'lucide-react'
import { api, type Project } from '../lib/api'

const EXTENSION_URL =
  'https://github.com/gabrielmezzalira/Agente-Diagnostico/releases/download/v1.0.0/agente-diagnostico-extension-v1.0.0.zip'

const INSTALL_STEPS = [
  'Baixe o arquivo .zip clicando no botão abaixo.',
  'Extraia a pasta do arquivo baixado.',
  'No Chrome, acesse chrome://extensions na barra de endereço.',
  'Ative o "Modo do desenvolvedor" no canto superior direito.',
  'Clique em "Carregar sem compactação" e selecione a pasta extraída.',
  'O ícone do Agente Diagnóstico aparecerá na barra de extensões.',
]

function ExtensionBanner() {
  const [open, setOpen] = useState(false)

  return (
    <div className="mb-6 rounded-lg border border-[var(--color-border-green)] bg-[var(--color-green-bg-light)] overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-[var(--color-green-bg-tag)] transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <Puzzle size={15} className="text-[var(--color-accent)] shrink-0" />
          <div>
            <span className="text-sm font-medium text-[var(--color-text-primary)]">
              Extensão Chrome disponível
            </span>
            <span className="ml-2 text-xs text-[var(--color-text-secondary)]">
              Necessária para capturar transcrições do Google Meet
            </span>
          </div>
        </div>
        <ChevronDown
          size={15}
          className={`text-[var(--color-text-secondary)] transition-transform shrink-0 ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <div className="px-4 pb-4 border-t border-[var(--color-border-green)]">
          <p className="text-xs text-[var(--color-text-secondary)] mt-3 mb-3">
            Instale a extensão no Chrome para que o Agente consiga capturar as transcrições
            da reunião em tempo real.
          </p>

          <ol className="space-y-2 mb-4">
            {INSTALL_STEPS.map((step, i) => (
              <li key={i} className="flex items-start gap-2.5">
                <div className="flex items-center justify-center w-4 h-4 rounded-full bg-[var(--color-accent)] text-white text-[10px] font-bold shrink-0 mt-0.5">
                  {i + 1}
                </div>
                <span className="text-xs text-[var(--color-text-primary)] leading-relaxed">
                  {i === 2 ? (
                    <>
                      No Chrome, acesse{' '}
                      <code className="font-mono bg-[var(--color-muted)] px-1 py-0.5 rounded text-[11px]">
                        chrome://extensions
                      </code>{' '}
                      na barra de endereço.
                    </>
                  ) : (
                    step
                  )}
                </span>
              </li>
            ))}
          </ol>

          <a
            href={EXTENSION_URL}
            download
            className="inline-flex items-center gap-2 px-3 py-2 bg-[var(--color-accent)] text-white text-xs font-medium rounded-md hover:bg-[var(--color-accent-hover)] transition-colors"
          >
            <Download size={13} />
            Baixar extensão v1.0.0
          </a>

          <p className="mt-3 flex items-center gap-1.5 text-xs text-[var(--color-text-secondary)]">
            <CheckCircle size={12} className="text-[var(--color-accent)]" />
            Após instalar, basta abrir o Meet e a extensão começa a capturar automaticamente.
          </p>
        </div>
      )}
    </div>
  )
}

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
        <ExtensionBanner />

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
