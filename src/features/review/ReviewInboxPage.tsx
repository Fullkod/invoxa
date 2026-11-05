import { endOfMonth, format, startOfMonth } from 'date-fns'
import { es } from 'date-fns/locale'
import { Check, ClipboardCheck, Lock, MessageSquare, Pencil } from 'lucide-react'
import { useMemo, useState } from 'react'
import { z } from 'zod'
import { AppShell } from '../../components/layout/AppShell'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { MonthPicker } from '../../components/ui/MonthPicker'
import { Pill } from '../../components/ui/Pill'
import type { ReviewStatus, ReviewTask } from '../../types/supervision'
import { useReviewTask, useReviewTasks } from './queries'
import { ReviewStatusPill } from './ReviewStatusPill'

const proposalSchema = z.object({
  hours: z
    .number({ message: 'Ingresa horas válidas' })
    .min(0.25, 'Mínimo 0.25 horas')
    .max(24, 'Máximo 24 horas'),
  comment: z.string().max(1000, 'Máximo 1000 caracteres'),
})

const FILTERS: { value: ReviewStatus | 'all'; label: string }[] = [
  { value: 'pending', label: 'Por revisar' },
  { value: 'changes_proposed', label: 'Propuestas' },
  { value: 'approved', label: 'Aprobadas' },
  { value: 'all', label: 'Todas' },
]

/**
 * PRP-003: review inbox. Supervisors see the tasks of the members they
 * supervise; admins see every hourly task of their company. No money here.
 */
export function ReviewInboxPage({ isAdmin }: { isAdmin: boolean }) {
  const [period, setPeriod] = useState<Date>(new Date())
  const [status, setStatus] = useState<ReviewStatus | 'all'>('pending')
  const [projectFilter, setProjectFilter] = useState('all')

  const periodStart = format(startOfMonth(period), 'yyyy-MM-dd')
  const periodEnd = format(endOfMonth(period), 'yyyy-MM-dd')
  const { data: tasks = [], isLoading, error } = useReviewTasks({
    periodStart,
    periodEnd,
    status,
  })

  const projects = useMemo(() => {
    const map = new Map<string, string>()
    for (const t of tasks) map.set(t.project_id, t.project_name)
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1]))
  }, [tasks])

  const visible =
    projectFilter === 'all' ? tasks : tasks.filter((t) => t.project_id === projectFilter)

  return (
    <AppShell
      title="Revisión de horas"
      subtitle={
        isAdmin
          ? 'Aprueba o ajusta las horas de los colaboradores por hora'
          : 'Aprueba o propone cambios en las horas de tu equipo'
      }
      breadcrumbs={[{ label: isAdmin ? 'Operación' : 'Equipo' }, { label: 'Revisión' }]}
    >
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <MonthPicker value={period} onChange={setPeriod} />
        <div className="flex flex-wrap gap-1.5 rounded-full border border-border bg-surface p-1">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => setStatus(f.value)}
              aria-pressed={status === f.value}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                status === f.value ? 'bg-text text-white' : 'text-text-sec hover:bg-subtle'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        {projects.length > 1 && (
          <select
            value={projectFilter}
            onChange={(e) => setProjectFilter(e.target.value)}
            className="h-9 rounded-full border border-border bg-surface px-3 text-xs font-semibold text-text-sec"
            aria-label="Filtrar por proyecto"
          >
            <option value="all">Todos los proyectos</option>
            {projects.map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </select>
        )}
      </div>

      {isLoading ? (
        <p className="py-12 text-center text-sm text-muted">Cargando…</p>
      ) : error ? (
        <p className="py-12 text-center text-sm text-red">Error: {(error as Error).message}</p>
      ) : visible.length === 0 ? (
        <Card>
          <div className="flex flex-col items-center px-5 py-12 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <ClipboardCheck size={22} />
            </div>
            <h3 className="font-display mt-4 text-base font-bold text-text">
              Nada que revisar en {format(period, 'MMMM yyyy', { locale: es })}
            </h3>
            <p className="mt-1 max-w-sm text-sm text-muted">
              Aquí aparecen las tareas de las personas a tu cargo cuando registran horas.
            </p>
          </div>
        </Card>
      ) : (
        <ul className="space-y-3">
          {visible.map((t) => (
            <li key={t.id}>
              <ReviewTaskCard task={t} isAdmin={isAdmin} />
            </li>
          ))}
        </ul>
      )}
    </AppShell>
  )
}

function ReviewTaskCard({ task, isAdmin }: { task: ReviewTask; isAdmin: boolean }) {
  const review = useReviewTask()
  const [mode, setMode] = useState<'idle' | 'propose' | 'set'>('idle')
  const [hours, setHours] = useState(String(task.hours))
  const [comment, setComment] = useState('')
  const [formError, setFormError] = useState<string | null>(null)

  const run = async (action: 'approve' | 'propose' | 'set') => {
    setFormError(null)
    let parsedHours: number | undefined
    if (action !== 'approve') {
      const parsed = proposalSchema.safeParse({ hours: Number(hours), comment })
      if (!parsed.success) {
        setFormError(parsed.error.issues[0]?.message ?? 'Datos inválidos')
        return
      }
      parsedHours = parsed.data.hours
    } else if (comment.length > 1000) {
      setFormError('Máximo 1000 caracteres')
      return
    }
    try {
      await review.mutateAsync({ taskId: task.id, action, hours: parsedHours, comment })
      setMode('idle')
      setComment('')
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'No se pudo guardar.')
    }
  }

  return (
    <Card>
      <div className="px-4 py-4 sm:px-5">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="text-sm font-semibold text-text">{task.name}</div>
            <div className="mt-0.5 text-xs text-muted">
              {task.member_name} · {task.project_name} ·{' '}
              {format(new Date(`${task.task_date}T00:00:00`), "d 'de' MMM", { locale: es })}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {task.billed && (
              <Pill tone="muted">
                <span className="inline-flex items-center gap-1">
                  <Lock size={11} /> Facturada
                </span>
              </Pill>
            )}
            <ReviewStatusPill status={task.review_status} />
            <span className="font-display text-lg font-bold text-text">{task.hours} h</span>
          </div>
        </div>

        {task.description && (
          <p className="mt-2 whitespace-pre-line text-sm text-text-sec">{task.description}</p>
        )}
        {task.observations && (
          <p className="mt-1 text-xs text-muted">Obs.: {task.observations}</p>
        )}

        {(task.review_status === 'changes_proposed' || task.review_comment || task.response_comment) && (
          <div className="mt-3 space-y-1.5 rounded-xl bg-subtle px-3 py-2.5 text-xs text-text-sec">
            {task.review_status === 'changes_proposed' && task.proposed_hours != null && (
              <div>
                Propuesta: <strong>{task.proposed_hours} h</strong> (esperando respuesta)
              </div>
            )}
            {task.review_comment && (
              <div className="flex gap-1.5">
                <MessageSquare size={12} className="mt-0.5 flex-shrink-0 text-muted" />
                <span>
                  {task.reviewed_by_name ?? 'Revisor'}: {task.review_comment}
                </span>
              </div>
            )}
            {task.response_comment && (
              <div className="flex gap-1.5">
                <MessageSquare size={12} className="mt-0.5 flex-shrink-0 text-primary" />
                <span>
                  {task.member_name}: {task.response_comment}
                </span>
              </div>
            )}
          </div>
        )}

        {!task.billed && (
          <div className="mt-3">
            {mode === 'idle' ? (
              <div className="flex flex-wrap gap-2">
                {task.review_status !== 'approved' && (
                  <Button
                    size="sm"
                    leftIcon={<Check size={14} />}
                    onClick={() => run('approve')}
                    disabled={review.isPending}
                  >
                    Aprobar
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  leftIcon={<Pencil size={13} />}
                  onClick={() => setMode('propose')}
                >
                  Proponer otras horas
                </Button>
                {isAdmin && (
                  <Button size="sm" variant="ghost" onClick={() => setMode('set')}>
                    Ajustar y aprobar
                  </Button>
                )}
              </div>
            ) : (
              <div className="space-y-2 rounded-xl border border-border p-3">
                <div className="flex flex-wrap items-end gap-3">
                  <label className="text-xs font-semibold text-text-sec">
                    {mode === 'propose' ? 'Horas propuestas' : 'Horas definitivas'}
                    <input
                      type="number"
                      step="0.25"
                      min="0.25"
                      max="24"
                      value={hours}
                      onChange={(e) => setHours(e.target.value)}
                      className="mt-1 block h-9 w-24 rounded-lg border border-border bg-surface px-2.5 text-sm text-text"
                    />
                  </label>
                  <label className="min-w-[200px] flex-1 text-xs font-semibold text-text-sec">
                    Comentario {mode === 'propose' ? '(recomendado)' : '(opcional)'}
                    <input
                      type="text"
                      maxLength={1000}
                      value={comment}
                      onChange={(e) => setComment(e.target.value)}
                      placeholder="Ej. la reunión de planificación no se factura"
                      className="mt-1 block h-9 w-full rounded-lg border border-border bg-surface px-2.5 text-sm text-text"
                    />
                  </label>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => run(mode)} disabled={review.isPending}>
                    {mode === 'propose' ? 'Enviar propuesta' : 'Guardar y aprobar'}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setMode('idle')
                      setFormError(null)
                    }}
                  >
                    Cancelar
                  </Button>
                </div>
              </div>
            )}
            {formError && (
              <p className="mt-2 rounded-md bg-red/10 px-3 py-2 text-xs text-red">{formError}</p>
            )}
          </div>
        )}
      </div>
    </Card>
  )
}
