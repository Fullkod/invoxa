import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase/client'
import type { ReviewAction, ReviewStatus, ReviewTask } from '../../types/supervision'
import type { Task } from '../../types/task'

// PRP-003. Reviewers never read `tasks` directly: everything goes through the
// SECURITY DEFINER RPCs, which return only non-monetary columns.

const REVIEW_KEY = 'review-tasks' as const

/** True when the signed-in user supervises someone in any project. */
export function useIsSupervisor(userId: string | undefined, enabled = true) {
  return useQuery<boolean>({
    queryKey: ['is-supervisor', userId],
    enabled: Boolean(userId) && enabled,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      if (!userId) return false
      const { count, error } = await supabase
        .from('project_supervisions')
        .select('id', { count: 'exact', head: true })
        .eq('supervisor_id', userId)
      if (error) throw error
      return (count ?? 0) > 0
    },
  })
}

export function useReviewTasks({
  periodStart,
  periodEnd,
  status,
}: {
  periodStart: string
  periodEnd: string
  status: ReviewStatus | 'all'
}) {
  return useQuery<ReviewTask[]>({
    queryKey: [REVIEW_KEY, periodStart, periodEnd, status],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('list_review_tasks', {
        p_project_id: null,
        p_status: status === 'all' ? null : status,
        p_from: periodStart,
        p_to: periodEnd,
      })
      if (error) throw error
      return ((data ?? []) as ReviewTask[]).map((t) => ({
        ...t,
        hours: Number(t.hours),
        proposed_hours: t.proposed_hours == null ? null : Number(t.proposed_hours),
      }))
    },
  })
}

export function useReviewTask() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: {
      taskId: string
      action: ReviewAction
      hours?: number
      comment?: string
    }) => {
      const { data, error } = await supabase.rpc('review_task', {
        p_task_id: input.taskId,
        p_action: input.action,
        p_hours: input.hours ?? null,
        p_comment: input.comment?.trim() || null,
      })
      if (error) throw error
      return data as ReviewStatus
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [REVIEW_KEY] })
    },
  })
}

export function useRespondToProposal() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { taskId: string; accept: boolean; comment?: string }) => {
      const { data, error } = await supabase.rpc('respond_to_task_proposal', {
        p_task_id: input.taskId,
        p_accept: input.accept,
        p_comment: input.comment?.trim() || null,
      })
      if (error) throw error
      return data as ReviewStatus
    },
    onSuccess: (_status, input) => {
      qc.invalidateQueries({ queryKey: ['my-tasks'] })
      qc.invalidateQueries({ queryKey: ['task', input.taskId] })
    },
  })
}

/** Project ids where the signed-in member has a supervisor (RLS: own rows). */
export function useMySupervisedProjectIds(userId: string | undefined) {
  // string[] (not Set): the query cache is persisted as JSON.
  return useQuery<string[]>({
    queryKey: ['my-supervised-projects', userId],
    enabled: Boolean(userId),
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      if (!userId) return []
      const { data, error } = await supabase
        .from('project_supervisions')
        .select('project_id')
        .eq('member_id', userId)
      if (error) throw error
      return [...new Set((data ?? []).map((r: { project_id: string }) => r.project_id))]
    },
  })
}

/** Review state is only worth showing when someone reviews this task. */
export function isReviewRelevant(
  task: Pick<Task, 'project_id' | 'review_status'>,
  supervised: string[] | undefined,
): boolean {
  return (task.review_status ?? 'pending') !== 'pending' || Boolean(supervised?.includes(task.project_id))
}
