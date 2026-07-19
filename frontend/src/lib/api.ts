const _fromEnv = import.meta.env.VITE_API_URL as string | undefined
export const API_BASE = _fromEnv ??
  (window.location.hostname === 'localhost' ? 'http://localhost:8000' : window.location.origin)

export interface Project {
  id: string
  name: string
  client: string
  description: string | null
  project_type: string | null
  budget_usd: string | null
  data_maturity_score: number | null
  pre_meeting_context: string | null
  meeting_url: string | null
  source: string
  question_ttl_seconds: number
  has_api_key: boolean
  has_active_session: boolean
  pricing_llm_provider: string | null
  pricing_llm_model: string | null
  has_pricing_api_key: boolean
  created_at: string
  updated_at: string
}

export interface Session {
  id: string
  project_id: string
  meeting_url: string | null
  source: string
  status: 'active' | 'finished' | 'cancelled'
  tokens_used: number
  cost_usd: string
  tunnel_url: string | null
  started_at: string
  finished_at: string | null
}

export interface SessionCreate {
  project_id: string
  meeting_url?: string
  source?: string
  additional_context?: string
  budget_usd?: number
}

export interface ProjectCreate {
  name: string
  client: string
  description?: string
  project_type?: string
  gemini_api_key?: string
  budget_usd?: number
  data_maturity_score?: number
  pre_meeting_context?: string
  meeting_url?: string
  source: 'extension' | 'recall'
  question_ttl_seconds: number
  pricing_llm_provider?: string
  pricing_llm_model?: string
  pricing_api_key?: string
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { detail?: string }
    throw new Error(err.detail ?? `HTTP ${res.status}`)
  }
  if (res.status === 204) return undefined as T
  return res.json() as Promise<T>
}

export interface Report {
  id: string
  session_id: string
  markdown_content: string
  cost_usd: string
  generated_at: string
}

export interface Question {
  id: string
  session_id: string
  text: string
  block: string | null
  source: 'auto' | 'manual' | 'pre_mapped'
  status: 'queued' | 'pinned' | 'dismissed' | 'used'
  generated_at: string
  expires_at: string | null
}

export interface Pricing {
  id: string
  project_id: string
  status: 'draft' | 'approved'
  start_date: string
  num_analysts: number
  hours_per_day: string
  ticket_price: string
  extra_calendar_days: number
  created_at: string
  updated_at: string
}

export interface PricingOutputs {
  total_horas: string
  dias_uteis: string
  dias_corridos: string
  preco_total: string
  duracao_meses: string
  duracao_semanas: string
  num_sprints: string
  data_final: string
}

export interface PricingFeature {
  id: string
  pricing_id: string
  bloco: string
  funcionalidade: string
  horas: string
  citi_responsible: boolean
  ordem: number | null
  created_at: string
}

export interface PricingWithDetails extends Pricing {
  features: PricingFeature[]
  outputs: PricingOutputs | null
}

export interface PricingCreateBody {
  start_date: string
  num_analysts: number
  hours_per_day: number
  ticket_price: number
  extra_calendar_days?: number
}

export interface PricingUpdateBody {
  start_date?: string
  num_analysts?: number
  hours_per_day?: number
  ticket_price?: number
  extra_calendar_days?: number
}

export interface PricingFeatureCreateBody {
  bloco: string
  funcionalidade: string
  horas: number
  citi_responsible?: boolean
  ordem?: number
}

export interface PricingFeatureUpdateBody {
  bloco?: string
  funcionalidade?: string
  horas?: number
  citi_responsible?: boolean
  ordem?: number
}

export interface PricingHistory {
  id: string
  project_id: string
  pricing_id: string
  snapshot: Record<string, unknown>
  approved_at: string
}

export const api = {
  sessions: {
    list: (project_id: string) =>
      request<Session[]>(`/sessions/?project_id=${project_id}`),
    get: (id: string) => request<Session>(`/sessions/${id}`),
    create: (data: SessionCreate) =>
      request<Session>('/sessions/', { method: 'POST', body: JSON.stringify(data) }),
    finish: (id: string) =>
      request<Session>(`/sessions/${id}/finish`, { method: 'POST' }),
    generateQuestions: (id: string) =>
      request<{ triggered: boolean }>(`/sessions/${id}/questions/generate`, { method: 'POST' }),
    generateReport: (id: string) =>
      request<Report>(`/sessions/${id}/report`, { method: 'POST' }),
    getReport: (id: string) =>
      request<Report>(`/sessions/${id}/report`),
    uploadTranscript: async (id: string, file: File): Promise<Report> => {
      const form = new FormData()
      form.append('file', file)
      const res = await fetch(`${API_BASE}/sessions/${id}/transcript/upload`, {
        method: 'POST',
        body: form,
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { detail?: string }
        throw new Error(err.detail ?? `HTTP ${res.status}`)
      }
      return res.json() as Promise<Report>
    },
  },
  projects: {
    list: () => request<Project[]>('/projects/'),
    get: (id: string) => request<Project>(`/projects/${id}`),
    create: (data: ProjectCreate) =>
      request<Project>('/projects/', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: Partial<ProjectCreate>) =>
      request<Project>(`/projects/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: string) =>
      request<void>(`/projects/${id}`, { method: 'DELETE' }),
  },
  questions: {
    updateStatus: (id: string, status: Question['status']) =>
      request<Question>(`/questions/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      }),
  },
  pricings: {
    list: (projectId: string) =>
      request<Pricing[]>(`/projects/${projectId}/pricings`),
    listByProject: (projectId: string) =>
      request<Pricing[]>(`/projects/${projectId}/pricings`),
    create: (projectId: string, body: PricingCreateBody) =>
      request<Pricing>(`/projects/${projectId}/pricings`, {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    get: (pricingId: string) =>
      request<PricingWithDetails>(`/pricings/${pricingId}`),
    update: (pricingId: string, body: PricingUpdateBody) =>
      request<Pricing>(`/pricings/${pricingId}`, {
        method: 'PUT',
        body: JSON.stringify(body),
      }),
    delete: (pricingId: string) =>
      request<void>(`/pricings/${pricingId}`, { method: 'DELETE' }),
    approve: (pricingId: string) =>
      request<Pricing>(`/pricings/${pricingId}/approve`, { method: 'POST' }),
    history: (projectId: string) =>
      request<PricingHistory[]>(`/projects/${projectId}/pricing-history`),
  },
  pricingFeatures: {
    list: (pricingId: string) =>
      request<PricingFeature[]>(`/pricings/${pricingId}/features`),
    add: (pricingId: string, body: PricingFeatureCreateBody) =>
      request<PricingFeature>(`/pricings/${pricingId}/features`, {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    update: (pricingId: string, featureId: string, body: PricingFeatureUpdateBody) =>
      request<PricingFeature>(`/pricings/${pricingId}/features/${featureId}`, {
        method: 'PUT',
        body: JSON.stringify(body),
      }),
    delete: (pricingId: string, featureId: string) =>
      request<void>(`/pricings/${pricingId}/features/${featureId}`, { method: 'DELETE' }),
  },
}
