import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../../lib/supabase/client'
import type {
  Project,
  ProjectInput,
  ProjectWithStats,
} from '../../../types/project'

const PROJECTS_KEY = ['projects'] as const

export function useProjects() {
  return useQuery<ProjectWithStats[]>({
    queryKey: PROJECTS_KEY,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('projects')
        .select('*, user_project_assignments(count)')
        .order('created_at', { ascending: false })

      if (error) throw error

      return (data ?? []).map((row) => {
        const counts = (row.user_project_assignments ??
          []) as { count: number }[]
        const member_count = counts.length > 0 ? counts[0].count : 0
        const { user_project_assignments: _ignored, ...rest } = row
        return { ...(rest as Project), member_count }
      })
    },
  })
}

export function useProject(id: string | undefined) {
  return useQuery<Project | null>({
    queryKey: ['projects', id],
    enabled: Boolean(id),
    queryFn: async () => {
      if (!id) return null
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .eq('id', id)
        .single()
      if (error) throw error
      return data as Project
    },
  })
}

export function useCreateProject() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: ProjectInput) => {
      const { data, error } = await supabase
        .from('projects')
        .insert({
          name: input.name,
          description: input.description ?? null,
          status: input.status,
          requires_approval: input.requires_approval ?? false,
        })
        .select()
        .single()
      if (error) throw error
      return data as Project
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: PROJECTS_KEY })
    },
  })
}

export function useUpdateProject(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: ProjectInput) => {
      const { data, error } = await supabase
        .from('projects')
        .update({
          name: input.name,
          description: input.description ?? null,
          status: input.status,
          ...(input.requires_approval !== undefined && {
            requires_approval: input.requires_approval,
          }),
        })
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return data as Project
    },
    onSuccess: (project) => {
      qc.invalidateQueries({ queryKey: PROJECTS_KEY })
      qc.setQueryData(['projects', id], project)
    },
  })
}

export function useToggleProjectStatus() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      id,
      next,
    }: {
      id: string
      next: 'active' | 'inactive'
    }) => {
      const { error } = await supabase
        .from('projects')
        .update({ status: next })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: PROJECTS_KEY })
    },
  })
}
