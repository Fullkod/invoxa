import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { z } from 'zod'
import { supabase } from '../../../lib/supabase/client'

/**
 * Personal API keys for agents (PRP-002). The plain key only exists in the
 * response of create_api_key(); the table never exposes the hash to clients.
 */

export type ApiKey = {
  id: string
  name: string
  key_prefix: string
  last_used_at: string | null
  revoked_at: string | null
  created_at: string
}

export type CreatedApiKey = {
  id: string
  name: string
  key_prefix: string
  api_key: string
  created_at: string
}

export const apiKeyNameSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'Mínimo 2 caracteres')
    .max(80, 'Máximo 80 caracteres'),
})

export type ApiKeyNameValues = z.infer<typeof apiKeyNameSchema>

export const MAX_ACTIVE_KEYS = 5

const KEYS = ['my-api-keys'] as const

export const AGENT_API_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/agent-api`

export function useMyApiKeys() {
  return useQuery<ApiKey[]>({
    queryKey: KEYS,
    // last_used_at changes outside the app (agent calls): always refetch on open.
    staleTime: 0,
    refetchOnMount: 'always',
    queryFn: async () => {
      const { data: userResult } = await supabase.auth.getUser()
      const userId = userResult?.user?.id
      if (!userId) return []
      const { data, error } = await supabase
        .from('api_keys')
        .select('id, name, key_prefix, last_used_at, revoked_at, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as ApiKey[]
    },
  })
}

export function useCreateApiKey() {
  const qc = useQueryClient()
  return useMutation<CreatedApiKey, Error, string>({
    mutationFn: async (name) => {
      const { data, error } = await supabase.rpc('create_api_key', { p_name: name })
      if (error) throw new Error(error.message)
      const row = (Array.isArray(data) ? data[0] : data) as CreatedApiKey | undefined
      if (!row?.api_key) throw new Error('Sin respuesta del servidor')
      return row
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS })
    },
  })
}

export function useRevokeApiKey() {
  const qc = useQueryClient()
  return useMutation<void, Error, string>({
    mutationFn: async (id) => {
      const { error } = await supabase.rpc('revoke_api_key', { p_key_id: id })
      if (error) throw new Error(error.message)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS })
    },
  })
}
