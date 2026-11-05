import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import {
  ArrowLeft,
  ChevronRight,
  FileText,
  Users,
} from 'lucide-react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { AppShell } from '../../../components/layout/AppShell'
import { Card, CardBody, CardHeader } from '../../../components/ui/Card'
import { Pill } from '../../../components/ui/Pill'
import type { InvoiceStatus } from '../../../types/invoice'
import { useProjectInvoices } from './activityQueries'
import { ProjectTasksCard } from './ProjectTasksCard'
import { useProjectMembers } from './membersQueries'
import { ProjectForm } from './ProjectForm'
import { useProject, useUpdateProject } from './queries'

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

export function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const { data: project, isLoading, error } = useProject(id)
  const { data: members = [] } = useProjectMembers(id)
  const { data: invoices = [] } = useProjectInvoices(id)
  const updateProject = useUpdateProject(id ?? '')

  const activeMembers = members.filter((m) => m.assignment.is_current)

  if (isLoading) {
    return (
      <AppShell title="Cargando proyecto…">
        <div className="px-5 py-12 text-center text-sm text-muted">
          Cargando…
        </div>
      </AppShell>
    )
  }

  if (error || !project) {
    return (
      <AppShell title="Proyecto no encontrado">
        <Link
          to="/admin/projects"
          className="mb-4 inline-flex items-center gap-1.5 text-xs font-semibold text-muted hover:text-text-sec"
        >
          <ArrowLeft size={13} /> Volver a proyectos
        </Link>
        <Card>
          <CardBody>
            <p className="text-sm text-red">
              {error
                ? (error as Error).message
                : 'No se encontró el proyecto solicitado.'}
            </p>
          </CardBody>
        </Card>
      </AppShell>
    )
  }

  return (
    <AppShell
      title={project.name}
      subtitle={project.description || 'Sin descripción'}
      breadcrumbs={[
        { label: 'Operación' },
        { label: 'Proyectos' },
        { label: project.name },
      ]}
      rightAction={
        <Pill tone={project.status === 'active' ? 'green' : 'muted'} dot>
          {project.status === 'active' ? 'Activo' : 'Inactivo'}
        </Pill>
      }
    >
      <Link
        to="/admin/projects"
        className="mb-4 inline-flex items-center gap-1.5 text-xs font-semibold text-muted hover:text-text-sec"
      >
        <ArrowLeft size={13} /> Volver a proyectos
      </Link>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card>
            <CardHeader
              title="Datos del proyecto"
              description="Edita el nombre, la descripción y el estado"
            />
            <CardBody>
              <ProjectForm
                initialValues={project}
                submitLabel="Guardar cambios"
                onSubmit={async (values) => {
                  await updateProject.mutateAsync({
                    name: values.name,
                    description: values.description ?? null,
                    status: values.status,
                    requires_approval: values.requires_approval,
                  })
                }}
              />
            </CardBody>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader
              title="Colaboradores"
              description={
                activeMembers.length === 0
                  ? 'Sin asignaciones activas'
                  : `${activeMembers.length} activos`
              }
              action={
                <button
                  type="button"
                  onClick={() => navigate(`/admin/projects/${project.id}/members`)}
                  className="text-xs font-semibold text-primary hover:text-primary-dark"
                >
                  Gestionar →
                </button>
              }
            />
            <CardBody className="space-y-2">
              {activeMembers.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border bg-subtle p-4 text-center">
                  <Users size={20} className="mx-auto text-muted" />
                  <p className="mt-2 text-xs text-muted">
                    Aún no asignaste a nadie a este proyecto.
                  </p>
                </div>
              ) : (
                <ul className="divide-y divide-border">
                  {activeMembers.slice(0, 5).map((m) => (
                    <li
                      key={m.assignment.id}
                      className="flex items-center justify-between gap-3 py-2.5 text-sm"
                    >
                      <div>
                        <div className="font-semibold text-text">
                          {m.user.full_name || m.user.email}
                        </div>
                        <div className="text-xs text-muted">
                          {m.compensation
                            ? `${
                                m.compensation.payment_type === 'hourly'
                                  ? 'Por hora'
                                  : 'Fijo mensual'
                              } · ${m.compensation.currency}`
                            : 'Sin compensación'}
                        </div>
                      </div>
                      <ChevronRight size={14} className="text-muted" />
                    </li>
                  ))}
                  {activeMembers.length > 5 && (
                    <li className="pt-2 text-xs text-muted">
                      Y {activeMembers.length - 5} más…
                    </li>
                  )}
                </ul>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Metadata" />
            <CardBody className="space-y-2 text-xs">
              <Row label="Creado">{formatDate(project.created_at)}</Row>
              <Row label="Actualizado">{formatDate(project.updated_at)}</Row>
              <Row label="ID" mono>
                {project.id}
              </Row>
            </CardBody>
          </Card>
        </div>
      </div>

      <div className="mt-6">
        <ProjectTasksCard
          projectId={project.id}
          requiresApproval={Boolean(project.requires_approval)}
        />
      </div>

      <div className="mt-4">
        <Card>
          <CardHeader
            title="Facturas con este proyecto"
            description={
              invoices.length === 0
                ? 'Sin facturas todavía'
                : `${invoices.length} ${
                    invoices.length === 1 ? 'factura' : 'facturas'
                  }`
            }
          />
          <CardBody>
            {invoices.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border bg-subtle p-6 text-center">
                <FileText size={20} className="mx-auto text-muted" />
                <p className="mt-2 text-xs text-muted">
                  Aún no se han generado facturas que incluyan ítems de este
                  proyecto.
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {invoices.slice(0, 8).map((inv) => (
                  <li
                    key={inv.id}
                    onClick={() => navigate(`/admin/invoices/${inv.id}`)}
                    className="flex cursor-pointer items-center gap-3 py-2.5 transition hover:opacity-80"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="font-mono text-xs text-text">
                          {inv.invoice_number}
                        </span>
                        <Pill tone={STATUS_TONE[inv.status]} dot>
                          {STATUS_LABEL[inv.status]}
                        </Pill>
                      </div>
                      <p className="mt-0.5 text-xs text-muted">
                        {inv.user?.full_name || inv.user?.email} ·{' '}
                        {format(
                          new Date(inv.period_start + 'T00:00:00'),
                          "MMM yyyy",
                          { locale: es },
                        )}
                      </p>
                    </div>
                    <div className="text-right">
                      <div className="font-display tabular text-sm font-medium text-text">
                        {formatCurrency(inv.total, inv.currency)}
                      </div>
                    </div>
                    <ChevronRight size={14} className="text-muted" />
                  </li>
                ))}
                {invoices.length > 8 && (
                  <li className="pt-2 text-xs text-muted">
                    Y {invoices.length - 8} más…
                  </li>
                )}
              </ul>
            )}
          </CardBody>
        </Card>
      </div>
    </AppShell>
  )
}

function formatCurrency(value: number, currency: string) {
  const formatted = new Intl.NumberFormat('es-CO', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value))
  return `${formatted} ${currency}`
}

function Row({
  label,
  children,
  mono,
}: {
  label: string
  children: React.ReactNode
  mono?: boolean
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="text-muted">{label}</span>
      <span
        className={`text-right text-text-sec ${mono ? 'font-mono text-[11px]' : ''}`}
      >
        {children}
      </span>
    </div>
  )
}

function formatDate(value: string) {
  return new Date(value).toLocaleString('es-CO', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}
