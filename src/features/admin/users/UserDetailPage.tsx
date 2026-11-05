import { ArrowLeft, Clock, DollarSign, FolderKanban, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { AppShell } from '../../../components/layout/AppShell'
import { Button } from '../../../components/ui/Button'
import { Card, CardBody, CardHeader } from '../../../components/ui/Card'
import { Pill } from '../../../components/ui/Pill'
import { useUserAssignments } from '../projects/membersQueries'
import type { UserStatus } from '../../../types/profile'
import { DeleteUserModal } from './DeleteUserModal'
import { parseDateOnly } from '../../../lib/dates/dateOnly'
import {
  useUpdateUserRole,
  useUpdateUserStatus,
  useUser,
} from './queries'

export function UserDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { data: user, isLoading, error } = useUser(id)
  const { data: assignments = [] } = useUserAssignments(id)
  const updateStatus = useUpdateUserStatus()
  const updateRole = useUpdateUserRole()
  const [deleteOpen, setDeleteOpen] = useState(false)

  const activeAssignments = assignments.filter((a) => a.assignment.is_current)

  if (isLoading) {
    return (
      <AppShell title="Cargando…">
        <div className="px-5 py-12 text-center text-sm text-muted">
          Cargando…
        </div>
      </AppShell>
    )
  }

  if (error || !user) {
    return (
      <AppShell title="Usuario no encontrado">
        <Link
          to="/admin/users"
          className="mb-4 inline-flex items-center gap-1.5 text-xs font-semibold text-muted hover:text-text-sec"
        >
          <ArrowLeft size={13} /> Volver a usuarios
        </Link>
        <Card>
          <CardBody>
            <p className="text-sm text-red">
              {error
                ? (error as Error).message
                : 'No se encontró el usuario solicitado.'}
            </p>
          </CardBody>
        </Card>
      </AppShell>
    )
  }

  const initials = (user.full_name || user.email)
    .split(/[ @.]/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase() ?? '')
    .join('')

  return (
    <AppShell
      title={user.full_name || user.email}
      subtitle={user.email}
      breadcrumbs={[
        { label: 'Operación' },
        { label: 'Usuarios' },
        { label: user.full_name || user.email },
      ]}
      rightAction={<StatusPill status={user.status} />}
    >
      <Link
        to="/admin/users"
        className="mb-4 inline-flex items-center gap-1.5 text-xs font-semibold text-muted hover:text-text-sec"
      >
        <ArrowLeft size={13} /> Volver a usuarios
      </Link>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader title="Información del usuario" />
            <CardBody>
              <div className="flex items-center gap-4 pb-5 border-b border-border">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary-dark text-base font-bold text-white">
                  {initials}
                </div>
                <div>
                  <div className="font-display text-lg font-bold text-text">
                    {user.full_name || 'Sin nombre'}
                  </div>
                  <div className="text-sm text-muted">{user.email}</div>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 pt-5">
                <InfoRow label="Rol">
                  <Pill tone={user.role === 'admin' ? 'violet' : 'blue'}>
                    {user.role === 'admin' ? 'Admin' : 'Usuario'}
                  </Pill>
                </InfoRow>
                <InfoRow label="Código de usuario">
                  <span className="font-mono text-sm text-text">
                    {user.user_code ?? '—'}
                  </span>
                </InfoRow>
                <InfoRow label="Creado">
                  <span className="text-sm text-text-sec">
                    {formatDate(user.created_at)}
                  </span>
                </InfoRow>
                <InfoRow label="Última actualización">
                  <span className="text-sm text-text-sec">
                    {formatDate(user.updated_at)}
                  </span>
                </InfoRow>
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="Proyectos y compensación"
              description={
                activeAssignments.length === 0
                  ? 'Sin asignaciones activas'
                  : `${activeAssignments.length} ${activeAssignments.length === 1 ? 'proyecto activo' : 'proyectos activos'}`
              }
            />
            <CardBody>
              {activeAssignments.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border bg-subtle p-6 text-center">
                  <FolderKanban size={20} className="mx-auto text-muted" />
                  <p className="mt-2 text-sm text-muted">
                    Este usuario aún no está asignado a ningún proyecto.
                  </p>
                  <p className="mt-1 text-xs text-muted">
                    Agrégalo desde el panel de un proyecto.
                  </p>
                </div>
              ) : (
                <ul className="divide-y divide-border">
                  {activeAssignments.map((a) => (
                    <li
                      key={a.assignment.id}
                      className="flex items-center justify-between gap-3 py-3"
                    >
                      <div className="min-w-0 flex-1">
                        <Link
                          to={`/admin/projects/${a.project.id}`}
                          className="text-sm font-semibold text-text hover:text-primary"
                        >
                          {a.project.name}
                        </Link>
                        <div className="mt-1 flex flex-wrap items-center gap-2">
                          {a.compensation ? (
                            <>
                              <Pill
                                tone={
                                  a.compensation.payment_type === 'hourly'
                                    ? 'blue'
                                    : 'violet'
                                }
                              >
                                {a.compensation.payment_type === 'hourly'
                                  ? 'Por hora'
                                  : 'Fijo mensual'}
                              </Pill>
                              <span className="inline-flex items-center gap-1 text-xs text-text-sec">
                                {a.compensation.payment_type === 'hourly' ? (
                                  <Clock size={12} className="text-muted" />
                                ) : (
                                  <DollarSign size={12} className="text-muted" />
                                )}
                                {formatRate(a.compensation)}{' '}
                                {a.compensation.currency}
                                {a.compensation.payment_type === 'hourly' &&
                                  '/h'}
                              </span>
                            </>
                          ) : (
                            <span className="text-xs text-muted">
                              Sin compensación configurada
                            </span>
                          )}
                          <span className="text-xs text-muted">
                            · Desde {formatDateShort(a.assignment.start_date)}
                          </span>
                        </div>
                      </div>
                      <Link
                        to={`/admin/projects/${a.project.id}/members/${user.id}`}
                        className="rounded-lg border border-border bg-surface px-2.5 py-1.5 text-xs font-semibold text-text-sec hover:bg-subtle"
                      >
                        Editar
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader title="Acciones administrativas" />
            <CardBody className="space-y-3">
              <ActionGroup label="Estado">
                <ActionButton
                  active={user.status === 'active'}
                  onClick={() =>
                    updateStatus.mutate({ id: user.id, status: 'active' })
                  }
                  disabled={updateStatus.isPending}
                >
                  Activo
                </ActionButton>
                <ActionButton
                  active={user.status === 'inactive'}
                  onClick={() =>
                    updateStatus.mutate({ id: user.id, status: 'inactive' })
                  }
                  disabled={updateStatus.isPending}
                >
                  Inactivo
                </ActionButton>
              </ActionGroup>

              <ActionGroup label="Rol">
                <ActionButton
                  active={user.role === 'user'}
                  onClick={() =>
                    updateRole.mutate({ id: user.id, role: 'user' })
                  }
                  disabled={updateRole.isPending}
                >
                  Usuario
                </ActionButton>
                <ActionButton
                  active={user.role === 'admin'}
                  onClick={() =>
                    updateRole.mutate({ id: user.id, role: 'admin' })
                  }
                  disabled={updateRole.isPending}
                >
                  Admin
                </ActionButton>
              </ActionGroup>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Metadata" />
            <CardBody className="space-y-2 text-xs">
              <Row label="ID" mono>
                {user.id}
              </Row>
            </CardBody>
          </Card>

          <Card className="border-red/30">
            <CardHeader
              title="Zona de peligro"
              description="Eliminar el usuario es permanente y no se puede deshacer."
            />
            <CardBody>
              <Button
                variant="danger"
                size="md"
                fullWidth
                leftIcon={<Trash2 size={14} />}
                onClick={() => setDeleteOpen(true)}
              >
                Eliminar usuario
              </Button>
            </CardBody>
          </Card>
        </div>
      </div>

      <DeleteUserModal
        open={deleteOpen}
        user={user}
        onClose={() => setDeleteOpen(false)}
        onDeleted={() => navigate('/admin/users')}
      />
    </AppShell>
  )
}

function InfoRow({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div>
      <div className="text-xs font-semibold uppercase tracking-wider text-muted">
        {label}
      </div>
      <div className="mt-1.5">{children}</div>
    </div>
  )
}

function ActionGroup({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div>
      <div className="mb-1.5 text-xs font-semibold text-text-sec">{label}</div>
      <div className="grid grid-cols-2 gap-1.5">{children}</div>
    </div>
  )
}

function ActionButton({
  active,
  onClick,
  disabled,
  children,
}: {
  active: boolean
  onClick: () => void
  disabled?: boolean
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`rounded-lg border px-3 py-2 text-xs font-semibold transition disabled:opacity-50 ${
        active
          ? 'border-primary bg-primary/10 text-primary'
          : 'border-border bg-subtle text-text-sec hover:border-border-strong'
      }`}
    >
      {children}
    </button>
  )
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

function StatusPill({ status }: { status: UserStatus }) {
  const map = {
    active: { tone: 'green' as const, label: 'Activo' },
    invited: { tone: 'amber' as const, label: 'Invitado' },
    inactive: { tone: 'muted' as const, label: 'Inactivo' },
  }
  const { tone, label } = map[status]
  return (
    <Pill tone={tone} dot>
      {label}
    </Pill>
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

function formatDateShort(value: string) {
  return parseDateOnly(value).toLocaleDateString('es-CO', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

function formatRate(c: {
  payment_type: 'hourly' | 'fixed'
  hourly_rate: number | null
  monthly_rate: number | null
}) {
  const value = c.payment_type === 'hourly' ? c.hourly_rate : c.monthly_rate
  if (value == null) return '—'
  return new Intl.NumberFormat('es-CO', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value)
}
