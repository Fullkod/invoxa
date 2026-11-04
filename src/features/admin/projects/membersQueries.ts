import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../../lib/supabase/client'
import type {
  Assignment,
  AssignmentInput,
  Compensation,
  CompensationInput,
  ProjectMember,
  UserAssignment,
} from '../../../types/assignment'
import type { Profile } from '../../../types/profile'
import type { Project } from '../../../types/project'

const projectMembersKey = (projectId: string) =>
  ['projects', projectId, 'members'] as const

const userAssignmentsKey = (userId: string) =>
  ['users', userId, 'assignments'] as const

export function useProjectMembers(projectId: string | undefined) {
  return useQuery<ProjectMember[]>({
    queryKey: projectId ? projectMembersKey(projectId) : ['_'],
    enabled: Boolean(projectId),
    queryFn: async () => {
      if (!projectId) return []

      const [{ data: assignments, error: aErr }, { data: comps, error: cErr }] =
        await Promise.all([
          supabase
            .from('user_project_assignments')
            .select(
              'id, user_id, project_id, is_current, start_date, end_date, created_at, updated_at, user:profiles(id, full_name, email, user_code, status)',
            )
            .eq('project_id', projectId)
            .order('created_at', { ascending: false }),
          supabase
            .from('compensation_settings')
            .select('*')
            .eq('project_id', projectId)
            .eq('is_active', true),
        ])

      if (aErr) throw aErr
      if (cErr) throw cErr

      const compsByUserId = new Map<string, Compensation>()
      for (const c of (comps ?? []) as Compensation[]) {
        compsByUserId.set(c.user_id, c)
      }

      return ((assignments ?? []) as unknown as (Assignment & {
        user: ProjectMember['user']
      })[]).map((row) => {
        const { user, ...assignment } = row
        return {
          assignment,
          user,
          compensation: compsByUserId.get(assignment.user_id) ?? null,
        }
      })
    },
  })
}

export function useUserAssignments(userId: string | undefined) {
  return useQuery<UserAssignment[]>({
    queryKey: userId ? userAssignmentsKey(userId) : ['_'],
    enabled: Boolean(userId),
    queryFn: async () => {
      if (!userId) return []

      const [{ data: assignments, error: aErr }, { data: comps, error: cErr }] =
        await Promise.all([
          supabase
            .from('user_project_assignments')
            .select(
              'id, user_id, project_id, is_current, start_date, end_date, created_at, updated_at, project:projects(*)',
            )
            .eq('user_id', userId)
            .order('created_at', { ascending: false }),
          supabase
            .from('compensation_settings')
            .select('*')
            .eq('user_id', userId)
            .eq('is_active', true),
        ])

      if (aErr) throw aErr
      if (cErr) throw cErr

      const compsByProjectId = new Map<string, Compensation>()
      for (const c of (comps ?? []) as Compensation[]) {
        compsByProjectId.set(c.project_id, c)
      }

      return ((assignments ?? []) as unknown as (Assignment & {
        project: Project
      })[]).map((row) => {
        const { project, ...assignment } = row
        return {
          assignment,
          project,
          compensation: compsByProjectId.get(assignment.project_id) ?? null,
        }
      })
    },
  })
}

export function useAvailableUsers(projectId: string | undefined) {
  return useQuery<Profile[]>({
    queryKey: ['projects', projectId, 'available-users'],
    enabled: Boolean(projectId),
    queryFn: async () => {
      if (!projectId) return []

      const { data: existing, error: eErr } = await supabase
        .from('user_project_assignments')
        .select('user_id')
        .eq('project_id', projectId)
        .eq('is_current', true)

      if (eErr) throw eErr

      const existingIds = new Set((existing ?? []).map((e) => e.user_id))

      const { data: profiles, error: pErr } = await supabase
        .from('profiles')
        .select('*')
        .neq('status', 'inactive')
        .neq('role', 'super_admin')
        .order('full_name', { nullsFirst: false })

      if (pErr) throw pErr

      return ((profiles ?? []) as Profile[]).filter(
        (p) => !existingIds.has(p.id),
      )
    },
  })
}

export function useAssignment(
  projectId: string | undefined,
  userId: string | undefined,
) {
  return useQuery<{
    assignment: Assignment
    compensation: Compensation | null
    user: Profile
  } | null>({
    queryKey: ['projects', projectId, 'members', userId],
    enabled: Boolean(projectId && userId),
    queryFn: async () => {
      if (!projectId || !userId) return null

      const [{ data: assignment, error: aErr }, { data: comp, error: cErr }, { data: user, error: uErr }] =
        await Promise.all([
          supabase
            .from('user_project_assignments')
            .select('*')
            .eq('project_id', projectId)
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle(),
          supabase
            .from('compensation_settings')
            .select('*')
            .eq('project_id', projectId)
            .eq('user_id', userId)
            .eq('is_active', true)
            .maybeSingle(),
          supabase.from('profiles').select('*').eq('id', userId).single(),
        ])

      if (aErr) throw aErr
      if (cErr) throw cErr
      if (uErr) throw uErr

      if (!assignment) return null

      return {
        assignment: assignment as Assignment,
        compensation: (comp ?? null) as Compensation | null,
        user: user as Profile,
      }
    },
  })
}

export function useAddMember(projectId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: AssignmentInput) => {
      const { error: aErr } = await supabase
        .from('user_project_assignments')
        .insert({
          user_id: input.user_id,
          project_id: input.project_id,
          start_date: input.start_date,
          is_current: true,
        })
      if (aErr) throw aErr

      const { error: cErr } = await supabase.from('compensation_settings').insert({
        user_id: input.user_id,
        project_id: input.project_id,
        payment_type: input.payment_type,
        hourly_rate:
          input.payment_type === 'hourly' ? (input.hourly_rate ?? 0) : null,
        monthly_rate:
          input.payment_type === 'fixed' ? (input.monthly_rate ?? 0) : null,
        currency: input.currency,
        is_active: true,
      })
      if (cErr) throw cErr
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: projectMembersKey(projectId) })
      qc.invalidateQueries({ queryKey: ['projects'] })
      qc.invalidateQueries({
        queryKey: ['projects', projectId, 'available-users'],
      })
    },
  })
}

export function useUpdateCompensation(projectId: string, userId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: CompensationInput) => {
      // Single active row guaranteed by partial unique index. Update it.
      const { error } = await supabase
        .from('compensation_settings')
        .update({
          payment_type: input.payment_type,
          hourly_rate:
            input.payment_type === 'hourly' ? (input.hourly_rate ?? 0) : null,
          monthly_rate:
            input.payment_type === 'fixed' ? (input.monthly_rate ?? 0) : null,
          currency: input.currency,
        })
        .eq('user_id', userId)
        .eq('project_id', projectId)
        .eq('is_active', true)

      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: projectMembersKey(projectId) })
      qc.invalidateQueries({ queryKey: userAssignmentsKey(userId) })
      qc.invalidateQueries({
        queryKey: ['projects', projectId, 'members', userId],
      })
    },
  })
}

export function useEndAssignment(projectId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      userId,
      assignmentId,
    }: {
      userId: string
      assignmentId: string
    }) => {
      const today = new Date().toISOString().slice(0, 10)

      const { error: aErr } = await supabase
        .from('user_project_assignments')
        .update({ is_current: false, end_date: today })
        .eq('id', assignmentId)
      if (aErr) throw aErr

      const { error: cErr } = await supabase
        .from('compensation_settings')
        .update({ is_active: false })
        .eq('user_id', userId)
        .eq('project_id', projectId)
        .eq('is_active', true)
      if (cErr) throw cErr
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: projectMembersKey(projectId) })
      qc.invalidateQueries({
        queryKey: ['projects', projectId, 'available-users'],
      })
    },
  })
}
