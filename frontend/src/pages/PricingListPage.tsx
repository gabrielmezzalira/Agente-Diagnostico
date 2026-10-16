import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ChevronLeft, Plus, Trash2 } from 'lucide-react'
import { api, type DiagnosticSummary, type Pricing } from '../lib/api'
import AppShell from '../components/layout/AppShell'
import { Button, Card, Chip, EmptyState, ErrorNotice } from '../components/ui'

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
  const [diagnostics, setDiagnostics] = useState<DiagnosticSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  async function handleDelete(pricingId: string, e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    if (!confirm('Excluir esta precificação?')) return
    try {
      await api.pricings.delete(pricingId)
      setPricings(prev => prev.filter(p => p.id !== pricingId))
    } catch (err: unknown) {
      setDeleteError(err instanceof Error ? err.message : 'Erro ao excluir')
    }
  }

  useEffect(() => {
    if (!id) return
    api.pricings
      .listByProject(id)
      .then(setPricings)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
    api.pricings.listDiagnostics(id).then(setDiagnostics).catch(() => null)
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
    return <AppShell><p className="text-[14px] text-ds-muted">Carregando…</p></AppShell>
  }

  return (
    <AppShell>
      <div className="flex items-center gap-4">
        <Link
          to={`/projects/${id}`}
          aria-label="Voltar para o projeto"
          className="w-[38px] h-[38px] rounded-[10px] border border-ds-border-strong flex items-center justify-center text-ds-text-2 hover:bg-white/[0.05] transition-colors"
        >
          <ChevronLeft size={18} aria-hidden />
        </Link>
        <h1 className="m-0 text-[24px] font-bold tracking-[-0.02em] text-white">Precificações</h1>
        <Button variant="primary" onClick={handleCreate} disabled={creating} className="ml-auto">
          <Plus size={14} aria-hidden /> {creating ? 'Criando…' : 'Nova precificação'}
        </Button>
      </div>

      {(error || deleteError) && <ErrorNotice>{error ?? deleteError}</ErrorNotice>}

      {pricings.length === 0 ? (
        <EmptyState>Nenhuma precificação ainda.</EmptyState>
      ) : (
        <Card>
          {pricings.map((p, i) => {
            const linked = diagnostics.find(d => d.session_id === p.session_id)
            return (
              <Link
                key={p.id}
                to={`/pricings/${p.id}`}
                className={`flex items-center justify-between gap-3 px-6 py-[18px] hover:bg-white/[0.03] transition-colors ${i > 0 ? 'border-t border-ds-border' : ''}`}
              >
                <div className="min-w-0 flex-1 flex flex-col gap-1">
                  <span className="text-[15px] font-semibold text-white truncate">{p.name ?? formatDate(p.created_at)}</span>
                  <span className="font-mono text-[12px] text-ds-muted">
                    {formatDate(p.created_at)}
                    {linked && <> · diagnóstico: {formatDate(linked.session_started_at)}</>}
                  </span>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  {p.status === 'approved' ? <Chip tone="green" dot>aprovada</Chip> : <Chip>rascunho</Chip>}
                  {p.status !== 'approved' && (
                    <button
                      type="button"
                      onClick={e => handleDelete(p.id, e)}
                      aria-label="Excluir precificação"
                      title="Excluir"
                      className="p-1.5 rounded-md text-ds-muted hover:text-ds-red transition-colors"
                    >
                      <Trash2 size={14} aria-hidden />
                    </button>
                  )}
                </div>
              </Link>
            )
          })}
        </Card>
      )}
    </AppShell>
  )
}
