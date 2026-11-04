import { lazy, Suspense } from 'react'
import { Navigate } from 'react-router-dom'
import { RouteFallback } from '../../components/ui/RouteFallback'
import { isNative } from '../../lib/native/platform'
import { useAuth } from './useAuth'
import { useProfile } from './useProfile'

// Lazy import keeps the 1200+ line marketing landing out of the main bundle.
// On native (Capacitor) we redirect to /login before this ever resolves, so
// the chunk is never fetched on the mobile shell.
const LandingPage = lazy(() =>
  import('../landing/LandingPage').then((m) => ({ default: m.LandingPage })),
)

export function HomeRedirect() {
  const { session, loading: authLoading } = useAuth()
  const { data: profile, isLoading: profileLoading, error } = useProfile()

  if (authLoading) {
    return <RouteFallback />
  }

  // Unauthenticated visitor: on the web we render the marketing landing
  // directly at "/" so it's the canonical URL for SEO. On the native shell
  // (Capacitor) the landing must never appear — go straight to login.
  if (!session) {
    if (isNative()) return <Navigate to="/login" replace />
    return (
      <Suspense fallback={<RouteFallback />}>
        <LandingPage />
      </Suspense>
    )
  }

  if (profileLoading) {
    return <RouteFallback />
  }

  if (error || !profile) {
    return (
      <div className="flex min-h-screen items-center justify-center px-6 text-center text-sm text-red-600">
        No se pudo cargar tu perfil. Contacta al administrador.
      </div>
    )
  }

  const target = profile.role === 'admin' ? '/admin/dashboard' : '/app/dashboard'
  return <Navigate to={target} replace />
}
