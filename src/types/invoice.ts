import type { PaymentType } from './assignment'
import type { Project } from './project'

export type InvoiceStatus =
  | 'draft'
  | 'generated'
  | 'sent'
  | 'reviewed'
  | 'approved'
  | 'rejected'
  | 'paid'
  | 'cancelled'

/**
 * Allowed status transitions. Mirror of the SQL trigger
 * `check_invoice_status_transition` so the UI never offers a transition the
 * database would reject. Update both together.
 */
export const INVOICE_STATUS_TRANSITIONS: Record<
  InvoiceStatus,
  InvoiceStatus[]
> = {
  draft: ['generated', 'cancelled'],
  generated: ['sent', 'reviewed', 'approved', 'rejected', 'cancelled'],
  sent: ['reviewed', 'approved', 'rejected', 'cancelled'],
  reviewed: ['approved', 'rejected', 'cancelled'],
  approved: ['paid', 'cancelled'],
  rejected: ['generated', 'cancelled'],
  paid: [],
  cancelled: [],
}

export function canTransitionInvoiceStatus(
  from: InvoiceStatus,
  to: InvoiceStatus,
): boolean {
  if (from === to) return true
  return INVOICE_STATUS_TRANSITIONS[from].includes(to)
}

export function isInvoiceStatusTerminal(status: InvoiceStatus): boolean {
  return INVOICE_STATUS_TRANSITIONS[status].length === 0
}

export type Invoice = {
  id: string
  user_id: string
  invoice_number: string
  user_invoice_sequence: number
  invoice_year: number
  invoice_date: string
  period_start: string
  period_end: string
  currency: string
  subtotal: number
  tax_amount: number
  total: number
  status: InvoiceStatus
  notes: string | null
  pdf_url: string | null
  created_at: string
  updated_at: string
}

export type InvoiceItem = {
  id: string
  invoice_id: string
  project_id: string
  payment_type: PaymentType
  description: string
  quantity: number
  unit_price: number
  total: number
  created_at: string
  updated_at: string
}

export type InvoiceItemWithProject = InvoiceItem & {
  project: Pick<Project, 'id' | 'name'>
}

export type InvoiceWithItems = Invoice & {
  items: InvoiceItemWithProject[]
}

export type InvoiceWithUser = Invoice & {
  user: {
    id: string
    full_name: string | null
    email: string
    user_code: string | null
  }
}

export type InvoiceWithItemsAndUser = InvoiceWithItems & {
  user: {
    id: string
    full_name: string | null
    email: string
    user_code: string | null
  }
}

export type InvoicePreviewItem = {
  project_id: string
  project_name: string
  payment_type: PaymentType
  quantity: number
  unit_price: number
  total: number
  task_count?: number
}

export type InvoicePreview = {
  items: InvoicePreviewItem[]
  subtotal: number
  currency: string | null
  ready: boolean
  blockers: string[]
}
