import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowLeft, LogIn, Power, Save } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { AppShell } from '../../../components/layout/AppShell'
import { Button } from '../../../components/ui/Button'
import { Card, CardBody, CardHeader } from '../../../components/ui/Card'
import { Pill } from '../../../components/ui/Pill'
import type { Company } from '../../../types/company'
import {
  useCompany,
  useSetActiveCompany,
  useUpdateCompany,
} from '../../companies/queries'
import { CompanyFields } from './CompanyFields'
import { companySchema, toCompanyInput, type CompanyFormValues } from './companySchema'

export function CompanyDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { data: company, isLoading, error } = useCompany(id)

  return (
    <AppShell
      title={company?.name ?? 'Empresa'}
      subtitle="Datos fiscales, prefijo de factura y estado"
      breadcrumbs={[{ label: 'Super admin' }, { label: 'Empresas' }, { label: 'Detalle' }]}
    >
      <Link
        to="/super/companies"
        className="mb-4 inline-flex items-center gap-1.5 text-xs font-semibold text-muted hover:text-text-sec"
      >
        <ArrowLeft size={13} /> Volver a empresas
      </Link>

      {isLoading ? (
        <p className="py-12 text-center text-sm text-muted">Cargando empresa…</p>
      ) : error || !company ? (
        <p className="py-12 text-center text-sm text-red">No se encontró la empresa.</p>
      ) : (
        // key: remount the form when another company is opened.
        <CompanyEditor key={company.id} company={company} />
      )}
    </AppShell>
  )
}

function CompanyEditor({ company }: { company: Company }) {
  const navigate = useNavigate()
  const updateCompany = useUpdateCompany(company.id)
  const setActive = useSetActiveCompany()
  const [serverError, setServerError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting, isDirty },
    reset,
  } = useForm<CompanyFormValues>({
    resolver: zodResolver(companySchema),
    defaultValues: {
      name: company.name,
      legal_name: company.legal_name,
      tax_id: company.tax_id,
      address_line: company.address_line ?? '',
      postal_code: company.postal_code ?? '',
      city: company.city ?? '',
      region: company.region ?? '',
      country: company.country,
      billing_email: company.billing_email ?? '',
      invoice_prefix: company.invoice_prefix,
      default_currency: company.default_currency,
    },
  })

  const submit = handleSubmit(async (values) => {
    setServerError(null)
    setSaved(false)
    try {
      // The prefix is locked: never send it on edit.
      const { invoice_prefix: _locked, ...patch } = toCompanyInput(values)
      const updated = await updateCompany.mutateAsync(patch)
      reset({ ...values, invoice_prefix: updated.invoice_prefix })
      setSaved(true)
    } catch (err) {
      setServerError(err instanceof Error ? err.message : 'Error al guardar.')
    }
  })

  const toggleStatus = async () => {
    setServerError(null)
    try {
      await updateCompany.mutateAsync({
        status: company.status === 'active' ? 'inactive' : 'active',
      })
    } catch (err) {
      setServerError(err instanceof Error ? err.message : 'Error al cambiar el estado.')
    }
  }

  const enter = async () => {
    await setActive.mutateAsync(company.id)
    navigate('/admin/dashboard')
  }

  const isActive = company.status === 'active'

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <Card>
        <CardBody>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <Pill tone={isActive ? 'green' : 'muted'} dot>
                {isActive ? 'Activa' : 'Desactivada'}
              </Pill>
              <span className="text-xs text-muted">
                Prefijo <span className="font-semibold text-text">{company.invoice_prefix}</span>
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="secondary"
                size="sm"
                leftIcon={<Power size={14} />}
                onClick={toggleStatus}
                disabled={updateCompany.isPending}
              >
                {isActive ? 'Desactivar' : 'Activar'}
              </Button>
              <Button
                size="sm"
                leftIcon={<LogIn size={14} />}
                onClick={enter}
                disabled={setActive.isPending}
              >
                Entrar a la empresa
              </Button>
            </div>
          </div>
          {!isActive && (
            <p className="mt-3 text-xs text-muted">
              Sus usuarios no pueden usar Invoxa mientras esté desactivada.
            </p>
          )}
        </CardBody>
      </Card>

      <form onSubmit={submit}>
        <Card>
          <CardHeader title="Datos de la empresa" />
          <CardBody>
            <CompanyFields field={(name) => register(name)} errors={errors} prefixLocked />

            {serverError && (
              <p className="mt-4 rounded-md bg-red/10 px-3 py-2 text-xs text-red">
                {serverError}
              </p>
            )}
            {saved && !isDirty && (
              <p className="mt-4 rounded-md bg-green/10 px-3 py-2 text-xs text-green">
                Cambios guardados.
              </p>
            )}

            <div className="flex justify-end pt-5">
              <Button
                type="submit"
                disabled={isSubmitting || !isDirty}
                leftIcon={<Save size={15} strokeWidth={2.4} />}
              >
                {isSubmitting ? 'Guardando…' : 'Guardar cambios'}
              </Button>
            </div>
          </CardBody>
        </Card>
      </form>
    </div>
  )
}
