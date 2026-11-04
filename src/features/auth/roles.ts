import type { Profile, UserRole } from '../../types/profile'

/** Company the profile works in: its own, or the one a super admin selected. */
export function workingCompanyId(profile: Profile): string | null {
  return profile.company_id ?? profile.active_company_id
}

/** Can use the /admin area: company admin, or super admin inside a company. */
export function canUseAdminArea(profile: Profile): boolean {
  if (profile.role === 'admin') return true
  return profile.role === 'super_admin' && Boolean(profile.active_company_id)
}

/** Where "/" sends a signed-in user. */
export function homePathFor(profile: Profile): string {
  if (profile.role === 'user') return '/app/dashboard'
  if (canUseAdminArea(profile)) return '/admin/dashboard'
  return '/super/companies'
}

export function roleLabel(role: UserRole): string {
  switch (role) {
    case 'super_admin':
      return 'Super admin'
    case 'admin':
      return 'Admin'
    default:
      return 'Usuario'
  }
}
