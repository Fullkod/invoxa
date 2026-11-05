export type ProjectStatus = 'active' | 'inactive'

export type Project = {
  id: string
  name: string
  description: string | null
  status: ProjectStatus
  /** PRP-003: only approved tasks are invoiced. */
  requires_approval?: boolean
  created_at: string
  updated_at: string
}

export type ProjectWithStats = Project & {
  member_count: number
}

export type ProjectInput = {
  name: string
  description?: string | null
  status: ProjectStatus
  requires_approval?: boolean
}
