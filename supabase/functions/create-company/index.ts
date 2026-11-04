// =============================================================================
// create-company — Edge Function (PRP-001 Phase 3)
// =============================================================================
// Super admin only. Creates a company and invites its first admin, who joins
// that company (profiles.company_id comes from the invitation metadata).
// If the invitation fails the company is removed so no empty company remains.
// =============================================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'
import { z } from 'https://esm.sh/zod@3.23.8'
import { loadCaller } from '../_shared/company.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const optionalText = z
  .string()
  .trim()
  .max(200)
  .optional()
  .transform((v) => (v ? v : null))

const PayloadSchema = z.object({
  company: z.object({
    name: z.string().trim().min(2).max(120),
    legal_name: z.string().trim().min(2).max(200),
    tax_id: z.string().trim().min(2).max(40),
    address_line: optionalText,
    postal_code: optionalText,
    city: optionalText,
    region: optionalText,
    country: z.string().trim().min(2).max(80),
    billing_email: z.string().trim().email().optional().transform((v) => v ?? null),
    invoice_prefix: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z0-9]{1,8}$/, 'Prefijo: 1-8 mayúsculas o números'),
    default_currency: z.string().trim().length(3).toUpperCase().default('USD'),
  }),
  admin: z.object({
    email: z.string().trim().email(),
    full_name: z.string().trim().min(2).max(120),
    user_code: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z0-9]{1,8}$/)
      .optional(),
  }),
})

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
  if (!caller || !caller.isSuperAdmin) {
    return jsonResponse({ error: 'Forbidden — solo el super admin' }, 403)
  }

  let raw: unknown
  try {
    raw = await req.json()
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400)
  }

  const parsed = PayloadSchema.safeParse(raw)
  if (!parsed.success) {
    return jsonResponse(
      { error: 'Datos inválidos', issues: parsed.error.flatten() },
      400,
    )
  }
  const { company, admin } = parsed.data

  const { data: created, error: companyErr } = await adminClient
    .from('companies')
    .insert(company)
    .select('id')
    .single()

  if (companyErr || !created) {
    const duplicatePrefix = companyErr?.code === '23505'
    return jsonResponse(
      {
        error: duplicatePrefix
          ? 'Ya existe una empresa con ese prefijo de factura'
          : companyErr?.message ?? 'No se pudo crear la empresa',
      },
      duplicatePrefix ? 409 : 400,
    )
  }

  const { data: inviteData, error: inviteError } =
    await adminClient.auth.admin.inviteUserByEmail(admin.email, {
      data: {
        full_name: admin.full_name,
        role: 'admin',
        user_code: admin.user_code ?? '',
        company_id: created.id,
      },
      redirectTo: `${appUrl}/accept-invite`,
    })

  if (inviteError) {
    await adminClient.from('companies').delete().eq('id', created.id)
    return jsonResponse({ error: inviteError.message }, 400)
  }

  await adminClient.from('email_logs').insert({
    company_id: created.id,
    recipient_email: admin.email,
    subject: 'Invitación a Invoxa',
    type: 'invitation',
    status: 'sent',
    provider_response: { user_id: inviteData.user?.id ?? null },
  })

  return jsonResponse(
    {
      success: true,
      company_id: created.id,
      admin_user_id: inviteData.user?.id ?? null,
    },
    200,
  )
})
