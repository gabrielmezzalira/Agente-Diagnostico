import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ChevronDown, ChevronLeft } from 'lucide-react'
import { api, type ProjectCreate } from '../lib/api'
import AppShell from '../components/layout/AppShell'
import FormSection from '../components/FormSection'
import {
  Button, ButtonLink, Card, ChoiceGroup, ErrorNotice, Field, Input, Select, Textarea,
} from '../components/ui'

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
  data_maturity_score: undefined,
  pre_meeting_context: '',
  meeting_url: '',
  source: 'extension',
  mode: 'sales',
  docudata_project_id: '',
  question_ttl_seconds: 60,
  pricing_llm_provider: undefined,
  pricing_llm_model: undefined,
  pricing_api_key: undefined,
}

export default function ProjectFormPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const isEdit = Boolean(id)

  const [form, setForm] = useState({ ...DEFAULT_FORM })
  const [hasApiKey, setHasApiKey] = useState(false)
  const [hasPricingApiKey, setHasPricingApiKey] = useState(false)
  const [linkedBefore, setLinkedBefore] = useState(false)
  const [showLlmConfig, setShowLlmConfig] = useState(false)
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
          data_maturity_score: p.data_maturity_score ?? undefined,
          pre_meeting_context: p.pre_meeting_context ?? '',
          meeting_url: p.meeting_url ?? '',
          source: (p.source === 'recall' ? 'recall' : 'extension') as 'extension' | 'recall',
          mode: (p.mode === 'discovery' ? 'discovery' : 'sales') as 'sales' | 'discovery',
          docudata_project_id: p.docudata_project_id ?? '',
          question_ttl_seconds: p.question_ttl_seconds,
          pricing_llm_provider: p.pricing_llm_provider ?? undefined,
          pricing_llm_model: p.pricing_llm_model ?? undefined,
          pricing_api_key: undefined,
        })
        setHasApiKey(p.has_api_key)
        setHasPricingApiKey(p.has_pricing_api_key ?? false)
        setLinkedBefore(!!p.docudata_project_id)
        if (p.pricing_llm_provider || p.pricing_llm_model) setShowLlmConfig(true)
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
      if (!payload.pricing_llm_provider) delete payload.pricing_llm_provider
      if (!payload.pricing_llm_model) delete payload.pricing_llm_model
      if (!payload.pricing_api_key) delete payload.pricing_api_key
      // Vínculo vazio = sem vínculo (não envia a coluna). O backend não desvincula.
      const link = payload.docudata_project_id?.trim()
      if (link) payload.docudata_project_id = link
      else delete payload.docudata_project_id

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
    return <AppShell><p className="text-[14px] text-ds-muted">Carregando…</p></AppShell>
  }

  const dms = form.data_maturity_score
  const backTo = id ? `/projects/${id}` : '/'

  return (
    <AppShell>
      <div className="flex items-center gap-4">
        <Link
          to={backTo}
          aria-label="Voltar"
          className="w-[38px] h-[38px] rounded-[10px] border border-ds-border-strong flex items-center justify-center text-ds-text-2 hover:bg-white/[0.05] transition-colors"
        >
          <ChevronLeft size={18} aria-hidden />
        </Link>
        <h1 className="m-0 text-[24px] font-bold tracking-[-0.02em] text-white">
          {isEdit ? 'Editar projeto' : 'Novo projeto'}
        </h1>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-7 max-w-[860px]">
        {error && <ErrorNotice>{error}</ErrorNotice>}

        <FormSection title="Identificação">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Nome do projeto" htmlFor="f-name" required>
              <Input id="f-name" required value={form.name} onChange={e => set('name', e.target.value)} placeholder="Pipeline de Vendas" />
            </Field>
            <Field label="Cliente" htmlFor="f-client" required>
              <Input id="f-client" required value={form.client} onChange={e => set('client', e.target.value)} placeholder="Empresa XYZ" />
            </Field>
          </div>
          <Field label="Descrição" htmlFor="f-desc">
            <Textarea id="f-desc" rows={2} value={form.description ?? ''} onChange={e => set('description', e.target.value)} placeholder="Breve descrição do escopo" />
          </Field>
        </FormSection>

        <FormSection title="Contexto da reunião">
          <Field
            label={dms != null ? `Data Maturity Score — ${dms} · ${DMS_META[dms].title}` : 'Data Maturity Score'}
            htmlFor="f-dms"
            hint={dms != null ? DMS_META[dms].description : undefined}
          >
            {dms == null ? (
              <div className="flex items-center gap-3">
                <span className="text-[14px] text-ds-muted italic">Não mapeado</span>
                <Button size="sm" variant="active" onClick={() => set('data_maturity_score', 3)}>Definir nível</Button>
              </div>
            ) : (
              <div className="flex items-center gap-4">
                <input
                  id="f-dms"
                  type="range"
                  min={1}
                  max={5}
                  step={1}
                  value={dms}
                  onChange={e => set('data_maturity_score', Number(e.target.value))}
                  className="flex-1 accent-[var(--color-accent)]"
                />
                <Button size="sm" variant="ghost" onClick={() => set('data_maturity_score', undefined)}>Limpar</Button>
              </div>
            )}
          </Field>
          <Field label="Contexto pré-reunião" htmlFor="f-ctx">
            <Textarea id="f-ctx" rows={4} value={form.pre_meeting_context ?? ''} onChange={e => set('pre_meeting_context', e.target.value)} placeholder="O que você já sabe sobre o cliente antes da reunião…" />
          </Field>
          <Field label="URL da reunião" htmlFor="f-url">
            <Input id="f-url" type="url" value={form.meeting_url ?? ''} onChange={e => set('meeting_url', e.target.value)} placeholder="https://meet.google.com/…" />
          </Field>
        </FormSection>

        <FormSection title="Captura e IA">
          <Field label="Modo do projeto" required>
            <ChoiceGroup
              name="mode"
              value={form.mode}
              onChange={v => set('mode', v)}
              options={[
                { value: 'sales', label: 'Vendas', description: 'Diagnóstico comercial antes de fechar contrato' },
                { value: 'discovery', label: 'Discovery', description: 'Levantamento de requisitos; envia ao DocuData' },
              ]}
            />
          </Field>
          <Field label="Fonte de transcrição" required>
            <ChoiceGroup
              name="source"
              value={form.source}
              onChange={v => set('source', v)}
              options={[
                { value: 'extension', label: 'Extensão Chrome', description: 'Gratuito' },
                { value: 'recall', label: 'Recall.ai', description: 'Bot automático na reunião' },
              ]}
            />
          </Field>
          <Field
            label="Chave de API Gemini"
            htmlFor="f-key"
            required={!isEdit}
            hint={hasApiKey ? 'Chave salva. Preencha apenas para substituir.' : undefined}
          >
            <Input
              id="f-key"
              type="password"
              required={!isEdit && !hasApiKey}
              value={form.gemini_api_key}
              onChange={e => set('gemini_api_key', e.target.value)}
              placeholder={hasApiKey ? '••••••• (deixe em branco para manter)' : 'AIza…'}
              autoComplete="new-password"
            />
          </Field>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Budget de IA (USD)" htmlFor="f-budget">
              <Input id="f-budget" type="number" min={0} step={0.01} value={form.budget_usd ?? ''} onChange={e => set('budget_usd', e.target.value ? Number(e.target.value) : undefined)} placeholder="Sem limite" />
            </Field>
            <Field label="TTL de perguntas (s)" htmlFor="f-ttl">
              <Input id="f-ttl" type="number" min={5} value={form.question_ttl_seconds} onChange={e => set('question_ttl_seconds', Number(e.target.value))} />
            </Field>
          </div>
        </FormSection>

        <FormSection
          title="Integração DocuData"
          description="Opcional. Em projetos no modo Discovery, ao encerrar a sessão a reunião é enviada ao projeto vinculado."
        >
          <Field
            label="ID do projeto no DocuData"
            htmlFor="f-docudata"
            hint={
              linkedBefore
                ? 'Já vinculado. Depois de vinculado, o vínculo não pode ser removido por aqui.'
                : 'Copie o ID do projeto no DocuData. Deixe em branco para não enviar nada.'
            }
          >
            <Input
              id="f-docudata"
              className="font-mono"
              value={form.docudata_project_id ?? ''}
              onChange={e => set('docudata_project_id', e.target.value)}
              placeholder="00000000-0000-0000-0000-000000000000"
              maxLength={100}
              autoComplete="off"
              spellCheck={false}
            />
          </Field>
        </FormSection>

        <Card>
          <button
            type="button"
            onClick={() => setShowLlmConfig(v => !v)}
            aria-expanded={showLlmConfig}
            className="w-full flex items-center justify-between px-[26px] py-5 text-left cursor-pointer"
          >
            <span className="ds-label">Configuração IA do Precificador</span>
            <ChevronDown size={16} aria-hidden className={`text-ds-muted transition-transform duration-200 ${showLlmConfig ? 'rotate-180' : ''}`} />
          </button>
          {showLlmConfig && (
            <div className="px-[26px] pb-6 pt-5 flex flex-col gap-5 border-t border-ds-border">
              <Field label="Provider" htmlFor="f-provider">
                <Select id="f-provider" value={form.pricing_llm_provider ?? ''} onChange={e => set('pricing_llm_provider', e.target.value || undefined)}>
                  <option value="">Selecione</option>
                  <option value="openai">OpenAI</option>
                  <option value="anthropic">Anthropic</option>
                  <option value="google">Google</option>
                </Select>
              </Field>
              <Field label="Modelo" htmlFor="f-model">
                <Input id="f-model" value={form.pricing_llm_model ?? ''} onChange={e => set('pricing_llm_model', e.target.value || undefined)} placeholder="gpt-4o, claude-3-5-sonnet-20241022, gemini-2.0-flash" />
              </Field>
              <Field label="API Key do Precificador" htmlFor="f-pkey" hint={hasPricingApiKey ? 'Chave salva. Preencha apenas para substituir.' : undefined}>
                <Input id="f-pkey" type="password" autoComplete="new-password" value={form.pricing_api_key ?? ''} onChange={e => set('pricing_api_key', e.target.value || undefined)} placeholder={hasPricingApiKey ? '••••• (deixe em branco para manter)' : 'sk-…'} />
              </Field>
            </div>
          )}
        </Card>

        <div className="flex items-center gap-3">
          <Button type="submit" variant="primary" disabled={submitting}>
            {submitting ? 'Salvando…' : isEdit ? 'Salvar alterações' : 'Criar projeto'}
          </Button>
          <ButtonLink to={backTo} variant="ghost">Cancelar</ButtonLink>
        </div>
      </form>
    </AppShell>
  )
}
