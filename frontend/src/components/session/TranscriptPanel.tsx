import { useEffect, useRef } from 'react'
import { AlertTriangle } from 'lucide-react'
import LensBadge from './LensBadge'
import { SectionLabel } from '../ui'

interface TranscriptChunk { text: string; speaker: string | null; timestamp: string }
interface RedFlag {
  id: string
  text: string
  severity: string
  evidence: string
  detected_at: string
  lens?: 'produto' | 'dados' | null
}

/** Estado de espera da coluna central, antes da primeira fala chegar. */
function WaitingForTranscript() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-[18px] text-center px-6 bg-[radial-gradient(600px_400px_at_50%_40%,rgba(62,224,111,0.10),rgba(62,224,111,0)_70%)]">
      <span className="w-[84px] h-[84px] rounded-full border border-ds-green-line flex items-center justify-center shadow-[0_0_60px_rgba(62,224,111,0.2)]">
        <span className="w-4 h-4 rounded-full bg-ds-green shadow-[0_0_20px_#3ee06f] motion-safe:animate-pulse" />
      </span>
      <span className="text-[20px] font-semibold text-white">Aguardando transcrição…</span>
      <p className="m-0 text-[14px] text-ds-muted">Abra a reunião no Google Meet com a extensão ativa.</p>
    </div>
  )
}

/** Coluna central: alertas (red flags) no topo e a transcrição ao vivo. */
export default function TranscriptPanel({ transcript, redFlags }: { transcript: TranscriptChunk[]; redFlags: RedFlag[] }) {
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [transcript.length])

  return (
    <div className="flex flex-col h-full min-h-0">
      {redFlags.length > 0 && (
        <section aria-label="Alertas" className="shrink-0 border-b border-ds-border max-h-56 overflow-y-auto">
          <div className="px-6 py-3 border-b border-ds-border"><SectionLabel>Alertas · {redFlags.length}</SectionLabel></div>
          <div className="divide-y divide-ds-border">
            {redFlags.map(rf => {
              const critical = rf.severity === 'critical'
              return (
                <div key={rf.id} className={`px-6 py-3.5 flex gap-3 ${critical ? 'bg-ds-red/[0.07]' : 'bg-ds-amber/[0.06]'}`}>
                  <AlertTriangle size={15} aria-hidden className={`shrink-0 mt-0.5 ${critical ? 'text-ds-red' : 'text-ds-amber'}`} />
                  <div className="min-w-0 flex flex-col gap-1">
                    {rf.lens != null && <span className="w-fit"><LensBadge lens={rf.lens} /></span>}
                    <p className="m-0 text-[14px] text-ds-text">{rf.text}</p>
                    {rf.evidence && <p className="m-0 text-[12.5px] text-ds-muted italic truncate">"{rf.evidence}"</p>}
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {transcript.length === 0 ? (
        <WaitingForTranscript />
      ) : (
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-3" aria-live="polite" aria-label="Transcrição ao vivo">
          {transcript.map((chunk, i) => (
            <div key={i} className="text-[14.5px] leading-[1.65]">
              {chunk.speaker && <span className="font-semibold text-ds-green mr-1.5">{chunk.speaker}:</span>}
              <span className="text-ds-text">{chunk.text}</span>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>
      )}
    </div>
  )
}
