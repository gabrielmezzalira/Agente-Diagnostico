export interface NavItem {
  to: string
  label: string
  /** Rotas que também deixam o item ativo (ex.: telas de projeto e de sessão dentro de "Projetos"). */
  match?: (pathname: string) => boolean
}

export const NAV_ITEMS: NavItem[] = [
  {
    to: '/',
    label: 'Projetos',
    match: p => p === '/' || p.startsWith('/projects') || p.startsWith('/pricings'),
  },
  { to: '/sessions', label: 'Sessões', match: p => p.startsWith('/sessions') },
  { to: '/extension', label: 'Extensão Chrome' },
  { to: '/settings', label: 'Configurações' },
]
