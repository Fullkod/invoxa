// =============================================================================
// change-invoice-number — Edge Function
// =============================================================================
// Admin-only direct change of an invoice's consecutive number. Calls the SQL
// function `apply_invoice_number_change` which validates uniqueness, updates
// the invoice and writes a row to `invoice_number_history`.
//
// User-submitted requests go through `request-invoice-number-change` and only
// take effect when an admin approves them via `resolve-invoice-number-change`.
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
  invoice_id: string
  new_invoice_number: string
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

  const caller = await loadCaller(adminClient, userResult.user.id)
  if (!caller || !caller.isAdmin) {
    return jsonResponse(
      { error: 'Forbidden — solo el admin puede cambiar consecutivos' },
      403,
    )
  }

  let payload: Payload
  try {
    payload = (await req.json()) as Payload
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400)
  }

  const { invoice_id, new_invoice_number, reason } = payload
  if (!invoice_id || !new_invoice_number) {
    return jsonResponse(
      { error: 'invoice_id y new_invoice_number son requeridos' },
      400,
    )
  }

  // The invoice must belong to the caller's company.
  const { data: targetInvoice } = await adminClient
    .from('invoices')
    .select('company_id')
    .eq('id', invoice_id)
    .maybeSingle()
  if (!targetInvoice || targetInvoice.company_id !== caller.companyId) {
    return jsonResponse({ error: 'Factura no encontrada' }, 404)
  }

  const { data, error } = await adminClient.rpc(
    'apply_invoice_number_change',
    {
      p_invoice_id: invoice_id,
      p_new_invoice_number: new_invoice_number,
      p_changed_by: userResult.user.id,
      p_change_request_id: null,
      p_reason: reason ?? null,
    },
  )

  if (error) {
    return jsonResponse({ error: error.message }, 400)
  }

  // Fire-and-forget PDF regen so the stored file matches the new number.
  // We don't fail the request if it errors — the invoice change already
  // succeeded and the user can hit "Regenerar PDF" from the detail page.
  void regenerateInvoicePdf(supabaseUrl, supabaseAnonKey, authHeader, invoice_id)

  return jsonResponse(
    {
      success: true,
      invoice_id: data,
      new_invoice_number,
    },
    200,
  )
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
    console.warn('PDF regen after invoice number change failed', err)
  }
}
