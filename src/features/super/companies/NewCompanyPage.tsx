import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowLeft, Send } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useNavigate } from 'react-router-dom'
import { AppShell } from '../../../components/layout/AppShell'
import { Button } from '../../../components/ui/Button'
import { Card, CardBody, CardHeader } from '../../../components/ui/Card'
import { Field } from '../../../components/ui/Field'
import { useCreateCompany } from '../../companies/queries'
import { CompanyFields } from './CompanyFields'
import {
  newCompanySchema,
  toCompanyInput,
  type NewCompanyFormValues,
} from './companySchema'

export function NewCompanyPage() {
  const navigate = useNavigate()
  const createCompany = useCreateCompany()
  const [serverError, setServerError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<NewCompanyFormValues>({
    resolver: zodResolver(newCompanySchema),
    defaultValues: {
      name: '',
      legal_name: '',
      tax_id: '',
      address_line: '',
      postal_code: '',
      city: '',
      region: '',
      country: 'España',
      billing_email: '',
      invoice_prefix: '',
      default_currency: 'USD',
      admin_full_name: '',
      admin_email: '',
      admin_user_code: '',
    },
  })

  const submit = handleSubmit(async (values) => {
    setServerError(null)
    try {
      const result = await createCompany.mutateAsync({
        company: toCompanyInput(values),
        admin: {
          email: values.admin_email,
          full_name: values.admin_full_name,
          user_code: values.admin_user_code ? values.admin_user_code : undefined,
        },
      })
      navigate(`/super/companies/${result.company_id}`, { replace: true })
    } catch (err) {
      setServerError(err instanceof Error ? err.message : 'Error al crear la empresa.')
    }
  })

  return (
    <AppShell
      title="Nueva empresa"
      subtitle="Da de alta una empresa e invita a su primer administrador"
      breadcrumbs={[{ label: 'Super admin' }, { label: 'Empresas' }, { label: 'Nueva' }]}
    >
      <Link
        to="/super/companies"
        className="mb-4 inline-flex items-center gap-1.5 text-xs font-semibold text-muted hover:text-text-sec"
      >
        <ArrowLeft size={13} /> Volver a empresas
      </Link>

      <form onSubmit={submit} className="mx-auto max-w-3xl space-y-5">
        <Card>
          <CardHeader
            title="Datos de la empresa"
            description="Aparecen como destinatario en las facturas de sus colaboradores."
          />
          <CardBody>
            <CompanyFields field={(name) => register(name)} errors={errors} />
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Primer administrador"
            description="Recibirá una invitación por correo y gestionará la empresa."
          />
          <CardBody>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="Nombre completo"
                error={errors.admin_full_name?.message}
                {...register('admin_full_name')}
              />
              <Field
                label="Email"
                type="email"
                error={errors.admin_email?.message}
                {...register('admin_email')}
              />
              <Field
                label="Código de usuario"
                placeholder="Ej. RCA"
                maxLength={8}
                hint="Opcional. Se usa en sus números de factura."
                error={errors.admin_user_code?.message}
                {...register('admin_user_code')}
              />
            </div>
          </CardBody>
        </Card>

        {serverError && (
          <p className="rounded-md bg-red/10 px-3 py-2 text-xs text-red">{serverError}</p>
        )}

        <div className="flex justify-end">
          <Button
            type="submit"
            disabled={isSubmitting}
            leftIcon={<Send size={15} strokeWidth={2.4} />}
          >
            {isSubmitting ? 'Creando…' : 'Crear empresa e invitar'}
          </Button>
        </div>
      </form>
    </AppShell>
  )
}
