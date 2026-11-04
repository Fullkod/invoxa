// =============================================================================
// invite-user — Edge Function
// =============================================================================
// Verifies the caller is admin, then sends a Supabase invitation email and
// (optionally) updates the auto-created profile with user_code.
// Logs the email send in email_logs.
// =============================================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'
import { loadCaller } from '../_shared/company.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

type InvitePayload = {
  email: string
  full_name: string
  user_code?: string
  role?: 'admin' | 'user'
  // Optional initial project + compensation. When present, after the auth
  // user is created the function inserts a `user_project_assignments` row
  // and the matching `compensation_settings` row so the admin doesn't have
  // to do it as a second step.
  initial_assignment?: {
    project_id: string
    payment_type: 'hourly' | 'fixed'
    hourly_rate: number | null
    monthly_rate: number | null
    currency: string
  }
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

  // Caller verification — uses anon key + caller's JWT
  const userClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  })

  const { data: userResult, error: userErr } = await userClient.auth.getUser()
  if (userErr || !userResult?.user) {
    return jsonResponse({ error: 'Invalid auth' }, 401)
  }

  // Service role — bypasses RLS. Used for admin checks and inviting.
  const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false },
  })

  const caller = await loadCaller(adminClient, userResult.user.id)
  if (!caller || !caller.isAdmin || !caller.companyId) {
    return jsonResponse({ error: 'Forbidden — admin only' }, 403)
  }

  let payload: InvitePayload
  try {
    payload = (await req.json()) as InvitePayload
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400)
  }

  const { email, full_name, user_code, role = 'user' } = payload

  if (role !== 'admin' && role !== 'user') {
    return jsonResponse({ error: 'role must be admin or user' }, 400)
  }

  if (!email || !full_name) {
    return jsonResponse(
      { error: 'email and full_name are required' },
      400,
    )
  }

  // Send invitation. Supabase will create auth.users row, fire the trigger
  // that creates the profile (reading full_name, role, user_code from metadata),
  // and email a magic link that lands at /accept-invite via redirectTo.
  const { data: inviteData, error: inviteError } =
    await adminClient.auth.admin.inviteUserByEmail(email, {
      data: {
        full_name,
        role,
        user_code: user_code ?? '',
        // New users always join the company of the admin who invites them.
        company_id: caller.companyId,
      },
      redirectTo: `${appUrl}/accept-invite`,
    })

  if (inviteError) {
    return jsonResponse({ error: inviteError.message }, 400)
  }

  // user_code redundancy: ensure it's set even if metadata path fails.
  if (user_code && inviteData.user) {
    await adminClient
      .from('profiles')
      .update({ user_code, full_name })
      .eq('id', inviteData.user.id)
  }

  // Optional initial assignment + compensation. We only attempt this when
  // the auth user was created. Failures here are surfaced as a flag in the
  // response (rather than failing the whole invite), so the admin can fix
  // it from the project members page if needed.
  let initialAssignmentFailed = false
  if (payload.initial_assignment && inviteData.user) {
    const a = payload.initial_assignment
    const today = new Date().toISOString().slice(0, 10)

    const { data: assign, error: assignErr } = await adminClient
      .from('user_project_assignments')
      .insert({
        user_id: inviteData.user.id,
        project_id: a.project_id,
        is_current: true,
        start_date: today,
      })
      .select('id')
      .single()

    if (assignErr || !assign) {
      console.warn('initial assignment failed', assignErr)
      initialAssignmentFailed = true
    } else {
      const { error: compErr } = await adminClient
        .from('compensation_settings')
        .insert({
          user_id: inviteData.user.id,
          project_id: a.project_id,
          payment_type: a.payment_type,
          hourly_rate: a.hourly_rate,
          monthly_rate: a.monthly_rate,
          currency: a.currency,
          is_active: true,
        })

      if (compErr) {
        console.warn(
          'initial compensation failed; rolling back assignment',
          compErr,
        )
        // Roll back the assignment so we don't leave an orphan row that
        // the user could falsely show as active without a rate.
        await adminClient
          .from('user_project_assignments')
          .delete()
          .eq('id', assign.id)
        initialAssignmentFailed = true
      }
    }
  }

  // Log email send
  await adminClient.from('email_logs').insert({
    company_id: caller.companyId,
    recipient_email: email,
    subject: 'Invitación a Invoxa',
    type: 'invitation',
    status: 'sent',
    provider_response: { user_id: inviteData.user?.id ?? null },
  })

  return jsonResponse(
    {
      success: true,
      user_id: inviteData.user?.id ?? null,
      initial_assignment_failed: initialAssignmentFailed,
    },
    200,
  )
})
