import { zodResolver } from '@hookform/resolvers/zod'
import { AlertTriangle, ArrowLeft, FolderKanban, Mail, Send } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useNavigate } from 'react-router-dom'
import { AppShell } from '../../../components/layout/AppShell'
import { Button } from '../../../components/ui/Button'
import { Card, CardBody, CardHeader } from '../../../components/ui/Card'
import { Field } from '../../../components/ui/Field'
import { Select } from '../../../components/ui/Select'
import { CompensationFields } from '../projects/CompensationFields'
import { useCurrentCompany } from '../../companies/queries'
import { useProjects } from '../projects/queries'
import { useInviteUser } from './inviteUser'
import { inviteUserSchema, type InviteUserFormValues } from './userSchema'

export function InviteUserPage() {
  const navigate = useNavigate()
  const inviteUser = useInviteUser()
  const [serverError, setServerError] = useState<string | null>(null)
  const [warning, setWarning] = useState<string | null>(null)

  const { data: projects = [] } = useProjects()
  const { data: company } = useCurrentCompany()

  const activeProjectOptions = useMemo(
    () => [
      { value: '', label: 'Sin asignación inicial' },
      ...projects
        .filter((p) => p.status === 'active')
        .map((p) => ({ value: p.id, label: p.name })),
    ],
    [projects],
  )

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<InviteUserFormValues>({
    resolver: zodResolver(inviteUserSchema),
    defaultValues: {
      email: '',
      full_name: '',
      user_code: '',
      role: 'user',
      project_id: '',
      payment_type: 'hourly',
      hourly_rate: undefined,
      monthly_rate: undefined,
      currency: 'USD',
    },
  })

  const role = watch('role')
  const projectId = watch('project_id')
  const hasProject = Boolean(projectId)

  const submit = handleSubmit(async (values) => {
    setServerError(null)
    setWarning(null)
    try {
      const result = await inviteUser.mutateAsync(values)
      if (result.initial_assignment_failed) {
        setWarning(
          'La invitación se envió, pero no se pudo crear la asignación inicial. Configúrala desde el detalle del proyecto.',
        )
        return
      }
      if (result.user_id) {
        navigate(`/admin/users/${result.user_id}`, { replace: true })
      } else {
        navigate('/admin/users', { replace: true })
      }
    } catch (err) {
      setServerError(
        err instanceof Error ? err.message : 'Error al enviar la invitación.',
      )
    }
  })

  return (
    <AppShell
      title="Invitar usuario"
      subtitle="El usuario recibirá un correo para activar su cuenta"
      breadcrumbs={[
        { label: 'Operación' },
        { label: 'Usuarios' },
        { label: 'Nuevo' },
      ]}
    >
      <Link
        to="/admin/users"
        className="mb-4 inline-flex items-center gap-1.5 text-xs font-semibold text-muted hover:text-text-sec"
      >
        <ArrowLeft size={13} /> Volver a usuarios
      </Link>

      <div className="mx-auto max-w-2xl space-y-4">
        <Card>
          <CardHeader
            title="Datos del nuevo colaborador"
            description="Se enviará una invitación por email para definir contraseña."
          />
          <CardBody>
            <form onSubmit={submit} className="space-y-5">
              <Field
                label="Nombre completo"
                placeholder="Ej. Roberto Cabrera Alvarez"
                error={errors.full_name?.message}
                {...register('full_name')}
              />

              <Field
                label="Email"
                type="email"
                placeholder="colaborador@email.com"
                error={errors.email?.message}
                {...register('email')}
              />

              <Field
                label="Código de usuario (opcional)"
                placeholder="Ej. RCA"
                hint={`Se usa en el consecutivo de facturas: ${company?.invoice_prefix ?? 'PREFIJO'}-{CODIGO}-2026-0001. Hasta 8 caracteres, solo mayúsculas y números.`}
                error={errors.user_code?.message}
                {...register('user_code', {
                  onChange: (e) => {
                    e.target.value = e.target.value.toUpperCase()
                  },
                })}
              />

              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-text-sec">
                  Rol
                </label>
                <div className="flex gap-2">
                  {(['user', 'admin'] as const).map((r) => {
                    const isSelected = role === r
                    return (
                      <button
                        key={r}
                        type="button"
                        onClick={() =>
                          setValue('role', r, { shouldDirty: true })
                        }
                        className={`flex-1 rounded-xl border px-4 py-3 text-left transition ${
                          isSelected
                            ? 'border-primary bg-primary/5'
                            : 'border-border bg-subtle hover:border-border-strong'
                        }`}
                      >
                        <div className="text-sm font-semibold text-text">
                          {r === 'user' ? 'Colaborador' : 'Administrador'}
                        </div>
                        <p className="mt-1 text-xs text-muted">
                          {r === 'user'
                            ? 'Genera y descarga sus propias facturas.'
                            : 'Gestiona usuarios, proyectos y facturas.'}
                        </p>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Optional initial assignment */}
              <div className="space-y-3 rounded-card border border-border bg-subtle/40 p-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <FolderKanban size={16} />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-sm font-semibold text-text">
                      Asignación inicial
                    </h3>
                    <p className="mt-0.5 text-xs text-muted">
                      Opcional. Si seleccionas un proyecto se creará la
                      asignación y la compensación de inmediato.
                    </p>
                  </div>
                </div>

                <Select
                  label="Proyecto inicial"
                  options={activeProjectOptions}
                  error={errors.project_id?.message}
                  {...register('project_id')}
                />

                {hasProject && (
                  <CompensationFields
                    register={register}
                    setValue={setValue}
                    watch={watch}
                    errors={errors}
                  />
                )}
              </div>

              <div className="flex items-start gap-2.5 rounded-xl border border-border bg-subtle p-3.5 text-xs text-text-sec">
                <Mail size={16} className="mt-0.5 flex-shrink-0 text-primary" />
                <div>
                  Al enviar la invitación, Supabase enviará un correo con un
                  enlace mágico al usuario. Cuando lo abra, definirá su
                  contraseña y entrará a la app.
                </div>
              </div>

              {warning && (
                <div className="flex items-start gap-2.5 rounded-xl border border-amber/30 bg-amber-soft p-3.5 text-xs text-text-sec">
                  <AlertTriangle
                    size={16}
                    className="mt-0.5 flex-shrink-0 text-amber"
                  />
                  <div>{warning}</div>
                </div>
              )}

              {serverError && (
                <p className="rounded-md bg-red/10 px-3 py-2 text-xs text-red">
                  {serverError}
                </p>
              )}

              <div className="flex justify-end pt-2">
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  leftIcon={<Send size={15} strokeWidth={2.4} />}
                >
                  {isSubmitting ? 'Enviando…' : 'Enviar invitación'}
                </Button>
              </div>
            </form>
          </CardBody>
        </Card>
      </div>
    </AppShell>
  )
}
