import { useState, useEffect, useCallback } from 'react'
import { api, type Pricing, type PricingFeature } from '../lib/api'
import { calculatePricing, type PricingOutputs } from '../lib/pricingCalculator'

export function usePricing(pricingId: string | undefined) {
  const [pricing, setPricing] = useState<Pricing | null>(null)
  const [features, setFeatures] = useState<PricingFeature[]>([])
  const [outputs, setOutputs] = useState<PricingOutputs | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!pricingId) return
    try {
      setLoading(true)
      const data = await api.pricings.get(pricingId)
      setPricing(data)
      setFeatures(data.features ?? [])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar precificação')
    } finally {
      setLoading(false)
    }
  }, [pricingId])

  useEffect(() => {
    refresh()
  }, [refresh])

  // Recompute outputs locally whenever pricing or features change
  useEffect(() => {
    if (!pricing || features.length === 0) {
      setOutputs(null)
      return
    }
    const inputs = {
      startDate: pricing.start_date ?? new Date().toISOString().slice(0, 10),
      numAnalysts: pricing.num_analysts ?? 1,
      hoursPerDay: Number(pricing.hours_per_day ?? 0),
      ticketPrice: Number(pricing.ticket_price ?? 0),
      extraCalendarDays: pricing.extra_calendar_days ?? 0,
    }
    setOutputs(
      calculatePricing(
        features.map(f => ({ horas: Number(f.horas) })),
        inputs
      )
    )
  }, [pricing, features])

  return { pricing, features, outputs, loading, error, refresh, setPricing, setFeatures }
}
