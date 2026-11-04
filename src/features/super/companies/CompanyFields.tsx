import type { FieldError, UseFormRegisterReturn } from 'react-hook-form'
import { Field } from '../../../components/ui/Field'
import type { CompanyFormValues } from './companySchema'

type CompanyField = keyof CompanyFormValues

/** Company data inputs, shared by the create and edit pages. */
export function CompanyFields({
  field,
  errors,
  prefixLocked = false,
}: {
  field: (name: CompanyField) => UseFormRegisterReturn
  errors: Partial<Record<CompanyField, FieldError | undefined>>
  /** The invoice prefix is part of already issued numbers: lock it when editing. */
  prefixLocked?: boolean
}) {
  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Nombre comercial"
          placeholder="Ej. Informage Studios"
          error={errors.name?.message}
          {...field('name')}
        />
        <Field
          label="Razón social"
          placeholder="Ej. Informage Studios S.L.U."
          error={errors.legal_name?.message}
          {...field('legal_name')}
        />
        <Field
          label="NIF / Tax ID"
          placeholder="Ej. B-97776744"
          error={errors.tax_id?.message}
          {...field('tax_id')}
        />
        <Field
          label="Email de facturación"
          type="email"
          placeholder="facturas@empresa.com"
          hint="Opcional. Recibe los avisos de cambios de consecutivo."
          error={errors.billing_email?.message}
          {...field('billing_email')}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Field
            label="Dirección"
            placeholder="Calle, número, piso"
            error={errors.address_line?.message}
            {...field('address_line')}
          />
        </div>
        <Field
          label="Código postal"
          error={errors.postal_code?.message}
          {...field('postal_code')}
        />
        <Field label="Ciudad" error={errors.city?.message} {...field('city')} />
        <Field
          label="Provincia / región"
          error={errors.region?.message}
          {...field('region')}
        />
        <Field
          label="País"
          placeholder="Ej. España"
          error={errors.country?.message}
          {...field('country')}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Prefijo de factura"
          placeholder="Ej. INF"
          maxLength={8}
          disabled={prefixLocked}
          hint={
            prefixLocked
              ? 'No se puede cambiar: forma parte de los números ya emitidos.'
              : 'Inicio del consecutivo: INF-{CÓDIGO}-2026-0001. Único por empresa.'
          }
          error={errors.invoice_prefix?.message}
          {...field('invoice_prefix')}
        />
        <Field
          label="Moneda por defecto"
          placeholder="USD"
          maxLength={3}
          error={errors.default_currency?.message}
          {...field('default_currency')}
        />
      </div>
    </div>
  )
}
