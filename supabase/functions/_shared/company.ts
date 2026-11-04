// =============================================================================
// Company (tenant) helpers shared by the Edge Functions — PRP-001 Phase 3.
// =============================================================================
// Edge Functions use the service role, which bypasses RLS. Every function must
// therefore check by hand that the rows it touches belong to the caller's
// company. "Caller's company" is profiles.company_id, or for the super admin
// the company they are currently operating in (profiles.active_company_id).
// =============================================================================

import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'

export type CallerRole = 'admin' | 'user' | 'super_admin'

export type Caller = {
  id: string
  role: CallerRole
  /** Company the caller works in (null only for a super admin with none selected). */
  companyId: string | null
  /** Admin of companyId: company admin, or super admin with an active company. */
  isAdmin: boolean
  isSuperAdmin: boolean
}

export async function loadCaller(
  adminClient: SupabaseClient,
  userId: string,
): Promise<Caller | null> {
  const { data, error } = await adminClient
    .from('profiles')
    .select('id, role, company_id, active_company_id')
    .eq('id', userId)
    .single()
  if (error || !data) return null

  const row = data as {
    id: string
    role: CallerRole
    company_id: string | null
    active_company_id: string | null
  }
  const companyId = row.company_id ?? row.active_company_id
  const isSuperAdmin = row.role === 'super_admin'
  return {
    id: row.id,
    role: row.role,
    companyId,
    isSuperAdmin,
    isAdmin: companyId !== null && (row.role === 'admin' || isSuperAdmin),
  }
}

/** Company of a user's profile, or null if the user does not exist. */
export async function companyOfUser(
  adminClient: SupabaseClient,
  userId: string,
): Promise<string | null> {
  const { data } = await adminClient
    .from('profiles')
    .select('company_id')
    .eq('id', userId)
    .maybeSingle()
  return (data as { company_id: string | null } | null)?.company_id ?? null
}

/** True when the user exists and belongs to the given company. */
export async function userInCompany(
  adminClient: SupabaseClient,
  userId: string,
  companyId: string | null,
): Promise<boolean> {
  if (!companyId) return false
  return (await companyOfUser(adminClient, userId)) === companyId
}
