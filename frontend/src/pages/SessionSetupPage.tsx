import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ChevronLeft, Play, Upload } from 'lucide-react'
import { api, type Project, type SessionCreate } from '../lib/api'
import AppShell from '../components/layout/AppShell'
import FormSection from '../components/FormSection'
import { Button, ButtonLink, ChoiceGroup, ErrorNotice, Field, Input, Textarea } from '../components/ui'

export default function SessionSetupPage() {
  const { id: projectId } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [project, setProject] = useState<Project | null>(null)
  const [loadingProject, setLoadingProject] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [mode, setMode] = useState<'live' | 'import'>('live')
  const [sessionName, setSessionName] = useState('')
  const [meetingUrl, setMeetingUrl] = useState('')
  const [source, setSource] = useState<'extension' | 'recall'>('extension')
  const [additionalContext, setAdditionalContext] = useState('')
  const [budgetUsd, setBudgetUsd] = useState<number | undefined>(undefined)
  const [importFile, setImportFile] = useState<File | null>(null)
  const importFileRef = useRef<HTMLInputElement>(null)

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

    if (mode === 'import') {
      if (!importFile) {
        setError('Selecione um PDF para importar')
        return
      }
      setSubmitting(true)
      setError(null)
      try {
        const session = await api.sessions.create({
          project_id: projectId,
          source: 'import',
          ...(additionalContext ? { additional_context: additionalContext } : {}),
        })
        await api.sessions.uploadTranscript(session.id, importFile)
        navigate(`/sessions/${session.id}`)
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'Erro ao importar diagnóstico')
        setSubmitting(false)
      }
      return
    }

    setSubmitting(true)
    setError(null)

    const payload: SessionCreate = {
      project_id: projectId,
      ...(sessionName.trim() ? { name: sessionName.trim() } : {}),
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
    return <AppShell><p className="text-[14px] text-ds-muted">Carregando…</p></AppShell>
  }

  const live = mode === 'live'

  return (
    <AppShell>
      <div className="flex items-center gap-4">
        <Link
          to={`/projects/${projectId}`}
          aria-label="Voltar para o projeto"
          className="w-[38px] h-[38px] rounded-[10px] border border-ds-border-strong flex items-center justify-center text-ds-text-2 hover:bg-white/[0.05] transition-colors"
        >
          <ChevronLeft size={18} aria-hidden />
        </Link>
        <div className="flex flex-col gap-1 min-w-0">
          <h1 className="m-0 text-[24px] font-bold tracking-[-0.02em] text-white">Nova sessão</h1>
          {project && <span className="text-[13.5px] text-ds-muted">{project.name} · {project.client}</span>}
        </div>
      </div>

      <form onSubmit={handleStart} className="flex flex-col gap-7 max-w-[860px]">
        {error && <ErrorNotice>{error}</ErrorNotice>}

        <div role="tablist" aria-label="Tipo de sessão" className="flex gap-1 p-1 rounded-xl bg-white/[0.05] border border-ds-border w-fit">
          {([
            { value: 'live', label: 'Iniciar sessão' },
            { value: 'import', label: 'Importar sessão' },
          ] as const).map(({ value, label }) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={mode === value}
              onClick={() => setMode(value)}
              className={`h-9 px-4 rounded-[9px] text-[13px] font-semibold transition-colors cursor-pointer ${
                mode === value ? 'bg-ds-green-soft text-ds-green border border-ds-green-line' : 'text-ds-muted border border-transparent hover:text-ds-text'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <FormSection title={live ? 'Reunião' : 'Transcrição'}>
          {live ? (
            <>
              <Field label="Nome da sessão (opcional)" htmlFor="s-name">
                <Input id="s-name" value={sessionName} onChange={e => setSessionName(e.target.value)} placeholder="Ex: Reunião ACE — 05/08 (deixe em branco para gerar automático)" />
              </Field>
              <Field label="URL da reunião" htmlFor="s-url">
                <Input id="s-url" type="url" value={meetingUrl} onChange={e => setMeetingUrl(e.target.value)} placeholder="https://meet.google.com/…" />
              </Field>
              <Field label="Fonte de transcrição">
                <ChoiceGroup
                  name="source"
                  value={source}
                  onChange={setSource}
                  options={[
                    { value: 'extension', label: 'Extensão Chrome', description: 'Gratuito' },
                    { value: 'recall', label: 'Recall.ai', description: 'Bot automático na reunião' },
                  ]}
                />
              </Field>
            </>
          ) : (
            <Field
              label="Transcrição em PDF"
              htmlFor="s-pdf"
              hint="Cria uma sessão sem reunião ao vivo e gera o relatório diretamente a partir do PDF. Sessões importadas não são enviadas ao DocuData."
            >
              <input
                id="s-pdf"
                ref={importFileRef}
                type="file"
                accept="application/pdf"
                onChange={e => setImportFile(e.target.files?.[0] ?? null)}
                className="w-full rounded-[10px] bg-ds-inner border border-ds-inner-border text-ds-text-2 text-[13.5px] p-2 file:mr-3 file:h-8 file:px-3 file:rounded-lg file:border file:border-ds-border-strong file:bg-white/[0.04] file:text-ds-text file:text-[12.5px] file:font-semibold file:cursor-pointer"
              />
            </Field>
          )}
        </FormSection>

        <FormSection title="Contexto e orçamento">
          <Field
            label={live ? 'Contexto adicional desta reunião' : 'Contexto adicional deste diagnóstico'}
            htmlFor="s-ctx"
            hint={project?.pre_meeting_context ? 'Complementa o contexto do projeto já configurado.' : undefined}
          >
            <Textarea id="s-ctx" rows={3} value={additionalContext} onChange={e => setAdditionalContext(e.target.value)} placeholder="Algo específico desta reunião que o agente deve saber…" />
          </Field>
          {live && (
            <Field label="Budget desta sessão (USD)" htmlFor="s-budget">
              <Input
                id="s-budget"
                type="number"
                min={0}
                step={0.01}
                value={budgetUsd ?? ''}
                onChange={e => setBudgetUsd(e.target.value ? Number(e.target.value) : undefined)}
                placeholder={project?.budget_usd ? `Herda do projeto ($${project.budget_usd})` : 'Sem limite'}
              />
            </Field>
          )}
        </FormSection>

        <div className="flex items-center gap-3">
          <Button type="submit" variant="primary" disabled={submitting}>
            {live ? <Play size={14} aria-hidden /> : <Upload size={14} aria-hidden />}
            {submitting ? (live ? 'Iniciando…' : 'Importando…') : live ? 'Iniciar sessão' : 'Importar sessão'}
          </Button>
          <ButtonLink to={`/projects/${projectId}`} variant="ghost">Cancelar</ButtonLink>
        </div>
      </form>
    </AppShell>
  )
}
