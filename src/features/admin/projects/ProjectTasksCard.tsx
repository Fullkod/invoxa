import { endOfMonth, format, startOfMonth } from 'date-fns'
import { es } from 'date-fns/locale'
import { Clock, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Card, CardBody, CardHeader } from '../../../components/ui/Card'
import { MonthPicker } from '../../../components/ui/MonthPicker'
import { Pill } from '../../../components/ui/Pill'
import { ReviewStatusPill } from '../../review/ReviewStatusPill'
import { AgentSourcePill } from '../../user/tasks/AgentSourcePill'
import { useProjectTasks, type ProjectTaskWithUser } from './activityQueries'

const PAGE_SIZE = 20

type Scope = 'month' | 'all'

type MemberSummary = {
  userId: string
  name: string
  tasks: number
  hours: number
  invoicedHours: number
  pendingReviewHours: number
}

/**
 * Admin view of the effort logged in a project: hours per collaborator
 * (month or whole history) and the full task list, filterable by person.
 */
export function ProjectTasksCard({
  projectId,
  requiresApproval,
}: {
  projectId: string
  requiresApproval: boolean
}) {
  const [scope, setScope] = useState<Scope>('month')
  const [period, setPeriod] = useState<Date>(new Date())
  const [selectedUser, setSelectedUser] = useState<string | null>(null)
  const [visible, setVisible] = useState(PAGE_SIZE)

  const periodStart =
    scope === 'month' ? format(startOfMonth(period), 'yyyy-MM-dd') : null
  const periodEnd =
    scope === 'month' ? format(endOfMonth(period), 'yyyy-MM-dd') : null

  const { data, isLoading, error, refetch, isFetching } = useProjectTasks(
    projectId,
    periodStart,
    periodEnd,
  )

  const summaries = useMemo(() => summarize(data?.tasks ?? []), [data])
  const filtered = useMemo(
    () =>
      (data?.tasks ?? []).filter(
        (t) => !selectedUser || t.user_id === selectedUser,
      ),
    [data, selectedUser],
  )
  const filteredHours = filtered.reduce((s, t) => s + Number(t.hours), 0)
  const selectedName = summaries.find((s) => s.userId === selectedUser)?.name

  function resetView() {
    setSelectedUser(null)
    setVisible(PAGE_SIZE)
  }

  const totalHours = data?.totalHours ?? 0
  const uniqueUsers = data?.uniqueUsers ?? 0
  const taskCount = data?.tasks.length ?? 0

  return (
    <Card>
      <CardHeader
        title="Tareas y horas"
        description={`${uniqueUsers} ${
          uniqueUsers === 1 ? 'colaborador' : 'colaboradores'
        } · ${taskCount} ${taskCount === 1 ? 'tarea' : 'tareas'} · ${formatHours(
          totalHours,
        )}${scope === 'all' ? ' en total' : ''}`}
        action={
          <div className="flex flex-wrap items-center justify-end gap-2">
            <div className="inline-flex rounded-full border border-border bg-subtle p-0.5 text-xs font-semibold">
              {(['month', 'all'] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => {
                    setScope(s)
                    resetView()
                  }}
                  className={`rounded-full px-3 py-1.5 transition ${
                    scope === s
                      ? 'bg-surface text-text shadow-card'
                      : 'text-muted hover:text-text-sec'
                  }`}
                >
                  {s === 'month' ? 'Mes' : 'Todo'}
                </button>
              ))}
            </div>
            {scope === 'month' && (
              <MonthPicker
                value={period}
                onChange={(d) => {
                  setPeriod(d)
                  resetView()
                }}
              />
            )}
          </div>
        }
      />
      <CardBody>
        {error ? (
          <div className="rounded-xl border border-red/30 bg-red/5 p-4 text-sm">
            <p className="font-semibold text-red">
              No se pudieron cargar las tareas.
            </p>
            <p className="mt-1 text-xs text-muted">{(error as Error).message}</p>
            <button
              type="button"
              onClick={() => refetch()}
              disabled={isFetching}
              className="mt-3 text-xs font-semibold text-primary hover:text-primary-dark disabled:opacity-50"
            >
              {isFetching ? 'Reintentando…' : 'Reintentar'}
            </button>
          </div>
        ) : isLoading || !data ? (
          <p className="text-sm text-muted">Cargando…</p>
        ) : data.tasks.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-subtle p-6 text-center">
            <Clock size={20} className="mx-auto text-muted" />
            <p className="mt-2 text-xs text-muted">
              {scope === 'month'
                ? 'Nadie registró tareas en este proyecto durante el periodo seleccionado.'
                : 'Nadie ha registrado tareas en este proyecto todavía.'}
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            <section>
              <h4 className="mb-2 text-[11px] font-bold uppercase tracking-wide text-muted">
                Horas por colaborador
              </h4>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[520px] text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-[11px] font-semibold uppercase tracking-wide text-muted">
                      <th className="py-2 pr-3">Colaborador</th>
                      <th className="py-2 pr-3 text-right">Tareas</th>
                      <th className="py-2 pr-3 text-right">Horas</th>
                      <th className="w-1/4 py-2 pr-3">% del total</th>
                      <th className="py-2 pr-3 text-right">Facturadas</th>
                      {requiresApproval && (
                        <th className="py-2 text-right">Sin aprobar</th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {summaries.map((s) => {
                      const share = totalHours > 0 ? s.hours / totalHours : 0
                      const active = selectedUser === s.userId
                      return (
                        <tr
                          key={s.userId}
                          onClick={() => {
                            setSelectedUser(active ? null : s.userId)
                            setVisible(PAGE_SIZE)
                          }}
                          className={`cursor-pointer transition ${
                            active ? 'bg-primary/10' : 'hover:bg-subtle'
                          }`}
                          title="Ver solo sus tareas"
                        >
                          <td className="py-2.5 pr-3 font-semibold text-text">
                            {s.name}
                          </td>
                          <td className="tabular py-2.5 pr-3 text-right text-text-sec">
                            {s.tasks}
                          </td>
                          <td className="font-display tabular py-2.5 pr-3 text-right font-medium text-text">
                            {formatHours(s.hours)}
                          </td>
                          <td className="py-2.5 pr-3">
                            <div className="flex items-center gap-2">
                              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-subtle2">
                                <div
                                  className="h-full rounded-full bg-primary"
                                  style={{ width: `${share * 100}%` }}
                                />
                              </div>
                              <span className="tabular w-9 text-right text-xs text-muted">
                                {Math.round(share * 100)}%
                              </span>
                            </div>
                          </td>
                          <td className="tabular py-2.5 pr-3 text-right text-text-sec">
                            {formatHours(s.invoicedHours)}
                          </td>
                          {requiresApproval && (
                            <td
                              className={`tabular py-2.5 text-right ${
                                s.pendingReviewHours > 0
                                  ? 'font-semibold text-amber'
                                  : 'text-text-sec'
                              }`}
                            >
                              {formatHours(s.pendingReviewHours)}
                            </td>
                          )}
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </section>

            <section>
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <h4 className="text-[11px] font-bold uppercase tracking-wide text-muted">
                  Tareas{' '}
                  <span className="normal-case tracking-normal">
                    · {filtered.length} · {formatHours(filteredHours)}
                  </span>
                </h4>
                {selectedName && (
                  <button
                    type="button"
                    onClick={() => resetView()}
                    className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary hover:bg-primary/15"
                  >
                    {selectedName} <X size={12} />
                  </button>
                )}
              </div>
              <ul className="divide-y divide-border">
                {filtered.slice(0, visible).map((t) => (
                  <TaskRow
                    key={t.id}
                    task={t}
                    showReview={requiresApproval}
                  />
                ))}
              </ul>
              {filtered.length > visible && (
                <button
                  type="button"
                  onClick={() => setVisible((v) => v + PAGE_SIZE)}
                  className="mt-3 w-full rounded-xl border border-border py-2 text-xs font-semibold text-text-sec transition hover:bg-subtle"
                >
                  Ver {Math.min(PAGE_SIZE, filtered.length - visible)} más (
                  {filtered.length - visible} restantes)
                </button>
              )}
            </section>
          </div>
        )}
      </CardBody>
    </Card>
  )
}

function TaskRow({
  task: t,
  showReview,
}: {
  task: ProjectTaskWithUser
  showReview: boolean
}) {
  return (
    <li className="flex items-start gap-3 py-2.5 text-sm">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="font-semibold text-text">{t.name}</span>
          {t.invoice_id ? (
            <Pill tone="green">Facturada</Pill>
          ) : (
            <Pill tone="muted">Sin facturar</Pill>
          )}
          {showReview && !t.invoice_id && (
            <ReviewStatusPill status={t.review_status} />
          )}
          <AgentSourcePill source={t.source} />
        </div>
        {t.description && (
          <p className="mt-0.5 line-clamp-2 text-xs text-text-sec">
            {t.description}
          </p>
        )}
        <p className="mt-0.5 text-xs text-muted">
          {t.user?.full_name || t.user?.email || '—'} ·{' '}
          {format(new Date(t.task_date + 'T00:00:00'), 'EEE d MMM yyyy', {
            locale: es,
          })}
        </p>
      </div>
      <div className="font-display tabular text-sm font-medium text-text">
        {formatHours(Number(t.hours))}
      </div>
    </li>
  )
}

function summarize(tasks: ProjectTaskWithUser[]): MemberSummary[] {
  const map = new Map<string, MemberSummary>()
  for (const t of tasks) {
    const hours = Number(t.hours)
    const s = map.get(t.user_id) ?? {
      userId: t.user_id,
      name: t.user?.full_name || t.user?.email || '—',
      tasks: 0,
      hours: 0,
      invoicedHours: 0,
      pendingReviewHours: 0,
    }
    s.tasks += 1
    s.hours += hours
    if (t.invoice_id) s.invoicedHours += hours
    else if (t.review_status !== 'approved') s.pendingReviewHours += hours
    map.set(t.user_id, s)
  }
  return [...map.values()].sort((a, b) => b.hours - a.hours)
}

function formatHours(value: number): string {
  return `${new Intl.NumberFormat('es-CO', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  }).format(value)} h`
}
