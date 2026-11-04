import { LogOut, Menu, Search } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import isotipoCafe from '/brand/isotipo-cafe.svg'
import { useAuth } from '../../features/auth/useAuth'
import { useProfile } from '../../features/auth/useProfile'
import { NotificationsBell } from '../../features/notifications/NotificationsBell'

export function Topbar({
  title,
  subtitle,
  rightAction,
  onOpenMenu,
}: {
  title: string
  subtitle?: string
  rightAction?: ReactNode
  onOpenMenu?: () => void
}) {
  const { signOut } = useAuth()
  const { data: profile } = useProfile()
  const navigate = useNavigate()

  const handleSignOut = async () => {
    await signOut()
    navigate('/login', { replace: true })
  }

  return (
    <header className="flex h-14 flex-shrink-0 items-center justify-between border-b border-border bg-bg px-4 md:h-16 md:px-7">
      <div className="flex min-w-0 items-center gap-2">
        {/* Hamburger + logo group — mobile only, no gap between them */}
        <div className="-ml-1.5 flex flex-shrink-0 items-center md:hidden">
          <button
            type="button"
            onClick={onOpenMenu}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-text-sec hover:bg-subtle"
            aria-label="Abrir menú"
          >
            <Menu size={20} />
          </button>
          <Link
            to="/"
            aria-label="Invoxa"
            className="-ml-1 flex h-9 w-7 items-center justify-center"
          >
            <img src={isotipoCafe} alt="" className="h-7 w-7" />
          </Link>
        </div>

        <div className="min-w-0">
          <h1 className="font-display truncate text-base font-bold tracking-tightish text-text md:text-lg">
            {title}
          </h1>
          {subtitle && (
            <p className="mt-0.5 hidden truncate text-xs text-muted sm:block">
              {subtitle}
            </p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 md:gap-3">
        <div className="hidden h-9 min-w-[280px] items-center gap-2 rounded-xl border border-border bg-subtle px-3 text-muted lg:flex">
          <Search size={15} />
          <span className="text-xs">Buscar…</span>
          <span className="ml-auto rounded border border-border px-1.5 py-px text-[10px] font-semibold">
            ⌘K
          </span>
        </div>

        {profile && <NotificationsBell profile={profile} />}

        {rightAction}

        <button
          type="button"
          onClick={handleSignOut}
          className="flex h-9 items-center justify-center gap-1.5 rounded-xl border border-border bg-surface px-2 text-xs font-semibold text-text-sec hover:bg-subtle md:px-3"
          aria-label="Cerrar sesión"
        >
          <LogOut size={14} />
          <span className="hidden md:inline">Cerrar sesión</span>
        </button>
      </div>
    </header>
  )
}
