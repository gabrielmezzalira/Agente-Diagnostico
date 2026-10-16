import { Link, useLocation } from 'react-router-dom'
import CITiLogo from '../CITiLogo'
import { StatusDot } from '../ui'
import { NAV_ITEMS } from './navItems'

function isActive(item: (typeof NAV_ITEMS)[number], pathname: string): boolean {
  return item.match ? item.match(pathname) : pathname.startsWith(item.to)
}

/** Menu lateral de 248px: logo, produto, navegação e cartão de identificação no rodapé. */
export default function Sidebar() {
  const { pathname } = useLocation()

  return (
    <aside className="hidden lg:flex w-[248px] shrink-0 flex-col gap-[30px] px-4 pt-7 pb-5 border-r border-ds-border bg-ds-sidebar">
      <Link to="/" className="flex flex-col gap-2 px-2.5 w-fit" aria-label="Agente Diagnóstico — início">
        <CITiLogo height={26} />
        <span className="font-mono text-[10.5px] tracking-[0.18em] text-ds-muted">AGENTE DIAGNÓSTICO</span>
      </Link>

      <nav aria-label="Principal" className="flex flex-col gap-1">
        {NAV_ITEMS.map(item => {
          const active = isActive(item, pathname)
          return (
            <Link
              key={item.to}
              to={item.to}
              aria-current={active ? 'page' : undefined}
              className={`flex items-center gap-2.5 h-[42px] px-3 rounded-[10px] border text-[14px] transition-colors ${
                active
                  ? 'bg-ds-green-soft border-ds-green/25 text-ds-green font-semibold'
                  : 'border-transparent text-ds-text-2 font-medium hover:bg-white/[0.04]'
              }`}
            >
              {active ? (
                <StatusDot tone="green" />
              ) : (
                <span aria-hidden className="w-[7px] h-[7px] rounded-sm border border-ds-dim shrink-0" />
              )}
              {item.label}
            </Link>
          )
        })}
      </nav>

      <div className="mt-auto ds-card !rounded-xl flex items-center gap-2.5 p-3">
        <span
          aria-hidden
          className="w-9 h-9 shrink-0 rounded-full bg-ds-green-soft border border-ds-green-line text-ds-green flex items-center justify-center text-[13px] font-bold"
        >
          AD
        </span>
        <div className="flex flex-col gap-0.5 min-w-0">
          <span className="text-[13.5px] font-semibold text-ds-text truncate">Diagnóstico CITi</span>
          <span className="text-[11.5px] text-ds-muted truncate">Subárea de Dados</span>
        </div>
      </div>
    </aside>
  )
}
