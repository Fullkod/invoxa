import { endOfMonth, format, startOfMonth } from 'date-fns'
import { es } from 'date-fns/locale'
import { AlertTriangle, ArrowLeft, FileText, Send } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AppShell } from '../../../components/layout/AppShell'
import { Button } from '../../../components/ui/Button'
import { Card, CardBody, CardHeader } from '../../../components/ui/Card'
import { MonthPicker } from '../../../components/ui/MonthPicker'
import { Pill } from '../../../components/ui/Pill'
import { Textarea } from '../../../components/ui/Textarea'
import { useMyBillingProfile } from '../billing-profile/queries'
import { useGenerateInvoice, useInvoicePreview } from './queries'

export function NewInvoicePage() {
  const navigate = useNavigate()
  const [period, setPeriod] = useState<Date>(new Date())
  const [serverError, setServerError] = useState<string | null>(null)
  const [notes, setNotes] = useState('')
  const [notesTouched, setNotesTouched] = useState(false)

  const periodStart = useMemo(
    () => format(startOfMonth(period), 'yyyy-MM-dd'),
    [period],
  )
  const periodEnd = useMemo(
    () => format(endOfMonth(period), 'yyyy-MM-dd'),
    [period],
  )

  const { data: preview, isLoading: loadingPreview } = useInvoicePreview({
    periodStart,
    periodEnd,
  })
  const { data: billingProfile } = useMyBillingProfile()
  const generate = useGenerateInvoice()

  // Pre-fill notes with the user's default invoice notes until the user types.
  const defaultNotes = billingProfile?.default_invoice_notes
  const notesValue =
    !notesTouched && defaultNotes && defaultNotes.trim().length > 0
      ? defaultNotes
      : notes

  const handleGenerate = async () => {
    setServerError(null)
    try {
      const result = await generate.mutateAsync({
        periodStart,
        periodEnd,
        notes: notesValue.trim() ? notesValue.trim() : null,
      })
      navigate(`/app/invoices/${result.invoice_id}`, { replace: true })
    } catch (err) {
      setServerError(
        err instanceof Error ? err.message : 'Error al generar la factura.',
      )
    }
  }

  return (
    <AppShell
      title="Generar factura"
      subtitle={format(period, "MMMM 'de' yyyy", { locale: es })}
      breadcrumbs={[
        { label: 'Mi facturación' },
        { label: 'Facturas' },
        { label: 'Nueva' },
      ]}
    >
      <Link
        to="/app/invoices"
        className="mb-4 inline-flex items-center gap-1.5 text-xs font-medium text-muted hover:text-text-sec"
      >
        <ArrowLeft size={13} /> Volver a facturas
      </Link>

      <div className="mx-auto max-w-3xl space-y-4">
        <Card>
          <CardHeader
            title="Periodo a facturar"
            description="Selecciona el mes que quieres facturar."
          />
          <CardBody className="flex flex-wrap items-center justify-between gap-3">
            <MonthPicker value={period} onChange={setPeriod} />
            <p className="text-xs text-muted">
              {format(startOfMonth(period), "d 'de' MMMM", { locale: es })} —{' '}
              {format(endOfMonth(period), "d 'de' MMMM 'de' yyyy", {
                locale: es,
              })}
            </p>
          </CardBody>
        </Card>

        {loadingPreview ? (
          <Card>
            <CardBody className="py-12 text-center text-sm text-muted">
              Calculando…
            </CardBody>
          </Card>
        ) : !preview ? null : (
          <>
            {preview.blockers.length > 0 && (
              <Card>
                <CardBody className="space-y-2">
                  {preview.blockers.map((reason) => (
                    <div
                      key={reason}
                      className="flex items-start gap-3 rounded-card border border-amber/30 bg-amber-soft px-4 py-3 text-sm text-text-sec"
                    >
                      <AlertTriangle
                        size={16}
                        className="mt-0.5 flex-shrink-0 text-amber"
                      />
                      <div>{reason}</div>
                    </div>
                  ))}
                </CardBody>
              </Card>
            )}

            <Card>
              <CardHeader
                title="Preview de la factura"
                description={
                  preview.items.length === 0
                    ? 'No hay nada que facturar en este periodo.'
                    : `${preview.items.length} ${preview.items.length === 1 ? 'ítem' : 'ítems'} agrupados por proyecto`
                }
                action={
                  preview.ready ? (
                    <Pill tone="green" dot>
                      Lista para generar
                    </Pill>
                  ) : (
                    <Pill tone="amber" dot>
                      Pendiente
                    </Pill>
                  )
                }
              />
              {preview.items.length === 0 ? (
                <CardBody>
                  <div className="flex flex-col items-center py-8 text-center">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-subtle text-muted">
                      <FileText size={22} />
                    </div>
                    <p className="mt-3 text-sm text-muted">
                      Aún no tienes horas registradas ni proyectos fijos en este
                      periodo.
                    </p>
                  </div>
                </CardBody>
              ) : (
                <>
                  <ul className="divide-y divide-border">
                    {preview.items.map((item) => (
                      <li
                        key={item.project_id}
                        className="flex items-start gap-4 px-5 py-4"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-display text-base font-medium text-text">
                              {item.project_name}
                            </span>
                            <Pill
                              tone={
                                item.payment_type === 'hourly'
                                  ? 'blue'
                                  : 'violet'
                              }
                            >
                              {item.payment_type === 'hourly'
                                ? 'Por hora'
                                : 'Fijo mensual'}
                            </Pill>
                          </div>
                          <p className="mt-1 text-xs text-muted">
                            {item.payment_type === 'hourly'
                              ? `${formatNumber(item.quantity)}h × ${formatCurrency(item.unit_price, preview.currency)} · ${item.task_count} ${item.task_count === 1 ? 'tarea' : 'tareas'}`
                              : `Tarifa mensual configurada`}
                          </p>
                        </div>
                        <div className="font-display tabular text-base font-medium text-text">
                          {formatCurrency(item.total, preview.currency)}
                        </div>
                      </li>
                    ))}
                  </ul>
                  <div className="border-t border-border px-5 py-4">
                    <div className="flex items-baseline justify-between">
                      <span className="text-xs uppercase tracking-[0.08em] text-muted">
                        Total
                      </span>
                      <div className="font-display tabular text-3xl font-medium text-text">
                        {formatCurrency(preview.subtotal, preview.currency)}
                      </div>
                    </div>
                  </div>
                </>
              )}
            </Card>

            <Card>
              <CardHeader
                title="Observaciones"
                description="Aparecerán en la factura tal cual las escribas."
              />
              <CardBody>
                <Textarea
                  value={notesValue}
                  onChange={(e) => {
                    setNotes(e.target.value)
                    setNotesTouched(true)
                  }}
                  placeholder="Ej. Pago a 30 días, transferencia a la cuenta indicada…"
                  rows={4}
                  maxLength={1000}
                  hint={
                    billingProfile?.default_invoice_notes
                      ? 'Pre-cargado desde tus observaciones por defecto.'
                      : undefined
                  }
                />
              </CardBody>
            </Card>

            {serverError && (
              <p className="rounded-card bg-red-soft px-3 py-2 text-xs text-red">
                {serverError}
              </p>
            )}

            <div className="flex items-center justify-between">
              <p className="text-xs text-muted">
                Una vez generada, las tareas asociadas quedarán bloqueadas para
                edición.
              </p>
              <Button
                size="lg"
                disabled={!preview.ready || generate.isPending}
                leftIcon={<Send size={16} />}
                onClick={handleGenerate}
              >
                {generate.isPending ? 'Generando…' : 'Generar factura'}
              </Button>
            </div>
          </>
        )}
      </div>
    </AppShell>
  )
}

function formatNumber(value: number) {
  return new Intl.NumberFormat('es-CO', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value)
}

function formatCurrency(value: number, currency: string | null) {
  const formatted = new Intl.NumberFormat('es-CO', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
  return `${formatted} ${currency ?? ''}`.trim()
}
