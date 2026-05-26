import { useCallback, useEffect, useRef, useState } from 'react'
import { API_BASE } from './api'

export interface CoverageArea {
  status: 'covered' | 'partial' | 'uncovered'
  score: number
  notes: string
}

export interface RedFlag {
  id: string
  text: string
  severity: 'warning' | 'critical'
  evidence: string
  detected_at: string
}

export interface WSQuestion {
  id: string
  text: string
  block: string
  source: 'auto' | 'manual'
  status: 'queued' | 'pinned' | 'dismissed' | 'used'
  generated_at: string
  expires_at: string
}

export interface TranscriptChunk {
  text: string
  speaker: string | null
  timestamp: string
}

export interface BudgetState {
  used_usd: number
  limit_usd: number | null
  estimated_report_cost: number
  status: 'ok' | 'warning' | 'critical' | 'insufficient'
}

export type CoverageState = Record<string, CoverageArea>

export interface SessionWSState {
  connected: boolean
  coverage: CoverageState
  redFlags: RedFlag[]
  questions: WSQuestion[]
  transcript: TranscriptChunk[]
  budget: BudgetState
  reportMarkdown: string | null
}

const COVERAGE_AREAS = [
  'negocio', 'eng_dados', 'visualizacao', 'ciencia_dados',
  'automacao', 'integracao', 'consumo', 'parceria',
]

const INITIAL_COVERAGE: CoverageState = Object.fromEntries(
  COVERAGE_AREAS.map(a => [a, { status: 'uncovered' as const, score: 0, notes: '' }])
)

const WS_BASE = API_BASE.replace(/^http/, 'ws')

export function useSessionWS(sessionId: string | undefined) {
  const [state, setState] = useState<SessionWSState>({
    connected: false,
    coverage: INITIAL_COVERAGE,
    redFlags: [],
    questions: [],
    transcript: [],
    budget: { used_usd: 0, limit_usd: null, estimated_report_cost: 0, status: 'ok' },
    reportMarkdown: null,
  })

  const wsRef = useRef<WebSocket | null>(null)

  const send = useCallback((event: string, data?: Record<string, unknown>) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ event, data: data ?? {} }))
    }
  }, [])

  // Expose a method to update question status in local state immediately
  const updateQuestionStatus = useCallback(
    (questionId: string, status: WSQuestion['status']) => {
      setState(s => ({
        ...s,
        questions: s.questions.map(q =>
          q.id === questionId ? { ...q, status } : q
        ),
      }))
    },
    []
  )

  useEffect(() => {
    if (!sessionId) return

    const ws = new WebSocket(`${WS_BASE}/ws/${sessionId}`)
    wsRef.current = ws

    ws.onopen = () => setState(s => ({ ...s, connected: true }))
    ws.onclose = () => setState(s => ({ ...s, connected: false }))

    ws.onmessage = (e: MessageEvent) => {
      try {
        const { event, data } = JSON.parse(e.data as string) as {
          event: string
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          data: any
        }
        setState(s => {
          switch (event) {
            case 'initial_state':
              return {
                ...s,
                coverage: (data.coverage as CoverageState) ?? s.coverage,
                redFlags: (data.red_flags as RedFlag[]) ?? s.redFlags,
                questions: (data.questions as WSQuestion[]) ?? s.questions,
                transcript: (data.transcript as TranscriptChunk[]) ?? s.transcript,
                budget: (data.budget as BudgetState) ?? s.budget,
              }
            case 'coverage_update':
              return { ...s, coverage: (data.areas as CoverageState) ?? s.coverage }
            case 'red_flag':
              return { ...s, redFlags: [...s.redFlags, data as RedFlag] }
            case 'question_new':
              return {
                ...s,
                questions: [
                  ...s.questions.filter(q => q.id !== (data as WSQuestion).id),
                  data as WSQuestion,
                ],
              }
            case 'question_expired':
              return {
                ...s,
                questions: s.questions.map(q =>
                  q.id === (data as { id: string }).id
                    ? { ...q, status: 'dismissed' as const }
                    : q
                ),
              }
            case 'transcript_chunk':
              return {
                ...s,
                transcript: [...s.transcript, data as TranscriptChunk],
              }
            case 'budget_update':
              return { ...s, budget: data as BudgetState }
            case 'report_ready':
              return { ...s, reportMarkdown: (data as { markdown_content: string }).markdown_content }
            default:
              return s
          }
        })
      } catch {
        // ignore parse errors
      }
    }

    return () => {
      ws.close()
      wsRef.current = null
    }
  }, [sessionId])

  return { state, send, updateQuestionStatus }
}
