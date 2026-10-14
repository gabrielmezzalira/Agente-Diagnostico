import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import CITiLogo from '../CITiLogo'
import Sidebar from './Sidebar'
import SearchBox from './SearchBox'

interface AppShellProps {
  /** Ação primária da topbar (no máximo uma). */
  actions?: ReactNode
  children: ReactNode
}

/** Casca das telas internas: sidebar de 248px + topbar de 72px + área de conteúdo com brilho verde. */
export default function AppShell({ actions, children }: AppShellProps) {
  return (
    <div className="min-h-screen flex bg-ds-bg text-ds-text">
      <Sidebar />
      <div className="flex-1 min-w-0 flex flex-col ds-page-glow">
        <header className="h-[72px] shrink-0 flex items-center gap-4 px-6 lg:px-12 border-b border-ds-border">
          <Link to="/" className="lg:hidden shrink-0" aria-label="Agente Diagnóstico — início">
            <CITiLogo height={22} />
          </Link>
          <SearchBox />
          {actions && <div className="ml-auto flex gap-2.5">{actions}</div>}
        </header>
        <main className="px-6 lg:px-12 pt-10 pb-14 flex flex-col gap-7">{children}</main>
      </div>
    </div>
  )
}
