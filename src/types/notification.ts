export type NotificationType =
  | 'invoice_request_created'
  | 'invoice_request_completed'
  | 'invoice_request_expired'
  | 'invoice_created'
  | 'invoice_status_changed'
  | 'invoice_number_change_requested'
  | 'invoice_number_change_resolved'
  // PRP-003 task review
  | 'task_review_requested'
  | 'task_reviewed'
  | 'task_proposal_answered'

export type NotificationResourceTable =
  | 'invoices'
  | 'invoice_requests'
  | 'invoice_number_change_requests'
  /** The member's own task (/app/tasks/:id). */
  | 'tasks'
  /** A task in the reviewer's inbox. */
  | 'task_review'

export type AppNotification = {
  id: string
  user_id: string
  type: NotificationType
  title: string
  body: string | null
  resource_table: NotificationResourceTable | null
  resource_id: string | null
  metadata: Record<string, unknown>
  read_at: string | null
  created_at: string
}
