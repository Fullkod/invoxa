import { z } from 'zod'

const optionalText = (max: number) =>
  z.string().trim().max(max, `Máximo ${max} caracteres`).optional()

export const companySchema = z.object({
  name: z.string().trim().min(2, 'Mínimo 2 caracteres').max(120, 'Máximo 120 caracteres'),
  legal_name: z
    .string()
    .trim()
    .min(2, 'Mínimo 2 caracteres')
    .max(200, 'Máximo 200 caracteres'),
  tax_id: z.string().trim().min(2, 'Obligatorio').max(40, 'Máximo 40 caracteres'),
  address_line: optionalText(200),
  postal_code: optionalText(20),
  city: optionalText(120),
  region: optionalText(120),
  country: z.string().trim().min(2, 'Obligatorio').max(80, 'Máximo 80 caracteres'),
  billing_email: z
    .string()
    .trim()
    .email('Email no válido')
    .optional()
    .or(z.literal('')),
  invoice_prefix: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9]{1,8}$/, 'De 1 a 8 mayúsculas o números'),
  default_currency: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{3}$/, 'Código de 3 letras (USD, EUR…)'),
})

export type CompanyFormValues = z.infer<typeof companySchema>

export const newCompanySchema = companySchema.extend({
  admin_full_name: z
    .string()
    .trim()
    .min(2, 'Mínimo 2 caracteres')
    .max(120, 'Máximo 120 caracteres'),
  admin_email: z.string().trim().email('Email no válido'),
  admin_user_code: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9]{0,8}$/, 'Hasta 8 mayúsculas o números')
    .optional(),
})

export type NewCompanyFormValues = z.infer<typeof newCompanySchema>

/** Form values → columns (empty optional text becomes null). */
export function toCompanyInput(v: CompanyFormValues) {
  const orNull = (s: string | undefined) => (s && s.trim() ? s.trim() : null)
  return {
    name: v.name,
    legal_name: v.legal_name,
    tax_id: v.tax_id,
    address_line: orNull(v.address_line),
    postal_code: orNull(v.postal_code),
    city: orNull(v.city),
    region: orNull(v.region),
    country: v.country,
    billing_email: orNull(v.billing_email),
    invoice_prefix: v.invoice_prefix,
    default_currency: v.default_currency,
  }
}
