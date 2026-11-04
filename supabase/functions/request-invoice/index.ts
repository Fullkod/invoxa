// =============================================================================
// request-invoice — Edge Function
// =============================================================================
// Admin asks a single user to generate the invoice for a given period. Creates
// a row in `invoice_requests` (status='pending', sent_at=now) and logs the
// outbound email in `email_logs`.
//
// Idempotent: if an active pending request already exists for the same
// (user, period), returns it without duplicating.
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
  user_id: string
  period_start: string // YYYY-MM-DD
  period_end: string // YYYY-MM-DD
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

  const { user_id, period_start, period_end } = payload
  if (!user_id || !period_start || !period_end) {
    return jsonResponse(
      { error: 'user_id, period_start y period_end son requeridos' },
      400,
    )
  }
  if (period_end < period_start) {
    return jsonResponse(
      { error: 'period_end debe ser igual o posterior a period_start' },
      400,
    )
  }

  // Resolve target user — must exist and be active.
  const { data: targetUser, error: targetErr } = await adminClient
    .from('profiles')
    .select('id, full_name, email, status, company_id')
    .eq('id', user_id)
    .single()

  if (targetErr || !targetUser || targetUser.company_id !== caller.companyId) {
    return jsonResponse({ error: 'Usuario no encontrado' }, 404)
  }

  if (targetUser.status !== 'active') {
    return jsonResponse(
      { error: 'El usuario no está activo' },
      400,
    )
  }

  // Skip if an invoice already exists for this period (non-cancelled).
  const { data: existingInvoice } = await adminClient
    .from('invoices')
    .select('id')
    .eq('user_id', user_id)
    .eq('period_start', period_start)
    .eq('period_end', period_end)
    .neq('status', 'cancelled')
    .maybeSingle()

  if (existingInvoice) {
    return jsonResponse(
      { error: 'El usuario ya tiene una factura para este periodo' },
      400,
    )
  }

  // Idempotent: re-use any existing pending request for this period.
  const { data: existingRequest } = await adminClient
    .from('invoice_requests')
    .select('id')
    .eq('user_id', user_id)
    .eq('period_start', period_start)
    .eq('period_end', period_end)
    .eq('status', 'pending')
    .maybeSingle()

  let requestId: string
  if (existingRequest) {
    requestId = existingRequest.id
    // Refresh sent_at to reflect the latest reminder.
    await adminClient
      .from('invoice_requests')
      .update({ sent_at: new Date().toISOString() })
      .eq('id', requestId)
  } else {
    const { data: inserted, error: insertErr } = await adminClient
      .from('invoice_requests')
      .insert({
        requested_by: userResult.user.id,
        user_id,
        period_start,
        period_end,
        status: 'pending',
        sent_at: new Date().toISOString(),
      })
      .select('id')
      .single()

    if (insertErr || !inserted) {
      return jsonResponse(
        { error: insertErr?.message ?? 'No se pudo crear la solicitud' },
        400,
      )
    }
    requestId = inserted.id
  }

  // Email log — actual SMTP/provider integration is a TODO; logging here
  // makes the request observable from the admin panel.
  await adminClient.from('email_logs').insert({
    company_id: caller.companyId,
    recipient_email: targetUser.email,
    subject: `Recordatorio: factura del periodo ${period_start} → ${period_end}`,
    type: 'invoice_request',
    status: 'pending',
    provider_response: {
      request_id: requestId,
      app_url: `${appUrl}/app/invoices/new`,
    },
  })

  return jsonResponse(
    {
      success: true,
      request_id: requestId,
    },
    200,
  )
})
