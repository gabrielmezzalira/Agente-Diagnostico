import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ChevronLeft, Plus } from 'lucide-react'
import { api, type Pricing } from '../lib/api'

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function PricingListPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [pricings, setPricings] = useState<Pricing[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    if (!id) return
    api.pricings
      .listByProject(id)
      .then(setPricings)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
  }, [id])

  async function handleCreate() {
    if (!id) return
    setCreating(true)
    try {
      const newPricing = await api.pricings.create(id, {
        start_date: new Date().toISOString().slice(0, 10),
        num_analysts: 2,
        hours_per_day: 3,
        ticket_price: 10000,
        extra_calendar_days: 0,
      })
      navigate(`/pricings/${newPricing.id}`)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erro ao criar precificação')
      setCreating(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--color-bg-page)] flex items-center justify-center">
        <span className="text-sm text-[var(--color-text-secondary)]">Carregando...</span>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[var(--color-bg-page)]">
      {/* Topbar */}
      <div className="border-b border-[var(--color-border-std)] bg-[var(--color-surface)]">
        <div className="max-w-2xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              to={`/projects/${id}`}
              className="text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors"
            >
              <ChevronLeft size={18} />
            </Link>
            <h1 className="font-semibold text-sm text-[var(--color-text-primary)]">
              Precificações
            </h1>
          </div>
          <button
            onClick={handleCreate}
            disabled={creating}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--color-accent)] text-white rounded-md text-xs font-medium hover:bg-[var(--color-accent-hover)] transition-colors disabled:opacity-50"
          >
            <Plus size={13} />
            {creating ? 'Criando...' : 'Nova Precificação'}
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-2xl mx-auto px-6 py-8 space-y-3">
        {error && (
          <div className="text-sm text-[var(--color-red)] bg-[var(--color-red-bg)] border border-[var(--color-border-red)] rounded-md px-4 py-3">
            {error}
          </div>
        )}

        {pricings.length === 0 ? (
          <p className="text-sm text-[var(--color-text-secondary)]">Nenhuma precificação ainda.</p>
        ) : (
          pricings.map(p => (
            <Link
              key={p.id}
              to={`/pricings/${p.id}`}
              className="flex items-center justify-between gap-4 bg-[var(--color-surface)] border border-[var(--color-border-std)] rounded-lg px-4 py-3 hover:border-[var(--color-border-hover)] transition-colors"
            >
              <span className="text-sm text-[var(--color-text-secondary)]">
                {formatDate(p.created_at)}
              </span>
              {p.status === 'approved' ? (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-[var(--color-green-bg-tag)] text-[var(--color-accent)] border border-[var(--color-border-green)]">
                  aprovada
                </span>
              ) : (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-[var(--color-muted)] text-[var(--color-text-secondary)]">
                  rascunho
                </span>
              )}
            </Link>
          ))
        )}
      </div>
    </div>
  )
}
