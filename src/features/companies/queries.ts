import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase/client'
import { extractFunctionError } from '../../lib/supabase/functionError'
import type { Company } from '../../types/company'
import { workingCompanyId } from '../auth/roles'
import { useProfile } from '../auth/useProfile'

const COMPANIES_KEY = ['companies'] as const

/** Company the signed-in user is working in (own, or super admin's active one). */
export function useCurrentCompany() {
  const { data: profile } = useProfile()
  const companyId = profile ? workingCompanyId(profile) : null

  return useQuery<Company | null>({
    queryKey: ['companies', 'current', companyId],
    enabled: Boolean(companyId),
    queryFn: async () => {
      if (!companyId) return null
      const { data, error } = await supabase
        .from('companies')
        .select('*')
        .eq('id', companyId)
        .single()
      if (error) throw error
      return data as Company
    },
  })
}

/** All companies (RLS: only the super admin sees more than their own). */
export function useCompanies() {
  return useQuery<Company[]>({
    queryKey: COMPANIES_KEY,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('companies')
        .select('*')
        .order('name', { ascending: true })
      if (error) throw error
      return (data ?? []) as Company[]
    },
  })
}

export function useCompany(id: string | undefined) {
  return useQuery<Company | null>({
    queryKey: ['companies', 'detail', id],
    enabled: Boolean(id),
    queryFn: async () => {
      if (!id) return null
      const { data, error } = await supabase
        .from('companies')
        .select('*')
        .eq('id', id)
        .single()
      if (error) throw error
      return data as Company
    },
  })
}

export type CompanyInput = Pick<
  Company,
  | 'name'
  | 'legal_name'
  | 'tax_id'
  | 'address_line'
  | 'postal_code'
  | 'city'
  | 'region'
  | 'country'
  | 'billing_email'
  | 'invoice_prefix'
  | 'default_currency'
>

export type CreateCompanyInput = {
  company: CompanyInput
  admin: { email: string; full_name: string; user_code?: string }
}

type CreateCompanyResponse = {
  success: boolean
  company_id: string
  admin_user_id: string | null
}

export function useCreateCompany() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: CreateCompanyInput) => {
      // The Edge Function expects optional text to be absent, not null.
      const company = Object.fromEntries(
        Object.entries(input.company).filter(([, v]) => v !== null && v !== ''),
      )
      const { data, error } = await supabase.functions.invoke<CreateCompanyResponse>(
        'create-company',
        { body: { company, admin: input.admin } },
      )
      if (error) throw new Error(await extractFunctionError(error))
      if (!data) throw new Error('Sin respuesta del servidor')
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: COMPANIES_KEY })
    },
  })
}

export function useUpdateCompany(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (
      patch: Partial<CompanyInput> & { status?: Company['status'] },
    ) => {
      const { data, error } = await supabase
        .from('companies')
        .update(patch)
        .eq('id', id)
        .select('*')
        .single()
      if (error) throw error
      return data as Company
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: COMPANIES_KEY })
    },
  })
}

/**
 * Super admin: choose the company to operate in (null = none). Every cached
 * query belongs to the previous company, so the whole cache is dropped.
 */
export function useSetActiveCompany() {
  const qc = useQueryClient()
  const { data: profile } = useProfile()
  return useMutation({
    mutationFn: async (companyId: string | null) => {
      if (!profile) throw new Error('Sin perfil')
      const { error } = await supabase
        .from('profiles')
        .update({ active_company_id: companyId })
        .eq('id', profile.id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.clear()
      try {
        window.localStorage.removeItem('invoxa-query-cache')
      } catch {
        /* storage disabled — ignore */
      }
    },
  })
}
