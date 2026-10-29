import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowRight, KeyRound } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useNavigate } from 'react-router-dom'
import { z } from 'zod'
import { Button } from '../../components/ui/Button'
import { Field } from '../../components/ui/Field'
import { useDocumentMeta } from '../../lib/seo/useDocumentMeta'
import { supabase } from '../../lib/supabase/client'
import { FullkodCredit } from '../../components/brand/FullkodCredit'

const schema = z
  .object({
    password: z.string().min(8, 'Mínimo 8 caracteres'),
    confirm: z.string().min(8, 'Mínimo 8 caracteres'),
  })
  .refine((data) => data.password === data.confirm, {
    path: ['confirm'],
    message: 'Las contraseñas no coinciden',
  })

type FormValues = z.infer<typeof schema>

export function AcceptInvitePage() {
  useDocumentMeta({
    title: 'Aceptar invitación',
    description: 'Activa tu cuenta de Invoxa para empezar a colaborar.',
    noindex: true,
  })
  const navigate = useNavigate()
  const [serverError, setServerError] = useState<string | null>(null)
  const [hasSession, setHasSession] = useState<boolean | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) })

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setHasSession(Boolean(data.session))
    })
  }, [])

  const onSubmit = async ({ password }: FormValues) => {
    setServerError(null)

    const { error } = await supabase.auth.updateUser({ password })
    if (error) {
      setServerError(error.message)
      return
    }

    navigate('/', { replace: true })
  }

  if (hasSession === false) {
    return (
      <main className="relative flex min-h-screen items-center justify-center bg-subtle p-6 text-center">
        <div className="max-w-sm rounded-2xl border border-border bg-bg p-8 shadow-card">
          <h1 className="font-display text-lg font-bold text-text">
            Enlace inválido o expirado
          </h1>
          <p className="mt-2 text-sm text-muted">
            Pídele al administrador una nueva invitación.
          </p>
        </div>
        <div className="pointer-events-none absolute inset-x-0 bottom-3 flex justify-center px-6">
          <FullkodCredit className="pointer-events-auto" />
        </div>
      </main>
    )
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center bg-subtle p-6">
      <form
        onSubmit={handleSubmit(onSubmit)}
        className="w-full max-w-sm rounded-2xl border border-border bg-bg p-8 shadow-card"
      >
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <KeyRound size={22} />
        </div>
        <h1 className="font-display mt-5 text-2xl font-bold tracking-tighter2">
          Configura tu contraseña
        </h1>
        <p className="mt-1.5 text-sm text-muted">
          Define la contraseña para acceder a tu cuenta.
        </p>

        <div className="mt-6 space-y-3.5">
          <Field
            label="Contraseña"
            type="password"
            autoComplete="new-password"
            error={errors.password?.message}
            {...register('password')}
          />
          <Field
            label="Confirmar contraseña"
            type="password"
            autoComplete="new-password"
            error={errors.confirm?.message}
            {...register('confirm')}
          />
        </div>

        {serverError && (
          <p className="mt-4 rounded-md bg-red/10 px-3 py-2 text-xs text-red">
            {serverError}
          </p>
        )}

        <Button
          type="submit"
          disabled={isSubmitting}
          fullWidth
          size="lg"
          rightIcon={<ArrowRight size={16} strokeWidth={2.6} />}
          className="mt-5"
        >
          {isSubmitting ? 'Guardando…' : 'Guardar y continuar'}
        </Button>
      </form>
      <div className="pointer-events-none absolute inset-x-0 bottom-3 flex justify-center px-6">
        <FullkodCredit className="pointer-events-auto" />
      </div>
    </main>
  )
}
