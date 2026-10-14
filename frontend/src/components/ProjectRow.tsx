import { Link } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import type { Project } from '../lib/api'
import { DMS_LABELS, PROJECT_TYPE_LABELS } from '../lib/labels'
import { Chip } from './ui'

/** Linha da lista de projetos: inicial, nome/cliente, tipo, DMS e seta. */
export default function ProjectRow({ project, first }: { project: Project; first: boolean }) {
  const dms = project.data_maturity_score
  return (
    <Link
      to={`/projects/${project.id}`}
      className={`group grid grid-cols-[44px_minmax(0,1fr)_auto_auto_20px] items-center gap-[18px] px-6 py-[18px] transition-colors hover:bg-white/[0.03] ${
        first ? '' : 'border-t border-ds-border'
      }`}
    >
      <span
        aria-hidden
        className="w-10 h-10 rounded-[10px] bg-ds-inner border border-ds-inner-border flex items-center justify-center text-[14px] font-bold text-ds-text-2"
      >
        {project.name.trim().charAt(0).toUpperCase() || '?'}
      </span>
      <div className="flex flex-col gap-1 min-w-0">
        <span className="flex items-center gap-2.5 min-w-0">
          <span className="text-[16px] font-semibold text-white truncate">{project.name}</span>
          {project.has_active_session && (
            <Chip tone="green" dot>ao vivo</Chip>
          )}
        </span>
        <span className="text-[13px] text-ds-muted truncate">{project.client}</span>
      </div>
      <span>
        {project.project_type && <Chip>{PROJECT_TYPE_LABELS[project.project_type] ?? project.project_type}</Chip>}
      </span>
      <span
        className={`font-mono text-[12px] min-w-[120px] text-right ${dms ? 'text-ds-green' : 'text-ds-dim'}`}
      >
        {dms ? `DMS ${dms} · ${DMS_LABELS[dms]}` : 'Sem DMS'}
      </span>
      <ChevronRight size={16} aria-hidden className="text-ds-muted group-hover:text-ds-text transition-colors" />
    </Link>
  )
}
