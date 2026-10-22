import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ChevronLeft, Play } from 'lucide-react'
import { api, type Project, type Session, type Pricing, type Readiness } from '../lib/api'
import { PROJECT_TYPE_LABELS } from '../lib/labels'
import AppShell from '../components/layout/AppShell'
import DmsMeter from '../components/project/DmsMeter'
import DocudataLinkCard from '../components/project/DocudataLinkCard'
import PrdCard from '../components/project/PrdCard'
import SessionHistory from '../components/project/SessionHistory'
import {
  ButtonLink, Button, Card, Chip, DetailRows, ErrorNotice, SectionLabel, StatusDot,
} from '../components/ui'

// D-47: escolhe deterministicamente a sessão de discovery associada ao "Gerar PRD" — a mais recente.
function pickDiscoverySession(sessions: Session[]): Session | null {
  if (sessions.length === 0) return null
  return [...sessions].sort(
    (a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime()
  )[0]
}

function TextCard({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Card className="px-[26px] py-6 flex flex-col gap-4">
      <SectionLabel>{label}</SectionLabel>
      <p className="m-0 text-[15px] leading-[1.7] text-ds-text-2 whitespace-pre-wrap text-pretty">{children}</p>
    </Card>
  )
}

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [project, setProject] = useState<Project | null>(null)
  const [sessions, setSessions] = useState<Session[]>([])
  const [pricings, setPricings] = useState<Pricing[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  // D-47: readiness da sessão de discovery + estado do botão "Gerar PRD" (escopado a este bloco).
  const [readiness, setReadiness] = useState<Readiness | null>(null)
  const [readinessLoading, setReadinessLoading] = useState(false)
  const [readinessError, setReadinessError] = useState<string | null>(null)
  // CR-02: erro da geração (POST) separado do erro do GET; uma falha transitória não trava o retry.
  const [prdError, setPrdError] = useState<string | null>(null)
  const [generatingPrd, setGeneratingPrd] = useState(false)

  useEffect(() => {
    if (!id) return
    Promise.all([api.projects.get(id), api.sessions.list(id)])
      .then(([p, s]) => {
        setProject(p)
        setSessions(s)
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
    api.pricings.listByProject(id).then(setPricings).catch(() => {})
  }, [id])

  // D-42: aqui a detecção de modo usa project.mode, não o payload de WS.
  const discoverySession = project && project.mode === 'discovery' ? pickDiscoverySession(sessions) : null
  const discoverySessionId = discoverySession?.id ?? null

  useEffect(() => {
    if (!discoverySessionId) return
    setReadinessLoading(true)
    setReadinessError(null)
    api.sessions
      .getReadiness(discoverySessionId)
      .then(setReadiness)
      .catch(() => setReadinessError('Erro ao carregar readiness'))
      .finally(() => setReadinessLoading(false))
  }, [discoverySessionId])

  async function handleGeneratePrd(sessionId: string) {
    if (!readiness?.ready || readinessLoading || readinessError || generatingPrd) return
    setPrdError(null)
    setGeneratingPrd(true)
    try {
      await api.sessions.generateReport(sessionId)
      navigate(`/sessions/${sessionId}`)
    } catch (e: unknown) {
      setPrdError(e instanceof Error ? e.message : 'Erro ao gerar PRD')
    } finally {
      setGeneratingPrd(false)
    }
  }

  async function handleDeleteSession(sessionId: string) {
    if (!confirm('Excluir esta sessão? A transcrição e relatório serão perdidos.')) return
    try {
      await api.sessions.delete(sessionId)
      setSessions(prev => prev.filter(s => s.id !== sessionId))
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao excluir sessão')
    }
  }

  async function handleRenameSession(sessionId: string, name: string) {
    try {
      const updated = await api.sessions.rename(sessionId, name)
      setSessions(prev => prev.map(s => (s.id === sessionId ? { ...s, name: updated.name } : s)))
    } catch { /* ignore */ }
  }

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

  const newProject = (
    <ButtonLink to="/projects/new" variant="primary">+ Novo projeto</ButtonLink>
  )

  if (loading) {
    return <AppShell actions={newProject}><p className="text-[14px] text-ds-muted">Carregando…</p></AppShell>
  }

  if (!project) {
    return (
      <AppShell actions={newProject}>
        <ErrorNotice>{error ?? 'Projeto não encontrado'}</ErrorNotice>
      </AppShell>
    )
  }

  return (
    <AppShell actions={newProject}>
      <div className="flex items-center gap-4">
        <Link
          to="/"
          aria-label="Voltar para projetos"
          className="w-[38px] h-[38px] rounded-[10px] border border-ds-border-strong flex items-center justify-center text-ds-text-2 hover:bg-white/[0.05] transition-colors"
        >
          <ChevronLeft size={18} aria-hidden />
        </Link>
        <div className="flex flex-col gap-1 min-w-0">
          <span className="flex items-center gap-2.5 min-w-0">
            <h1 className="m-0 text-[24px] font-bold tracking-[-0.02em] text-white truncate">{project.name}</h1>
            {project.has_active_session && <Chip tone="green" dot>ao vivo</Chip>}
          </span>
          <span className="text-[13.5px] text-ds-muted">{project.client}</span>
        </div>
        <div className="ml-auto flex gap-2">
          <ButtonLink to={`/projects/${id}/edit`}>Editar</ButtonLink>
          <Button variant="danger" onClick={handleDelete} disabled={deleting}>Excluir</Button>
        </div>
      </div>

      {error && <ErrorNotice>{error}</ErrorNotice>}

      <ButtonLink to={`/projects/${id}/sessions/new`} variant="primary" size="hero">
        <Play size={18} aria-hidden /> Nova sessão
      </ButtonLink>

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_1.15fr] gap-4 items-start">
        <DetailRows
          rows={[
            { label: 'Tipo de projeto', value: project.project_type ? (PROJECT_TYPE_LABELS[project.project_type] ?? project.project_type) : '—' },
            { label: 'Data Maturity Score', value: <DmsMeter score={project.data_maturity_score} /> },
            { label: 'Fonte de transcrição', value: <span className="capitalize">{project.source}</span> },
            { label: 'Budget de IA', value: project.budget_usd ? <span className="font-mono">${project.budget_usd}</span> : 'Sem limite' },
            { label: 'TTL de perguntas', value: <span className="font-mono">{project.question_ttl_seconds}s</span> },
            {
              label: 'Chave Gemini',
              value: project.has_api_key ? <Chip tone="green">Configurada</Chip> : <Chip tone="neutral">Usando a chave do servidor</Chip>,
            },
            ...(project.meeting_url
              ? [{
                  label: 'URL da reunião',
                  value: (
                    <a href={project.meeting_url} target="_blank" rel="noreferrer" className="text-ds-green font-mono text-[13px] hover:underline break-all">
                      {project.meeting_url.replace(/^https?:\/\//, '')}
                    </a>
                  ),
                }]
              : []),
          ]}
        />
        <div className="flex flex-col gap-4">
          {project.pre_meeting_context && <TextCard label="Contexto pré-reunião">{project.pre_meeting_context}</TextCard>}
          {project.description && <TextCard label="Descrição">{project.description}</TextCard>}
          <DocudataLinkCard project={project} />
        </div>
      </div>

      {sessions.length > 0 && (
        <SessionHistory sessions={sessions} onRename={handleRenameSession} onDelete={handleDeleteSession} />
      )}

      {project.mode === 'discovery' && discoverySession && (
        <PrdCard
          readiness={readiness}
          loading={readinessLoading}
          loadError={readinessError}
          generating={generatingPrd}
          generateError={prdError}
          onGenerate={() => handleGeneratePrd(discoverySession.id)}
        />
      )}

      <section className="flex flex-col gap-3" aria-label="Precificações">
        <div className="flex items-center justify-between">
          <SectionLabel>Precificações · {pricings.length}</SectionLabel>
          <ButtonLink to={`/projects/${id}/pricings`} size="sm" variant="active">Nova precificação</ButtonLink>
        </div>
        {pricings.length === 0 ? (
          <div className="px-3 py-7 border border-dashed border-ds-border-strong rounded-xl text-center text-[13px] text-ds-dim">
            Nenhuma precificação ainda.
          </div>
        ) : (
          <Card>
            {pricings.map((p, i) => (
              <Link
                key={p.id}
                to={`/pricings/${p.id}`}
                className={`flex items-center justify-between gap-4 px-6 py-4 hover:bg-white/[0.03] transition-colors ${i > 0 ? 'border-t border-ds-border' : ''}`}
              >
                <span className="font-mono text-[13px] text-ds-text-2">
                  {new Date(p.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                </span>
                {p.status === 'approved' ? (
                  <span className="inline-flex items-center gap-2 text-[13px] text-ds-green">
                    <StatusDot tone="green" /> aprovada
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-2 text-[13px] text-ds-muted">
                    <StatusDot tone="neutral" /> rascunho
                  </span>
                )}
              </Link>
            ))}
          </Card>
        )}
      </section>
    </AppShell>
  )
}
