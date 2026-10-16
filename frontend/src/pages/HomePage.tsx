import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Database, Plus } from 'lucide-react'
import { api, type Project } from '../lib/api'
import AppShell from '../components/layout/AppShell'
import ProjectRow from '../components/ProjectRow'
import { ButtonLink, Card, ErrorNotice, PageHeader, StatusDot } from '../components/ui'

function ExtensionBanner() {
  return (
    <Card highlight>
      <div className="flex items-center gap-4 px-[22px] py-[18px] flex-wrap">
        <StatusDot tone="green" />
        <span className="text-[15px] font-semibold text-white">Extensão Chrome disponível</span>
        <span className="text-[13.5px] text-ds-muted">Necessária para capturar transcrições do Google Meet</span>
        <span className="ml-auto">
          <ButtonLink to="/extension" variant="secondary">Instalar extensão</ButtonLink>
        </span>
      </div>
    </Card>
  )
}

export default function HomePage() {
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [params] = useSearchParams()
  const query = (params.get('q') ?? '').trim().toLowerCase()

  useEffect(() => {
    api.projects
      .list()
      .then(setProjects)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  const visible = useMemo(
    () =>
      query
        ? projects.filter(p => `${p.name} ${p.client}`.toLowerCase().includes(query))
        : projects,
    [projects, query],
  )

  const subtitle = loading || error
    ? undefined
    : query
      ? `${visible.length} de ${projects.length} ${projects.length === 1 ? 'projeto' : 'projetos'} para "${params.get('q')}".`
      : projects.length === 0
        ? 'Nenhum projeto ainda.'
        : `${projects.length} ${projects.length === 1 ? 'projeto' : 'projetos'} em diagnóstico.`

  return (
    <AppShell
      actions={
        <ButtonLink to="/projects/new" variant="primary">
          <Plus size={14} aria-hidden /> Novo projeto
        </ButtonLink>
      }
    >
      <ExtensionBanner />
      <PageHeader eyebrow="Diagnóstico" title="Projetos" subtitle={subtitle} />

      {loading && <p className="text-[14px] text-ds-muted">Carregando…</p>}
      {error && <ErrorNotice>{error}</ErrorNotice>}

      {!loading && !error && projects.length === 0 && (
        <Card className="py-16 flex flex-col items-center gap-4 text-center">
          <span className="w-14 h-14 rounded-2xl bg-ds-inner border border-ds-inner-border flex items-center justify-center">
            <Database size={22} aria-hidden className="text-ds-muted" />
          </span>
          <div>
            <p className="m-0 text-[15px] font-semibold text-white">Nenhum projeto ainda</p>
            <p className="m-0 mt-1 text-[13px] text-ds-muted">Crie um projeto para começar a diagnosticar clientes.</p>
          </div>
          <ButtonLink to="/projects/new" variant="primary">Criar primeiro projeto</ButtonLink>
        </Card>
      )}

      {!loading && !error && projects.length > 0 && visible.length === 0 && (
        <Card className="py-12 text-center text-[13.5px] text-ds-muted">Nenhum projeto encontrado para a busca.</Card>
      )}

      {visible.length > 0 && (
        <Card>
          {visible.map((project, i) => (
            <ProjectRow key={project.id} project={project} first={i === 0} />
          ))}
        </Card>
      )}
    </AppShell>
  )
}
