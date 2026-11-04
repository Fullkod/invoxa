// =============================================================================
// delete-user — Edge Function
// =============================================================================
// Verifies the caller is admin, then permanently deletes a user.
//
// Deleting the auth.users row cascades to the profile and everything that
// references it with ON DELETE CASCADE (billing profile, project assignments,
// compensation settings, tasks, invoice_requests where the user is the
// subject). A handful of financial/audit tables reference profiles with
// ON DELETE RESTRICT — we check those up front and BLOCK the deletion with a
// clear reason so accounting traceability is never silently broken:
//
//   - invoices.user_id                          (issued invoices)
//   - invoice_requests.requested_by             (requests this user created)
//   - invoice_number_change_requests.requested_by
//   - invoice_number_history.changed_by         (audit log of number changes)
//
// Also guards against deleting yourself or the last remaining admin.
// =============================================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'
import { loadCaller } from '../_shared/company.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

type DeletePayload = {
  id: string
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

  // Caller verification — uses anon key + caller's JWT
  const userClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  })

  const { data: userResult, error: userErr } = await userClient.auth.getUser()
  if (userErr || !userResult?.user) {
    return jsonResponse({ error: 'Invalid auth' }, 401)
  }

  // Service role — bypasses RLS. Used for admin checks and deleting.
  const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false },
  })

  const caller = await loadCaller(adminClient, userResult.user.id)
  if (!caller || !caller.isAdmin) {
    return jsonResponse({ error: 'Forbidden — admin only' }, 403)
  }

  let payload: DeletePayload
  try {
    payload = (await req.json()) as DeletePayload
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400)
  }

  const targetId = payload.id?.trim()
  if (!targetId) {
    return jsonResponse({ error: 'id is required' }, 400)
  }

  // Guard: can't delete yourself.
  if (targetId === userResult.user.id) {
    return jsonResponse(
      { error: 'No puedes eliminar tu propia cuenta.' },
      400,
    )
  }

  // Make sure the target exists and grab its role.
  const { data: target, error: targetErr } = await adminClient
    .from('profiles')
    .select('id, role, company_id')
    .eq('id', targetId)
    .single()

  if (targetErr || !target || target.company_id !== caller.companyId) {
    return jsonResponse({ error: 'El usuario no existe.' }, 404)
  }

  // Guard: don't delete the last remaining admin.
  if (target.role === 'admin') {
    const { count: adminCount, error: adminCountErr } = await adminClient
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .eq('role', 'admin')
      .eq('company_id', caller.companyId)

    if (adminCountErr) {
      return jsonResponse({ error: adminCountErr.message }, 500)
    }
    if ((adminCount ?? 0) <= 1) {
      return jsonResponse(
        { error: 'No puedes eliminar al único administrador.' },
        409,
      )
    }
  }

  // ---------------------------------------------------------------------------
  // Blocking checks — tables that reference the user with ON DELETE RESTRICT.
  // We count rows for each and refuse the deletion if any exist, so financial
  // and audit history is preserved.
  // ---------------------------------------------------------------------------
  const blockers: string[] = []

  const checks: Array<{ table: string; column: string; label: string }> = [
    { table: 'invoices', column: 'user_id', label: 'facturas emitidas' },
    {
      table: 'invoice_requests',
      column: 'requested_by',
      label: 'solicitudes de factura creadas por el usuario',
    },
    {
      table: 'invoice_number_change_requests',
      column: 'requested_by',
      label: 'solicitudes de cambio de número de factura',
    },
    {
      table: 'invoice_number_history',
      column: 'changed_by',
      label: 'cambios en el historial de números de factura',
    },
  ]

  for (const check of checks) {
    const { count, error } = await adminClient
      .from(check.table)
      .select('id', { count: 'exact', head: true })
      .eq(check.column, targetId)

    if (error) {
      return jsonResponse({ error: error.message }, 500)
    }
    if ((count ?? 0) > 0) {
      blockers.push(`${count} ${check.label}`)
    }
  }

  if (blockers.length > 0) {
    return jsonResponse(
      {
        error:
          'No se puede eliminar: el usuario tiene registros financieros asociados ' +
          `(${blockers.join(', ')}). Desactívalo en su lugar para conservar la trazabilidad contable.`,
        blockers,
      },
      409,
    )
  }

  // Delete the auth user — cascades to the profile and all CASCADE references.
  const { error: deleteErr } = await adminClient.auth.admin.deleteUser(targetId)

  if (deleteErr) {
    return jsonResponse({ error: deleteErr.message }, 400)
  }

  return jsonResponse({ success: true, user_id: targetId }, 200)
})
