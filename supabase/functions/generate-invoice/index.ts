// =============================================================================
// generate-invoice — Edge Function
// =============================================================================
// Validates the caller is authenticated and is acting on their own behalf,
// then delegates the actual generation to the SQL function
// `generate_user_invoice` (transactional).
//
// Admins may also invoke this on behalf of any user by passing user_id.
// =============================================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'
import { loadCaller, userInCompany } from '../_shared/company.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

type GeneratePayload = {
  period_start: string // YYYY-MM-DD
  period_end: string // YYYY-MM-DD
  user_id?: string // optional, admin-only override
  notes?: string | null
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

  // Resolve target user. Default = caller. Admins may override.
  let payload: GeneratePayload
  try {
    payload = (await req.json()) as GeneratePayload
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400)
  }

  const { period_start, period_end } = payload
  if (!period_start || !period_end) {
    return jsonResponse(
      { error: 'period_start y period_end son requeridos' },
      400,
    )
  }

  let targetUserId = userResult.user.id
  if (payload.user_id && payload.user_id !== targetUserId) {
    const caller = await loadCaller(adminClient, userResult.user.id)
    if (
      !caller ||
      !caller.isAdmin ||
      !(await userInCompany(adminClient, payload.user_id, caller.companyId))
    ) {
      return jsonResponse(
        { error: 'Forbidden — solo el admin puede generar facturas a otros usuarios' },
        403,
      )
    }
    targetUserId = payload.user_id
  }

  const { data, error } = await adminClient.rpc('generate_user_invoice', {
    p_user_id: targetUserId,
    p_period_start: period_start,
    p_period_end: period_end,
  })

  if (error) {
    return jsonResponse({ error: error.message }, 400)
  }

  // RPC returns jsonb directly.
  const result = data as {
    invoice_id?: string
    invoice_number?: string
    total?: number
    currency?: string
  } | null

  if (!result || !result.invoice_id) {
    return jsonResponse({ error: 'No se pudo generar la factura' }, 500)
  }

  // Persist notes after the SQL function created the invoice. Done as a
  // separate UPDATE rather than a new function parameter so we don't need
  // to change `generate_user_invoice`'s signature.
  if (typeof payload.notes === 'string' && payload.notes.trim().length > 0) {
    await adminClient
      .from('invoices')
      .update({ notes: payload.notes.trim() })
      .eq('id', result.invoice_id)
  }

  return jsonResponse(
    {
      success: true,
      invoice_id: result.invoice_id,
      invoice_number: result.invoice_number,
      total: Number(result.total ?? 0),
      currency: result.currency,
    },
    200,
  )
})
