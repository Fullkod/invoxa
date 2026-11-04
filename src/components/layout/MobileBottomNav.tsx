import {
  FileText,
  Files,
  FolderKanban,
  Home,
  UserSquare,
  Users,
} from 'lucide-react'
import type { ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import type { Profile } from '../../types/profile'

type Tab = {
  to: string
  label: string
  icon: ReactNode
  match: (pathname: string) => boolean
}

const adminTabs: Tab[] = [
  {
    to: '/admin/dashboard',
    label: 'Inicio',
    icon: <Home size={20} />,
    match: (p) => p === '/admin/dashboard' || p === '/admin' || p === '/',
  },
  {
    to: '/admin/users',
    label: 'Usuarios',
    icon: <Users size={20} />,
    match: (p) => p.startsWith('/admin/users'),
  },
  {
    to: '/admin/projects',
    label: 'Proyectos',
    icon: <FolderKanban size={20} />,
    match: (p) => p.startsWith('/admin/projects'),
  },
  {
    to: '/admin/invoices',
    label: 'Facturas',
    icon: <Files size={20} />,
    match: (p) =>
      p.startsWith('/admin/invoices') ||
      p.startsWith('/admin/invoice-requests') ||
      p.startsWith('/admin/invoice-number-requests'),
  },
]

const userTabs: Tab[] = [
  {
    to: '/app/dashboard',
    label: 'Inicio',
    icon: <Home size={20} />,
    match: (p) => p === '/app/dashboard' || p === '/app' || p === '/',
  },
  {
    to: '/app/tasks',
    label: 'Tareas',
    icon: <FileText size={20} />,
    match: (p) => p.startsWith('/app/tasks'),
  },
  {
    to: '/app/invoices',
    label: 'Facturas',
    icon: <Files size={20} />,
    match: (p) =>
      p.startsWith('/app/invoices') ||
      p.startsWith('/app/invoice-number-requests'),
  },
  {
    to: '/app/billing-profile',
    label: 'Perfil',
    icon: <UserSquare size={20} />,
    match: (p) => p.startsWith('/app/billing-profile'),
  },
]

export function MobileBottomNav({ profile }: { profile: Profile }) {
  const location = useLocation()
  const tabs = profile.role === 'admin' ? adminTabs : userTabs

  return (
    <nav
      aria-label="Navegación principal"
      className="fixed inset-x-0 bottom-0 z-30 flex items-stretch border-t border-border bg-bg/95 backdrop-blur supports-[backdrop-filter]:bg-bg/80 md:hidden"
      style={{
        paddingBottom: 'var(--safe-area-bottom)',
      }}
    >
      {tabs.map((tab) => {
        const active = tab.match(location.pathname)
        return (
          <Link
            key={tab.to}
            to={tab.to}
            className={`flex flex-1 flex-col items-center justify-center gap-1 py-2 text-[10.5px] font-medium tracking-tight transition ${
              active ? 'text-primary' : 'text-muted hover:text-text-sec'
            }`}
          >
            <span className={active ? 'text-primary' : 'text-muted'}>
              {tab.icon}
            </span>
            <span>{tab.label}</span>
          </Link>
        )
      })}
    </nav>
  )
}
