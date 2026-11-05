import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../../lib/supabase/client'
import type { Profile } from '../../../types/profile'
import type { ProjectSupervision } from '../../../types/supervision'

const supervisionsKey = (projectId: string) =>
  ['projects', projectId, 'supervisions'] as const

export function useProjectSupervisions(projectId: string | undefined) {
  return useQuery<ProjectSupervision[]>({
    queryKey: projectId ? supervisionsKey(projectId) : ['_'],
    enabled: Boolean(projectId),
    queryFn: async () => {
      if (!projectId) return []
      const { data, error } = await supabase
        .from('project_supervisions')
        .select(
          'id, project_id, supervisor_id, member_id, created_at, supervisor:profiles!project_supervisions_supervisor_id_fkey(id, full_name, email), member:profiles!project_supervisions_member_id_fkey(id, full_name, email)',
        )
        .eq('project_id', projectId)
        .order('created_at', { ascending: true })
      if (error) throw error
      return (data ?? []) as unknown as ProjectSupervision[]
    },
  })
}

/** People of the admin's company who can be supervisors (RLS scopes it). */
export function useCompanyPeople() {
  return useQuery<Pick<Profile, 'id' | 'full_name' | 'email' | 'role'>[]>({
    queryKey: ['users', 'people'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, email, role')
        .neq('status', 'inactive')
        .neq('role', 'super_admin')
        .order('full_name', { nullsFirst: false })
      if (error) throw error
      return (data ?? []) as Pick<Profile, 'id' | 'full_name' | 'email' | 'role'>[]
    },
  })
}

export function useAddSupervisions(projectId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      supervisorId,
      memberIds,
    }: {
      supervisorId: string
      memberIds: string[]
    }) => {
      const { error } = await supabase.from('project_supervisions').insert(
        memberIds.map((memberId) => ({
          project_id: projectId,
          supervisor_id: supervisorId,
          member_id: memberId,
        })),
      )
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: supervisionsKey(projectId) })
    },
  })
}

export function useRemoveSupervision(projectId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('project_supervisions')
        .delete()
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: supervisionsKey(projectId) })
    },
  })
}
