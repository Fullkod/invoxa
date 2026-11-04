// =============================================================================
// resolve-invoice-number-change — Edge Function
// =============================================================================
// Admin approves or rejects a pending invoice number change request submitted
// by a user. On approval, calls `apply_invoice_number_change` to commit the
// change atomically and writes a row to `invoice_number_history` linked to
// this request (status -> 'applied').
//
// Rejection only updates the request row (status -> 'rejected'); no invoice
// changes occur.
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
  request_id: string
  decision: 'approve' | 'reject'
  review_notes?: string
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
      { error: 'Forbidden — solo el admin puede resolver solicitudes' },
      403,
    )
  }

  let payload: Payload
  try {
    payload = (await req.json()) as Payload
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400)
  }

  const { request_id, decision, review_notes } = payload
  if (!request_id || !decision) {
    return jsonResponse(
      { error: 'request_id y decision son requeridos' },
      400,
    )
  }
  if (decision !== 'approve' && decision !== 'reject') {
    return jsonResponse(
      { error: "decision debe ser 'approve' o 'reject'" },
      400,
    )
  }

  const { data: request, error: requestErr } = await adminClient
    .from('invoice_number_change_requests')
    .select('*')
    .eq('id', request_id)
    .single()

  if (requestErr || !request || request.company_id !== caller.companyId) {
    return jsonResponse({ error: 'Solicitud no encontrada' }, 404)
  }

  if (request.status !== 'pending') {
    return jsonResponse(
      { error: 'La solicitud ya fue resuelta' },
      400,
    )
  }

  const reviewedAt = new Date().toISOString()

  if (decision === 'reject') {
    const { error: updateErr } = await adminClient
      .from('invoice_number_change_requests')
      .update({
        status: 'rejected',
        reviewed_by: userResult.user.id,
        reviewed_at: reviewedAt,
        review_notes: review_notes ?? null,
      })
      .eq('id', request_id)

    if (updateErr) {
      return jsonResponse({ error: updateErr.message }, 400)
    }

    await adminClient.from('email_logs').insert({
      company_id: caller.companyId,
      recipient_email: 'user-pending', // resolved server-side later
      subject: `Solicitud rechazada · ${request.current_invoice_number}`,
      type: 'invoice_number_change_resolved',
      status: 'pending',
      provider_response: {
        request_id,
        decision: 'reject',
      },
    })

    return jsonResponse({ success: true, status: 'rejected' }, 200)
  }

  // Approve path: apply via SQL function then mark as 'applied'.
  const { error: applyErr } = await adminClient.rpc(
    'apply_invoice_number_change',
    {
      p_invoice_id: request.invoice_id,
      p_new_invoice_number: request.requested_invoice_number,
      p_changed_by: userResult.user.id,
      p_change_request_id: request_id,
      p_reason: review_notes ?? request.reason ?? null,
    },
  )

  if (applyErr) {
    return jsonResponse({ error: applyErr.message }, 400)
  }

  const { error: updateErr } = await adminClient
    .from('invoice_number_change_requests')
    .update({
      status: 'applied',
      reviewed_by: userResult.user.id,
      reviewed_at: reviewedAt,
      review_notes: review_notes ?? null,
    })
    .eq('id', request_id)

  if (updateErr) {
    return jsonResponse({ error: updateErr.message }, 400)
  }

  await adminClient.from('email_logs').insert({
    company_id: caller.companyId,
    recipient_email: 'user-pending',
    subject: `Cambio aplicado · ${request.requested_invoice_number}`,
    type: 'invoice_number_change_resolved',
    status: 'pending',
    provider_response: {
      request_id,
      decision: 'approve',
      new_invoice_number: request.requested_invoice_number,
    },
  })

  // Regenerate the PDF so the stored file matches the new consecutive
  // number. Fire-and-forget — the change is already committed.
  void regenerateInvoicePdf(
    supabaseUrl,
    supabaseAnonKey,
    authHeader,
    request.invoice_id,
  )

  return jsonResponse({ success: true, status: 'applied' }, 200)
})

async function regenerateInvoicePdf(
  supabaseUrl: string,
  anonKey: string,
  authHeader: string,
  invoiceId: string,
): Promise<void> {
  try {
    await fetch(`${supabaseUrl}/functions/v1/generate-invoice-pdf`, {
      method: 'POST',
      headers: {
        Authorization: authHeader,
        apikey: anonKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ invoice_id: invoiceId }),
    })
  } catch (err) {
    console.warn('PDF regen after approval failed', err)
  }
}
