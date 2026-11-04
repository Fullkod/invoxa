export type CompanyStatus = 'active' | 'inactive'

export type Company = {
  id: string
  name: string
  legal_name: string
  tax_id: string
  address_line: string | null
  postal_code: string | null
  city: string | null
  region: string | null
  country: string
  billing_email: string | null
  invoice_prefix: string
  default_currency: string
  logo_path: string | null
  status: CompanyStatus
  created_at: string
  updated_at: string
}
