import { ArrowLeft } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { AppShell } from '../../../components/layout/AppShell'
import { Card, CardBody } from '../../../components/ui/Card'
import { ProjectForm } from './ProjectForm'
import { useCreateProject } from './queries'

export function NewProjectPage() {
  const navigate = useNavigate()
  const createProject = useCreateProject()

  return (
    <AppShell
      title="Nuevo proyecto"
      subtitle="Define el proyecto y su estado inicial"
      breadcrumbs={[
        { label: 'Operación' },
        { label: 'Proyectos' },
        { label: 'Nuevo' },
      ]}
    >
      <Link
        to="/admin/projects"
        className="mb-4 inline-flex items-center gap-1.5 text-xs font-semibold text-muted hover:text-text-sec"
      >
        <ArrowLeft size={13} /> Volver a proyectos
      </Link>

      <div className="mx-auto max-w-2xl">
        <Card>
          <CardBody>
            <ProjectForm
              submitLabel="Crear proyecto"
              onSubmit={async (values) => {
                const project = await createProject.mutateAsync({
                  name: values.name,
                  description: values.description ?? null,
                  status: values.status,
                  requires_approval: values.requires_approval,
                })
                navigate(`/admin/projects/${project.id}`, { replace: true })
              }}
            />
          </CardBody>
        </Card>
      </div>
    </AppShell>
  )
}
