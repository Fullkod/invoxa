// =============================================================================
// request-invoices-bulk — Edge Function
// =============================================================================
// Sends invoice reminders to multiple users at once. Two modes:
//   - Explicit: payload.user_ids = [...]
//   - All-active: payload.user_ids omitted -> all `profiles.status='active'`
//                 users that have at least one current project assignment.
//
// Per-user behaviour mirrors `request-invoice`:
//   - Skip users that already have a non-cancelled invoice for the period.
//   - Reuse any pending request and bump sent_at.
//   - Otherwise create a new pending request.
//   - Always log an email_logs entry.
//
// Returns a summary { created, refreshed, skipped: [{user_id, reason}] }.
// =============================================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'
import { loadCaller } from '../_shared/company.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

type Payload = {
  user_ids?: string[]
  period_start: string
  period_end: string
}

type SkipReason =
  | 'invoice_already_exists'
  | 'user_inactive'
  | 'no_active_projects'
  | 'user_not_found'

type ProcessOutcome = {
  created: number
  refreshed: number
  skipped: { user_id: string; reason: SkipReason }[]
}

function jsonResponse(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405)
  }

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) {
    return jsonResponse({ error: 'Missing authorization header' }, 401)
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  const appUrl = Deno.env.get('APP_URL') ?? 'http://localhost:5173'

  if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
    return jsonResponse({ error: 'Server misconfigured' }, 500)
  }

  const userClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  })

  const { data: userResult, error: userErr } = await userClient.auth.getUser()
  if (userErr || !userResult?.user) {
    return jsonResponse({ error: 'Invalid auth' }, 401)
  }

  const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false },
  })

  const caller = await loadCaller(adminClient, userResult.user.id)
  if (!caller || !caller.isAdmin) {
    return jsonResponse(
      { error: 'Forbidden — solo el admin puede solicitar facturas' },
      403,
    )
  }

  let payload: Payload
  try {
    payload = (await req.json()) as Payload
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400)
  }

  const { user_ids, period_start, period_end } = payload
  if (!period_start || !period_end) {
    return jsonResponse(
      { error: 'period_start y period_end son requeridos' },
      400,
    )
  }
  if (period_end < period_start) {
    return jsonResponse(
      { error: 'period_end debe ser igual o posterior a period_start' },
      400,
    )
  }

  // Resolve target users.
  let targetIds: string[]
  if (user_ids && user_ids.length > 0) {
    targetIds = user_ids
  } else {
    // All active users that have at least one current project assignment.
    const { data: assignments } = await adminClient
      .from('user_project_assignments')
      .select('user_id')
      .eq('company_id', caller.companyId)
      .eq('is_current', true)

    const assignedIds = Array.from(
      new Set(
        ((assignments ?? []) as { user_id: string }[]).map((a) => a.user_id),
      ),
    )

    if (assignedIds.length === 0) {
      return jsonResponse(
        {
          success: true,
          summary: { created: 0, refreshed: 0, skipped: [] },
        },
        200,
      )
    }

    const { data: activeProfiles } = await adminClient
      .from('profiles')
      .select('id')
      .eq('company_id', caller.companyId)
      .eq('status', 'active')
      .in('id', assignedIds)

    targetIds = ((activeProfiles ?? []) as { id: string }[]).map((p) => p.id)
  }

  if (targetIds.length === 0) {
    return jsonResponse(
      {
        success: true,
        summary: { created: 0, refreshed: 0, skipped: [] },
      },
      200,
    )
  }

  // Bulk-fetch the data we need to apply per-user logic.
  const { data: profiles } = await adminClient
    .from('profiles')
    .select('id, email, status')
    .eq('company_id', caller.companyId)
    .in('id', targetIds)

  const profileById = new Map(
    ((profiles ?? []) as {
      id: string
      email: string
      status: 'active' | 'inactive' | 'invited'
    }[]).map((p) => [p.id, p]),
  )

  const { data: existingInvoices } = await adminClient
    .from('invoices')
    .select('user_id')
    .in('user_id', targetIds)
    .eq('period_start', period_start)
    .eq('period_end', period_end)
    .neq('status', 'cancelled')

  const usersWithInvoice = new Set(
    ((existingInvoices ?? []) as { user_id: string }[]).map((i) => i.user_id),
  )

  const { data: existingRequests } = await adminClient
    .from('invoice_requests')
    .select('id, user_id')
    .in('user_id', targetIds)
    .eq('period_start', period_start)
    .eq('period_end', period_end)
    .eq('status', 'pending')

  const pendingByUser = new Map(
    ((existingRequests ?? []) as { id: string; user_id: string }[]).map(
      (r) => [r.user_id, r.id],
    ),
  )

  const outcome: ProcessOutcome = {
    created: 0,
    refreshed: 0,
    skipped: [],
  }
  const now = new Date().toISOString()
  const inserts: {
    requested_by: string
    user_id: string
    period_start: string
    period_end: string
    status: 'pending'
    sent_at: string
  }[] = []
  const refreshIds: string[] = []
  const emailRows: {
    company_id: string | null
    recipient_email: string
    subject: string
    type: 'invoice_request'
    status: 'pending'
    provider_response: Record<string, unknown>
  }[] = []

  for (const userId of targetIds) {
    const profile = profileById.get(userId)
    if (!profile) {
      outcome.skipped.push({ user_id: userId, reason: 'user_not_found' })
      continue
    }
    if (profile.status !== 'active') {
      outcome.skipped.push({ user_id: userId, reason: 'user_inactive' })
      continue
    }
    if (usersWithInvoice.has(userId)) {
      outcome.skipped.push({
        user_id: userId,
        reason: 'invoice_already_exists',
      })
      continue
    }

    const subject = `Recordatorio: factura del periodo ${period_start} → ${period_end}`
    const pendingId = pendingByUser.get(userId)

    if (pendingId) {
      refreshIds.push(pendingId)
      outcome.refreshed += 1
      emailRows.push({
        company_id: caller.companyId,
        recipient_email: profile.email,
        subject,
        type: 'invoice_request',
        status: 'pending',
        provider_response: {
          request_id: pendingId,
          app_url: `${appUrl}/app/invoices/new`,
        },
      })
    } else {
      inserts.push({
        requested_by: userResult.user.id,
        user_id: userId,
        period_start,
        period_end,
        status: 'pending',
        sent_at: now,
      })
      // requestId is filled after insert; email_logs entry will be added then.
    }
  }

  // Refresh existing pending rows.
  if (refreshIds.length > 0) {
    await adminClient
      .from('invoice_requests')
      .update({ sent_at: now })
      .in('id', refreshIds)
  }

  // Bulk insert new requests and capture ids.
  if (inserts.length > 0) {
    const { data: created, error: insertErr } = await adminClient
      .from('invoice_requests')
      .insert(inserts)
      .select('id, user_id')

    if (insertErr) {
      return jsonResponse({ error: insertErr.message }, 400)
    }

    outcome.created = created?.length ?? 0

    for (const row of (created ?? []) as {
      id: string
      user_id: string
    }[]) {
      const profile = profileById.get(row.user_id)
      if (!profile) continue
      emailRows.push({
        company_id: caller.companyId,
        recipient_email: profile.email,
        subject: `Recordatorio: factura del periodo ${period_start} → ${period_end}`,
        type: 'invoice_request',
        status: 'pending',
        provider_response: {
          request_id: row.id,
          app_url: `${appUrl}/app/invoices/new`,
        },
      })
    }
  }

  if (emailRows.length > 0) {
    await adminClient.from('email_logs').insert(emailRows)
  }

  return jsonResponse(
    {
      success: true,
      summary: outcome,
    },
    200,
  )
})
