import { endOfMonth, format, startOfMonth } from 'date-fns'
import { es } from 'date-fns/locale'
import {
  ChevronRight,
  Clock,
  Download,
  FileText,
  Lock,
  Plus,
  ReceiptText,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AppShell } from '../../../components/layout/AppShell'
import { Button } from '../../../components/ui/Button'
import { Card, CardBody, CardHeader } from '../../../components/ui/Card'
import { MonthPicker } from '../../../components/ui/MonthPicker'
import { Pill } from '../../../components/ui/Pill'
import { StatCard } from '../../../components/ui/StatCard'
import { openExternalUrl } from '../../../lib/native/openUrl'
import { AgentSourcePill } from './AgentSourcePill'
import { useAuth } from '../../auth/useAuth'
import { ReviewStatusPill } from '../../review/ReviewStatusPill'
import {
  isReviewRelevant,
  useMySupervisedProjectIds,
} from '../../review/queries'
import type { TaskWithProject } from '../../../types/task'
import {
  getTasksReportPdfSignedUrl,
  useGenerateTasksReportPdf,
  useMyHourlyProjects,
  useMyTasks,
} from './queries'

export function TasksListPage() {
  const navigate = useNavigate()
  const { session } = useAuth()
  const { data: supervised } = useMySupervisedProjectIds(session?.user.id)
  const [period, setPeriod] = useState<Date>(new Date())
  const [projectFilter, setProjectFilter] = useState<string>('all')

  const periodStart = useMemo(
    () => format(startOfMonth(period), 'yyyy-MM-dd'),
    [period],
  )
  const periodEnd = useMemo(
    () => format(endOfMonth(period), 'yyyy-MM-dd'),
    [period],
  )

  const { data: hourlyProjects = [], isLoading: loadingProjects } =
    useMyHourlyProjects()
  const { data: tasks = [], isLoading: loadingTasks } = useMyTasks({
    periodStart,
    periodEnd,
    projectId: projectFilter === 'all' ? undefined : projectFilter,
  })

  const totals = useMemo(() => {
    const totalHours = tasks.reduce((sum, t) => sum + Number(t.hours), 0)
    const billed = tasks.filter((t) => t.invoice_id != null)
    const pending = tasks.filter((t) => t.invoice_id == null)
    return {
      total: tasks.length,
      totalHours,
      billed: billed.length,
      pending: pending.length,
      pendingHours: pending.reduce((sum, t) => sum + Number(t.hours), 0),
    }
  }, [tasks])

  // Monthly report PDF (worked-hours justification). Always covers the whole
  // month across every project — the active project filter doesn't apply.
  const generateReport = useGenerateTasksReportPdf()
  const [pdfBusy, setPdfBusy] = useState(false)
  const [pdfError, setPdfError] = useState<string | null>(null)

  const handleDownloadPdf = async () => {
    setPdfError(null)
    setPdfBusy(true)
    try {
      const { pdf_path } = await generateReport.mutateAsync({
        periodStart,
        periodEnd,
      })
      const url = await getTasksReportPdfSignedUrl(pdf_path, 60)
      if (!url) {
        setPdfError('No se pudo abrir el PDF. Inténtalo de nuevo.')
        return
      }
      await openExternalUrl(url)
    } catch (err) {
      setPdfError(
        err instanceof Error ? err.message : 'Error al generar el PDF.',
      )
    } finally {
      setPdfBusy(false)
    }
  }

  // No hourly projects → tasks module doesn't apply.
  if (!loadingProjects && hourlyProjects.length === 0) {
    return (
      <AppShell
        title="Tareas"
        subtitle="Registra tu trabajo para facturar"
        breadcrumbs={[{ label: 'Mi facturación' }, { label: 'Tareas' }]}
      >
        <Card>
          <CardBody className="flex flex-col items-center py-16 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Clock size={22} />
            </div>
            <h3 className="font-display mt-4 text-xl text-text">
              No tienes proyectos por hora
            </h3>
            <p className="mt-2 max-w-md text-sm text-muted">
              El registro de tareas solo aplica para proyectos con modalidad de
              pago por hora. Tus proyectos actuales son de tarifa fija mensual,
              así que no necesitas registrar horas para generar tu factura.
            </p>
            <Link
              to="/app/dashboard"
              className="mt-6 text-sm font-medium text-primary hover:text-primary-dark"
            >
              Volver al inicio →
            </Link>
          </CardBody>
        </Card>
      </AppShell>
    )
  }

  return (
    <AppShell
      title="Tareas"
      subtitle={`Periodo: ${format(period, "MMMM 'de' yyyy", { locale: es })}`}
      breadcrumbs={[{ label: 'Mi facturación' }, { label: 'Tareas' }]}
      rightAction={
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="md"
            leftIcon={<Download size={15} strokeWidth={2.4} />}
            onClick={handleDownloadPdf}
            disabled={pdfBusy || loadingTasks || totals.total === 0}
            aria-label="Descargar reporte en PDF"
          >
            <span className="hidden sm:inline">
              {pdfBusy ? 'Generando…' : 'Descargar PDF'}
            </span>
          </Button>
          <Button
            size="md"
            leftIcon={<Plus size={15} strokeWidth={2.4} />}
            onClick={() => navigate('/app/tasks/new')}
            aria-label="Nueva tarea"
          >
            <span className="hidden sm:inline">Nueva tarea</span>
          </Button>
        </div>
      }
    >
      {pdfError && (
        <div className="mb-4 rounded-xl border border-red/30 bg-red/10 px-4 py-3 text-sm text-red">
          {pdfError}
        </div>
      )}

      {/* Filters */}
      <div className="mb-4 flex flex-wrap items-center gap-2.5">
        <MonthPicker value={period} onChange={setPeriod} />

        <div className="flex flex-wrap gap-1.5 rounded-full border border-border bg-surface p-1">
          <FilterChip
            active={projectFilter === 'all'}
            onClick={() => setProjectFilter('all')}
          >
            Todos
          </FilterChip>
          {hourlyProjects.map((p) => (
            <FilterChip
              key={p.id}
              active={projectFilter === p.id}
              onClick={() => setProjectFilter(p.id)}
            >
              {p.name}
            </FilterChip>
          ))}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Horas totales"
          value={
            <span className="tabular">
              {totals.totalHours.toFixed(2).replace(/\.?0+$/, '')}
            </span>
          }
          hint={`${totals.total} ${totals.total === 1 ? 'tarea' : 'tareas'}`}
          icon={<Clock size={16} />}
          tone="primary"
        />
        <StatCard
          label="Por facturar"
          value={
            <span className="tabular">
              {totals.pendingHours.toFixed(2).replace(/\.?0+$/, '')}
            </span>
          }
          hint={`${totals.pending} pendientes`}
          icon={<FileText size={16} />}
          tone="amber"
        />
        <StatCard
          label="Ya facturadas"
          value={<span className="tabular">{totals.billed}</span>}
          hint="Bloqueadas para edición"
          icon={<ReceiptText size={16} />}
          tone="green"
        />
        <StatCard
          label="Proyectos"
          value={<span className="tabular">{hourlyProjects.length}</span>}
          hint="Por hora activos"
          icon={<Clock size={16} />}
          tone="blue"
        />
      </div>

      {/* List */}
      <div className="mt-6">
        <Card>
          <CardHeader
            title={`Tareas del periodo`}
            description={`${format(startOfMonth(period), 'd MMM', { locale: es })} — ${format(endOfMonth(period), "d MMM yyyy", { locale: es })}`}
          />
          {loadingTasks ? (
            <div className="px-5 py-12 text-center text-sm text-muted">
              Cargando…
            </div>
          ) : tasks.length === 0 ? (
            <CardBody>
              <EmptyState onAdd={() => navigate('/app/tasks/new')} />
            </CardBody>
          ) : (
            <ul className="divide-y divide-border">
              {tasks.map((t) => (
                <TaskRow
                  key={t.id}
                  task={t}
                  showReview={isReviewRelevant(t, supervised)}
                  onClick={() => navigate(`/app/tasks/${t.id}`)}
                />
              ))}
            </ul>
          )}
        </Card>
      </div>
    </AppShell>
  )
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
        active
          ? 'bg-primary text-white'
          : 'text-text-sec hover:bg-subtle hover:text-text'
      }`}
    >
      {children}
    </button>
  )
}

function TaskRow({
  task,
  onClick,
  showReview,
}: {
  task: TaskWithProject
  onClick: () => void
  showReview: boolean
}) {
  const billed = task.invoice_id != null
  return (
    <li
      onClick={onClick}
      className="flex cursor-pointer items-center gap-4 px-5 py-4 transition hover:bg-subtle/60"
    >
      <div className="w-12 flex-shrink-0 text-center">
        <div className="text-[10px] font-bold uppercase tracking-[0.08em] text-muted">
          {format(new Date(task.task_date + 'T00:00:00'), 'MMM', { locale: es })}
        </div>
        <div className="font-display text-2xl font-medium text-text">
          {format(new Date(task.task_date + 'T00:00:00'), 'dd')}
        </div>
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-medium text-text">
            {task.name}
          </span>
          {billed && (
            <Pill tone="green" dot>
              <Lock size={9} className="inline" /> Facturada
            </Pill>
          )}
          <AgentSourcePill source={task.source} />
          {showReview && !billed && task.review_status && (
            <ReviewStatusPill status={task.review_status} />
          )}
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted">
          <Pill tone="violet">{task.project.name}</Pill>
          {task.description && (
            <span className="line-clamp-1 max-w-md">{task.description}</span>
          )}
        </div>
      </div>

      <div className="flex flex-col items-end">
        <div className="font-display tabular text-lg font-medium text-text">
          {Number(task.hours).toFixed(2).replace(/\.?0+$/, '')}h
        </div>
        <ChevronRight size={14} className="mt-0.5 text-muted" />
      </div>
    </li>
  )
}

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="flex flex-col items-center py-12 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
        <FileText size={22} />
      </div>
      <h3 className="font-display mt-4 text-lg text-text">
        No hay tareas en este periodo
      </h3>
      <p className="mt-1 max-w-sm text-sm text-muted">
        Registra tu primera tarea para empezar a acumular horas facturables.
      </p>
      <Button
        size="md"
        leftIcon={<Plus size={15} strokeWidth={2.4} />}
        className="mt-5"
        onClick={onAdd}
      >
        Nueva tarea
      </Button>
    </div>
  )
}
