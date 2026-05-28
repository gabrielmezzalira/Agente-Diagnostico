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
  source: 'auto' | 'manual'
  status: 'queued' | 'pinned' | 'dismissed' | 'used'
  generated_at: string
  expires_at: string | null
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
}
