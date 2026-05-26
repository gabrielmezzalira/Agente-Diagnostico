import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'
import { api, type ProjectCreate } from '../lib/api'

const DMS_META: Record<number, { title: string; description: string }> = {
  1: { title: 'Inicial', description: 'Dados em planilhas manuais, sem integração' },
  2: { title: 'Gerenciado', description: 'Dados centralizados, ETL básico ou manual' },
  3: { title: 'Definido', description: 'Pipelines funcionando, DW básico presente' },
  4: { title: 'Quantificado', description: 'Dados confiáveis, KPIs e pipelines monitorados' },
  5: { title: 'Otimizado', description: 'Dados como ativo estratégico, governança completa' },
}

const DEFAULT_FORM: ProjectCreate & { gemini_api_key: string } = {
  name: '',
  client: '',
  description: '',
  gemini_api_key: '',
  budget_usd: undefined,
  data_maturity_score: 3,
  pre_meeting_context: '',
  meeting_url: '',
  source: 'extension',
  question_ttl_seconds: 60,
}

const inputCls =
  'w-full px-3 py-2 text-sm border border-[var(--color-border-std)] rounded-md bg-[var(--color-surface)] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-secondary)] focus:outline-none focus:border-[var(--color-accent)] transition-colors'

function Field({
  label,
  required,
  children,
}: {
  label: string
  required?: boolean
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium text-[var(--color-text-primary)]">
        {label}
        {required && <span className="text-[var(--color-red)] ml-0.5">*</span>}
      </label>
      {children}
    </div>
  )
}

export default function ProjectFormPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const isEdit = Boolean(id)

  const [form, setForm] = useState({ ...DEFAULT_FORM })
  const [hasApiKey, setHasApiKey] = useState(false)
  const [loading, setLoading] = useState(isEdit)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    api.projects
      .get(id)
      .then(p => {
        setForm({
          name: p.name,
          client: p.client,
          description: p.description ?? '',
          gemini_api_key: '',
          budget_usd: p.budget_usd ? Number(p.budget_usd) : undefined,
          data_maturity_score: p.data_maturity_score ?? 3,
          pre_meeting_context: p.pre_meeting_context ?? '',
          meeting_url: p.meeting_url ?? '',
          source: (p.source === 'recall' ? 'recall' : 'extension') as 'extension' | 'recall',
          question_ttl_seconds: p.question_ttl_seconds,
        })
        setHasApiKey(p.has_api_key)
        setLoading(false)
      })
      .catch((e: Error) => {
        setError(e.message)
        setLoading(false)
      })
  }, [id])

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm(f => ({ ...f, [key]: value }))
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)

    try {
      const payload: Partial<typeof form> = { ...form }
      if (isEdit && !payload.gemini_api_key) delete payload.gemini_api_key
      if (!payload.description) delete payload.description
      if (!payload.pre_meeting_context) delete payload.pre_meeting_context
      if (!payload.meeting_url) delete payload.meeting_url

      if (id) {
        await api.projects.update(id, payload)
        navigate(`/projects/${id}`)
      } else {
        const created = await api.projects.create(payload as ProjectCreate & { gemini_api_key: string })
        navigate(`/projects/${created.id}`)
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erro desconhecido')
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--color-bg-page)] flex items-center justify-center">
        <span className="text-sm text-[var(--color-text-secondary)]">Carregando...</span>
      </div>
    )
  }

  const dms = form.data_maturity_score ?? 3

  return (
    <div className="min-h-screen bg-[var(--color-bg-page)]">
      <div className="border-b border-[var(--color-border-std)] bg-[var(--color-surface)]">
        <div className="max-w-2xl mx-auto px-6 py-4 flex items-center gap-3">
          <Link
            to={id ? `/projects/${id}` : '/'}
            className="text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors"
          >
            <ChevronLeft size={18} />
          </Link>
          <h1 className="font-semibold text-sm text-[var(--color-text-primary)]">
            {isEdit ? 'Editar projeto' : 'Novo projeto'}
          </h1>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="max-w-2xl mx-auto px-6 py-8 space-y-5">
        {error && (
          <div className="text-sm text-[var(--color-red)] bg-[var(--color-red-bg)] border border-[var(--color-border-red)] rounded-md px-4 py-3">
            {error}
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <Field label="Nome do projeto" required>
            <input
              type="text"
              required
              value={form.name}
              onChange={e => set('name', e.target.value)}
              placeholder="Pipeline de Vendas"
              className={inputCls}
            />
          </Field>
          <Field label="Cliente" required>
            <input
              type="text"
              required
              value={form.client}
              onChange={e => set('client', e.target.value)}
              placeholder="Empresa XYZ"
              className={inputCls}
            />
          </Field>
        </div>

        <Field label="Descrição">
          <textarea
            rows={2}
            value={form.description ?? ''}
            onChange={e => set('description', e.target.value)}
            placeholder="Breve descrição do escopo"
            className={inputCls}
          />
        </Field>

        <Field label={`Data Maturity Score — ${dms} · ${DMS_META[dms].title}`} required>
          <input
            type="range"
            min={1}
            max={5}
            step={1}
            value={dms}
            onChange={e => set('data_maturity_score', Number(e.target.value))}
            className="w-full accent-[var(--color-accent)] mt-1"
          />
          <p className="text-xs text-[var(--color-text-secondary)]">{DMS_META[dms].description}</p>
        </Field>

        <Field label="Contexto pré-reunião">
          <textarea
            rows={4}
            value={form.pre_meeting_context ?? ''}
            onChange={e => set('pre_meeting_context', e.target.value)}
            placeholder="O que você já sabe sobre o cliente antes da reunião..."
            className={inputCls}
          />
        </Field>

        <Field label="URL da reunião">
          <input
            type="url"
            value={form.meeting_url ?? ''}
            onChange={e => set('meeting_url', e.target.value)}
            placeholder="https://meet.google.com/..."
            className={inputCls}
          />
        </Field>

        <Field label="Fonte de transcrição" required>
          <div className="flex gap-5 mt-0.5">
            {([
              { value: 'extension', label: 'Extensão Chrome (gratuito)' },
              { value: 'recall', label: 'Recall.ai (bot automático)' },
            ] as const).map(({ value, label }) => (
              <label key={value} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="source"
                  value={value}
                  checked={form.source === value}
                  onChange={() => set('source', value)}
                  className="accent-[var(--color-accent)]"
                />
                <span className="text-sm">{label}</span>
              </label>
            ))}
          </div>
        </Field>

        <Field label="Chave de API Gemini" required={!isEdit}>
          <input
            type="password"
            required={!isEdit && !hasApiKey}
            value={form.gemini_api_key}
            onChange={e => set('gemini_api_key', e.target.value)}
            placeholder={hasApiKey ? '••••••• (deixe em branco para manter)' : 'AIza...'}
            autoComplete="new-password"
            className={inputCls}
          />
          {hasApiKey && (
            <p className="text-xs text-[var(--color-text-secondary)]">
              Chave salva. Preencha apenas para substituir.
            </p>
          )}
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Budget de IA (USD)">
            <input
              type="number"
              min={0}
              step={0.01}
              value={form.budget_usd ?? ''}
              onChange={e => set('budget_usd', e.target.value ? Number(e.target.value) : undefined)}
              placeholder="Sem limite"
              className={inputCls}
            />
          </Field>
          <Field label="TTL de perguntas (s)">
            <input
              type="number"
              min={5}
              value={form.question_ttl_seconds}
              onChange={e => set('question_ttl_seconds', Number(e.target.value))}
              className={inputCls}
            />
          </Field>
        </div>

        <div className="flex items-center gap-3 pt-2">
          <button
            type="submit"
            disabled={submitting}
            className="px-4 py-2 bg-[var(--color-accent)] text-white rounded-md text-sm font-medium hover:bg-[var(--color-accent-hover)] transition-colors disabled:opacity-50"
          >
            {submitting ? 'Salvando...' : isEdit ? 'Salvar alterações' : 'Criar projeto'}
          </button>
          <Link
            to={id ? `/projects/${id}` : '/'}
            className="text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors"
          >
            Cancelar
          </Link>
        </div>
      </form>
    </div>
  )
}
