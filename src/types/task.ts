import type { Project } from './project'
import type { ReviewStatus } from './supervision'

/** 'api' = created through agent-api with a personal key (PRP-002). */
export type TaskSource = 'app' | 'api'

export type Task = {
  id: string
  source?: TaskSource
  user_id: string
  project_id: string
  invoice_id: string | null
  name: string
  description: string | null
  task_date: string
  hours: number
  observations: string | null
  /** PRP-003 review state; only the review RPCs change it. */
  review_status?: ReviewStatus
  proposed_hours?: number | null
  review_comment?: string | null
  response_comment?: string | null
  reviewed_at?: string | null
  created_at: string
  updated_at: string
}

export type TaskWithProject = Task & {
  project: Pick<Project, 'id' | 'name'>
}

export type TaskInput = {
  project_id: string
  name: string
  description: string | null
  task_date: string
  hours: number
  observations: string | null
}

export function isTaskBilled(task: Pick<Task, 'invoice_id'>): boolean {
  return task.invoice_id != null
}
