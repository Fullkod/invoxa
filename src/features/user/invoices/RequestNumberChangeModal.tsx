import { X } from 'lucide-react'
import { useState } from 'react'
import { Button } from '../../../components/ui/Button'
import { Field } from '../../../components/ui/Field'
import { Textarea } from '../../../components/ui/Textarea'
import { useRequestInvoiceNumberChange } from '../../invoiceNumberChange/queries'

export function RequestNumberChangeModal({
  open,
  onClose,
  invoiceId,
  currentNumber,
}: {
  open: boolean
  onClose: () => void
  invoiceId: string
  currentNumber: string
}) {
  const [requestedNumber, setRequestedNumber] = useState(currentNumber)
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)

  const requestChange = useRequestInvoiceNumberChange()

  // Reset state on open (adjusted during render, not in an effect).
  const resetKey = open ? currentNumber : null
  const [lastResetKey, setLastResetKey] = useState(resetKey)
  if (resetKey !== lastResetKey) {
    setLastResetKey(resetKey)
    if (open) {
      setRequestedNumber(currentNumber)
      setReason('')
      setError(null)
      setSubmitted(false)
    }
  }

  if (!open) return null

  const handleSubmit = async () => {
    setError(null)
    const trimmed = requestedNumber.trim()
    if (!trimmed) {
      setError('El nuevo número no puede estar vacío.')
      return
    }
    if (trimmed === currentNumber) {
      setError('Debe ser distinto al número actual.')
      return
    }
    if (!reason.trim()) {
      setError('Cuéntale al admin por qué pides el cambio.')
      return
    }

    try {
      await requestChange.mutateAsync({
        invoiceId,
        requestedInvoiceNumber: trimmed,
        reason: reason.trim(),
      })
      setSubmitted(true)
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Error al enviar la solicitud.',
      )
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-text/40 px-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-card border border-border bg-surface shadow-card"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between border-b border-border px-5 py-4">
          <div>
            <h3 className="font-display text-base font-bold text-text">
              Solicitar cambio de consecutivo
            </h3>
            <p className="mt-1 text-xs text-muted">
              Un admin revisará tu solicitud antes de aplicar el cambio.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted hover:bg-subtle hover:text-text"
            aria-label="Cerrar"
          >
            <X size={16} />
          </button>
        </div>

        {submitted ? (
          <div className="px-5 py-6 text-center">
            <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-green/10 text-green">
              ✓
            </div>
            <p className="mt-3 text-sm text-text">
              Tu solicitud quedó registrada.
            </p>
            <p className="mt-1 text-xs text-muted">
              Recibirás aviso cuando el admin la resuelva.
            </p>
            <Button
              variant="outline"
              size="md"
              className="mt-5"
              onClick={onClose}
            >
              Cerrar
            </Button>
          </div>
        ) : (
          <div className="space-y-3 px-5 py-4">
            <div className="rounded-card border border-border bg-subtle px-3.5 py-2.5">
              <p className="text-xs text-muted">Número actual</p>
              <p className="mt-0.5 font-mono text-sm font-medium text-text">
                {currentNumber}
              </p>
            </div>

            <Field
              label="Nuevo número solicitado"
              value={requestedNumber}
              onChange={(e) => setRequestedNumber(e.target.value)}
              placeholder="INF-RCA-2026-0001"
              className="font-mono"
            />

            <Textarea
              label="Motivo"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              maxLength={500}
              placeholder="Ej. error en el orden, factura previa anulada…"
            />

            {error && (
              <p className="rounded-card bg-red-soft px-3 py-2 text-xs text-red">
                {error}
              </p>
            )}

            <div className="flex gap-2 pt-1">
              <Button
                fullWidth
                size="md"
                onClick={handleSubmit}
                disabled={requestChange.isPending}
              >
                {requestChange.isPending ? 'Enviando…' : 'Enviar solicitud'}
              </Button>
              <Button
                fullWidth
                variant="ghost"
                size="md"
                onClick={onClose}
                disabled={requestChange.isPending}
              >
                Cancelar
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
