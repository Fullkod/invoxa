import { Check, MessageSquare, X } from 'lucide-react'
import { useState } from 'react'
import { z } from 'zod'
import { Button } from '../../components/ui/Button'
import type { Task } from '../../types/task'
import { useRespondToProposal } from './queries'
import { ReviewStatusPill } from './ReviewStatusPill'

const rejectSchema = z.object({
  comment: z
    .string()
    .trim()
    .min(2, 'Explica por qué no aceptas la propuesta')
    .max(1000, 'Máximo 1000 caracteres'),
})

export function TaskReviewPanel({ task }: { task: Task }) {
  const respond = useRespondToProposal()
  const [rejecting, setRejecting] = useState(false)
  const [comment, setComment] = useState('')
  const [error, setError] = useState<string | null>(null)
  const status = task.review_status ?? 'pending'
  const proposed = task.proposed_hours == null ? null : Number(task.proposed_hours)

  const answer = async (accept: boolean) => {
    setError(null)
    if (!accept) {
      const parsed = rejectSchema.safeParse({ comment })
      if (!parsed.success) {
        setError(parsed.error.issues[0]?.message ?? 'Datos inválidos')
        return
      }
    }
    try {
      await respond.mutateAsync({ taskId: task.id, accept, comment })
      setRejecting(false)
      setComment('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar.')
    }
  }

  return (
    <div className="mb-4 rounded-card border border-border bg-surface px-4 py-3.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted">
          Revisión
        </span>
        <ReviewStatusPill status={status} />
      </div>

      {task.review_comment && (
        <p className="mt-2 flex gap-1.5 text-sm text-text-sec">
          <MessageSquare size={14} className="mt-0.5 flex-shrink-0 text-muted" />
          {task.review_comment}
        </p>
      )}
      {task.response_comment && status !== 'changes_proposed' && (
        <p className="mt-1 text-xs text-muted">Tu respuesta: {task.response_comment}</p>
      )}

      {status === 'changes_proposed' && proposed != null && (
        <div className="mt-3 rounded-xl bg-subtle px-3 py-3">
          <p className="text-sm text-text">
            Te proponen <strong>{proposed} h</strong> en vez de{' '}
            <strong>{Number(task.hours)} h</strong>.
          </p>
          {rejecting ? (
            <div className="mt-2 space-y-2">
              <input
                type="text"
                maxLength={1000}
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="¿Por qué mantienes tus horas?"
                aria-label="Motivo"
                className="block h-9 w-full rounded-lg border border-border bg-surface px-2.5 text-sm text-text"
              />
              <div className="flex gap-2">
                <Button size="sm" variant="danger" onClick={() => answer(false)} disabled={respond.isPending}>
                  Enviar respuesta
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setRejecting(false)}>
                  Cancelar
                </Button>
              </div>
            </div>
          ) : (
            <div className="mt-2 flex flex-wrap gap-2">
              <Button
                size="sm"
                leftIcon={<Check size={14} />}
                onClick={() => answer(true)}
                disabled={respond.isPending}
              >
                Aceptar {proposed} h
              </Button>
              <Button
                size="sm"
                variant="outline"
                leftIcon={<X size={14} />}
                onClick={() => setRejecting(true)}
              >
                No aceptar
              </Button>
            </div>
          )}
        </div>
      )}

      {status === 'approved' && !task.invoice_id && (
        <p className="mt-2 text-xs text-muted">
          Si editas la tarea, vuelve a quedar pendiente de revisión.
        </p>
      )}
      {error && <p className="mt-2 rounded-md bg-red/10 px-3 py-2 text-xs text-red">{error}</p>}
    </div>
  )
}
