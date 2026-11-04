import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import type { UserRole } from '../../types/profile'
import { useCurrentCompany } from '../companies/queries'
import { canUseAdminArea, homePathFor } from './roles'
import { useAuth } from './useAuth'
import { useProfile } from './useProfile'

/**
 * Area guard.
 * - "admin": company admins, and the super admin once inside a company.
 * - "super_admin" / "user": exactly that role.
 * Users of a deactivated company are stopped here.
 */
export function RoleRoute({
  role,
  children,
}: {
  role: UserRole
  children: ReactNode
}) {
  const { data: profile, isLoading, error } = useProfile()
  const { data: company } = useCurrentCompany()
  const { signOut } = useAuth()

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-slate-500">
        Cargando perfil…
      </div>
    )
  }

  if (error || !profile) {
    return (
      <div className="flex min-h-screen items-center justify-center px-6 text-center text-sm text-red-600">
        No se pudo cargar tu perfil. Contacta al administrador.
      </div>
    )
  }

  if (profile.role !== 'super_admin' && company?.status === 'inactive') {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="max-w-sm text-sm text-text-sec">
          Tu empresa está desactivada en Invoxa. Contacta con Fullkod si crees que es un error.
        </p>
        <button
          type="button"
          onClick={() => void signOut()}
          className="text-sm font-semibold text-primary hover:underline"
        >
          Cerrar sesión
        </button>
      </div>
    )
  }

  const allowed = role === 'admin' ? canUseAdminArea(profile) : profile.role === role
  if (!allowed) {
    return <Navigate to={homePathFor(profile)} replace />
  }

  return <>{children}</>
}
