import { ArrowLeft, Lock, Trash2 } from 'lucide-react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { AppShell } from '../../../components/layout/AppShell'
import { Button } from '../../../components/ui/Button'
import { Card, CardBody, CardHeader } from '../../../components/ui/Card'
import { Pill } from '../../../components/ui/Pill'
import { isTaskBilled } from '../../../types/task'
import {
  useDeleteTask,
  useMyHourlyProjects,
  useTask,
  useUpdateTask,
} from './queries'
import { TaskForm } from './TaskForm'
import { useAuth } from '../../auth/useAuth'
import { isReviewRelevant, useMySupervisedProjectIds } from '../../review/queries'
import { TaskReviewPanel } from '../../review/TaskReviewPanel'

export function TaskDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { data: task, isLoading, error } = useTask(id)
  const { data: projects = [] } = useMyHourlyProjects()
  const updateTask = useUpdateTask(id ?? '')
  const deleteTask = useDeleteTask()
  const { session } = useAuth()
  const { data: supervised } = useMySupervisedProjectIds(session?.user.id)

  if (isLoading) {
    return (
      <AppShell title="Cargando…">
        <div className="px-5 py-12 text-center text-sm text-muted">
          Cargando…
        </div>
      </AppShell>
    )
  }

  if (error || !task) {
    return (
      <AppShell title="Tarea no encontrada">
        <Link
          to="/app/tasks"
          className="mb-4 inline-flex items-center gap-1.5 text-xs font-medium text-muted hover:text-text-sec"
        >
          <ArrowLeft size={13} /> Volver a tareas
        </Link>
        <Card>
          <CardBody>
            <p className="text-sm text-red">
              {error
                ? (error as Error).message
                : 'No se encontró la tarea solicitada.'}
            </p>
          </CardBody>
        </Card>
      </AppShell>
    )
  }

  const billed = isTaskBilled(task)

  const handleDelete = async () => {
    if (!confirm('¿Eliminar esta tarea? Esta acción no se puede deshacer.')) {
      return
    }
    try {
      await deleteTask.mutateAsync(task.id)
      navigate('/app/tasks', { replace: true })
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error al eliminar.')
    }
  }

  // If the project this task belongs to no longer appears in the user's
  // current hourly projects (e.g. assignment was ended), include it so the
  // form can still display it.
  const projectsForForm =
    projects.find((p) => p.id === task.project_id) == null
      ? [
          ...projects,
          {
            id: task.project.id,
            name: task.project.name,
            description: null,
            status: 'active' as const,
            created_at: '',
            updated_at: '',
          },
        ]
      : projects

  return (
    <AppShell
      title={task.name}
      subtitle={`Tarea del ${task.task_date}`}
      breadcrumbs={[
        { label: 'Mi facturación' },
        { label: 'Tareas' },
        { label: task.name },
      ]}
      rightAction={
        billed ? (
          <Pill tone="green" dot>
            <Lock size={10} className="inline" /> Facturada
          </Pill>
        ) : (
          <Pill tone="amber" dot>
            Sin facturar
          </Pill>
        )
      }
    >
      <Link
        to="/app/tasks"
        className="mb-4 inline-flex items-center gap-1.5 text-xs font-medium text-muted hover:text-text-sec"
      >
        <ArrowLeft size={13} /> Volver a tareas
      </Link>

      <div className="mx-auto max-w-2xl">
        {billed && (
          <div className="mb-4 flex items-start gap-3 rounded-card border border-green/30 bg-green-soft px-4 py-3 text-sm text-text-sec">
            <Lock size={16} className="mt-0.5 flex-shrink-0 text-green" />
            <p>
              <strong className="text-text">Esta tarea ya fue facturada.</strong>{' '}
              No puede editarse ni eliminarse para mantener la integridad del
              registro contable. Si necesitas un cambio, contacta al
              administrador.
            </p>
          </div>
        )}

        {!billed && isReviewRelevant(task, supervised) && <TaskReviewPanel task={task} />}

        <Card>
          <CardHeader
            title={billed ? 'Detalles de la tarea' : 'Editar tarea'}
            description={
              billed
                ? 'Solo lectura — esta tarea está incluida en una factura.'
                : 'Modifica los datos y guarda.'
            }
          />
          <CardBody>
            <TaskForm
              key={`${task.id}-${task.updated_at}`}
              initial={task}
              projects={projectsForForm}
              submitLabel="Guardar cambios"
              disabled={billed}
              onSubmit={async (values) => {
                await updateTask.mutateAsync({
                  project_id: values.project_id,
                  name: values.name,
                  description: values.description || null,
                  task_date: values.task_date,
                  hours: values.hours,
                  observations: values.observations || null,
                })
                navigate('/app/tasks', { replace: true })
              }}
            />
          </CardBody>
        </Card>

        {!billed && (
          <div className="mt-6 flex justify-end">
            <Button
              variant="danger"
              size="md"
              leftIcon={<Trash2 size={15} />}
              onClick={handleDelete}
              disabled={deleteTask.isPending}
            >
              {deleteTask.isPending ? 'Eliminando…' : 'Eliminar tarea'}
            </Button>
          </div>
        )}
      </div>
    </AppShell>
  )
}
