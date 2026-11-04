import { endOfMonth, format } from 'date-fns'
import { es } from 'date-fns/locale'
import {
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  Clock,
  FileText,
  Plus,
  ReceiptText,
  Send,
  TrendingUp,
  Users,
} from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { AppShell } from '../../../components/layout/AppShell'
import { Button } from '../../../components/ui/Button'
import { Card, CardBody, CardHeader } from '../../../components/ui/Card'
import { Pill } from '../../../components/ui/Pill'
import { StatCard } from '../../../components/ui/StatCard'
import { useProfile } from '../../auth/useProfile'
import type { InvoiceStatus, InvoiceWithUser } from '../../../types/invoice'
import { useInvoiceNumberChangeRequests } from '../../invoiceNumberChange/queries'
import { useCurrentCompany } from '../../companies/queries'
import { useAdminDashboardStats, useRecentInvoices } from './queries'

const STATUS_LABEL: Record<InvoiceStatus, string> = {
  draft: 'Borrador',
  generated: 'Generada',
  sent: 'Enviada',
  reviewed: 'Revisada',
  approved: 'Aprobada',
  rejected: 'Rechazada',
  paid: 'Pagada',
  cancelled: 'Anulada',
}

const STATUS_TONE: Record<
  InvoiceStatus,
  'muted' | 'blue' | 'amber' | 'green' | 'red'
> = {
  draft: 'muted',
  generated: 'blue',
  sent: 'blue',
  reviewed: 'amber',
  approved: 'green',
  paid: 'green',
  rejected: 'red',
  cancelled: 'muted',
}

export function AdminDashboardPage() {
  const navigate = useNavigate()
  const today = new Date()
  const { data: stats } = useAdminDashboardStats(today)
  const { data: company } = useCurrentCompany()
  const { data: recentInvoices = [] } = useRecentInvoices(6)
  const { data: pendingNumberRequests = [] } =
    useInvoiceNumberChangeRequests('pending')
  const { data: profile } = useProfile()

  const monthLabel = format(today, "MMMM yyyy", { locale: es })
  const monthCloseLabel = format(endOfMonth(today), "d 'de' MMM · 23:59", {
    locale: es,
  })
  const firstName = (profile?.full_name || profile?.email || '').split(' ')[0]
  const greeting = getGreeting(today)
  const pendingCount = stats?.pendingInvoiceRequests ?? 0

  return (
    <AppShell
      title="Resumen del mes"
      subtitle={`${capitalize(monthLabel)} · ${company?.name ?? ''}`}
      breadcrumbs={[{ label: 'Dashboard' }]}
      rightAction={
        <Button
          size="md"
          leftIcon={<Plus size={15} strokeWidth={2.6} />}
          onClick={() => navigate('/admin/users/new')}
          aria-label="Invitar usuario"
        >
          <span className="hidden sm:inline">Invitar usuario</span>
        </Button>
      }
    >
      {/* Mobile hero — kicker + display title + subtitle */}
      <div className="mb-5 md:hidden">
        <div className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted">
          {capitalize(monthLabel)}
        </div>
        <h2 className="font-display mt-1.5 text-[28px] font-bold leading-[1.05] tracking-[-0.02em] text-text">
          {greeting}
          {firstName ? `, ${firstName}` : ''}.
        </h2>
        <p className="mt-1.5 text-sm leading-snug text-muted">
          {pendingCount > 0 ? (
            <>
              Faltan{' '}
              <span className="font-semibold text-primary">
                {pendingCount}{' '}
                {pendingCount === 1 ? 'factura' : 'facturas'}
              </span>{' '}
              por recibir este mes.
            </>
          ) : (
            'Todo al día. No hay solicitudes pendientes.'
          )}
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-2.5 md:gap-4 xl:grid-cols-4">
        <StatCard
          label="Colaboradores activos"
          value={stats?.activeUsers ?? '—'}
          hint={
            stats?.activeUsers
              ? `${stats.activeUsers} en plantilla`
              : 'Sin colaboradores aún'
          }
          icon={<Users size={16} />}
          tone="primary"
        />
        <StatCard
          label="Solicitudes pendientes"
          value={stats?.pendingInvoiceRequests ?? '—'}
          hint="Esperando que el colaborador facture"
          icon={<Clock size={16} />}
          tone="amber"
        />
        <StatCard
          label="Generadas (mes)"
          value={stats?.generatedThisMonth ?? '—'}
          hint="En curso de revisión"
          icon={<FileText size={16} />}
          tone="blue"
        />
        <StatCard
          label="Pagadas (mes)"
          value={stats?.paidThisMonth ?? '—'}
          hint="Cerradas"
          icon={<CheckCircle2 size={16} />}
          tone="green"
        />
      </div>

      {/* Mobile-only CTA: deadline card */}
      {pendingCount > 0 && (
        <Link
          to="/admin/invoice-requests"
          className="mt-5 block overflow-hidden rounded-2xl bg-text p-5 text-white shadow-card md:hidden"
        >
          <div className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-white/60">
            Cierre próximo
          </div>
          <div className="font-display mt-1.5 text-[22px] font-bold tracking-tightish capitalize">
            {monthCloseLabel}
          </div>
          <p className="mt-2 text-[13px] leading-relaxed text-white/70">
            Solicita las facturas pendientes de los {pendingCount}{' '}
            {pendingCount === 1 ? 'colaborador' : 'colaboradores'} que aún no
            han enviado la suya.
          </p>
          <div className="mt-4 inline-flex h-10 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-bold text-white">
            <Send size={14} /> Solicitar a todos
            <ArrowRight size={14} />
          </div>
        </Link>
      )}

      {/* Two columns */}
      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card>
            <CardHeader
              title="Acciones rápidas"
              description="Lo que sueles hacer al cierre del mes"
            />
            <CardBody className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <QuickAction
                to="/admin/invoice-requests"
                icon={<Send size={18} />}
                title="Solicitar facturas en lote"
                description="Envía un correo a todos los colaboradores activos."
              />
              <QuickAction
                to="/admin/users/new"
                icon={<Users size={18} />}
                title="Invitar colaborador"
                description="Crea una invitación con código y rol inicial."
              />
              <QuickAction
                to="/admin/projects/new"
                icon={<FileText size={18} />}
                title="Crear proyecto"
                description="Define un proyecto y asigna colaboradores."
              />
              <QuickAction
                to="/admin/invoices"
                icon={<TrendingUp size={18} />}
                title="Ver facturas del mes"
                description="Revisa el estado y descarga PDFs."
              />
            </CardBody>
          </Card>
        </div>

        <Card>
          <CardHeader
            title="Cambios de consecutivo"
            description="Esperan tu revisión"
            action={
              pendingNumberRequests.length > 0 ? (
                <Pill tone="amber" dot>
                  {pendingNumberRequests.length}
                </Pill>
              ) : null
            }
          />
          <CardBody className="space-y-3">
            {pendingNumberRequests.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border bg-subtle p-4 text-center">
                <p className="text-xs text-muted">
                  No hay solicitudes pendientes.
                </p>
              </div>
            ) : (
              <ul className="space-y-2">
                {pendingNumberRequests.slice(0, 3).map((req) => (
                  <li key={req.id}>
                    <Link
                      to={`/admin/invoices/${req.invoice_id}`}
                      className="flex items-start gap-2 rounded-xl border border-border bg-subtle px-3 py-2 transition hover:border-primary/40"
                    >
                      <ReceiptText
                        size={14}
                        className="mt-0.5 flex-shrink-0 text-muted"
                      />
                      <div className="min-w-0 flex-1 text-xs">
                        <div className="flex items-center gap-1">
                          <span className="font-mono text-text-sec line-through">
                            {req.current_invoice_number}
                          </span>
                          <span className="text-muted">→</span>
                          <span className="font-mono font-semibold text-text">
                            {req.requested_invoice_number}
                          </span>
                        </div>
                        <p className="mt-0.5 truncate text-muted">
                          {req.requester?.full_name ||
                            req.requester?.email ||
                            '—'}
                        </p>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            <Link
              to="/admin/invoice-number-requests"
              className="text-xs font-semibold text-primary hover:text-primary-dark"
            >
              Ver todas →
            </Link>
          </CardBody>
        </Card>
      </div>

      <div className="mt-6">
        <Card>
          <CardHeader
            title="Actividad reciente"
            description="Últimas facturas creadas"
            action={
              recentInvoices.length > 0 ? (
                <Link
                  to="/admin/invoices"
                  className="text-xs font-semibold text-primary hover:text-primary-dark"
                >
                  Ver todas →
                </Link>
              ) : null
            }
          />
          <CardBody>
            {recentInvoices.length === 0 ? (
              <p className="text-sm text-muted">
                Aún no hay actividad. Las facturas que generen los colaboradores
                aparecerán aquí.
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {recentInvoices.map((inv) => (
                  <RecentInvoiceRow
                    key={inv.id}
                    invoice={inv}
                    onClick={() => navigate(`/admin/invoices/${inv.id}`)}
                  />
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
      </div>
    </AppShell>
  )
}

function RecentInvoiceRow({
  invoice,
  onClick,
}: {
  invoice: InvoiceWithUser
  onClick: () => void
}) {
  return (
    <li
      onClick={onClick}
      className="flex cursor-pointer items-center gap-3 py-3 transition hover:opacity-80"
    >
      <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary-dark text-xs font-bold text-white">
        {getInitials(invoice.user?.full_name || invoice.user?.email || '?')}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-sm font-semibold text-text">
            {invoice.user?.full_name || invoice.user?.email}
          </span>
          <Pill tone={STATUS_TONE[invoice.status]} dot>
            {STATUS_LABEL[invoice.status]}
          </Pill>
        </div>
        <p className="mt-0.5 text-xs text-muted">
          <span className="font-mono">{invoice.invoice_number}</span> ·{' '}
          {format(new Date(invoice.created_at), "d MMM 'a las' HH:mm", {
            locale: es,
          })}
        </p>
      </div>
      <div className="text-right">
        <div className="font-display tabular text-sm font-medium text-text">
          {formatCurrency(invoice.total, invoice.currency)}
        </div>
      </div>
      <ChevronRight size={14} className="text-muted" />
    </li>
  )
}

function QuickAction({
  to,
  icon,
  title,
  description,
}: {
  to: string
  icon: React.ReactNode
  title: string
  description: string
}) {
  return (
    <Link
      to={to}
      className="group flex items-start gap-3 rounded-xl border border-border bg-subtle p-4 transition hover:border-primary/40 hover:bg-primary/5"
    >
      <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        {icon}
      </div>
      <div>
        <div className="text-sm font-semibold text-text">{title}</div>
        <p className="mt-1 text-xs text-muted">{description}</p>
      </div>
    </Link>
  )
}

function getInitials(name: string): string {
  return name
    .split(/[ @.]/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase() ?? '')
    .join('')
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1)
}

function getGreeting(date: Date): string {
  const hour = date.getHours()
  if (hour < 12) return 'Buen día'
  if (hour < 19) return 'Buenas tardes'
  return 'Buenas noches'
}

function formatCurrency(value: number, currency: string) {
  const formatted = new Intl.NumberFormat('es-CO', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value))
  return `${formatted} ${currency}`
}
