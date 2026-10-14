import { useRef } from 'react'
import { Link } from 'react-router-dom'
import { ChevronLeft, FileText, RefreshCw, Upload } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { Report, Session } from '../../lib/api'
import { formatDateTime, sessionDurationLabel } from '../../lib/labels'
import AppShell from '../layout/AppShell'
import { Button, Card, Chip, DetailRows, ErrorNotice, SectionLabel, StatCard } from '../ui'
import { Select } from '../ui'
import { MARKDOWN_STYLES } from './ReportModal'

interface TranscriptChunk { text: string; speaker: string | null }

interface FinishedSessionProps {
  session: Session
  projectName: string | null
  report: Report | null
  transcript: TranscriptChunk[]
  error: string | null
  regenerating: boolean
  uploadingPdf: boolean
  updatingStatus: boolean
  onOpenReport: (markdown: string) => void
  onRegenerate: () => void
  onUploadPdf: (e: React.ChangeEvent<HTMLInputElement>) => void
  onUpdateStatus: (status: NonNullable<Report['status']>) => void
}

/** Sessão encerrada: métricas, detalhes, relatório (com status de aprovação) e transcrição. */
export default function FinishedSession(props: FinishedSessionProps) {
  const { session, projectName, report, transcript, error, regenerating, uploadingPdf, updatingStatus } = props
  const pdfInputRef = useRef<HTMLInputElement>(null)
  const duration = sessionDurationLabel(session.started_at, session.finished_at)
  const cost = `$${parseFloat(session.cost_usd).toFixed(4)}`
  const tokens = session.tokens_used.toLocaleString('pt-BR')

  return (
    <AppShell>
      <div className="flex items-center gap-4 flex-wrap">
        <Link
          to={`/projects/${session.project_id}`}
          aria-label="Voltar para o projeto"
          className="w-[38px] h-[38px] rounded-[10px] border border-ds-border-strong flex items-center justify-center text-ds-text-2 hover:bg-white/[0.05] transition-colors"
        >
          <ChevronLeft size={18} aria-hidden />
        </Link>
        <div className="flex flex-col gap-1 min-w-0">
          <h1 className="m-0 text-[24px] font-bold tracking-[-0.02em] text-white">{session.name ?? 'Sessão encerrada'}</h1>
          {projectName && <span className="text-[13.5px] text-ds-muted">{projectName}</span>}
        </div>
        <div className="ml-auto flex gap-2">
          {report && (
            <Button variant="active" onClick={() => props.onOpenReport(report.markdown_content)}>
              <FileText size={14} aria-hidden /> Ver relatório
            </Button>
          )}
          <Button onClick={props.onRegenerate} disabled={regenerating || uploadingPdf}>
            <RefreshCw size={14} aria-hidden /> {regenerating ? 'Gerando…' : 'Regenerar'}
          </Button>
          <input ref={pdfInputRef} type="file" accept=".pdf" className="hidden" onChange={props.onUploadPdf} />
          <Button
            onClick={() => pdfInputRef.current?.click()}
            disabled={uploadingPdf || regenerating}
            title="Importar transcrição em PDF para gerar relatório"
          >
            <Upload size={14} aria-hidden /> {uploadingPdf ? 'Processando…' : 'Importar PDF'}
          </Button>
        </div>
      </div>

      {error && <ErrorNotice>{error}</ErrorNotice>}

      <div className="flex items-center gap-2.5">
        <Chip tone="green" dot><span className="capitalize">{session.status}</span></Chip>
        <span className="font-mono text-[12.5px] text-ds-muted">Início {formatDateTime(session.started_at)}</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard label="Duração" value={duration} />
        <StatCard label="Custo de IA" value={cost} />
        <StatCard label="Tokens usados" value={tokens} />
      </div>

      <DetailRows
        rows={[
          { label: 'Status', value: <span className="capitalize">{session.status}</span> },
          { label: 'Início', value: formatDateTime(session.started_at) },
          { label: 'Duração', value: duration },
          { label: 'Custo de IA', value: cost },
          { label: 'Tokens usados', value: tokens },
        ]}
      />

      {report && (
        <Card className="px-[26px] py-6 flex flex-col gap-4">
          <div className="flex items-center justify-between gap-3">
            <SectionLabel>Relatório gerado</SectionLabel>
            <span className="font-mono text-[12px] text-ds-muted">{formatDateTime(report.generated_at)}</span>
          </div>

          {/* D-48: seletor de status/aprovação — só relatório de discovery (status != null) */}
          {report.status != null && (
            <div className="flex items-center gap-3 flex-wrap">
              <label htmlFor="report-status-select" className="ds-label">Status</label>
              <Select
                id="report-status-select"
                value={report.status}
                disabled={updatingStatus}
                onChange={e => props.onUpdateStatus(e.target.value as NonNullable<Report['status']>)}
                className="!w-auto !h-9 text-[13px]"
              >
                <option value="Rascunho">Rascunho</option>
                <option value="Em revisão">Em revisão</option>
                <option value="Aprovado para build">Aprovado para build</option>
              </Select>
              {report.status === 'Aprovado para build' && (
                <span className="text-[12.5px] text-ds-muted">Libera a importação no Precificador</span>
              )}
            </div>
          )}

          <div className={`text-ds-text-2 line-clamp-6 overflow-hidden ${MARKDOWN_STYLES}`}>
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{report.markdown_content}</ReactMarkdown>
          </div>
          <button
            type="button"
            onClick={() => props.onOpenReport(report.markdown_content)}
            className="self-start text-[13px] text-ds-green hover:text-ds-green-hover"
          >
            Ver relatório completo →
          </button>
        </Card>
      )}

      {transcript.length > 0 && (
        <Card className="overflow-hidden">
          <div className="px-6 py-3.5 border-b border-ds-border">
            <SectionLabel>Transcrição · {transcript.length} blocos</SectionLabel>
          </div>
          <div className="overflow-y-auto max-h-96 px-6 py-4 space-y-2.5">
            {transcript.map((c, i) => (
              <div key={i} className="text-[14px] leading-[1.6]">
                {c.speaker && <span className="font-semibold text-ds-green mr-1.5">{c.speaker}:</span>}
                <span className="text-ds-text">{c.text}</span>
              </div>
            ))}
          </div>
        </Card>
      )}
    </AppShell>
  )
}
