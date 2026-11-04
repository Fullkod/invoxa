// =============================================================================
// request-invoice-number-change — Edge Function
// =============================================================================
// User-facing request for an invoice number change. Only the invoice owner can
// request. Admins go through `change-invoice-number` instead, which applies
// the change directly.
//
// Records a row in `invoice_number_change_requests` with status='pending' and
// logs an email_logs entry so admin sees it pending review.
// =============================================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

type Payload = {
  invoice_id: string
  requested_invoice_number: string
  reason?: string
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

  let payload: Payload
  try {
    payload = (await req.json()) as Payload
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400)
  }

  const { invoice_id, requested_invoice_number, reason } = payload
  if (!invoice_id || !requested_invoice_number) {
    return jsonResponse(
      { error: 'invoice_id y requested_invoice_number son requeridos' },
      400,
    )
  }

  // Verify the invoice exists and the caller is the owner.
  const { data: invoice, error: invoiceErr } = await adminClient
    .from('invoices')
    .select('id, invoice_number, user_id, company_id')
    .eq('id', invoice_id)
    .single()

  if (invoiceErr || !invoice) {
    return jsonResponse({ error: 'Factura no encontrada' }, 404)
  }

  if (invoice.user_id !== userResult.user.id) {
    return jsonResponse(
      { error: 'Solo puedes solicitar cambios para tus facturas' },
      403,
    )
  }

  if (invoice.invoice_number === requested_invoice_number) {
    return jsonResponse(
      { error: 'El número solicitado coincide con el actual' },
      400,
    )
  }

  // Block multiple pending requests for the same invoice.
  const { count: pendingCount } = await adminClient
    .from('invoice_number_change_requests')
    .select('id', { count: 'exact', head: true })
    .eq('invoice_id', invoice_id)
    .eq('status', 'pending')

  if (pendingCount && pendingCount > 0) {
    return jsonResponse(
      { error: 'Ya tienes una solicitud pendiente para esta factura' },
      400,
    )
  }

  // Verify uniqueness: the requested number cannot already be taken.
  const { count: existingCount } = await adminClient
    .from('invoices')
    .select('id', { count: 'exact', head: true })
    .eq('company_id', invoice.company_id)
    .eq('invoice_number', requested_invoice_number)

  if (existingCount && existingCount > 0) {
    return jsonResponse(
      { error: 'Ese número ya está asignado a otra factura' },
      400,
    )
  }

  const { data: inserted, error: insertErr } = await adminClient
    .from('invoice_number_change_requests')
    .insert({
      invoice_id,
      requested_by: userResult.user.id,
      requested_by_role: 'user',
      current_invoice_number: invoice.invoice_number,
      requested_invoice_number,
      reason: reason ?? null,
      status: 'pending',
    })
    .select()
    .single()

  if (insertErr || !inserted) {
    return jsonResponse(
      { error: insertErr?.message ?? 'No se pudo crear la solicitud' },
      400,
    )
  }

  // Email log — actual notification can be wired to a provider later.
  const { data: invoiceCompany } = await adminClient
    .from('companies')
    .select('billing_email')
    .eq('id', invoice.company_id)
    .single()

  await adminClient.from('email_logs').insert({
    company_id: invoice.company_id,
    recipient_email: invoiceCompany?.billing_email ?? 'admins',
    subject: `Solicitud de cambio de consecutivo · ${invoice.invoice_number}`,
    type: 'invoice_number_change_request',
    status: 'pending',
    provider_response: { request_id: inserted.id, invoice_id },
  })

  return jsonResponse(
    {
      success: true,
      request_id: inserted.id,
    },
    200,
  )
})
