import type { Profile } from './profile'

/** PRP-003: review state of a task. */
export type ReviewStatus = 'pending' | 'approved' | 'changes_proposed'

export const REVIEW_STATUS_LABEL: Record<ReviewStatus, string> = {
  pending: 'Pendiente de revisión',
  approved: 'Aprobada',
  changes_proposed: 'Cambio propuesto',
}

export type ProjectSupervision = {
  id: string
  project_id: string
  supervisor_id: string
  member_id: string
  created_at: string
  supervisor: Pick<Profile, 'id' | 'full_name' | 'email'> | null
  member: Pick<Profile, 'id' | 'full_name' | 'email'> | null
}

/**
 * Row returned by the `list_review_tasks` RPC. Deliberately has no money:
 * reviewers never see rates, invoices or billing data.
 */
export type ReviewTask = {
  id: string
  project_id: string
  project_name: string
  member_id: string
  member_name: string
  task_date: string
  hours: number
  name: string
  description: string | null
  observations: string | null
  review_status: ReviewStatus
  proposed_hours: number | null
  review_comment: string | null
  response_comment: string | null
  reviewed_by_name: string | null
  reviewed_at: string | null
  billed: boolean
  created_at: string
}

export type ReviewAction = 'approve' | 'propose' | 'set'
