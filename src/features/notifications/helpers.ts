import type { AppNotification } from '../../types/notification'
import type { UserRole } from '../../types/profile'

/**
 * Devuelve la ruta interna a la que debe llevar el clic en una notificación.
 * Las rutas dependen del rol porque admin y usuario tienen layouts distintos
 * para el mismo recurso (por ejemplo `/admin/invoices/:id` vs
 * `/app/invoices/:id`).
 */
export function getNotificationHref(
  notification: AppNotification,
  role: UserRole,
): string | null {
  const isAdmin = role === 'admin'
  const { resource_table, resource_id } = notification
  if (!resource_id || !resource_table) return null

  switch (resource_table) {
    case 'invoices':
      return isAdmin
        ? `/admin/invoices/${resource_id}`
        : `/app/invoices/${resource_id}`
    case 'invoice_requests':
      return isAdmin ? `/admin/invoice-requests` : `/app/invoices`
    case 'invoice_number_change_requests':
      return isAdmin
        ? `/admin/invoice-number-requests`
        : `/app/invoice-number-requests`
    case 'tasks':
      return `/app/tasks/${resource_id}`
    case 'task_review':
      return isAdmin ? '/admin/review' : '/app/review'
    default:
      return null
  }
}
