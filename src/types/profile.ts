export type UserRole = 'admin' | 'user' | 'super_admin'

export type UserStatus = 'active' | 'inactive' | 'invited'

export type Profile = {
  id: string
  full_name: string | null
  email: string
  user_code: string | null
  role: UserRole
  status: UserStatus
  /** Company the user belongs to. Null only for the super admin. */
  company_id: string | null
  /** Super admin only: company they are currently operating in. */
  active_company_id: string | null
  created_at: string
  updated_at: string
}
