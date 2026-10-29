import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowRight, Eye, EyeOff } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useNavigate } from 'react-router-dom'
import { z } from 'zod'
import logoCrema from '/brand/imagotipo-horizontal-crema.svg'
import logoCafe from '/brand/imagotipo-horizontal-cafe.svg'
import { Button } from '../../components/ui/Button'
import { Field } from '../../components/ui/Field'
import { useDocumentMeta } from '../../lib/seo/useDocumentMeta'
import { supabase } from '../../lib/supabase/client'

const loginSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(6, 'Mínimo 6 caracteres'),
})

type LoginFormValues = z.infer<typeof loginSchema>

export function LoginPage() {
  useDocumentMeta({
    title: 'Iniciar sesión',
    description: 'Accede a tu cuenta de Invoxa para gestionar horas, proyectos y facturas.',
    noindex: true,
  })
  const navigate = useNavigate()
  const [serverError, setServerError] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
  })

  const onSubmit = async (values: LoginFormValues) => {
    setServerError(null)
    const { error } = await supabase.auth.signInWithPassword({
      email: values.email,
      password: values.password,
    })

    if (error) {
      setServerError(error.message)
      return
    }

    navigate('/', { replace: true })
  }

  return (
    <div className="flex h-screen w-full bg-bg text-text">
      {/* Brand panel — terracotta canvas with serif tagline */}
      <aside className="relative hidden flex-1 flex-col justify-between overflow-hidden bg-text p-10 text-white lg:flex">
        {/* subtle grain pattern */}
        <svg
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          className="absolute inset-0 h-full w-full opacity-[0.07]"
        >
          <defs>
            <pattern
              id="grain"
              width="3"
              height="3"
              patternUnits="userSpaceOnUse"
            >
              <circle cx="1.5" cy="1.5" r="0.4" fill="#fbf7f0" />
            </pattern>
          </defs>
          <rect width="100" height="100" fill="url(#grain)" />
        </svg>

        {/* warm corner glow */}
        <div className="absolute -right-32 -top-32 h-[420px] w-[420px] rounded-full bg-primary/30 blur-3xl" />
        <div className="absolute -bottom-40 -left-20 h-[360px] w-[360px] rounded-full bg-primary/15 blur-3xl" />

        <div className="relative">
          <img src={logoCrema} alt="Invoxa" className="h-16 w-auto" />
        </div>

        <div className="relative max-w-[460px]">
          <p className="text-xs uppercase tracking-[0.18em] text-white/60">
            Un producto de Fullkod
          </p>
          <h2 className="font-display mt-3 text-[44px] font-medium leading-[1.05] tracking-[-0.02em]">
            Facturas mensuales,
            <span className="block italic text-primary">claras como el café.</span>
          </h2>
          <p className="mt-5 max-w-[420px] text-sm leading-relaxed text-white/70">
            Gestiona colaboradores, proyectos y consecutivos desde un solo
            lugar. Cada cierre de mes, sin perseguir PDFs.
          </p>
        </div>

        <div className="relative flex items-center gap-1.5 text-xs text-white/45">
          © {new Date().getFullYear()} Invoxa · Desarrollado por
          <a
            href="https://fullkod.com/?ref=invoxa"
            target="_blank"
            rel="noopener"
            className="inline-flex items-center gap-1.5 font-semibold text-white/70 hover:text-white"
          >
            <img src="/brand/fullkod-symbol-reversed.svg" alt="" className="h-3.5 w-3.5" />
            Fullkod
          </a>
        </div>
      </aside>

      {/* Form */}
      <div className="flex flex-1 items-center justify-center p-10">
        <form onSubmit={handleSubmit(onSubmit)} className="w-full max-w-sm">
          {/* Mobile logo */}
          <img
            src={logoCafe}
            alt="Invoxa"
            className="mb-10 h-12 w-auto lg:hidden"
          />

          <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted">
            Bienvenido
          </p>
          <h1 className="font-display mt-1 text-[34px] font-medium leading-tight tracking-[-0.02em] text-text">
            Inicia sesión
          </h1>
          <p className="mt-2 text-sm text-muted">
            Continúa tu trabajo donde lo dejaste.
          </p>

          <div className="mt-8 space-y-3.5">
            <Field
              label="Email"
              type="email"
              autoComplete="email"
              placeholder="tu@email.com"
              error={errors.email?.message}
              {...register('email')}
            />
            <Field
              label="Contraseña"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              placeholder="••••••••"
              error={errors.password?.message}
              trailing={
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="text-muted hover:text-text-sec"
                  aria-label={
                    showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'
                  }
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              }
              {...register('password')}
            />
          </div>

          <div className="mt-3.5 flex items-center justify-end">
            <Link
              to="/forgot-password"
              className="text-xs font-medium text-primary hover:text-primary-dark"
            >
              ¿Olvidaste tu contraseña?
            </Link>
          </div>

          {serverError && (
            <p className="mt-4 rounded-lg bg-red-soft px-3 py-2 text-xs text-red">
              {serverError}
            </p>
          )}

          <Button
            type="submit"
            disabled={isSubmitting}
            fullWidth
            size="lg"
            rightIcon={<ArrowRight size={16} />}
            className="mt-5"
          >
            {isSubmitting ? 'Ingresando…' : 'Iniciar sesión'}
          </Button>

          <p className="mt-8 text-xs text-muted">
            ¿Eres nuevo?{' '}
            <span className="font-medium text-text">
              Pídele al administrador una invitación.
            </span>{' '}
            Las cuentas se crean por invitación.
          </p>
        </form>
      </div>
    </div>
  )
}
