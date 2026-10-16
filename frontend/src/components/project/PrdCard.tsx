import type { Readiness } from '../../lib/api'
import { Button, Card, ProgressBar, SectionLabel } from '../ui'

// Mapa fechado dos 4 sinais de READINESS_WEIGHTS (session_state.py) para frases curtas, usadas no tooltip.
const READINESS_SIGNAL_LABELS: Record<string, string> = {
  cobertura_por_lente: 'cobertura por lente',
  cobertura_global: 'cobertura geral',
  perguntas_transcricao: 'perguntas respondidas ou transcrição',
  secoes_chave: 'seções-chave do relatório',
}

interface PrdCardProps {
  readiness: Readiness | null
  loading: boolean
  loadError: string | null
  generating: boolean
  generateError: string | null
  onGenerate: () => void
}

/** "Gerar PRD" (só discovery): progresso de prontidão da sessão mais recente + botão. */
export default function PrdCard({ readiness, loading, loadError, generating, generateError, onGenerate }: PrdCardProps) {
  const pct = loading ? 0 : Math.round((readiness?.score ?? 0) * 100)
  const tooltip =
    readiness && !readiness.ready
      ? `Faltam: ${readiness.low_signals.map(k => READINESS_SIGNAL_LABELS[k] ?? k).join(', ')}`
      : undefined

  return (
    <Card className="px-[26px] py-6 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <SectionLabel>Gerar PRD</SectionLabel>
        <span className="font-mono text-[12px] text-ds-muted tabular-nums">{pct}% pronto</span>
      </div>
      {loadError ? (
        <p className="m-0 text-[13px] text-ds-red">Erro ao carregar readiness</p>
      ) : (
        <ProgressBar pct={pct} label="Prontidão para gerar o PRD" />
      )}
      <Button
        variant="primary"
        onClick={onGenerate}
        disabled={!readiness?.ready || loading || !!loadError || generating}
        title={tooltip}
        className="w-full"
      >
        {loading ? 'Carregando…' : generating ? 'Gerando…' : 'Gerar PRD'}
      </Button>
      {generateError && <p role="alert" className="m-0 text-[13px] text-ds-red">{generateError}</p>}
    </Card>
  )
}
