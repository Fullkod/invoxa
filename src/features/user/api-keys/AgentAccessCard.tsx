import { zodResolver } from '@hookform/resolvers/zod'
import { Bot, Check, Copy, KeyRound, Plus, X } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Button } from '../../../components/ui/Button'
import { Card, CardBody, CardHeader } from '../../../components/ui/Card'
import { Field } from '../../../components/ui/Field'
import { Pill } from '../../../components/ui/Pill'
import { formatRelativeEs } from '../../../lib/dates/relative'
import {
  AGENT_API_URL,
  apiKeyNameSchema,
  MAX_ACTIVE_KEYS,
  useCreateApiKey,
  useMyApiKeys,
  useRevokeApiKey,
  type ApiKey,
  type ApiKeyNameValues,
  type CreatedApiKey,
} from './queries'
import { SkillDownload } from './SkillDownload'

/**
 * "Acceso para agentes" (PRP-002): personal API keys so Claude Code, Codex or
 * n8n can register and read the collaborator's hours through agent-api.
 */
export function AgentAccessCard() {
  const { data: keys = [], isLoading } = useMyApiKeys()
  const create = useCreateApiKey()
  const [created, setCreated] = useState<CreatedApiKey | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const active = keys.filter((k) => k.revoked_at === null)
  const revoked = keys.filter((k) => k.revoked_at !== null)
  const atLimit = active.length >= MAX_ACTIVE_KEYS

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ApiKeyNameValues>({
    resolver: zodResolver(apiKeyNameSchema),
    defaultValues: { name: '' },
  })

  const submit = handleSubmit(async ({ name }) => {
    setError(null)
    try {
      const key = await create.mutateAsync(name)
      setCreated(key)
      setShowForm(false)
      reset({ name: '' })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo crear la key.')
    }
  })

  return (
    <Card>
      <CardHeader
        title={
          <span className="inline-flex items-center gap-2">
            <Bot size={16} /> Acceso para agentes
          </span>
        }
        description="Keys personales para que Claude Code, Codex o n8n registren y consulten tus horas. Actúan como tú, nunca como admin."
        action={
          !showForm && !atLimit ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              leftIcon={<Plus size={14} />}
              onClick={() => {
                setCreated(null)
                setShowForm(true)
              }}
            >
              Crear key
            </Button>
          ) : undefined
        }
      />
      <CardBody className="space-y-4">
        {created && <NewKeyNotice created={created} onClose={() => setCreated(null)} />}

        {showForm && (
          <form
            onSubmit={(e) => void submit(e)}
            className="flex flex-col gap-3 sm:flex-row sm:items-end"
          >
            <div className="flex-1">
              <Field
                label="Nombre de la key"
                placeholder="Claude Code portátil"
                autoFocus
                maxLength={80}
                error={errors.name?.message}
                {...register('name')}
              />
            </div>
            <div className="flex gap-2">
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Creando…' : 'Crear'}
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setShowForm(false)
                  setError(null)
                  reset({ name: '' })
                }}
              >
                Cancelar
              </Button>
            </div>
          </form>
        )}

        {error && (
          <p className="rounded-card bg-red-soft px-3 py-2 text-xs text-red">{error}</p>
        )}

        {isLoading ? (
          <p className="text-sm text-muted">Cargando…</p>
        ) : active.length === 0 && !created ? (
          <p className="text-sm text-muted">
            Aún no tienes keys. Crea una y guárdala en el <code>.env.local</code> de tu
            repo como <code>INVOXA_API_KEY</code>.
          </p>
        ) : (
          <ul className="divide-y divide-border rounded-xl border border-border">
            {active.map((k) => (
              <KeyRow key={k.id} apiKey={k} />
            ))}
          </ul>
        )}

        {atLimit && (
          <p className="text-xs text-muted">
            Tienes el máximo de {MAX_ACTIVE_KEYS} keys activas. Revoca una para crear otra.
          </p>
        )}

        {revoked.length > 0 && (
          <details className="text-xs text-muted">
            <summary className="cursor-pointer select-none">
              {revoked.length} key{revoked.length === 1 ? '' : 's'} revocada
              {revoked.length === 1 ? '' : 's'}
            </summary>
            <ul className="mt-2 space-y-1">
              {revoked.map((k) => (
                <li key={k.id} className="flex flex-wrap gap-x-2">
                  <span className="font-medium text-text-sec">{k.name}</span>
                  <code>ivx_{k.key_prefix}…</code>
                  <span>revocada {formatRelativeEs(k.revoked_at as string, { addSuffix: true })}</span>
                </li>
              ))}
            </ul>
          </details>
        )}

        <div className="rounded-xl bg-subtle px-3 py-2.5 text-xs text-text-sec">
          <p className="font-semibold text-text">Endpoint</p>
          <code className="mt-1 block break-all">{AGENT_API_URL}</code>
          <p className="mt-1">
            Cabecera <code>Authorization: Bearer ivx_…</code>. Empieza por{' '}
            <code>GET /</code> para ver los endpoints.
          </p>
        </div>

        <SkillDownload />
      </CardBody>
    </Card>
  )
}

function NewKeyNotice({ created, onClose }: { created: CreatedApiKey; onClose: () => void }) {
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(created.api_key)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      setCopied(false)
    }
  }

  return (
    <div className="rounded-xl border border-green/30 bg-green/10 px-3 py-3">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-semibold text-text">
          Key «{created.name}» creada. Cópiala ahora: no se volverá a mostrar.
        </p>
        <button
          type="button"
          aria-label="Cerrar"
          className="text-muted hover:text-text"
          onClick={onClose}
        >
          <X size={16} />
        </button>
      </div>
      <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center">
        <code
          data-testid="new-api-key"
          className="min-w-0 flex-1 break-all rounded-lg bg-surface px-3 py-2 text-xs text-text"
        >
          {created.api_key}
        </code>
        <Button
          type="button"
          size="sm"
          variant={copied ? 'secondary' : 'primary'}
          leftIcon={copied ? <Check size={14} /> : <Copy size={14} />}
          onClick={() => void copy()}
        >
          {copied ? 'Copiada' : 'Copiar'}
        </Button>
      </div>
      <p className="mt-2 text-xs text-text-sec">
        Guárdala en el <code>.env.local</code> de tu repo como{' '}
        <code>INVOXA_API_KEY=…</code>. Nunca la subas a git.
      </p>
    </div>
  )
}

function KeyRow({ apiKey }: { apiKey: ApiKey }) {
  const revoke = useRevokeApiKey()
  const [confirming, setConfirming] = useState(false)

  return (
    <li className="flex flex-col gap-2 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <KeyRound size={14} className="text-muted" />
          <span className="text-sm font-medium text-text">{apiKey.name}</span>
          <code className="text-xs text-muted">ivx_{apiKey.key_prefix}…</code>
        </div>
        <p className="mt-0.5 text-xs text-muted">
          Creada {formatRelativeEs(apiKey.created_at, { addSuffix: true })} ·{' '}
          {apiKey.last_used_at
            ? `último uso ${formatRelativeEs(apiKey.last_used_at, { addSuffix: true })}`
            : 'sin usar'}
        </p>
      </div>
      {confirming ? (
        <div className="flex items-center gap-2">
          <span className="text-xs text-text-sec">¿Revocar?</span>
          <Button
            type="button"
            size="sm"
            variant="danger"
            disabled={revoke.isPending}
            onClick={() => revoke.mutate(apiKey.id)}
          >
            {revoke.isPending ? 'Revocando…' : 'Sí, revocar'}
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => setConfirming(false)}>
            No
          </Button>
        </div>
      ) : (
        <Button type="button" size="sm" variant="ghost" onClick={() => setConfirming(true)}>
          Revocar
        </Button>
      )}
      {revoke.error && <Pill tone="red">{revoke.error.message}</Pill>}
    </li>
  )
}
