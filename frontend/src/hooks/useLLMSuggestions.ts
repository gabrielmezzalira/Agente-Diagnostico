import { useCallback, useState } from 'react'
import { api, type PricingFeature, type PricingFeatureCreateBody, type SuggestedFeature } from '../lib/api'

interface SuggestionWithId extends SuggestedFeature {
  _localId: string
}

export function useLLMSuggestions(
  pricingId: string | undefined,
  setFeatures: React.Dispatch<React.SetStateAction<PricingFeature[]>>
) {
  const [importing, setImporting] = useState(false)
  const [importError, setImportError] = useState<string | null>(null)
  const [suggesting, setSuggesting] = useState(false)
  const [suggestError, setSuggestError] = useState<string | null>(null)
  const [suggestions, setSuggestions] = useState<SuggestionWithId[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)

  const importFromDiagnosis = useCallback(async () => {
    if (!pricingId) return
    setImporting(true)
    setImportError(null)
    try {
      const newFeatures = await api.pricings.importFromDiagnosis(pricingId)
      setFeatures(fs => [...fs, ...newFeatures])
    } catch (e: unknown) {
      setImportError(e instanceof Error ? e.message : 'Erro ao importar do diagnóstico')
    } finally {
      setImporting(false)
    }
  }, [pricingId, setFeatures])

  const suggestFeatures = useCallback(async () => {
    if (!pricingId) return
    setSuggesting(true)
    setSuggestError(null)
    try {
      const raw = await api.pricings.suggestFeatures(pricingId)
      setSuggestions(raw.map(s => ({ ...s, _localId: Math.random().toString(36).slice(2) })))
      setShowSuggestions(true)
    } catch (e: unknown) {
      setSuggestError(e instanceof Error ? e.message : 'Erro ao sugerir funcionalidades')
    } finally {
      setSuggesting(false)
    }
  }, [pricingId])

  const acceptSuggestion = useCallback(async (
    localId: string,
    addFeature: (body: PricingFeatureCreateBody) => Promise<unknown>
  ) => {
    const s = suggestions.find(s => s._localId === localId)
    if (!s) return
    await addFeature({ bloco: s.bloco, funcionalidade: s.funcionalidade, horas: Number(s.horas), citi_responsible: true })
    setSuggestions(prev => prev.filter(s => s._localId !== localId))
  }, [suggestions])

  const rejectSuggestion = useCallback((localId: string) => {
    setSuggestions(prev => prev.filter(s => s._localId !== localId))
  }, [])

  const closeSuggestions = useCallback(() => {
    setShowSuggestions(false)
    setSuggestions([])
  }, [])

  return {
    importing,
    importError,
    suggesting,
    suggestError,
    suggestions,
    showSuggestions,
    importFromDiagnosis,
    suggestFeatures,
    acceptSuggestion,
    rejectSuggestion,
    closeSuggestions,
  }
}
