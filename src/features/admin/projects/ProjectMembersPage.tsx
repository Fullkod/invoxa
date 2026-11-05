import {
  ArrowLeft,
  ChevronRight,
  Clock,
  CornerDownRight,
  DollarSign,
  Plus,
  UserMinus,
  Users,
} from 'lucide-react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { AppShell } from '../../../components/layout/AppShell'
import { Button } from '../../../components/ui/Button'
import { Card, CardBody, CardHeader } from '../../../components/ui/Card'
import { Pill } from '../../../components/ui/Pill'
import { parseDateOnly } from '../../../lib/dates/dateOnly'
import type { ProjectMember } from '../../../types/assignment'
import { useEndAssignment, useProjectMembers } from './membersQueries'
import { useProject } from './queries'
import { SupervisorsCard } from './SupervisorsCard'

export function ProjectMembersPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { data: project } = useProject(id)
  const { data: members = [], isLoading, error } = useProjectMembers(id)
  const endAssignment = useEndAssignment(id ?? '')

  const current = members.filter((m) => m.assignment.is_current)
  const past = members.filter((m) => !m.assignment.is_current)

  const handleEnd = (member: ProjectMember) => {
    if (
      !confirm(
        `¿Finalizar asignación de ${
          member.user.full_name || member.user.email
        } en este proyecto? Las facturas existentes no se modificarán.`,
      )
    )
      return

    endAssignment.mutate({
      userId: member.user.id,
      assignmentId: member.assignment.id,
    })
  }

  return (
    <AppShell
      title={project ? `Colaboradores · ${project.name}` : 'Colaboradores'}
      subtitle="Asigna usuarios y configura su modalidad de pago"
      breadcrumbs={[
        { label: 'Operación' },
        { label: 'Proyectos' },
        { label: project?.name ?? '' },
        { label: 'Colaboradores' },
      ]}
      rightAction={
        <Button
          size="md"
          leftIcon={<Plus size={15} strokeWidth={2.6} />}
          onClick={() => navigate(`/admin/projects/${id}/members/new`)}
          disabled={!id}
          aria-label="Asignar colaborador"
        >
          <span className="hidden sm:inline">Asignar colaborador</span>
        </Button>
      }
    >
      <Link
        to={`/admin/projects/${id}`}
        className="mb-4 inline-flex items-center gap-1.5 text-xs font-semibold text-muted hover:text-text-sec"
      >
        <ArrowLeft size={13} /> Volver al proyecto
      </Link>

      <Card>
        <CardHeader
          title="Colaboradores activos"
          description="Personas con compensación vigente en el proyecto"
        />
        {isLoading ? (
          <div className="px-5 py-12 text-center text-sm text-muted">
            Cargando…
          </div>
        ) : error ? (
          <div className="px-5 py-12 text-center text-sm text-red">
            Error: {(error as Error).message}
          </div>
        ) : current.length === 0 ? (
          <CardBody>
            <EmptyState onAdd={() => navigate(`/admin/projects/${id}/members/new`)} />
          </CardBody>
        ) : (
          <MembersTable
            members={current}
            onEdit={(m) =>
              navigate(`/admin/projects/${id}/members/${m.user.id}`)
            }
            onEnd={handleEnd}
            isEnding={endAssignment.isPending}
          />
        )}
      </Card>

      {id && current.length > 0 && (
        <div className="mt-6">
          <SupervisorsCard projectId={id} members={current} />
        </div>
      )}

      {past.length > 0 && (
        <div className="mt-6">
          <Card>
            <CardHeader
              title="Histórico"
              description="Asignaciones finalizadas — solo lectura"
            />
            <MembersTable members={past} readOnly />
          </Card>
        </div>
      )}
    </AppShell>
  )
}

function MembersTable({
  members,
  onEdit,
  onEnd,
  isEnding,
  readOnly = false,
}: {
  members: ProjectMember[]
  onEdit?: (m: ProjectMember) => void
  onEnd?: (m: ProjectMember) => void
  isEnding?: boolean
  readOnly?: boolean
}) {
  return (
    <>
      {/* Mobile: card list */}
      <ul className="divide-y divide-border md:hidden">
        {members.map((m) => (
          <li key={m.assignment.id} className="px-4 py-4">
            <div className="flex items-start gap-3">
              <Avatar name={m.user.full_name || m.user.email} />
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold text-text">
                      {m.user.full_name || '—'}
                    </div>
                    <div className="mt-0.5 truncate text-[11px] text-muted">
                      {m.user.email}
                    </div>
                  </div>
                  {m.compensation && (
                    <Pill
                      tone={
                        m.compensation.payment_type === 'hourly'
                          ? 'blue'
                          : 'violet'
                      }
                    >
                      {m.compensation.payment_type === 'hourly'
                        ? 'Por hora'
                        : 'Fijo'}
                    </Pill>
                  )}
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-text-sec">
                  {m.compensation && (
                    <span className="inline-flex items-center gap-1">
                      {m.compensation.payment_type === 'hourly' ? (
                        <Clock size={12} className="text-muted" />
                      ) : (
                        <DollarSign size={12} className="text-muted" />
                      )}
                      {formatRate(m.compensation)} {m.compensation.currency}
                      {m.compensation.payment_type === 'hourly' && '/h'}
                    </span>
                  )}
                  <span className="text-muted">
                    Desde {formatDate(m.assignment.start_date)}
                  </span>
                  {m.assignment.end_date && (
                    <span className="text-muted">
                      · Hasta {formatDate(m.assignment.end_date)}
                    </span>
                  )}
                </div>
              </div>
            </div>
            {!readOnly && (
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => onEdit?.(m)}
                  className="flex-1 rounded-lg border border-border bg-surface py-2 text-xs font-semibold text-text-sec hover:bg-subtle"
                >
                  Editar
                </button>
                <button
                  type="button"
                  onClick={() => onEnd?.(m)}
                  disabled={isEnding}
                  className="flex-1 rounded-lg border border-red/40 bg-surface py-2 text-xs font-semibold text-red hover:bg-red/5 disabled:opacity-50"
                >
                  <span className="inline-flex items-center justify-center gap-1">
                    <UserMinus size={12} /> Finalizar
                  </span>
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>

      {/* Desktop: table */}
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[720px] text-sm">
        <thead className="bg-subtle text-left text-xs uppercase tracking-wider text-muted">
          <tr>
            <th className="px-5 py-3 font-semibold">Colaborador</th>
            <th className="px-5 py-3 font-semibold">Modalidad</th>
            <th className="px-5 py-3 font-semibold">Tarifa</th>
            <th className="px-5 py-3 font-semibold">Inicio</th>
            <th className="px-5 py-3 font-semibold">Fin</th>
            <th className="w-44 px-5 py-3" />
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {members.map((m) => (
            <tr key={m.assignment.id} className="hover:bg-subtle">
              <td className="px-5 py-3.5">
                <div className="flex items-center gap-3">
                  <Avatar name={m.user.full_name || m.user.email} />
                  <div>
                    <div className="font-semibold text-text">
                      {m.user.full_name || '—'}
                    </div>
                    <div className="mt-0.5 text-xs text-muted">
                      {m.user.email}
                    </div>
                  </div>
                </div>
              </td>
              <td className="px-5 py-3.5">
                {m.compensation ? (
                  <Pill
                    tone={
                      m.compensation.payment_type === 'hourly' ? 'blue' : 'violet'
                    }
                  >
                    {m.compensation.payment_type === 'hourly'
                      ? 'Por hora'
                      : 'Fijo mensual'}
                  </Pill>
                ) : (
                  <span className="text-xs text-muted">Sin definir</span>
                )}
              </td>
              <td className="px-5 py-3.5 text-text-sec">
                {m.compensation ? (
                  <span className="inline-flex items-center gap-1.5">
                    {m.compensation.payment_type === 'hourly' ? (
                      <Clock size={13} className="text-muted" />
                    ) : (
                      <DollarSign size={13} className="text-muted" />
                    )}
                    {formatRate(m.compensation)} {m.compensation.currency}
                    {m.compensation.payment_type === 'hourly' && '/h'}
                  </span>
                ) : (
                  '—'
                )}
              </td>
              <td className="px-5 py-3.5 text-text-sec">
                {formatDate(m.assignment.start_date)}
              </td>
              <td className="px-5 py-3.5 text-text-sec">
                {m.assignment.end_date
                  ? formatDate(m.assignment.end_date)
                  : '—'}
              </td>
              <td className="px-5 py-3.5">
                {!readOnly && (
                  <div className="flex items-center justify-end gap-1.5">
                    <button
                      type="button"
                      onClick={() => onEdit?.(m)}
                      className="rounded-lg border border-border bg-surface px-2.5 py-1.5 text-xs font-semibold text-text-sec hover:bg-subtle"
                    >
                      <span className="inline-flex items-center gap-1">
                        Editar <ChevronRight size={12} />
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onEnd?.(m)}
                      disabled={isEnding}
                      className="rounded-lg border border-red/40 bg-surface px-2.5 py-1.5 text-xs font-semibold text-red hover:bg-red/5 disabled:opacity-50"
                    >
                      <span className="inline-flex items-center gap-1">
                        <UserMinus size={12} /> Finalizar
                      </span>
                    </button>
                  </div>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
    </>
  )
}

function Avatar({ name }: { name: string }) {
  const initials = name
    .split(/[ @.]/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase() ?? '')
    .join('')

  return (
    <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary-dark text-xs font-bold text-white">
      {initials}
    </div>
  )
}

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
        <Users size={22} />
      </div>
      <h3 className="font-display mt-4 text-base font-bold text-text">
        Aún no hay colaboradores asignados
      </h3>
      <p className="mt-1 max-w-sm text-sm text-muted">
        Asigna a los miembros del equipo y configura su modalidad de pago.
      </p>
      <Button
        size="md"
        leftIcon={<CornerDownRight size={15} strokeWidth={2.6} />}
        className="mt-5"
        onClick={onAdd}
      >
        Asignar primer colaborador
      </Button>
    </div>
  )
}

function formatRate(c: { payment_type: 'hourly' | 'fixed'; hourly_rate: number | null; monthly_rate: number | null }) {
  const value = c.payment_type === 'hourly' ? c.hourly_rate : c.monthly_rate
  if (value == null) return '—'
  return new Intl.NumberFormat('es-CO', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value)
}

function formatDate(value: string) {
  return parseDateOnly(value).toLocaleDateString('es-CO', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}
