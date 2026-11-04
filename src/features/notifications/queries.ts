import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase/client'
import type { AppNotification } from '../../types/notification'
import { useAuth } from '../auth/useAuth'

const NOTIFICATIONS_KEY = (userId: string | undefined) =>
  ['notifications', userId] as const

export function useNotifications(limit = 50) {
  const { session } = useAuth()
  const userId = session?.user.id

  return useQuery<AppNotification[]>({
    queryKey: NOTIFICATIONS_KEY(userId),
    enabled: Boolean(userId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit)
      if (error) throw error
      return (data ?? []) as AppNotification[]
    },
  })
}

export function useUnreadNotificationsCount() {
  const { data } = useNotifications()
  return (data ?? []).filter((n) => !n.read_at).length
}

export function useMarkNotificationRead() {
  const qc = useQueryClient()
  const { session } = useAuth()
  const userId = session?.user.id

  return useMutation<void, Error, string>({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('notifications')
        .update({ read_at: new Date().toISOString() })
        .eq('id', id)
        .is('read_at', null)
      if (error) throw error
    },
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: NOTIFICATIONS_KEY(userId) })
      const prev = qc.getQueryData<AppNotification[]>(NOTIFICATIONS_KEY(userId))
      if (prev) {
        qc.setQueryData<AppNotification[]>(
          NOTIFICATIONS_KEY(userId),
          prev.map((n) =>
            n.id === id && !n.read_at
              ? { ...n, read_at: new Date().toISOString() }
              : n,
          ),
        )
      }
      return { prev }
    },
    onError: (_err, _id, ctx) => {
      const prev = (ctx as { prev?: AppNotification[] } | undefined)?.prev
      if (prev) qc.setQueryData(NOTIFICATIONS_KEY(userId), prev)
    },
  })
}

export function useMarkAllNotificationsRead() {
  const qc = useQueryClient()
  const { session } = useAuth()
  const userId = session?.user.id

  return useMutation<void, Error, void>({
    mutationFn: async () => {
      if (!userId) return
      const { error } = await supabase
        .from('notifications')
        .update({ read_at: new Date().toISOString() })
        .eq('user_id', userId)
        .is('read_at', null)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: NOTIFICATIONS_KEY(userId) })
    },
  })
}
