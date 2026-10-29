import { useEffect, useState, type ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import { useProfile } from '../../features/auth/useProfile'
import { useNotificationsRealtime } from '../../features/notifications/useNotificationsRealtime'
import { useDocumentMeta } from '../../lib/seo/useDocumentMeta'
import { RouteFallback } from '../ui/RouteFallback'
import { MobileBottomNav } from './MobileBottomNav'
import { Sidebar } from './Sidebar'
import { Topbar } from './Topbar'

type Crumb = { label: string }

export function AppShell({
  title,
  subtitle,
  breadcrumbs,
  rightAction,
  children,
}: {
  title: string
  subtitle?: string
  breadcrumbs?: Crumb[]
  rightAction?: ReactNode
  children: ReactNode
}) {
  useDocumentMeta({ title, description: subtitle, noindex: true })
  const { data: profile } = useProfile()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false
    return window.localStorage.getItem('invoxa:sidebar-collapsed') === '1'
  })
  const location = useLocation()
  useNotificationsRealtime()

  // Close drawer when route changes.
  useEffect(() => {
    setDrawerOpen(false)
  }, [location.pathname])

  // Persist desktop sidebar collapsed state.
  useEffect(() => {
    window.localStorage.setItem(
      'invoxa:sidebar-collapsed',
      sidebarCollapsed ? '1' : '0',
    )
  }, [sidebarCollapsed])

  // Lock body scroll while drawer is open.
  useEffect(() => {
    if (!drawerOpen) return
    const original = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = original
    }
  }, [drawerOpen])

  if (!profile) {
    return <RouteFallback />
  }

  return (
    <div
      className="flex h-screen bg-subtle text-text"
      style={{
        paddingTop: 'var(--safe-area-top)',
        paddingBottom: 'var(--safe-area-bottom)',
      }}
    >
      {/* Desktop sidebar (always visible from md up) */}
      <Sidebar
        profile={profile}
        className="hidden md:flex"
        collapsed={sidebarCollapsed}
        onToggleCollapsed={() => setSidebarCollapsed((v) => !v)}
      />

      {/* Mobile drawer overlay */}
      {drawerOpen && (
        <>
          <button
            type="button"
            aria-label="Cerrar menú"
            className="fixed inset-0 z-40 bg-text/40 backdrop-blur-sm md:hidden"
            onClick={() => setDrawerOpen(false)}
          />
          <div className="fixed inset-y-0 left-0 z-50 flex md:hidden">
            <Sidebar
              profile={profile}
              onNavigate={() => setDrawerOpen(false)}
              showCloseButton
              className="shadow-xl"
            />
          </div>
        </>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar
          title={title}
          subtitle={subtitle}
          rightAction={rightAction}
          onOpenMenu={() => setDrawerOpen(true)}
        />
        <main
          className="scrollbar-thin flex-1 overflow-y-auto p-4 pb-[calc(64px+env(safe-area-inset-bottom))] md:p-6 md:pb-6"
        >
          {breadcrumbs && breadcrumbs.length > 0 && (
            <nav
              aria-label="Breadcrumb"
              className="mb-3 flex items-center gap-1.5 text-[11px] text-muted md:mb-4"
            >
              {breadcrumbs.map((c, i) => (
                <span key={i} className="flex items-center gap-1.5">
                  {i > 0 && <span>/</span>}
                  <span>{c.label}</span>
                </span>
              ))}
            </nav>
          )}
          {children}
          <footer className="mt-10 flex justify-end border-t border-border pt-3 text-[11px] text-muted">
            <a
              href="https://fullkod.com/?ref=invoxa"
              target="_blank"
              rel="noopener"
              className="inline-flex items-center gap-1.5 hover:text-text-sec"
            >
              Desarrollado por
              <img src="/brand/fullkod-symbol.svg" alt="" className="h-3 w-3" />
              <span className="font-semibold text-text-sec">Fullkod</span>
            </a>
          </footer>
        </main>
      </div>

      <MobileBottomNav profile={profile} />
    </div>
  )
}
