import { useEffect, useState } from 'react'
import { API_BASE, api, type Project } from '../lib/api'
import AppShell from '../components/layout/AppShell'
import { Chip, DetailRows, ErrorNotice, PageHeader } from '../components/ui'

/** Configurações (somente leitura): onde o app fala com a API e como está a integração com o DocuData. */
export default function SettingsPage() {
  const [projects, setProjects] = useState<Project[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api.projects.list().then(setProjects).catch((e: Error) => setError(e.message))
  }, [])

  const discovery = projects?.filter(p => p.mode === 'discovery') ?? []
  const linked = discovery.filter(p => !!p.docudata_project_id)

  return (
    <AppShell>
      <PageHeader
        eyebrow="Sistema"
        title="Configurações"
        subtitle="Somente leitura. Chaves e endereços são definidos no servidor e nunca aparecem aqui."
      />
      {error && <ErrorNotice>{error}</ErrorNotice>}

      <div className="max-w-[860px] flex flex-col gap-4">
        <DetailRows
          rows={[
            { label: 'Endereço da API', value: <span className="font-mono text-[13px] break-all">{API_BASE}</span> },
            { label: 'Projetos', value: projects ? projects.length : '—' },
            { label: 'Projetos em modo Discovery', value: projects ? discovery.length : '—' },
            {
              label: 'Discovery vinculados ao DocuData',
              value: projects ? (
                <Chip tone={linked.length > 0 ? 'green' : 'neutral'} dot>{linked.length} de {discovery.length}</Chip>
              ) : '—',
            },
          ]}
        />
        <p className="m-0 px-1 text-[13px] leading-[1.6] text-ds-dim">
          O envio ao DocuData é ligado no backend pelas variáveis <span className="font-mono">DOCUDATA_URL</span> e{' '}
          <span className="font-mono">DOCUDATA_DISCOVERY_KEY</span>. Sem elas, nada é enviado, mesmo com projeto vinculado.
        </p>
      </div>
    </AppShell>
  )
}
