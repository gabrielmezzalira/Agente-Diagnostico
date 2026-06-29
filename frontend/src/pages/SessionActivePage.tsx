import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  AlertTriangle,
  Check,
  ChevronLeft,
  Clock,
  Copy,
  FileText,
  MessageSquarePlus,
  Pin,
  Radio,
  RefreshCw,
  Square,
  X,
} from 'lucide-react'
import { api, type Report, type Session } from '../lib/api'
import { useSessionWS, type WSQuestion } from '../lib/useSessionWS'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const AREA_LABELS: Record<string, string> = {
  negocio: 'Negócio',
  eng_dados: 'Eng. de Dados',
  visualizacao: 'Visualização',
  ciencia_dados: 'Ciência de Dados',
  automacao: 'Automação',
  integracao: 'Integração',
  consumo: 'Consumo',
  parceria: 'Parceria',
}

// ---------------------------------------------------------------------------
// Session timer
// ---------------------------------------------------------------------------

function SessionTimer({ startedAt }: { startedAt: string }) {
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    const start = new Date(startedAt).getTime()
    const tick = () => setElapsed(Math.floor((Date.now() - start) / 1000))
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [startedAt])

  const h = String(Math.floor(elapsed / 3600)).padStart(2, '0')
  const m = String(Math.floor((elapsed % 3600) / 60)).padStart(2, '0')
  const s = String(elapsed % 60).padStart(2, '0')

  return (
    <span className="font-mono text-sm text-[var(--color-text-secondary)]">
      {h}:{m}:{s}
    </span>
  )
}

// ---------------------------------------------------------------------------
// Coverage panel (left column)
// ---------------------------------------------------------------------------

function CoveragePanel({
  coverage,
  onForceClassify,
}: {
  coverage: Record<string, { status: string; score: number; notes: string }>
  onForceClassify: () => void
}) {
  const statusColor: Record<string, string> = {
    covered: 'bg-[var(--color-accent)]',
    partial: 'bg-[var(--color-yellow)]',
    uncovered: 'bg-[var(--color-border-std)]',
    not_applicable: 'bg-transparent',
  }
  const statusDot: Record<string, string> = {
    covered: 'bg-[var(--color-accent)]',
    partial: 'bg-[var(--color-yellow)]',
    uncovered: 'bg-[var(--color-border-hover)]',
    not_applicable: 'bg-[var(--color-border-std)]',
  }

  const active = Object.entries(coverage).filter(([, i]) => i.status !== 'not_applicable')
  const inactive = Object.entries(coverage).filter(([, i]) => i.status === 'not_applicable')

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-[var(--color-border-std)]">
        <span className="text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider">
          Cobertura
        </span>
        <button
          onClick={onForceClassify}
          title="Forçar classificação"
          className="p-1 rounded hover:bg-[var(--color-muted)] text-[var(--color-text-secondary)] transition-colors"
        >
          <RefreshCw size={12} />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto py-1">
        {active.map(([area, info]) => (
          <div
            key={area}
            className="px-3 py-2 hover:bg-[var(--color-muted)] rounded-sm transition-colors"
            title={info.notes || undefined}
          >
            <div className="flex items-center gap-2 mb-1">
              <span className={`shrink-0 w-2 h-2 rounded-full ${statusDot[info.status] ?? statusDot.uncovered}`} />
              <span className="text-xs text-[var(--color-text-primary)] truncate flex-1">
                {AREA_LABELS[area] ?? area}
              </span>
              <span className="text-xs text-[var(--color-text-secondary)] tabular-nums">
                {info.score}%
              </span>
            </div>
            <div className="ml-4 h-1 bg-[var(--color-border-std)] rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${statusColor[info.status] ?? statusColor.uncovered}`}
                style={{ width: `${info.score}%` }}
              />
            </div>
          </div>
        ))}

        {inactive.length > 0 && (
          <>
            <div className="mx-3 my-1 border-t border-[var(--color-border-std)]" />
            {inactive.map(([area]) => (
              <div key={area} className="px-3 py-1.5 flex items-center gap-2 opacity-35">
                <span className="shrink-0 w-2 h-2 rounded-full border border-[var(--color-border-std)]" />
                <span className="text-xs text-[var(--color-text-secondary)] truncate flex-1">
                  {AREA_LABELS[area] ?? area}
                </span>
                <span className="text-xs text-[var(--color-text-secondary)]">N/A</span>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Budget bar
// ---------------------------------------------------------------------------

function BudgetBar({
  used,
  limit,
  estimated,
  status,
}: {
  used: number
  limit: number | null
  estimated: number
  status: string
}) {
  const pct = limit ? Math.min((used / limit) * 100, 100) : 0
  const barColor =
    status === 'insufficient' || status === 'critical'
      ? 'bg-[var(--color-red)]'
      : status === 'warning'
        ? 'bg-[var(--color-yellow)]'
        : 'bg-[var(--color-accent)]'

  const fmt = (v: number) => `$${v.toFixed(4)}`

  return (
    <div className="flex items-center gap-3 px-4 h-9 border-b border-[var(--color-border-std)] bg-[var(--color-surface)]">
      <div className="flex-1 h-1.5 bg-[var(--color-border-std)] rounded-full overflow-hidden">
        {limit ? (
          <div
            className={`h-full rounded-full transition-all duration-500 ${barColor}`}
            style={{ width: `${pct.toFixed(1)}%` }}
          />
        ) : (
          <div className="h-full w-full bg-[var(--color-border-std)]" />
        )}
      </div>
      <span className="text-xs text-[var(--color-text-secondary)] whitespace-nowrap">
        {limit
          ? `${fmt(used)} / ${fmt(limit)}`
          : `${fmt(used)} consumido`}
      </span>
      {status === 'insufficient' && (
        <span className="text-xs text-[var(--color-red)] font-medium whitespace-nowrap">
          Saldo insuficiente para relatório (~{fmt(estimated)})
        </span>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Transcript + red flags (center column)
// ---------------------------------------------------------------------------

function TranscriptPanel({
  transcript,
  redFlags,
}: {
  transcript: Array<{ text: string; speaker: string | null; timestamp: string }>
  redFlags: Array<{ id: string; text: string; severity: string; evidence: string; detected_at: string }>
}) {
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [transcript.length])

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Red flags */}
      {redFlags.length > 0 && (
        <div className="border-b border-[var(--color-border-std)] max-h-48 overflow-y-auto">
          <div className="px-4 py-2 text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider border-b border-[var(--color-border-std)]">
            Alertas
          </div>
          <div className="divide-y divide-[var(--color-border-std)]">
            {redFlags.map(rf => (
              <div
                key={rf.id}
                className={`px-4 py-3 flex gap-3 ${
                  rf.severity === 'critical'
                    ? 'bg-[var(--color-red-bg)]'
                    : 'bg-[var(--color-yellow-bg)]'
                }`}
              >
                <AlertTriangle
                  size={14}
                  className={`shrink-0 mt-0.5 ${
                    rf.severity === 'critical'
                      ? 'text-[var(--color-red)]'
                      : 'text-[var(--color-yellow)]'
                  }`}
                />
                <div className="min-w-0">
                  <p className="text-sm text-[var(--color-text-primary)]">{rf.text}</p>
                  {rf.evidence && (
                    <p className="text-xs text-[var(--color-text-secondary)] mt-0.5 italic truncate">
                      "{rf.evidence}"
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Transcript */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
        {transcript.length === 0 ? (
          <p className="text-sm text-[var(--color-text-secondary)] text-center pt-8">
            Aguardando transcrição...
          </p>
        ) : (
          transcript.map((chunk, i) => (
            <div key={i} className="text-sm leading-relaxed">
              {chunk.speaker && (
                <span className="font-medium text-[var(--color-text-secondary)] mr-1.5">
                  {chunk.speaker}:
                </span>
              )}
              <span className="text-[var(--color-text-primary)]">{chunk.text}</span>
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// TTL progress bar (per-question)
// ---------------------------------------------------------------------------

function TTLBar({ expiresAt }: { expiresAt: string }) {
  const [pct, setPct] = useState(100)

  useEffect(() => {
    const exp = new Date(expiresAt).getTime()
    const total = exp - Date.now()
    if (total <= 0) return

    const tick = () => {
      const remaining = exp - Date.now()
      setPct(Math.max(0, (remaining / total) * 100))
    }
    tick()
    const id = setInterval(tick, 200)
    return () => clearInterval(id)
  }, [expiresAt])

  const color =
    pct > 60
      ? 'bg-[var(--color-accent)]'
      : pct > 30
        ? 'bg-[var(--color-yellow)]'
        : 'bg-[var(--color-red)]'

  return (
    <div className="mt-2 h-0.5 bg-[var(--color-border-std)] rounded-full overflow-hidden">
      <div
        className={`h-full rounded-full transition-none ${color}`}
        style={{ width: `${pct.toFixed(1)}%` }}
      />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Question card
// ---------------------------------------------------------------------------

function QuestionCard({
  question,
  onPin,
  onDismiss,
  onUse,
}: {
  question: WSQuestion
  onPin: () => void
  onDismiss: () => void
  onUse: () => void
}) {
  const blockLabel: Record<string, string> = {
    negocio: 'Negócio',
    eng_dados: 'Eng. Dados',
    visualizacao: 'Visualização',
    ciencia_dados: 'C. de Dados',
    automacao: 'Automação',
    integracao: 'Integração',
    consumo: 'Consumo',
    parceria: 'Parceria',
  }

  return (
    <div className="bg-[var(--color-surface)] border border-[var(--color-border-std)] rounded-[var(--radius-card)] px-3 py-2.5">
      <div className="flex items-start justify-between gap-1 mb-1">
        <span className="text-xs px-1.5 py-0.5 rounded-[var(--radius-tag)] bg-[var(--color-green-bg-tag)] text-[var(--color-accent)] border border-[var(--color-border-green)]">
          {blockLabel[question.block] ?? question.block}
        </span>
        <div className="flex items-center gap-0.5 shrink-0">
          <button
            onClick={onPin}
            title="Fixar"
            className="p-1 rounded hover:bg-[var(--color-muted)] text-[var(--color-text-secondary)] hover:text-[var(--color-accent)] transition-colors"
          >
            <Pin size={11} />
          </button>
          <button
            onClick={onUse}
            title="Marcar como usada"
            className="p-1 rounded hover:bg-[var(--color-muted)] text-[var(--color-text-secondary)] hover:text-[var(--color-accent)] transition-colors"
          >
            <Check size={11} />
          </button>
          <button
            onClick={onDismiss}
            title="Descartar"
            className="p-1 rounded hover:bg-[var(--color-muted)] text-[var(--color-text-secondary)] hover:text-[var(--color-red)] transition-colors"
          >
            <X size={11} />
          </button>
        </div>
      </div>
      <p className="text-sm text-[var(--color-text-primary)] leading-snug">{question.text}</p>
      {question.source === 'pre_mapped' && (
        <p className="text-[10px] text-[var(--color-text-secondary)] mt-1 opacity-70">pré-mapeada</p>
      )}
      {question.status === 'queued' && question.expires_at && (
        <TTLBar expiresAt={question.expires_at} />
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Questions panel (right column)
// ---------------------------------------------------------------------------

function QuestionsPanel({
  questions,
  onGenerateQuestions,
  onPin,
  onDismiss,
  onUse,
}: {
  questions: WSQuestion[]
  onGenerateQuestions: () => void
  onPin: (id: string) => void
  onDismiss: (id: string) => void
  onUse: (id: string) => void
}) {
  const preMapped = questions.filter(q => q.status === 'pinned' && q.source === 'pre_mapped')
  const pinned = questions.filter(q => q.status === 'pinned' && q.source !== 'pre_mapped')
  const queued = questions.filter(q => q.status === 'queued')

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-[var(--color-border-std)]">
        <span className="text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider">
          Perguntas
        </span>
        <button
          onClick={onGenerateQuestions}
          className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-[var(--color-accent)] border border-[var(--color-border-green)] rounded-[var(--radius-btn)] hover:bg-[var(--color-green-bg-tag)] transition-colors"
        >
          <MessageSquarePlus size={11} />
          Gerar
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2">
        {preMapped.length > 0 && (
          <div>
            <p className="text-xs text-[var(--color-text-secondary)] mb-1.5 font-medium">
              Pré-reunião
            </p>
            <div className="space-y-2">
              {preMapped.map(q => (
                <QuestionCard
                  key={q.id}
                  question={q}
                  onPin={() => onPin(q.id)}
                  onDismiss={() => onDismiss(q.id)}
                  onUse={() => onUse(q.id)}
                />
              ))}
            </div>
          </div>
        )}

        {pinned.length > 0 && (
          <div>
            <p className="text-xs text-[var(--color-text-secondary)] mb-1.5 font-medium">
              Fixadas
            </p>
            <div className="space-y-2">
              {pinned.map(q => (
                <QuestionCard
                  key={q.id}
                  question={q}
                  onPin={() => onPin(q.id)}
                  onDismiss={() => onDismiss(q.id)}
                  onUse={() => onUse(q.id)}
                />
              ))}
            </div>
          </div>
        )}

        {queued.length > 0 && (
          <div>
            {pinned.length > 0 && (
              <p className="text-xs text-[var(--color-text-secondary)] mb-1.5 font-medium">
                Fila
              </p>
            )}
            <div className="space-y-2">
              {queued.map(q => (
                <QuestionCard
                  key={q.id}
                  question={q}
                  onPin={() => onPin(q.id)}
                  onDismiss={() => onDismiss(q.id)}
                  onUse={() => onUse(q.id)}
                />
              ))}
            </div>
          </div>
        )}

        {preMapped.length === 0 && pinned.length === 0 && queued.length === 0 && (
          <p className="text-sm text-[var(--color-text-secondary)] text-center pt-8">
            Nenhuma pergunta na fila
          </p>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Report modal
// ---------------------------------------------------------------------------

function ReportModal({
  markdown,
  onClose,
}: {
  markdown: string
  onClose: () => void
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-[var(--color-surface)] border border-[var(--color-border-std)] rounded-lg w-full max-w-3xl max-h-[90vh] flex flex-col shadow-xl">
        <div className="flex items-center justify-between px-5 py-3 border-b border-[var(--color-border-std)]">
          <div className="flex items-center gap-2">
            <FileText size={14} className="text-[var(--color-accent)]" />
            <span className="text-sm font-semibold text-[var(--color-text-primary)]">Relatório de Diagnóstico</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-[var(--color-muted)] text-[var(--color-text-secondary)] transition-colors"
          >
            <X size={16} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-5">
          <pre className="text-sm text-[var(--color-text-primary)] whitespace-pre-wrap font-sans leading-relaxed">
            {markdown}
          </pre>
        </div>
        <div className="flex justify-end gap-2 px-5 py-3 border-t border-[var(--color-border-std)]">
          <button
            onClick={() => navigator.clipboard.writeText(markdown)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-[var(--color-border-std)] rounded-[var(--radius-btn)] hover:bg-[var(--color-muted)] transition-colors text-[var(--color-text-secondary)]"
          >
            <Copy size={11} />
            Copiar Markdown
          </button>
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-xs bg-[var(--color-accent)] text-white rounded-[var(--radius-btn)] hover:bg-[var(--color-accent-hover)] transition-colors"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Copy helper
// ---------------------------------------------------------------------------

function useCopy(text: string) {
  const [copied, setCopied] = useState(false)
  const copy = useCallback(async () => {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [text])
  return { copied, copy }
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function SessionActivePage() {
  const { sessionId } = useParams<{ sessionId: string }>()
  const navigate = useNavigate()

  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [finishing, setFinishing] = useState(false)
  const [generatingReport, setGeneratingReport] = useState(false)
  const [reportModal, setReportModal] = useState<string | null>(null)
  const [finishedReport, setFinishedReport] = useState<Report | null>(null)

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
      send('finish_session')
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

  function handleGenerateQuestions() {
    send('generate_questions')
  }

  function handleForceClassify() {
    send('force_classify')
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
    return (
      <div className="min-h-screen bg-[var(--color-bg-page)] flex items-center justify-center">
        <span className="text-sm text-[var(--color-text-secondary)]">Carregando...</span>
      </div>
    )
  }

  if (error && !session) {
    return (
      <div className="min-h-screen bg-[var(--color-bg-page)] flex items-center justify-center">
        <span className="text-sm text-[var(--color-red)]">{error}</span>
      </div>
    )
  }

  if (!session) return null

  const isExtension = session.source === 'extension'
  const isActive = session.status === 'active'

  function sessionDuration(s: Session): string {
    const start = new Date(s.started_at)
    const end = s.finished_at ? new Date(s.finished_at) : new Date()
    const mins = Math.floor((end.getTime() - start.getTime()) / 60000)
    return mins < 1 ? '< 1 min' : `${mins} min`
  }

  // Non-active session: history view
  if (!isActive) {
    return (
      <div className="min-h-screen bg-[var(--color-bg-page)]">
        {reportModal && (
          <ReportModal markdown={reportModal} onClose={() => setReportModal(null)} />
        )}
        <div className="border-b border-[var(--color-border-std)] bg-[var(--color-surface)]">
          <div className="max-w-2xl mx-auto px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link
                to={`/projects/${session.project_id}`}
                className="text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors"
              >
                <ChevronLeft size={18} />
              </Link>
              <span className="text-sm font-medium text-[var(--color-text-primary)]">Sessão encerrada</span>
            </div>
            {finishedReport && (
              <button
                onClick={() => setReportModal(finishedReport.markdown_content)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[var(--color-accent)] border border-[var(--color-border-green)] rounded-[var(--radius-btn)] hover:bg-[var(--color-green-bg-tag)] transition-colors"
              >
                <FileText size={12} />
                Ver Relatório
              </button>
            )}
          </div>
        </div>
        <div className="max-w-2xl mx-auto px-6 py-8 space-y-4">
          <div className="bg-[var(--color-surface)] border border-[var(--color-border-std)] rounded-lg divide-y divide-[var(--color-border-std)]">
            <div className="flex items-center justify-between px-4 py-3">
              <span className="text-sm text-[var(--color-text-secondary)]">Status</span>
              <span className="text-sm text-[var(--color-text-primary)] capitalize">{session.status}</span>
            </div>
            <div className="flex items-center justify-between px-4 py-3">
              <span className="text-sm text-[var(--color-text-secondary)]">Início</span>
              <span className="text-sm text-[var(--color-text-primary)]">
                {new Date(session.started_at).toLocaleString('pt-BR')}
              </span>
            </div>
            <div className="flex items-center justify-between px-4 py-3">
              <span className="text-sm text-[var(--color-text-secondary)]">Duração</span>
              <span className="text-sm text-[var(--color-text-primary)]">{sessionDuration(session)}</span>
            </div>
            {parseFloat(session.cost_usd) > 0 && (
              <div className="flex items-center justify-between px-4 py-3">
                <span className="text-sm text-[var(--color-text-secondary)]">Custo de IA</span>
                <span className="text-sm text-[var(--color-text-primary)]">${parseFloat(session.cost_usd).toFixed(4)}</span>
              </div>
            )}
            {session.tokens_used > 0 && (
              <div className="flex items-center justify-between px-4 py-3">
                <span className="text-sm text-[var(--color-text-secondary)]">Tokens usados</span>
                <span className="text-sm text-[var(--color-text-primary)]">{session.tokens_used.toLocaleString('pt-BR')}</span>
              </div>
            )}
          </div>

          {finishedReport && (
            <div className="bg-[var(--color-surface)] border border-[var(--color-border-std)] rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <FileText size={13} className="text-[var(--color-accent)]" />
                  <span className="text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider">Relatório gerado</span>
                </div>
                <span className="text-xs text-[var(--color-text-secondary)]">
                  {new Date(finishedReport.generated_at).toLocaleString('pt-BR')}
                </span>
              </div>
              <pre className="text-sm text-[var(--color-text-primary)] whitespace-pre-wrap font-sans leading-relaxed line-clamp-6 overflow-hidden">
                {finishedReport.markdown_content}
              </pre>
              <button
                onClick={() => setReportModal(finishedReport.markdown_content)}
                className="mt-3 text-xs text-[var(--color-accent)] hover:underline"
              >
                Ver relatório completo →
              </button>
            </div>
          )}
        </div>
      </div>
    )
  }

  // Active session: full monitoring layout
  return (
    <div className="flex flex-col h-screen bg-[var(--color-bg-page)] overflow-hidden">
      {reportModal && (
        <ReportModal markdown={reportModal} onClose={() => setReportModal(null)} />
      )}

      {/* Topbar */}
      <div
        className="shrink-0 border-b border-[var(--color-border-std)] bg-[var(--color-surface)] flex items-center justify-between px-4"
        style={{ height: 'var(--height-topbar)' }}
      >
        <div className="flex items-center gap-3 min-w-0">
          <Link
            to={`/projects/${session.project_id}`}
            className="text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors shrink-0"
          >
            <ChevronLeft size={18} />
          </Link>

          <div className="flex items-center gap-2 min-w-0">
            {ws.connected ? (
              <span className="flex items-center gap-1.5 text-xs font-medium text-[var(--color-accent)] shrink-0">
                <Radio size={12} className="animate-pulse" />
                ao vivo
              </span>
            ) : (
              <span className="text-xs text-[var(--color-yellow)] shrink-0">
                reconectando...
              </span>
            )}
            <span className="text-[var(--color-border-std)]">·</span>
            <Clock size={12} className="text-[var(--color-text-secondary)] shrink-0" />
            <SessionTimer startedAt={session.started_at} />
          </div>
        </div>

        {/* Extension instructions (compact) */}
        {isExtension && (
          <div className="hidden md:flex items-center gap-2 text-xs text-[var(--color-text-secondary)]">
            <span>ID:</span>
            <code className="px-2 py-0.5 bg-[var(--color-muted)] rounded font-mono text-xs max-w-[160px] truncate">
              {session.id}
            </code>
            <button
              onClick={copy}
              className="flex items-center gap-1 hover:text-[var(--color-text-primary)] transition-colors"
            >
              {copied ? <Check size={12} className="text-[var(--color-accent)]" /> : <Copy size={12} />}
            </button>
          </div>
        )}

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleGenerateReport}
            disabled={generatingReport || ws.budget.status === 'insufficient'}
            title={ws.budget.status === 'insufficient' ? 'Saldo insuficiente' : 'Gerar relatório (R)'}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[var(--color-text-secondary)] border border-[var(--color-border-std)] rounded-[var(--radius-btn)] hover:bg-[var(--color-muted)] transition-colors disabled:opacity-40"
          >
            <FileText size={12} />
            {generatingReport ? 'Gerando...' : 'Relatório'}
          </button>
          <button
            onClick={handleFinish}
            disabled={finishing}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-[var(--color-red)] border border-[var(--color-border-red)] rounded-[var(--radius-btn)] hover:bg-[var(--color-red-bg)] transition-colors disabled:opacity-50"
          >
            <Square size={12} />
            {finishing ? 'Encerrando...' : 'Encerrar'}
          </button>
        </div>
      </div>

      {/* Budget bar */}
      <BudgetBar
        used={ws.budget.used_usd}
        limit={ws.budget.limit_usd}
        estimated={ws.budget.estimated_report_cost}
        status={ws.budget.status}
      />

      {/* Error banner */}
      {error && (
        <div className="shrink-0 text-xs text-[var(--color-red)] bg-[var(--color-red-bg)] border-b border-[var(--color-border-red)] px-4 py-2">
          {error}
        </div>
      )}

      {/* 3-column layout */}
      <div className="flex flex-1 min-h-0 overflow-hidden">

        {/* Left — Coverage (220px) */}
        <div
          className="shrink-0 border-r border-[var(--color-border-std)] bg-[var(--color-surface)] overflow-hidden"
          style={{ width: 220 }}
        >
          <CoveragePanel
            coverage={ws.coverage}
            onForceClassify={handleForceClassify}
          />
        </div>

        {/* Center — Transcript + alerts */}
        <div className="flex-1 bg-[var(--color-bg-page)] overflow-hidden">
          <TranscriptPanel
            transcript={ws.transcript}
            redFlags={ws.redFlags}
          />
        </div>

        {/* Right — Questions (280px) */}
        <div
          className="shrink-0 border-l border-[var(--color-border-std)] bg-[var(--color-surface)] overflow-hidden"
          style={{ width: 280 }}
        >
          <QuestionsPanel
            questions={ws.questions}
            onGenerateQuestions={handleGenerateQuestions}
            onPin={handlePinQuestion}
            onDismiss={handleDismissQuestion}
            onUse={handleUseQuestion}
          />
        </div>
      </div>
    </div>
  )
}
