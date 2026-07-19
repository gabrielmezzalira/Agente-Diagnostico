import { useState, useEffect } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Check, ChevronLeft, Trash2, Download, Lightbulb, X, Plus } from 'lucide-react'
import { api, type PricingFeature, type SuggestedFeature } from '../lib/api'
import { usePricing } from '../hooks/usePricing'
import { usePricingFeatures } from '../hooks/usePricingFeatures'
import { useLLMSuggestions } from '../hooks/useLLMSuggestions'
import { featureDias } from '../lib/pricingCalculator'

const inputCls =
  'w-full px-3 py-2 text-sm border border-[var(--color-border-std)] rounded-md bg-[var(--color-surface)] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-secondary)] focus:outline-none focus:border-[var(--color-accent)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed'

const tdCls = 'px-3 py-2 text-sm text-[var(--color-text-primary)]'

function Field({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-medium text-[var(--color-text-secondary)] uppercase tracking-wide">
        {label}
      </label>
      {children}
    </div>
  )
}

function OutputRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 px-4 py-2.5">
      <span className="text-xs text-[var(--color-text-secondary)]">{label}</span>
      <span className="text-sm font-medium text-[var(--color-text-primary)]">{value}</span>
    </div>
  )
}

/** Inline-editable row in the feature table */
function FeatureRow({
  feature,
  numAnalysts,
  hoursPerDay,
  isApproved,
  onUpdate,
  onDelete,
}: {
  feature: PricingFeature
  numAnalysts: number
  hoursPerDay: number
  isApproved: boolean
  onUpdate: (featureId: string, body: { bloco?: string; funcionalidade?: string; horas?: number; citi_responsible?: boolean }) => Promise<void>
  onDelete: (featureId: string) => Promise<void>
}) {
  const [bloco, setBloco] = useState(feature.bloco)
  const [funcionalidade, setFuncionalidade] = useState(feature.funcionalidade)
  const [horas, setHoras] = useState(String(feature.horas))
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    setSaving(true)
    try {
      await onUpdate(feature.id, {
        bloco,
        funcionalidade,
        horas: Number(horas),
      })
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!confirm('Excluir esta funcionalidade?')) return
    await onDelete(feature.id)
  }

  const dias = featureDias(Number(horas), numAnalysts, hoursPerDay).toFixed(1)

  return (
    <tr className="border-t border-[var(--color-border-std)]">
      <td className={tdCls}>
        <input
          type="text"
          value={bloco}
          onChange={e => setBloco(e.target.value)}
          disabled={isApproved}
          className={inputCls}
        />
      </td>
      <td className={tdCls}>
        <input
          type="text"
          value={funcionalidade}
          onChange={e => setFuncionalidade(e.target.value)}
          disabled={isApproved}
          className={inputCls}
        />
      </td>
      <td className={tdCls + ' w-20'}>
        <input
          type="number"
          min={0}
          step={0.5}
          value={horas}
          onChange={e => setHoras(e.target.value)}
          disabled={isApproved}
          className={inputCls}
        />
      </td>
      <td className={tdCls + ' w-16 text-center text-[var(--color-text-secondary)]'}>
        {dias}
      </td>
      <td className={tdCls + ' w-16 text-center'}>
        <input
          type="checkbox"
          checked={feature.citi_responsible}
          disabled={isApproved}
          onChange={() => onUpdate(feature.id, { citi_responsible: !feature.citi_responsible })}
          className="accent-[var(--color-accent)]"
        />
      </td>
      {!isApproved && (
        <td className={tdCls + ' w-20'}>
          <div className="flex items-center gap-1">
            <button
              onClick={handleSave}
              disabled={saving}
              title="Salvar"
              className="p-1.5 text-[var(--color-accent)] hover:bg-[var(--color-muted)] rounded transition-colors disabled:opacity-50"
            >
              <Check size={13} />
            </button>
            <button
              onClick={handleDelete}
              title="Excluir"
              className="p-1.5 text-[var(--color-text-secondary)] hover:text-[var(--color-red)] hover:bg-[var(--color-red-bg)] rounded transition-colors"
            >
              <Trash2 size={13} />
            </button>
          </div>
        </td>
      )}
    </tr>
  )
}

function SuggestionCard({
  suggestion,
  onAccept,
  onReject,
}: {
  suggestion: SuggestedFeature & { _localId: string }
  onAccept: () => void
  onReject: () => void
}) {
  return (
    <div className="bg-[var(--color-surface)] border border-[var(--color-border-std)] rounded-lg p-4 flex items-start justify-between gap-4">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs px-2 py-0.5 bg-[var(--color-muted)] rounded-full text-[var(--color-text-secondary)]">
            {suggestion.bloco}
          </span>
          <span className="text-xs text-[var(--color-text-secondary)]">{Number(suggestion.horas).toFixed(1)}h</span>
        </div>
        <p className="text-sm text-[var(--color-text-primary)]">{suggestion.funcionalidade}</p>
        {suggestion.justificativa && (
          <p className="text-xs text-[var(--color-text-secondary)] mt-1">{suggestion.justificativa}</p>
        )}
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <button onClick={onAccept} title="Aceitar" className="p-1.5 text-[var(--color-accent)] hover:bg-[var(--color-muted)] rounded transition-colors">
          <Plus size={14} />
        </button>
        <button onClick={onReject} title="Rejeitar" className="p-1.5 text-[var(--color-text-secondary)] hover:text-[var(--color-red)] hover:bg-[var(--color-red-bg)] rounded transition-colors">
          <X size={14} />
        </button>
      </div>
    </div>
  )
}

export default function PricingEditorPage() {
  const { id: pricingId } = useParams<{ id: string }>()
  const { pricing, features, outputs, loading, error, refresh, setPricing, setFeatures } =
    usePricing(pricingId)
  const { addFeature, updateFeature, deleteFeature } = usePricingFeatures(pricingId, setFeatures)
  const {
    importing, importError, suggesting, suggestError,
    suggestions, showSuggestions,
    importFromDiagnosis, suggestFeatures, acceptSuggestion, rejectSuggestion, closeSuggestions,
  } = useLLMSuggestions(pricingId, setFeatures)
  const [approving, setApproving] = useState(false)
  const [addingFeature, setAddingFeature] = useState(false)

  const isApproved = pricing?.status === 'approved'

  useEffect(() => {
    if (showSuggestions && suggestions.length === 0) closeSuggestions()
  }, [suggestions.length, showSuggestions, closeSuggestions])

  async function handleInputBlur(
    field: 'start_date' | 'num_analysts' | 'hours_per_day' | 'ticket_price' | 'extra_calendar_days',
    value: string
  ) {
    if (!pricingId || !pricing) return
    const numericFields = ['num_analysts', 'hours_per_day', 'ticket_price', 'extra_calendar_days'] as const
    const body = numericFields.includes(field as typeof numericFields[number])
      ? { [field]: Number(value) }
      : { [field]: value }
    try {
      const updated = await api.pricings.update(pricingId, body)
      setPricing(updated)
    } catch {
      // silently ignore blur errors; user will see stale value
    }
  }

  async function handleApprove() {
    if (!pricingId) return
    setApproving(true)
    try {
      await api.pricings.approve(pricingId)
      await refresh()
    } catch {
      // ignore
    } finally {
      setApproving(false)
    }
  }

  async function handleAddFeature() {
    setAddingFeature(true)
    try {
      await addFeature({
        bloco: 'Novo bloco',
        funcionalidade: 'Nova funcionalidade',
        horas: 1,
        citi_responsible: true,
        ordem: features.length + 1,
      })
    } finally {
      setAddingFeature(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--color-bg-page)] flex items-center justify-center">
        <span className="text-sm text-[var(--color-text-secondary)]">Carregando...</span>
      </div>
    )
  }

  if (error || !pricing) {
    return (
      <div className="min-h-screen bg-[var(--color-bg-page)] flex items-center justify-center">
        <span className="text-sm text-[var(--color-red)]">
          {error ?? 'Precificação não encontrada'}
        </span>
      </div>
    )
  }

  const backTo = pricing ? `/projects/${pricing.project_id}/pricings` : '#'
  const numAnalysts = pricing.num_analysts ?? 1
  const hoursPerDay = Number(pricing.hours_per_day ?? 0)

  return (
    <div className="min-h-screen bg-[var(--color-bg-page)]">
      {/* Topbar */}
      <div className="border-b border-[var(--color-border-std)] bg-[var(--color-surface)]">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              to={backTo}
              className="text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors"
            >
              <ChevronLeft size={18} />
            </Link>
            <h1 className="font-semibold text-sm text-[var(--color-text-primary)]">
              Precificação
            </h1>
          </div>
          {!isApproved && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => importFromDiagnosis()}
                disabled={importing || isApproved}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border border-[var(--color-border-std)] text-[var(--color-text-primary)] hover:border-[var(--color-border-hover)] transition-colors disabled:opacity-50"
              >
                <Download size={12} />
                {importing ? 'Importando...' : 'Importar do diagnóstico'}
              </button>
              <button
                onClick={() => suggestFeatures()}
                disabled={suggesting || isApproved}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border border-[var(--color-border-std)] text-[var(--color-text-primary)] hover:border-[var(--color-border-hover)] transition-colors disabled:opacity-50"
              >
                <Lightbulb size={12} />
                {suggesting ? 'Sugerindo...' : 'Sugerir funcionalidades'}
              </button>
            </div>
          )}
          <button
            onClick={handleApprove}
            disabled={isApproved || approving}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              isApproved
                ? 'bg-[var(--color-green-bg-tag)] text-[var(--color-accent)] border border-[var(--color-border-green)] cursor-default'
                : 'bg-[var(--color-accent)] text-white hover:bg-[var(--color-accent-hover)] disabled:opacity-50'
            }`}
          >
            {isApproved ? (
              <>
                <Check size={12} />
                Aprovada
              </>
            ) : approving ? (
              'Aprovando...'
            ) : (
              'Aprovar'
            )}
          </button>
        </div>
      </div>

      {importError && (
        <div className="max-w-5xl mx-auto px-6 pt-4">
          <div className="text-sm text-[var(--color-red)] bg-[var(--color-red-bg)] border border-[var(--color-border-red)] rounded-md px-4 py-3">
            {importError}
          </div>
        </div>
      )}
      {suggestError && (
        <div className="max-w-5xl mx-auto px-6 pt-4">
          <div className="text-sm text-[var(--color-red)] bg-[var(--color-red-bg)] border border-[var(--color-border-red)] rounded-md px-4 py-3">
            {suggestError}
          </div>
        </div>
      )}

      {/* Main layout: two column on large screens */}
      <div className="max-w-5xl mx-auto px-6 py-8 flex flex-col lg:flex-row gap-8">
        {/* Left: Inputs + Outputs */}
        <div className="lg:w-72 shrink-0 space-y-5">
          {/* Inputs form */}
          <div className="bg-[var(--color-surface)] border border-[var(--color-border-std)] rounded-lg p-5 space-y-4">
            <p className="text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wide">
              Parâmetros
            </p>

            <Field label="Data de início">
              <input
                type="date"
                defaultValue={pricing.start_date ?? ''}
                disabled={isApproved}
                onBlur={e => handleInputBlur('start_date', e.target.value)}
                className={inputCls}
              />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Analistas">
                <input
                  type="number"
                  min={1}
                  defaultValue={pricing.num_analysts ?? 2}
                  disabled={isApproved}
                  onBlur={e => handleInputBlur('num_analysts', e.target.value)}
                  className={inputCls}
                />
              </Field>
              <Field label="Horas/dia">
                <input
                  type="number"
                  min={0.5}
                  step={0.5}
                  defaultValue={Number(pricing.hours_per_day ?? 3)}
                  disabled={isApproved}
                  onBlur={e => handleInputBlur('hours_per_day', e.target.value)}
                  className={inputCls}
                />
              </Field>
            </div>

            <Field label="Ticket mensal (R$)">
              <input
                type="number"
                min={0}
                defaultValue={Number(pricing.ticket_price ?? 10000)}
                disabled={isApproved}
                onBlur={e => handleInputBlur('ticket_price', e.target.value)}
                className={inputCls}
              />
            </Field>

            <Field label="Dias extras no calendário">
              <input
                type="number"
                min={0}
                defaultValue={pricing.extra_calendar_days ?? 0}
                disabled={isApproved}
                onBlur={e => handleInputBlur('extra_calendar_days', e.target.value)}
                className={inputCls}
              />
            </Field>
          </div>

          {/* Outputs card */}
          <div className="bg-[var(--color-surface)] border border-[var(--color-border-std)] rounded-lg overflow-hidden">
            <div className="px-4 py-3 border-b border-[var(--color-border-std)]">
              <p className="text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wide">
                Resultados
              </p>
            </div>
            <div className="divide-y divide-[var(--color-border-std)]">
              <OutputRow
                label="Preço total"
                value={
                  outputs
                    ? outputs.precoTotal.toLocaleString('pt-BR', {
                        style: 'currency',
                        currency: 'BRL',
                      })
                    : '—'
                }
              />
              <OutputRow
                label="Data de entrega"
                value={outputs ? outputs.dataFinal : '—'}
              />
              <OutputRow
                label="Horas totais"
                value={outputs ? outputs.totalHoras.toFixed(1) : '—'}
              />
              <OutputRow
                label="Dias úteis"
                value={outputs ? outputs.diasUteis.toFixed(1) : '—'}
              />
              <OutputRow
                label="Dias corridos"
                value={outputs ? outputs.diasCorridos.toFixed(1) : '—'}
              />
              <OutputRow
                label="Semanas"
                value={outputs ? outputs.duracaoSemanas.toFixed(1) : '—'}
              />
              <OutputRow
                label="Meses"
                value={outputs ? outputs.duracaoMeses.toFixed(2) : '—'}
              />
              <OutputRow
                label="Sprints"
                value={outputs ? outputs.numSprints.toFixed(1) : '—'}
              />
            </div>
          </div>
        </div>

        {/* Right: Feature table */}
        <div className="flex-1 min-w-0">
          <div className="bg-[var(--color-surface)] border border-[var(--color-border-std)] rounded-lg overflow-hidden">
            <div className="px-4 py-3 border-b border-[var(--color-border-std)] flex items-center justify-between">
              <p className="text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wide">
                Funcionalidades
              </p>
              <span className="text-xs text-[var(--color-text-secondary)]">
                {features.length} {features.length === 1 ? 'item' : 'itens'}
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-[var(--color-muted)]">
                    <th className="px-3 py-2 text-left text-xs font-medium text-[var(--color-text-secondary)]">
                      Bloco
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-[var(--color-text-secondary)]">
                      Funcionalidade
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-[var(--color-text-secondary)] w-20">
                      Horas
                    </th>
                    <th className="px-3 py-2 text-center text-xs font-medium text-[var(--color-text-secondary)] w-16">
                      Dias
                    </th>
                    <th className="px-3 py-2 text-center text-xs font-medium text-[var(--color-text-secondary)] w-16">
                      CITI?
                    </th>
                    {!isApproved && (
                      <th className="px-3 py-2 text-left text-xs font-medium text-[var(--color-text-secondary)] w-20">
                        Ações
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {features.length === 0 ? (
                    <tr>
                      <td
                        colSpan={isApproved ? 5 : 6}
                        className="px-3 py-8 text-center text-sm text-[var(--color-text-secondary)]"
                      >
                        Nenhuma funcionalidade adicionada.
                      </td>
                    </tr>
                  ) : (
                    features.map(f => (
                      <FeatureRow
                        key={f.id}
                        feature={f}
                        numAnalysts={numAnalysts}
                        hoursPerDay={hoursPerDay}
                        isApproved={isApproved ?? false}
                        onUpdate={updateFeature}
                        onDelete={deleteFeature}
                      />
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {!isApproved && (
              <div className="px-4 py-3 border-t border-[var(--color-border-std)]">
                <button
                  onClick={handleAddFeature}
                  disabled={addingFeature}
                  className="text-xs text-[var(--color-accent)] hover:underline disabled:opacity-50"
                >
                  {addingFeature ? 'Adicionando...' : '+ Adicionar funcionalidade'}
                </button>
              </div>
            )}
          </div>

          {showSuggestions && suggestions.length > 0 && (
            <div className="mt-6 bg-[var(--color-surface)] border border-[var(--color-border-std)] rounded-lg overflow-hidden">
              <div className="px-4 py-3 border-b border-[var(--color-border-std)] flex items-center justify-between">
                <p className="text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wide">
                  Sugestões do LLM ({suggestions.length})
                </p>
                <button onClick={closeSuggestions} className="text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]">
                  <X size={14} />
                </button>
              </div>
              <div className="p-4 space-y-3">
                {suggestions.map(s => (
                  <SuggestionCard
                    key={s._localId}
                    suggestion={s}
                    onAccept={() => acceptSuggestion(s._localId, addFeature)}
                    onReject={() => rejectSuggestion(s._localId)}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
