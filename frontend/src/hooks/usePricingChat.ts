import { useCallback, useEffect, useRef, useState } from 'react'
import { api, type ChatMessage, type PricingFeature } from '../lib/api'

export function usePricingChat(
  pricingId: string | undefined,
  setFeatures: React.Dispatch<React.SetStateAction<PricingFeature[]>>,
) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [sending, setSending] = useState(false)
  const [chatError, setChatError] = useState<string | null>(null)
  const loadedRef = useRef(false)

  useEffect(() => {
    if (!pricingId || loadedRef.current) return
    loadedRef.current = true
    api.pricings
      .getChatHistory(pricingId)
      .then(setMessages)
      .catch(() => {})
  }, [pricingId])

  const sendMessage = useCallback(
    async (text: string) => {
      if (!pricingId || !text.trim() || sending) return

      const optimistic: ChatMessage = {
        id: `opt-${Date.now()}`,
        pricing_id: pricingId,
        role: 'user',
        content: text,
        created_at: new Date().toISOString(),
      }
      setMessages(m => [...m, optimistic])
      setSending(true)
      setChatError(null)

      try {
        const { reply, features } = await api.pricings.chat(pricingId, text)
        const assistantMsg: ChatMessage = {
          id: `opt-${Date.now() + 1}`,
          pricing_id: pricingId,
          role: 'assistant',
          content: reply,
          created_at: new Date().toISOString(),
        }
        setMessages(m => [...m, assistantMsg])
        setFeatures(features)
      } catch (e: unknown) {
        setChatError(e instanceof Error ? e.message : 'Erro no chatbot')
        setMessages(m => m.filter(msg => msg.id !== optimistic.id))
      } finally {
        setSending(false)
      }
    },
    [pricingId, sending, setFeatures],
  )

  return { messages, sending, chatError, sendMessage }
}
