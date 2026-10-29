import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowLeft, ArrowRight, Mail } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link } from 'react-router-dom'
import { z } from 'zod'
import { Button } from '../../components/ui/Button'
import { Field } from '../../components/ui/Field'
import { useDocumentMeta } from '../../lib/seo/useDocumentMeta'
import { supabase } from '../../lib/supabase/client'
import { FullkodCredit } from '../../components/brand/FullkodCredit'

const schema = z.object({
  email: z.string().email('Email inválido'),
})

type FormValues = z.infer<typeof schema>

export function ForgotPasswordPage() {
  useDocumentMeta({
    title: 'Recuperar contraseña',
    description: 'Recupera el acceso a tu cuenta de Invoxa.',
    noindex: true,
  })
  const [serverMessage, setServerMessage] = useState<string | null>(null)
  const [serverError, setServerError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) })

  const onSubmit = async ({ email }: FormValues) => {
    setServerError(null)
    setServerMessage(null)

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/accept-invite`,
    })

    if (error) {
      setServerError(error.message)
      return
    }

    setServerMessage(
      'Si el email está registrado, recibirás un enlace para restablecer la contraseña.',
    )
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center bg-subtle p-6">
      <form
        onSubmit={handleSubmit(onSubmit)}
        className="w-full max-w-sm rounded-2xl border border-border bg-bg p-8 shadow-card"
      >
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Mail size={22} />
        </div>
        <h1 className="font-display mt-5 text-2xl font-bold tracking-tighter2">
          Recuperar contraseña
        </h1>
        <p className="mt-1.5 text-sm text-muted">
          Te enviaremos un enlace por correo.
        </p>

        <div className="mt-6">
          <Field
            label="Email"
            type="email"
            placeholder="tu@email.com"
            autoComplete="email"
            error={errors.email?.message}
            {...register('email')}
          />
        </div>

        {serverError && (
          <p className="mt-4 rounded-md bg-red/10 px-3 py-2 text-xs text-red">
            {serverError}
          </p>
        )}
        {serverMessage && (
          <p className="mt-4 rounded-md bg-green/10 px-3 py-2 text-xs text-green">
            {serverMessage}
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
          {isSubmitting ? 'Enviando…' : 'Enviar enlace'}
        </Button>

        <Link
          to="/login"
          className="mt-5 flex items-center justify-center gap-1.5 text-xs font-semibold text-muted hover:text-text-sec"
        >
          <ArrowLeft size={13} /> Volver al login
        </Link>
      </form>
      <div className="pointer-events-none absolute inset-x-0 bottom-3 flex justify-center px-6">
        <FullkodCredit className="pointer-events-auto" />
      </div>
    </main>
  )
}
