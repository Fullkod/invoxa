import { EyeOff, ShieldCheck, UserPlus, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Button } from '../../../components/ui/Button'
import { Card, CardBody, CardHeader } from '../../../components/ui/Card'
import { Select } from '../../../components/ui/Select'
import type { ProjectMember } from '../../../types/assignment'
import {
  useAddSupervisions,
  useCompanyPeople,
  useProjectSupervisions,
  useRemoveSupervision,
} from './supervisionQueries'

/**
 * PRP-003: who reviews whose hours in this project. A supervisor can be any
 * person of the company; they only supervise current hourly members.
 */
export function SupervisorsCard({
  projectId,
  members,
}: {
  projectId: string
  members: ProjectMember[]
}) {
  const { data: supervisions = [], isLoading, error } = useProjectSupervisions(projectId)
  const { data: people = [] } = useCompanyPeople()
  const add = useAddSupervisions(projectId)
  const remove = useRemoveSupervision(projectId)

  const [supervisorId, setSupervisorId] = useState('')
  const [selected, setSelected] = useState<string[]>([])
  const [formError, setFormError] = useState<string | null>(null)

  const hourlyMembers = useMemo(
    () =>
      members.filter(
        (m) => m.assignment.is_current && m.compensation?.payment_type === 'hourly',
      ),
    [members],
  )

  const bySupervisor = useMemo(() => {
    const map = new Map<string, { name: string; rows: typeof supervisions }>()
    for (const s of supervisions) {
      const name = s.supervisor?.full_name || s.supervisor?.email || '—'
      const entry = map.get(s.supervisor_id) ?? { name, rows: [] }
      entry.rows.push(s)
      map.set(s.supervisor_id, entry)
    }
    return [...map.entries()]
  }, [supervisions])

  const alreadySupervised = new Set(
    supervisions.filter((s) => s.supervisor_id === supervisorId).map((s) => s.member_id),
  )
  const candidates = hourlyMembers.filter(
    (m) => m.user.id !== supervisorId && !alreadySupervised.has(m.user.id),
  )

  const toggle = (id: string) =>
    setSelected((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]))

  const submit = async () => {
    setFormError(null)
    if (!supervisorId || selected.length === 0) {
      setFormError('Elige un responsable y al menos un colaborador.')
      return
    }
    try {
      await add.mutateAsync({ supervisorId, memberIds: selected })
      setSelected([])
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'No se pudo guardar.')
    }
  }

  return (
    <Card>
      <CardHeader
        title="Responsables"
        description="Quién revisa las horas de quién en este proyecto"
      />
      <CardBody>
        <p className="mb-4 flex items-start gap-2 rounded-xl bg-subtle px-3 py-2.5 text-xs text-text-sec">
          <EyeOff size={14} className="mt-0.5 flex-shrink-0 text-muted" />
          Un responsable ve la fecha, las horas y la descripción de las tareas de
          sus colaboradores en este proyecto, y puede aprobarlas o proponer otras
          horas. Nunca ve tarifas, facturas ni datos de cobro.
        </p>

        {isLoading ? (
          <p className="py-4 text-center text-sm text-muted">Cargando…</p>
        ) : error ? (
          <p className="py-4 text-center text-sm text-red">
            Error: {(error as Error).message}
          </p>
        ) : bySupervisor.length === 0 ? (
          <p className="py-2 text-sm text-muted">
            Sin responsables. Solo el admin revisa las horas de este proyecto.
          </p>
        ) : (
          <ul className="space-y-3">
            {bySupervisor.map(([id, { name, rows }]) => (
              <li key={id} className="rounded-xl border border-border px-3.5 py-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-text">
                  <ShieldCheck size={15} className="text-primary" /> {name}
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {rows.map((s) => (
                    <span
                      key={s.id}
                      className="inline-flex items-center gap-1 rounded-full bg-subtle2 py-1 pl-2.5 pr-1 text-xs font-medium text-text-sec"
                    >
                      {s.member?.full_name || s.member?.email || '—'}
                      <button
                        type="button"
                        onClick={() => remove.mutate(s.id)}
                        disabled={remove.isPending}
                        className="rounded-full p-0.5 text-muted hover:bg-border hover:text-red disabled:opacity-50"
                        aria-label={`Quitar a ${s.member?.full_name ?? 'colaborador'} de ${name}`}
                      >
                        <X size={12} />
                      </button>
                    </span>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-5 space-y-3 border-t border-border pt-4">
          <Select
            id="supervisor-select"
            label="Responsable"
            placeholder="Elige a una persona de la empresa"
            value={supervisorId}
            onChange={(e) => {
              setSupervisorId(e.target.value)
              setSelected([])
            }}
            options={people.map((p) => ({
              value: p.id,
              label: `${p.full_name || p.email}${p.role === 'admin' ? ' (admin)' : ''}`,
            }))}
          />

          {supervisorId && (
            <div className="space-y-1.5">
              <span className="block text-xs font-semibold text-text-sec">
                Colaboradores a su cargo (solo los que cobran por hora)
              </span>
              {candidates.length === 0 ? (
                <p className="text-xs text-muted">
                  No quedan colaboradores por hora para asignarle.
                </p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {candidates.map((m) => {
                    const on = selected.includes(m.user.id)
                    return (
                      <button
                        key={m.user.id}
                        type="button"
                        onClick={() => toggle(m.user.id)}
                        aria-pressed={on}
                        className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                          on
                            ? 'border-primary bg-primary/10 text-primary'
                            : 'border-border bg-surface text-text-sec hover:bg-subtle'
                        }`}
                      >
                        {m.user.full_name || m.user.email}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {formError && (
            <p className="rounded-md bg-red/10 px-3 py-2 text-xs text-red">{formError}</p>
          )}

          <div className="flex justify-end">
            <Button
              size="sm"
              variant="outline"
              leftIcon={<UserPlus size={14} />}
              onClick={submit}
              disabled={add.isPending || !supervisorId || selected.length === 0}
            >
              {add.isPending ? 'Guardando…' : 'Asignar'}
            </Button>
          </div>
        </div>
      </CardBody>
    </Card>
  )
}
