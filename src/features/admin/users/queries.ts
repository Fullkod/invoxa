import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../../lib/supabase/client'
import { extractFunctionError } from '../../../lib/supabase/functionError'
import type { Profile, UserRole, UserStatus } from '../../../types/profile'

const USERS_KEY = ['users'] as const

export function useUsers() {
  return useQuery<Profile[]>({
    queryKey: USERS_KEY,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        // RLS lets everyone read their own row: hide the super admin.
        .neq('role', 'super_admin')
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as Profile[]
    },
  })
}

export function useUser(id: string | undefined) {
  return useQuery<Profile | null>({
    queryKey: ['users', id],
    enabled: Boolean(id),
    queryFn: async () => {
      if (!id) return null
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', id)
        .single()
      if (error) throw error
      return data as Profile
    },
  })
}

export function useUpdateUserStatus() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      id,
      status,
    }: {
      id: string
      status: UserStatus
    }) => {
      const { error } = await supabase
        .from('profiles')
        .update({ status })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: USERS_KEY })
    },
  })
}

export function useUpdateUserRole() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, role }: { id: string; role: UserRole }) => {
      const { error } = await supabase
        .from('profiles')
        .update({ role })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: USERS_KEY })
    },
  })
}

type DeleteUserResponse = {
  success: boolean
  user_id: string
}

// Permanently deletes a user via the `delete-user` Edge Function. The function
// verifies the caller is admin and blocks deletion when the user has financial
// records (invoices, invoice requests, number-change history) to preserve
// accounting traceability — those errors surface as the thrown message.
export function useDeleteUser() {
  const qc = useQueryClient()
  return useMutation<DeleteUserResponse, Error, string>({
    mutationFn: async (id) => {
      const { data, error } =
        await supabase.functions.invoke<DeleteUserResponse>('delete-user', {
          body: { id },
        })

      if (error) {
        throw new Error(await extractFunctionError(error))
      }
      if (!data) throw new Error('Sin respuesta del servidor')
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: USERS_KEY })
      qc.invalidateQueries({ queryKey: ['projects'] })
      qc.invalidateQueries({ queryKey: ['project-members'] })
    },
  })
}
