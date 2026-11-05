import { zodResolver } from '@hookform/resolvers/zod'
import { CheckCircle2, Save } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { AppShell } from '../../../components/layout/AppShell'
import { Button } from '../../../components/ui/Button'
import { Card, CardBody, CardHeader } from '../../../components/ui/Card'
import { Field } from '../../../components/ui/Field'
import { Pill } from '../../../components/ui/Pill'
import { Textarea } from '../../../components/ui/Textarea'
import { isBillingProfileComplete } from '../../../types/billingProfile'
import { AgentAccessCard } from '../api-keys/AgentAccessCard'
import {
  billingProfileSchema,
  type BillingProfileFormValues,
} from './billingProfileSchema'
import { useMyBillingProfile, useUpsertBillingProfile } from './queries'

export function BillingProfilePage() {
  const { data: profile, isLoading } = useMyBillingProfile()
  const upsert = useUpsertBillingProfile()
  const [serverError, setServerError] = useState<string | null>(null)
  const [savedAt, setSavedAt] = useState<Date | null>(null)

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<BillingProfileFormValues>({
    resolver: zodResolver(billingProfileSchema),
    defaultValues: {
      legal_name: '',
      tax_id: '',
      billing_email: '',
      country: '',
      address: '',
      city: '',
      bank_name: '',
      bank_account: '',
      payment_method: '',
      default_invoice_notes: '',
    },
  })

  useEffect(() => {
    if (profile) {
      reset({
        legal_name: profile.legal_name ?? '',
        tax_id: profile.tax_id ?? '',
        billing_email: profile.billing_email ?? '',
        country: profile.country ?? '',
        address: profile.address ?? '',
        city: profile.city ?? '',
        bank_name: profile.bank_name ?? '',
        bank_account: profile.bank_account ?? '',
        payment_method: profile.payment_method ?? '',
        default_invoice_notes: profile.default_invoice_notes ?? '',
      })
    }
  }, [profile, reset])

  const submit = handleSubmit(async (values) => {
    setServerError(null)
    try {
      await upsert.mutateAsync({
        legal_name: values.legal_name,
        tax_id: values.tax_id,
        billing_email: values.billing_email,
        country: values.country,
        address: values.address || null,
        city: values.city || null,
        bank_name: values.bank_name || null,
        bank_account: values.bank_account || null,
        payment_method: values.payment_method || null,
        default_invoice_notes: values.default_invoice_notes || null,
      })
      setSavedAt(new Date())
    } catch (err) {
      setServerError(
        err instanceof Error ? err.message : 'Error al guardar.',
      )
    }
  })

  const isComplete = isBillingProfileComplete(profile)

  return (
    <AppShell
      title="Datos de facturación"
      subtitle="Información que aparecerá en tus facturas"
      breadcrumbs={[{ label: 'Mi facturación' }, { label: 'Datos' }]}
      rightAction={
        isComplete ? (
          <Pill tone="green" dot>
            Completo
          </Pill>
        ) : (
          <Pill tone="amber" dot>
            Incompleto
          </Pill>
        )
      }
    >
      {isLoading ? (
        <div className="px-5 py-12 text-center text-sm text-muted">
          Cargando…
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          {!isComplete && (
            <div className="flex items-start gap-3 rounded-card border border-amber/30 bg-amber-soft px-4 py-3 text-sm text-text-sec">
              <span className="mt-0.5 inline-flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-amber text-white text-xs font-bold">
                !
              </span>
              <p>
                <strong className="text-text">Falta información.</strong> Para
                generar facturas necesitas razón social, identificación fiscal,
                email de facturación y país.
              </p>
            </div>
          )}

          <Card>
            <CardHeader
              title="Identidad fiscal"
              description="Nombre o razón social y número de identificación tributaria."
            />
            <CardBody className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Field
                label="Razón social / Nombre legal"
                placeholder="Roberto Cabrera Alvarez"
                error={errors.legal_name?.message}
                {...register('legal_name')}
              />
              <Field
                label="Identificación fiscal (NIT, RFC, RUT…)"
                placeholder="900.123.456-7"
                error={errors.tax_id?.message}
                {...register('tax_id')}
              />
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="Contacto"
              description="Email donde llegarán las facturas y notificaciones."
            />
            <CardBody className="grid grid-cols-1 gap-4">
              <Field
                label="Email de facturación"
                type="email"
                placeholder="facturacion@example.com"
                error={errors.billing_email?.message}
                {...register('billing_email')}
              />
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="Dirección"
              description="Aparecerá en el bloque de remitente del PDF."
            />
            <CardBody className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Field
                label="País"
                placeholder="Colombia"
                error={errors.country?.message}
                {...register('country')}
              />
              <Field
                label="Ciudad"
                placeholder="Bogotá"
                error={errors.city?.message}
                {...register('city')}
              />
              <div className="md:col-span-2">
                <Field
                  label="Dirección"
                  placeholder="Calle 123 #45-67, Apto 8"
                  error={errors.address?.message}
                  {...register('address')}
                />
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="Datos de pago"
              description="Cómo prefieres recibir el pago. Aparece en cada factura."
            />
            <CardBody className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Field
                label="Método de pago"
                placeholder="Transferencia bancaria, Wise, PayPal…"
                error={errors.payment_method?.message}
                {...register('payment_method')}
              />
              <Field
                label="Banco"
                placeholder="Bancolombia"
                error={errors.bank_name?.message}
                {...register('bank_name')}
              />
              <div className="md:col-span-2">
                <Field
                  label="Cuenta / IBAN / Email PayPal"
                  placeholder="123-456789-01 / @user / email"
                  error={errors.bank_account?.message}
                  {...register('bank_account')}
                />
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="Observaciones por defecto"
              description="Texto opcional que se incluirá en cada factura nueva."
            />
            <CardBody>
              <Textarea
                rows={4}
                maxLength={1000}
                placeholder="Ej. Pago a 30 días. Aplican retenciones según ley local…"
                error={errors.default_invoice_notes?.message}
                {...register('default_invoice_notes')}
              />
            </CardBody>
          </Card>

          {serverError && (
            <p className="rounded-card bg-red-soft px-3 py-2 text-xs text-red">
              {serverError}
            </p>
          )}

          <div className="sticky bottom-0 -mx-6 mt-6 flex items-center justify-between border-t border-border bg-bg/95 px-6 py-3 backdrop-blur">
            <div className="text-xs text-muted">
              {savedAt && !isDirty ? (
                <span className="inline-flex items-center gap-1.5 text-green">
                  <CheckCircle2 size={14} /> Guardado a las{' '}
                  {savedAt.toLocaleTimeString('es-CO', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              ) : isDirty ? (
                'Tienes cambios sin guardar'
              ) : (
                ''
              )}
            </div>
            <Button
              type="submit"
              disabled={isSubmitting || !isDirty}
              leftIcon={<Save size={15} />}
            >
              {isSubmitting ? 'Guardando…' : 'Guardar cambios'}
            </Button>
          </div>
        </form>
      )}

      {!isLoading && (
        <div className="mt-6">
          <AgentAccessCard />
        </div>
      )}
    </AppShell>
  )
}
