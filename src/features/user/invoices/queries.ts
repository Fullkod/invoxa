import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../../lib/supabase/client'
import { extractFunctionError } from '../../../lib/supabase/functionError'
import { isBillingProfileComplete } from '../../../types/billingProfile'
import type {
  Invoice,
  InvoicePreview,
  InvoicePreviewItem,
  InvoiceWithItems,
} from '../../../types/invoice'

export function useMyInvoices() {
  return useQuery<Invoice[]>({
    queryKey: ['my-invoices'],
    queryFn: async () => {
      const { data: userResult } = await supabase.auth.getUser()
      const userId = userResult?.user?.id
      if (!userId) return []

      const { data, error } = await supabase
        .from('invoices')
        .select('*')
        .eq('user_id', userId)
        .order('invoice_date', { ascending: false })
        .order('user_invoice_sequence', { ascending: false })

      if (error) throw error
      return (data ?? []) as Invoice[]
    },
  })
}

export function useInvoice(id: string | undefined) {
  return useQuery<InvoiceWithItems | null>({
    queryKey: ['invoice', id],
    enabled: Boolean(id),
    queryFn: async () => {
      if (!id) return null
      const { data, error } = await supabase
        .from('invoices')
        .select('*, items:invoice_items(*, project:projects(id, name))')
        .eq('id', id)
        .single()
      if (error) throw error
      return data as InvoiceWithItems
    },
  })
}

/**
 * Computes a client-side preview of what would be invoiced for the given
 * period. Mirrors the logic of `generate_user_invoice` SQL function:
 *   - Active assignments only
 *   - Hourly: sum of unbilled task hours × hourly_rate (skip if 0 hours)
 *   - Fixed:  monthly_rate
 *   - Currencies must match
 *   - Billing profile must be complete
 *   - No existing non-cancelled invoice for the period
 *
 * Returns blockers as an array of human-readable reasons; if non-empty,
 * generation will fail.
 */
export function useInvoicePreview({
  periodStart,
  periodEnd,
}: {
  periodStart: string
  periodEnd: string
}) {
  return useQuery<InvoicePreview>({
    queryKey: ['invoice-preview', periodStart, periodEnd],
    queryFn: async () => {
      const blockers: string[] = []
      const items: InvoicePreviewItem[] = []

      const { data: userResult } = await supabase.auth.getUser()
      const userId = userResult?.user?.id
      if (!userId) {
        return {
          items: [],
          subtotal: 0,
          currency: null,
          ready: false,
          blockers: ['No autenticado'],
        }
      }

      // Billing profile complete?
      const { data: billingProfile } = await supabase
        .from('user_billing_profiles')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle()
      if (!isBillingProfileComplete(billingProfile)) {
        blockers.push('Completa tus datos de facturación')
      }

      // Existing non-cancelled invoice?
      const { data: existing } = await supabase
        .from('invoices')
        .select('id, status')
        .eq('user_id', userId)
        .eq('period_start', periodStart)
        .eq('period_end', periodEnd)
        .neq('status', 'cancelled')
        .maybeSingle()
      if (existing) {
        blockers.push('Ya existe una factura para este periodo')
      }

      // PRP-003: projects that require approval block the month while any
      // task of the period is not approved (same rule as generate_user_invoice).
      const { data: unapproved } = await supabase
        .from('tasks')
        .select('id, project:projects!inner(name, requires_approval)')
        .eq('user_id', userId)
        .gte('task_date', periodStart)
        .lte('task_date', periodEnd)
        .is('invoice_id', null)
        .neq('review_status', 'approved')
        .eq('project.requires_approval', true)
      const unapprovedRows = (unapproved ?? []) as unknown as {
        id: string
        project: { name: string } | null
      }[]
      if (unapprovedRows.length > 0) {
        const names = [...new Set(unapprovedRows.map((t) => t.project?.name).filter(Boolean))]
        blockers.push(
          `Tienes ${unapprovedRows.length} ${
            unapprovedRows.length === 1 ? 'tarea sin aprobar' : 'tareas sin aprobar'
          } en ${names.join(', ')}. Tu responsable debe revisarlas (o responde a sus propuestas) antes de cerrar el mes.`,
        )
      }

      // Two separate queries: there's no single foreign key between
      // compensation_settings and user_project_assignments (they share
      // user_id + project_id only), so Postgrest can't resolve the embed.
      // Fetch each list and intersect in JS by project_id.
      const [{ data: compsRaw }, { data: assignmentsRaw }] = await Promise.all([
        supabase
          .from('compensation_settings')
          .select(
            'project_id, payment_type, hourly_rate, monthly_rate, currency, project:projects(id, name)',
          )
          .eq('user_id', userId)
          .eq('is_active', true),
        supabase
          .from('user_project_assignments')
          .select('project_id')
          .eq('user_id', userId)
          .eq('is_current', true),
      ])

      const currentProjectIds = new Set(
        ((assignmentsRaw ?? []) as { project_id: string }[]).map(
          (a) => a.project_id,
        ),
      )

      const comps = (
        (compsRaw ?? []) as unknown as {
          project_id: string
          payment_type: 'hourly' | 'fixed'
          hourly_rate: number | null
          monthly_rate: number | null
          currency: string
          project: { id: string; name: string }
        }[]
      ).filter((c) => currentProjectIds.has(c.project_id))

      if (comps.length === 0) {
        blockers.push('No tienes proyectos activos')
        return {
          items: [],
          subtotal: 0,
          currency: null,
          ready: false,
          blockers,
        }
      }

      // Currency consistency
      const currencies = Array.from(new Set(comps.map((c) => c.currency)))
      if (currencies.length > 1) {
        blockers.push(
          `Tienes proyectos en monedas distintas (${currencies.join(', ')})`,
        )
      }
      const currency = currencies[0] ?? null

      // Tasks in period (unbilled)
      const { data: tasks } = await supabase
        .from('tasks')
        .select('project_id, hours')
        .eq('user_id', userId)
        .gte('task_date', periodStart)
        .lte('task_date', periodEnd)
        .is('invoice_id', null)

      const hoursByProject = new Map<string, { hours: number; count: number }>()
      for (const t of (tasks ?? []) as {
        project_id: string
        hours: number
      }[]) {
        const e = hoursByProject.get(t.project_id) ?? { hours: 0, count: 0 }
        e.hours += Number(t.hours)
        e.count += 1
        hoursByProject.set(t.project_id, e)
      }

      for (const c of comps) {
        if (c.payment_type === 'hourly') {
          const entry = hoursByProject.get(c.project_id)
          if (!entry || entry.hours <= 0) continue
          const rate = Number(c.hourly_rate ?? 0)
          items.push({
            project_id: c.project_id,
            project_name: c.project.name,
            payment_type: 'hourly',
            quantity: entry.hours,
            unit_price: rate,
            total: entry.hours * rate,
            task_count: entry.count,
          })
        } else {
          const rate = Number(c.monthly_rate ?? 0)
          items.push({
            project_id: c.project_id,
            project_name: c.project.name,
            payment_type: 'fixed',
            quantity: 1,
            unit_price: rate,
            total: rate,
          })
        }
      }

      const subtotal = items.reduce((sum, it) => sum + it.total, 0)

      if (items.length === 0) {
        blockers.push(
          'No hay horas registradas ni proyectos con tarifa fija para facturar',
        )
      }

      return {
        items,
        subtotal,
        currency,
        ready: blockers.length === 0,
        blockers,
      }
    },
  })
}

type GenerateResponse = {
  success: boolean
  invoice_id: string
  invoice_number: string
  total: number
  currency: string
}

type PdfResponse = {
  success: boolean
  pdf_path: string
}

async function invokePdfGeneration(invoiceId: string) {
  // Fire-and-forget-ish: errors are surfaced but the invoice itself is
  // already created. The detail page has a "Regenerar PDF" button as
  // recovery.
  return supabase.functions.invoke<PdfResponse>('generate-invoice-pdf', {
    body: { invoice_id: invoiceId },
  })
}

export function useGenerateInvoice() {
  const qc = useQueryClient()
  return useMutation<
    GenerateResponse,
    Error,
    { periodStart: string; periodEnd: string; notes?: string | null }
  >({
    mutationFn: async ({ periodStart, periodEnd, notes }) => {
      const { data, error } = await supabase.functions.invoke<GenerateResponse>(
        'generate-invoice',
        {
          body: {
            period_start: periodStart,
            period_end: periodEnd,
            notes: notes ?? null,
          },
        },
      )

      if (error) {
        throw new Error(await extractFunctionError(error))
      }
      if (!data) throw new Error('Sin respuesta del servidor')

      // Best-effort PDF generation; surface a warning but don't block the
      // happy path. The user can regenerate from the detail page.
      try {
        await invokePdfGeneration(data.invoice_id)
      } catch (e) {
        console.warn('PDF generation failed; can be retried from detail', e)
      }

      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['my-invoices'] })
      qc.invalidateQueries({ queryKey: ['my-tasks'] })
      qc.invalidateQueries({ queryKey: ['invoice-preview'] })
    },
  })
}

export function useGenerateInvoicePdf() {
  const qc = useQueryClient()
  return useMutation<PdfResponse, Error, string>({
    mutationFn: async (invoiceId) => {
      const { data, error } = await invokePdfGeneration(invoiceId)
      if (error) {
        const ctx = (error as unknown as { context?: { error?: string } })
          .context
        throw new Error(ctx?.error || error.message)
      }
      if (!data) throw new Error('Sin respuesta del servidor')
      return data
    },
    onSuccess: (_data, invoiceId) => {
      qc.invalidateQueries({ queryKey: ['invoice', invoiceId] })
      qc.invalidateQueries({ queryKey: ['my-invoices'] })
    },
  })
}

/**
 * Creates a short-lived signed URL for an invoice PDF stored in the
 * `invoices` private bucket. Returns null if the object hasn't been
 * generated yet.
 */
export async function getInvoicePdfSignedUrl(
  pdfPath: string,
  expiresInSeconds = 60,
): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from('invoices')
    .createSignedUrl(pdfPath, expiresInSeconds)
  if (error || !data) return null
  return data.signedUrl
}
