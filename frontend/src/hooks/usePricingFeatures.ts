import type { Dispatch, SetStateAction } from 'react'
import {
  api,
  type PricingFeature,
  type PricingFeatureCreateBody,
  type PricingFeatureUpdateBody,
} from '../lib/api'

export function usePricingFeatures(
  pricingId: string | undefined,
  setFeatures: Dispatch<SetStateAction<PricingFeature[]>>
) {
  const addFeature = async (body: PricingFeatureCreateBody): Promise<PricingFeature> => {
    if (!pricingId) throw new Error('No pricingId')
    const created = await api.pricingFeatures.add(pricingId, body)
    setFeatures(fs => [...fs, created])
    return created
  }

  const updateFeature = async (featureId: string, body: PricingFeatureUpdateBody) => {
    if (!pricingId) throw new Error('No pricingId')
    // Optimistic update — coerce numeric horas to string to match PricingFeature.horas type
    const optimisticPatch: Partial<PricingFeature> =
      body.horas !== undefined
        ? { ...body, horas: String(body.horas) }
        : (body as Partial<PricingFeature>)
    setFeatures(fs =>
      fs.map(f => (f.id === featureId ? { ...f, ...optimisticPatch } : f))
    )
    try {
      const updated = await api.pricingFeatures.update(pricingId, featureId, body)
      setFeatures(fs => fs.map(f => (f.id === featureId ? updated : f)))
    } catch (e) {
      throw e
    }
  }

  const deleteFeature = async (featureId: string) => {
    if (!pricingId) throw new Error('No pricingId')
    // Optimistic remove
    setFeatures(fs => fs.filter(f => f.id !== featureId))
    await api.pricingFeatures.delete(pricingId, featureId)
  }

  const reorderFeatures = async (orderedFeatures: PricingFeature[]) => {
    if (!pricingId) throw new Error('No pricingId')
    // Optimistic update
    setFeatures(orderedFeatures)
    // Persist new ordem for each feature
    await Promise.all(
      orderedFeatures.map((f, i) =>
        api.pricingFeatures.update(pricingId, f.id, { ordem: i + 1 })
      )
    )
  }

  return { addFeature, updateFeature, deleteFeature, reorderFeatures }
}
