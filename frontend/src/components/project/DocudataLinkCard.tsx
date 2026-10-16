import { Link } from 'react-router-dom'
import type { Project } from '../../lib/api'
import { Card, Chip, SectionLabel } from '../ui'

/** Estado do vínculo com o DocuData: ao encerrar uma sessão de discovery, a reunião segue para o projeto vinculado. */
export default function DocudataLinkCard({ project }: { project: Project }) {
  const linked = !!project.docudata_project_id
  const discovery = project.mode === 'discovery'
  const sends = linked && discovery

  return (
    <Card className="px-[26px] py-6 flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <SectionLabel>Integração DocuData</SectionLabel>
        <Chip tone={sends ? 'green' : linked ? 'amber' : 'neutral'} dot>
          {sends ? 'Envio ativo' : linked ? 'Vinculado, modo vendas' : 'Não vinculado'}
        </Chip>
      </div>
      {linked ? (
        <div className="flex items-center justify-between gap-4">
          <span className="text-[14px] text-ds-muted">Projeto no DocuData</span>
          <span className="font-mono text-[12.5px] text-ds-text-2 break-all text-right">{project.docudata_project_id}</span>
        </div>
      ) : (
        <p className="m-0 text-[14px] leading-[1.6] text-ds-muted">
          Vincule este projeto a um projeto do DocuData para que as reuniões de discovery virem requisitos.{' '}
          <Link to={`/projects/${project.id}/edit`} className="text-ds-green hover:text-ds-green-hover">Editar projeto</Link>
        </p>
      )}
      <p className="m-0 text-[13px] leading-[1.6] text-ds-dim">
        {sends
          ? 'Ao encerrar uma sessão, a transcrição é enviada automaticamente em segundo plano; se o DocuData estiver fora do ar, a sessão encerra normalmente.'
          : linked
            ? 'O envio só acontece em projetos no modo discovery.'
            : 'Sem vínculo, nada é enviado.'}
      </p>
    </Card>
  )
}
