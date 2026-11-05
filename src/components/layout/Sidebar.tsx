import {
  Building2,
  ChevronDown,
  ClipboardCheck,
  Files,
  FileText,
  FolderKanban,
  Home,
  LogOut,
  Menu,
  ReceiptText,
  Send,
  Settings,
  UserSquare,
  Users,
  X,
} from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import logoHorizontal from '/brand/imagotipo-horizontal-cafe.svg'
import isotipoCafe from '/brand/isotipo-cafe.svg'
import { canUseAdminArea, roleLabel } from '../../features/auth/roles'
import { useAuth } from '../../features/auth/useAuth'
import { useCurrentCompany } from '../../features/companies/queries'
import { useIsSupervisor } from '../../features/review/queries'
import type { Profile, UserRole } from '../../types/profile'

type NavItem = {
  to: string
  label: string
  icon: ReactNode
  badge?: number
}

type NavSection = {
  title: string
  items: NavItem[]
}

const adminSections: NavSection[] = [
  {
    title: 'Principal',
    items: [
      { to: '/admin/dashboard', label: 'Dashboard', icon: <Home size={18} /> },
    ],
  },
  {
    title: 'Operación',
    items: [
      { to: '/admin/users', label: 'Usuarios', icon: <Users size={18} /> },
      {
        to: '/admin/projects',
        label: 'Proyectos',
        icon: <FolderKanban size={18} />,
      },
      {
        to: '/admin/review',
        label: 'Revisión de horas',
        icon: <ClipboardCheck size={18} />,
      },
    ],
  },
  {
    title: 'Facturación',
    items: [
      { to: '/admin/invoices', label: 'Facturas', icon: <Files size={18} /> },
      {
        to: '/admin/invoice-requests',
        label: 'Solicitudes',
        icon: <Send size={18} />,
      },
      {
        to: '/admin/invoice-number-requests',
        label: 'Cambios consecutivo',
        icon: <ReceiptText size={18} />,
      },
    ],
  },
]

const superSection: NavSection = {
  title: 'Super admin',
  items: [
    { to: '/super/companies', label: 'Empresas', icon: <Building2 size={18} /> },
  ],
}

const reviewSection: NavSection = {
  title: 'Equipo',
  items: [
    { to: '/app/review', label: 'Revisión de horas', icon: <ClipboardCheck size={18} /> },
  ],
}

function sectionsFor(profile: Profile, isSupervisor: boolean): NavSection[] {
  if (profile.role === 'super_admin') {
    return canUseAdminArea(profile) ? [superSection, ...adminSections] : [superSection]
  }
  if (profile.role === 'admin') return adminSections
  return isSupervisor ? [...userSections, reviewSection] : userSections
}

const userSections: NavSection[] = [
  {
    title: 'Principal',
    items: [{ to: '/app/dashboard', label: 'Inicio', icon: <Home size={18} /> }],
  },
  {
    title: 'Mi facturación',
    items: [
      {
        to: '/app/billing-profile',
        label: 'Datos de facturación',
        icon: <UserSquare size={18} />,
      },
      { to: '/app/tasks', label: 'Tareas', icon: <FileText size={18} /> },
      { to: '/app/invoices', label: 'Facturas', icon: <Files size={18} /> },
      {
        to: '/app/invoice-number-requests',
        label: 'Solicitudes consecutivo',
        icon: <ReceiptText size={18} />,
      },
    ],
  },
]

export function Sidebar({
  profile,
  className = '',
  onNavigate,
  showCloseButton = false,
  collapsed = false,
  onToggleCollapsed,
}: {
  profile: Profile
  className?: string
  onNavigate?: () => void
  showCloseButton?: boolean
  collapsed?: boolean
  onToggleCollapsed?: () => void
}) {
  const { data: isSupervisor = false } = useIsSupervisor(
    profile.id,
    profile.role === 'user',
  )
  const sections = sectionsFor(profile, isSupervisor)
  const { data: company } = useCurrentCompany()
  const isSuperAdmin = profile.role === 'super_admin'
  const companyName = company?.name ?? (isSuperAdmin ? 'Sin empresa' : '…')
  const initials = getInitials(profile.full_name || profile.email)

  return (
    <aside
      className={`flex h-full ${collapsed ? 'w-[68px]' : 'w-[252px]'} flex-shrink-0 flex-col border-r border-border bg-bg transition-[width] duration-200 ${className}`}
    >
      {/* Logo + toggle / close */}
      <div
        className={`flex items-center ${collapsed ? 'flex-col gap-3 px-2' : 'justify-between px-4'} py-5`}
      >
        {collapsed ? (
          <Link
            to="/"
            aria-label="Invoxa"
            className="flex h-9 w-9 items-center justify-center"
            onClick={onNavigate}
          >
            <img src={isotipoCafe} alt="Invoxa" className="h-8 w-8" />
          </Link>
        ) : (
          <Link
            to="/"
            className="flex items-center"
            aria-label="Invoxa"
            onClick={onNavigate}
          >
            <img src={logoHorizontal} alt="Invoxa" className="h-12 w-auto" />
          </Link>
        )}
        {showCloseButton && (
          <button
            type="button"
            onClick={onNavigate}
            className="flex h-8 w-8 items-center justify-center rounded-md text-muted hover:bg-subtle hover:text-text-sec"
            aria-label="Cerrar menú"
          >
            <X size={16} />
          </button>
        )}
        {onToggleCollapsed && (
          <button
            type="button"
            onClick={onToggleCollapsed}
            className="flex h-8 w-8 items-center justify-center rounded-md text-muted hover:bg-subtle hover:text-text-sec"
            aria-label={collapsed ? 'Expandir menú' : 'Colapsar menú'}
            title={collapsed ? 'Expandir menú' : 'Colapsar menú'}
          >
            <Menu size={16} />
          </button>
        )}
      </div>

      {/* Org card — for the super admin it opens the company switcher */}
      {!collapsed && (
        <OrgCard
          companyName={companyName}
          roleText={roleLabel(profile.role)}
          switchTo={isSuperAdmin ? '/super/companies' : undefined}
          onNavigate={onNavigate}
        />
      )}

      {/* Sections */}
      <nav className="scrollbar-none flex-1 overflow-y-auto px-2.5 pb-2">
        {sections.map((section) => (
          <SidebarSection
            key={section.title}
            section={section}
            onNavigate={onNavigate}
            collapsed={collapsed}
          />
        ))}
      </nav>

      {/* User card */}
      <div
        className={`flex items-center border-t border-border p-3 ${collapsed ? 'justify-center' : 'gap-2.5'}`}
      >
        <div
          className="font-display flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary-dark text-xs font-bold text-white"
          title={collapsed ? profile.full_name || profile.email : undefined}
        >
          {initials}
        </div>
        {!collapsed && (
          <>
            <div className="min-w-0 flex-1">
              <div className="truncate text-xs font-semibold text-text">
                {profile.full_name || profile.email}
              </div>
              <div className="text-[10px] text-muted">
                {roleLabel(profile.role)}
              </div>
            </div>
            <SettingsMenu profile={profile} onNavigate={onNavigate} />
          </>
        )}
      </div>
    </aside>
  )
}

function SettingsMenu({
  profile,
  onNavigate,
}: {
  profile: Profile
  onNavigate?: () => void
}) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()
  const { signOut } = useAuth()

  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false)
      }
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('mousedown', handleClick)
      document.removeEventListener('keydown', handleKey)
    }
  }, [open])

  const handleNavigate = (to: string) => {
    setOpen(false)
    onNavigate?.()
    navigate(to)
  }

  const handleSignOut = async () => {
    setOpen(false)
    onNavigate?.()
    await signOut()
    navigate('/login', { replace: true })
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex h-7 w-7 items-center justify-center rounded-lg bg-subtle text-muted hover:text-text-sec"
        aria-label="Configuración"
        aria-expanded={open}
      >
        <Settings size={14} />
      </button>

      {open && (
        <div className="absolute bottom-full right-0 z-50 mb-2 w-52 overflow-hidden rounded-xl border border-border bg-surface shadow-xl">
          {profile.role === 'user' && (
            <button
              type="button"
              onClick={() => handleNavigate('/app/billing-profile')}
              className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-[13px] text-text-sec hover:bg-subtle"
            >
              <UserSquare size={15} />
              Mi perfil
            </button>
          )}
          <button
            type="button"
            onClick={handleSignOut}
            className="flex w-full items-center gap-2.5 border-t border-border px-3 py-2.5 text-left text-[13px] text-text-sec hover:bg-subtle"
          >
            <LogOut size={15} />
            Cerrar sesión
          </button>
        </div>
      )}
    </div>
  )
}

function SidebarSection({
  section,
  onNavigate,
  collapsed = false,
}: {
  section: NavSection
  onNavigate?: () => void
  collapsed?: boolean
}) {
  const location = useLocation()
  return (
    <div className="mb-4">
      {!collapsed && (
        <div className="px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-[0.08em] text-muted">
          {section.title}
        </div>
      )}
      {section.items.map((item) => {
        const active = location.pathname.startsWith(item.to)
        return (
          <Link
            key={item.to}
            to={item.to}
            onClick={onNavigate}
            title={collapsed ? item.label : undefined}
            aria-label={collapsed ? item.label : undefined}
            className={`relative my-px flex items-center rounded-lg text-[13px] font-medium transition ${
              collapsed
                ? 'h-10 justify-center px-0'
                : 'gap-2.5 px-2.5 py-2'
            } ${
              active
                ? 'bg-primary/10 font-semibold text-primary'
                : 'text-text-sec hover:bg-subtle'
            }`}
          >
            {active && (
              <span className="absolute -left-[10px] top-1.5 bottom-1.5 w-[2.5px] rounded-full bg-primary" />
            )}
            {item.icon}
            {!collapsed && (
              <>
                <span className="flex-1">{item.label}</span>
                {item.badge ? (
                  <span className="min-w-[18px] rounded-full bg-primary px-1.5 py-0.5 text-center text-[10px] font-bold text-white">
                    {item.badge}
                  </span>
                ) : null}
              </>
            )}
            {collapsed && item.badge ? (
              <span className="absolute right-1 top-1 min-w-[16px] rounded-full bg-primary px-1 py-px text-center text-[9px] font-bold text-white">
                {item.badge}
              </span>
            ) : null}
          </Link>
        )
      })}
    </div>
  )
}

function OrgCard({
  companyName,
  roleText,
  switchTo,
  onNavigate,
}: {
  companyName: string
  roleText: string
  switchTo?: string
  onNavigate?: () => void
}) {
  const body = (
    <>
      <div className="flex h-7 w-7 items-center justify-center rounded-md bg-blue text-[11px] font-bold text-white">
        {getInitials(companyName) || '·'}
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-xs font-semibold text-text">{companyName}</div>
        <div className="mt-0.5 text-[10px] text-muted">{roleText}</div>
      </div>
      {switchTo && <ChevronDown size={14} className="text-muted" />}
    </>
  )
  const className =
    'mx-3 mb-3.5 flex items-center gap-2.5 rounded-xl border border-border bg-subtle px-3 py-2.5'
  if (!switchTo) return <div className={className}>{body}</div>
  return (
    <Link
      to={switchTo}
      onClick={onNavigate}
      title="Cambiar de empresa"
      className={`${className} transition hover:border-border-strong`}
    >
      {body}
    </Link>
  )
}

function getInitials(value: string): string {
  return value
    .split(/[ @.]/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase() ?? '')
    .join('')
}

export type { UserRole }
