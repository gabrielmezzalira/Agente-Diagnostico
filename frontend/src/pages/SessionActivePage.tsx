import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Check, ChevronLeft, Copy, FileText, Square } from 'lucide-react'
import { api, type Report, type Session } from '../lib/api'
import { useSessionWS } from '../lib/useSessionWS'
import { shouldShowManualReportButton } from '../lib/lens'
import CITiLogo from '../components/CITiLogo'
import AppShell from '../components/layout/AppShell'
import BudgetMeter from '../components/session/BudgetMeter'
import CoveragePanel from '../components/session/CoveragePanel'
import FinishedSession from '../components/session/FinishedSession'
import QuestionsPanel from '../components/session/QuestionsPanel'
import ReportModal from '../components/session/ReportModal'
import SessionTimer from '../components/session/SessionTimer'
import TranscriptPanel from '../components/session/TranscriptPanel'
import { Button, Chip, ErrorNotice } from '../components/ui'

function useCopy(text: string) {
  const [copied, setCopied] = useState(false)
  const copy = useCallback(async () => {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [text])
  return { copied, copy }
}

export default function SessionActivePage() {
  const { sessionId } = useParams<{ sessionId: string }>()
  const navigate = useNavigate()

  const [session, setSession] = useState<Session | null>(null)
  const [projectName, setProjectName] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [finishing, setFinishing] = useState(false)
  const [generatingReport, setGeneratingReport] = useState(false)
  const [regenerating, setRegenerating] = useState(false)
  const [reportModal, setReportModal] = useState<string | null>(null)
  const [finishedReport, setFinishedReport] = useState<Report | null>(null)
  const [uploadingPdf, setUploadingPdf] = useState(false)
  const [updatingStatus, setUpdatingStatus] = useState(false)

  const { state: ws, send, updateQuestionStatus } = useSessionWS(sessionId)
  const { copied, copy } = useCopy(session?.id ?? '')

  // Load session once on mount
  useEffect(() => {
    if (!sessionId) return
    api.sessions
      .get(sessionId)
      .then(s => {
        setSession(s)
        if (s.status === 'active') {
          localStorage.setItem('agente_session_id', s.id)
        } else {
          api.sessions.getReport(sessionId).then(setFinishedReport).catch(() => null)
          api.projects.get(s.project_id).then(p => setProjectName(p.name)).catch(() => null)
        }
      })
      .catch(e => setError(e instanceof Error ? e.message : 'Erro ao carregar sessão'))
      .finally(() => setLoading(false))

    return () => { localStorage.removeItem('agente_session_id') }
  }, [sessionId])

  async function handleFinish() {
    if (!sessionId || !confirm('Encerrar a sessão?')) return
    setFinishing(true)
    try {
      // Caminho único via REST: o endpoint /finish é autossuficiente (grava status=finished e para o
      // pipeline, idempotente). Disparar também o evento WS 'finish_session' criava uma corrida — o WS
      // encerrava primeiro e o POST /finish respondia 409, cuja exceção impedia o navigate().
      await api.sessions.finish(sessionId)
      navigate(`/projects/${session?.project_id}`)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erro ao encerrar sessão')
      setFinishing(false)
    }
  }

  function handlePinQuestion(id: string) {
    updateQuestionStatus(id, 'pinned')
    send('pin_question', { question_id: id })
  }

  function handleDismissQuestion(id: string) {
    updateQuestionStatus(id, 'dismissed')
    send('dismiss_question', { question_id: id })
  }

  function handleUseQuestion(id: string) {
    updateQuestionStatus(id, 'used')
    send('use_question', { question_id: id })
  }

  async function handleRegenerate() {
    if (!sessionId || regenerating) return
    setRegenerating(true)
    setError(null)
    try {
      const report = await api.sessions.generateReport(sessionId)
      setFinishedReport(report)
      setReportModal(report.markdown_content)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erro ao regenerar relatório')
    } finally {
      setRegenerating(false)
    }
  }

  // D-48: seletor de status/aprovação do relatório na sessão encerrada.
  async function handleUpdateReportStatus(newStatus: NonNullable<Report['status']>) {
    if (!sessionId || updatingStatus) return
    setUpdatingStatus(true)
    setError(null)
    try {
      setFinishedReport(await api.sessions.updateReportStatus(sessionId, newStatus))
    } catch {
      setError('Erro ao atualizar status')
    } finally {
      setUpdatingStatus(false)
    }
  }

  async function handleUploadPdf(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !sessionId) return
    e.target.value = ''
    setUploadingPdf(true)
    setError(null)
    try {
      const report = await api.sessions.uploadTranscript(sessionId, file)
      setFinishedReport(report)
      setReportModal(report.markdown_content)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao processar PDF')
    } finally {
      setUploadingPdf(false)
    }
  }

  async function handleGenerateReport() {
    if (!sessionId || generatingReport) return
    if (ws.budget.status === 'insufficient') {
      setError('Saldo insuficiente para gerar o relatório.')
      return
    }
    setGeneratingReport(true)
    try {
      const report = await api.sessions.generateReport(sessionId)
      setReportModal(report.markdown_content)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erro ao gerar relatório')
    } finally {
      setGeneratingReport(false)
    }
  }

  // When WS delivers report_ready, open modal automatically
  useEffect(() => {
    if (ws.reportMarkdown && !reportModal) {
      setReportModal(ws.reportMarkdown)
    }
  }, [ws.reportMarkdown])

  if (loading) {
    return <AppShell><p className="text-[14px] text-ds-muted">Carregando…</p></AppShell>
  }

  if (error && !session) {
    return <AppShell><ErrorNotice>{error}</ErrorNotice></AppShell>
  }

  if (!session) return null

  const isExtension = session.source === 'extension'

  // Sessão encerrada: visão de histórico
  if (session.status !== 'active') {
    return (
      <>
        {reportModal && <ReportModal markdown={reportModal} onClose={() => setReportModal(null)} />}
        <FinishedSession
          session={session}
          projectName={projectName}
          report={finishedReport}
          transcript={ws.transcript}
          error={error}
          regenerating={regenerating}
          uploadingPdf={uploadingPdf}
          updatingStatus={updatingStatus}
          onOpenReport={setReportModal}
          onRegenerate={handleRegenerate}
          onUploadPdf={handleUploadPdf}
          onUpdateStatus={handleUpdateReportStatus}
        />
      </>
    )
  }

  // Sessão ao vivo: monitoramento em 3 colunas (300 | 1fr | 360)
  return (
    <div className="flex flex-col h-screen bg-ds-bg text-ds-text overflow-hidden">
      {reportModal && <ReportModal markdown={reportModal} onClose={() => setReportModal(null)} />}

      <header className="h-[68px] shrink-0 flex items-center gap-4 px-7 border-b border-ds-border">
        <Link
          to={`/projects/${session.project_id}`}
          aria-label="Voltar para o projeto"
          className="text-ds-text-2 hover:text-white transition-colors shrink-0"
        >
          <ChevronLeft size={20} aria-hidden />
        </Link>
        <CITiLogo height={22} />
        <span aria-hidden className="w-px h-[18px] bg-ds-border-strong" />
        {ws.connected ? (
          <Chip tone="green" dot>AO VIVO</Chip>
        ) : (
          <Chip tone="amber">reconectando…</Chip>
        )}
        <SessionTimer startedAt={session.started_at} />

        {isExtension && (
          <div className="hidden lg:flex items-center gap-2 ml-6 text-[12.5px] text-ds-muted">
            <span>ID</span>
            <code className="font-mono text-[12px] px-2.5 py-1 rounded-lg bg-ds-inner border border-ds-inner-border text-ds-text-2 max-w-[190px] truncate">
              {session.id}
            </code>
            <button
              type="button"
              onClick={copy}
              aria-label="Copiar ID da sessão"
              className="p-1 rounded-md hover:text-white transition-colors"
            >
              {copied ? <Check size={13} aria-hidden className="text-ds-green" /> : <Copy size={13} aria-hidden />}
            </button>
          </div>
        )}

        <div className="ml-auto flex items-center gap-3 shrink-0">
          <div className="hidden md:block">
            <BudgetMeter
              used={ws.budget.used_usd}
              limit={ws.budget.limit_usd}
              estimated={ws.budget.estimated_report_cost}
              status={ws.budget.status}
            />
          </div>
          {shouldShowManualReportButton(ws.hasReceivedInitialState, ws.coverage) && (
            <Button
              onClick={handleGenerateReport}
              disabled={generatingReport || ws.budget.status === 'insufficient'}
              title={ws.budget.status === 'insufficient' ? 'Saldo insuficiente' : 'Gerar relatório (R)'}
            >
              <FileText size={14} aria-hidden /> {generatingReport ? 'Gerando…' : 'Relatório'}
            </Button>
          )}
          <Button variant="danger" onClick={handleFinish} disabled={finishing}>
            <Square size={12} aria-hidden /> {finishing ? 'Encerrando…' : 'Encerrar'}
          </Button>
        </div>
      </header>

      {(error || ws.wsError) && (
        <div className="shrink-0 px-7 py-2"><ErrorNotice>{error || ws.wsError}</ErrorNotice></div>
      )}

      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-[300px_minmax(0,1fr)] xl:grid-cols-[300px_minmax(0,1fr)_360px]">
        <aside className="hidden lg:block border-r border-ds-border bg-ds-sidebar min-h-0 overflow-hidden" aria-label="Cobertura">
          <CoveragePanel coverage={ws.coverage} onForceClassify={() => send('force_classify')} />
        </aside>

        <main className="min-h-0 overflow-hidden" aria-label="Transcrição">
          <TranscriptPanel transcript={ws.transcript} redFlags={ws.redFlags} />
        </main>

        <aside className="hidden xl:block border-l border-ds-border bg-ds-sidebar min-h-0 overflow-hidden" aria-label="Perguntas">
          <QuestionsPanel
            questions={ws.questions}
            onGenerateQuestions={() => send('generate_questions')}
            onPin={handlePinQuestion}
            onDismiss={handleDismissQuestion}
            onUse={handleUseQuestion}
          />
        </aside>
      </div>
    </div>
  )
}
