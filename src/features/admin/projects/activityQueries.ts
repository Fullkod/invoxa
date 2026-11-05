import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../../lib/supabase/client'
import type { InvoiceWithUser } from '../../../types/invoice'
import type { TaskSource } from '../../../types/task'

/**
 * Tasks registered against a project within a period, plus the total
 * billable hours. Used in the project detail page so the admin can audit
 * effort per month.
 */

export type ProjectTaskWithUser = {
  id: string
  user_id: string
  project_id: string
  invoice_id: string | null
  name: string
  description: string | null
  task_date: string
  hours: number
  source?: TaskSource
  user: {
    id: string
    full_name: string | null
    email: string
  } | null
}

export type ProjectTasksData = {
  tasks: ProjectTaskWithUser[]
  totalHours: number
  uniqueUsers: number
}

export function useProjectTasks(
  projectId: string | undefined,
  periodStart: string,
  periodEnd: string,
) {
  return useQuery<ProjectTasksData>({
    queryKey: ['admin-project-tasks', projectId, periodStart, periodEnd],
    enabled: Boolean(projectId),
    queryFn: async () => {
      if (!projectId) return { tasks: [], totalHours: 0, uniqueUsers: 0 }
      const { data, error } = await supabase
        .from('tasks')
        .select(
          'id, user_id, project_id, invoice_id, name, description, task_date, hours, source, user:profiles(id, full_name, email)',
        )
        .eq('project_id', projectId)
        .gte('task_date', periodStart)
        .lte('task_date', periodEnd)
        .order('task_date', { ascending: false })

      if (error) throw error
      const tasks = (data ?? []) as unknown as ProjectTaskWithUser[]
      const totalHours = tasks.reduce((sum, t) => sum + Number(t.hours), 0)
      const uniqueUsers = new Set(tasks.map((t) => t.user_id)).size
      return { tasks, totalHours, uniqueUsers }
    },
  })
}

/**
 * Invoices that contain at least one item linked to this project. Distinct
 * by invoice_id since a single invoice could (in theory) include multiple
 * items per project.
 */
export function useProjectInvoices(projectId: string | undefined) {
  return useQuery<InvoiceWithUser[]>({
    queryKey: ['admin-project-invoices', projectId],
    enabled: Boolean(projectId),
    queryFn: async () => {
      if (!projectId) return []
      const { data, error } = await supabase
        .from('invoice_items')
        .select(
          'invoice:invoices(*, user:profiles(id, full_name, email, user_code))',
        )
        .eq('project_id', projectId)

      if (error) throw error

      const seen = new Set<string>()
      const invoices: InvoiceWithUser[] = []
      for (const row of (data ?? []) as unknown as {
        invoice: InvoiceWithUser | null
      }[]) {
        const inv = row.invoice
        if (!inv || seen.has(inv.id)) continue
        seen.add(inv.id)
        invoices.push(inv)
      }
      return invoices.sort(
        (a, b) =>
          new Date(b.invoice_date).getTime() -
          new Date(a.invoice_date).getTime(),
      )
    },
  })
}
