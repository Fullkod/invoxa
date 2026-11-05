// =============================================================================
// API key helpers for agent-api (PRP-002).
// =============================================================================
// Keys look like "ivx_<43 base64url chars>". Only their SHA-256 (hex) is stored
// in api_keys.key_hash (see migration 20261104000006). Never log the key.
// =============================================================================

import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'

const KEY_PATTERN = /^ivx_[A-Za-z0-9_-]{20,128}$/

export type ApiKeyOwner = {
  keyId: string
  userId: string
  companyId: string
  fullName: string
  email: string
  userCode: string | null
  companyName: string
  defaultCurrency: string
}

export async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

/** Extracts the key from "Authorization: Bearer ivx_..." (or "X-Api-Key"). */
export function readApiKey(req: Request): string | null {
  const header = req.headers.get('Authorization') ?? ''
  const bearer = header.match(/^Bearer\s+(.+)$/i)?.[1]?.trim()
  const candidate = bearer ?? req.headers.get('X-Api-Key')?.trim() ?? ''
  return KEY_PATTERN.test(candidate) ? candidate : null
}

type KeyRow = {
  id: string
  user_id: string
  revoked_at: string | null
  last_used_at: string | null
  profile: {
    id: string
    full_name: string
    email: string
    user_code: string | null
    role: string
    status: string
    company_id: string | null
    company: { id: string; name: string; status: string; default_currency: string } | null
  } | null
}

/**
 * Resolves a key to its owner. Returns null when the key does not exist, is
 * revoked, or its user is not an active collaborator of an active company.
 * Touches last_used_at at most once per minute.
 */
export async function authenticateApiKey(
  adminClient: SupabaseClient,
  apiKey: string,
): Promise<ApiKeyOwner | null> {
  const hash = await sha256Hex(apiKey)
  const { data, error } = await adminClient
    .from('api_keys')
    .select(
      'id, user_id, revoked_at, last_used_at, profile:profiles!api_keys_user_id_fkey(id, full_name, email, user_code, role, status, company_id, company:companies!profiles_company_id_fkey(id, name, status, default_currency))',
    )
    .eq('key_hash', hash)
    .maybeSingle()

  if (error || !data) return null
  const row = data as unknown as KeyRow
  const profile = row.profile
  const company = profile?.company
  if (
    row.revoked_at !== null ||
    !profile ||
    profile.role !== 'user' ||
    profile.status === 'inactive' ||
    !company ||
    company.status !== 'active' ||
    profile.company_id !== company.id
  ) {
    return null
  }

  const oneMinuteAgo = new Date(Date.now() - 60_000).toISOString()
  if (row.last_used_at === null || row.last_used_at < oneMinuteAgo) {
    await adminClient
      .from('api_keys')
      .update({ last_used_at: new Date().toISOString() })
      .eq('id', row.id)
  }

  return {
    keyId: row.id,
    userId: profile.id,
    companyId: company.id,
    fullName: profile.full_name,
    email: profile.email,
    userCode: profile.user_code,
    companyName: company.name,
    defaultCurrency: company.default_currency,
  }
}
