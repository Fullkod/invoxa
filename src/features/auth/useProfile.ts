import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase/client'
import type { Profile } from '../../types/profile'
import { useAuth } from './useAuth'

export function useProfile() {
  const { session } = useAuth()
  const userId = session?.user.id

  return useQuery<Profile | null>({
    queryKey: ['profile', userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      if (!userId) return null
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single()

      if (error) throw error
      return data as Profile
    },
  })
}
