import { App as CapacitorApp } from '@capacitor/app'
import type { PluginListenerHandle } from '@capacitor/core'
import { useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { isNative } from '../../lib/native/platform'
import { supabase } from '../../lib/supabase/client'
import type { AppNotification } from '../../types/notification'
import { useAuth } from '../auth/useAuth'

/**
 * Suscribe el cliente al canal de Realtime de la tabla `notifications`
 * filtrado por `user_id = auth.uid()`. Cuando llega un evento, parchea la
 * cache de TanStack Query para que la campana y el listado se refresquen
 * en vivo sin tener que hacer un refetch contra la base.
 *
 * Pensado para colocarse una vez en el AppShell (un solo canal por sesión).
 *
 * En Capacitor, cierra el WebSocket cuando la app va a background y lo
 * reabre al volver a foreground — mantenerlo abierto drena batería y, en
 * iOS, suele cortarse igual.
 */
export function useNotificationsRealtime() {
  const qc = useQueryClient()
  const { session } = useAuth()
  const userId = session?.user.id

  useEffect(() => {
    if (!userId) return

    const queryKey = ['notifications', userId] as const
    type Channel = ReturnType<typeof supabase.channel>
    let channel: Channel | null = null

    const subscribe = () => {
      if (channel) return
      channel = supabase
        .channel(`notifications:${userId}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${userId}`,
          },
          (payload) => {
            const newRow = payload.new as AppNotification
            qc.setQueryData<AppNotification[]>(queryKey, (prev) => {
              if (!prev) return [newRow]
              if (prev.some((n) => n.id === newRow.id)) return prev
              return [newRow, ...prev]
            })
          },
        )
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${userId}`,
          },
          (payload) => {
            const updated = payload.new as AppNotification
            qc.setQueryData<AppNotification[]>(queryKey, (prev) =>
              prev
                ? prev.map((n) => (n.id === updated.id ? updated : n))
                : prev,
            )
          },
        )
        .on(
          'postgres_changes',
          {
            event: 'DELETE',
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${userId}`,
          },
          (payload) => {
            const deletedId = (payload.old as { id?: string }).id
            if (!deletedId) return
            qc.setQueryData<AppNotification[]>(queryKey, (prev) =>
              prev ? prev.filter((n) => n.id !== deletedId) : prev,
            )
          },
        )
        .subscribe()
    }

    const unsubscribe = () => {
      if (!channel) return
      void supabase.removeChannel(channel)
      channel = null
    }

    subscribe()

    let listenerHandle: PluginListenerHandle | undefined
    if (isNative()) {
      void CapacitorApp.addListener('appStateChange', ({ isActive }) => {
        if (isActive) subscribe()
        else unsubscribe()
      }).then((handle) => {
        listenerHandle = handle
      })
    }

    return () => {
      unsubscribe()
      if (listenerHandle) void listenerHandle.remove()
    }
  }, [userId, qc])
}
