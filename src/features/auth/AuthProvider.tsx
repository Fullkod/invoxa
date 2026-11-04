import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { queryClient } from '../../app/providers/queryClient'
import { hideNativeSplash } from '../../lib/native/bootstrap'
import { supabase } from '../../lib/supabase/client'
import { AuthContext, type AuthContextValue } from './useAuth'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return
      setSession(data.session)
      setLoading(false)
      // On Capacitor, dismiss the native splash now that we know whether to
      // route to login/landing/dashboard — avoids the splash → "Cargando…"
      // flash. No-op on web.
      void hideNativeSplash()
    })

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, nextSession) => {
        setSession(nextSession)
      },
    )

    return () => {
      mounted = false
      listener.subscription.unsubscribe()
    }
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      loading,
      signOut: async () => {
        await supabase.auth.signOut()
        // Drop in-memory cache and the localStorage-persisted snapshot so
        // the next user doesn't see the previous user's data.
        queryClient.clear()
        try {
          window.localStorage.removeItem('invoxa-query-cache')
        } catch {
          /* storage disabled — ignore */
        }
      },
    }),
    [session, loading],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
