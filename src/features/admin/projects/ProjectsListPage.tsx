import { ChevronRight, FolderKanban, Plus, Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AppShell } from '../../../components/layout/AppShell'
import { Button } from '../../../components/ui/Button'
import { Card } from '../../../components/ui/Card'
import { Pill } from '../../../components/ui/Pill'
import { useCurrentCompany } from '../../companies/queries'
import { useProjects } from './queries'

export function ProjectsListPage() {
  const navigate = useNavigate()
  const [filter, setFilter] = useState<'all' | 'active' | 'inactive'>('all')
  const [search, setSearch] = useState('')
  const { data: projects = [], isLoading, error } = useProjects()
  const { data: company } = useCurrentCompany()

  const filtered = useMemo(() => {
    return projects.filter((p) => {
      if (filter !== 'all' && p.status !== filter) return false
      if (search.trim() && !p.name.toLowerCase().includes(search.toLowerCase()))
        return false
      return true
    })
  }, [projects, filter, search])

  return (
    <AppShell
      title="Proyectos"
      subtitle={`Gestiona los proyectos de ${company?.name ?? 'tu empresa'}`}
      breadcrumbs={[{ label: 'Operación' }, { label: 'Proyectos' }]}
      rightAction={
        <Button
          size="md"
          leftIcon={<Plus size={15} strokeWidth={2.6} />}
          onClick={() => navigate('/admin/projects/new')}
          aria-label="Nuevo proyecto"
        >
          <span className="hidden sm:inline">Nuevo proyecto</span>
        </Button>
      }
    >
      {/* Filters */}
      <div className="mb-4 flex flex-wrap items-center gap-2.5">
        <div className="flex h-9 w-full flex-1 items-center gap-2 rounded-xl border border-border bg-surface px-3 sm:w-auto sm:min-w-[260px] sm:flex-initial">
          <Search size={14} className="text-muted" />
          <input
            type="text"
            placeholder="Buscar proyecto…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 bg-transparent text-sm text-text outline-none placeholder:text-muted"
          />
        </div>
        {/* Mobile: chips */}
        <div className="scrollbar-none -mx-4 flex gap-2 overflow-x-auto px-4 sm:hidden">
          {(['all', 'active', 'inactive'] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={`flex-shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-semibold transition ${
                filter === f
                  ? 'border-primary bg-primary text-white'
                  : 'border-border bg-surface text-text-sec hover:border-border-strong'
              }`}
            >
              {f === 'all' ? 'Todos' : f === 'active' ? 'Activos' : 'Inactivos'}
            </button>
          ))}
        </div>

        {/* Desktop: segmented */}
        <div className="hidden rounded-xl border border-border bg-surface p-1 sm:flex">
          {(['all', 'active', 'inactive'] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                filter === f
                  ? 'bg-primary/10 text-primary'
                  : 'text-text-sec hover:text-text'
              }`}
            >
              {f === 'all' ? 'Todos' : f === 'active' ? 'Activos' : 'Inactivos'}
            </button>
          ))}
        </div>
      </div>

      <Card>
        {isLoading ? (
          <div className="px-5 py-12 text-center text-sm text-muted">
            Cargando proyectos…
          </div>
        ) : error ? (
          <div className="px-5 py-12 text-center text-sm text-red">
            Error: {(error as Error).message}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyProjectsState hasFilter={filter !== 'all' || search !== ''} />
        ) : (
          <>
            {/* Mobile: card list */}
            <ul className="divide-y divide-border md:hidden">
              {filtered.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => navigate(`/admin/projects/${p.id}`)}
                    className="flex w-full items-start gap-3 px-4 py-4 text-left transition hover:bg-subtle"
                  >
                    <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <FolderKanban size={16} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <div className="font-display truncate text-sm font-bold text-text">
                          {p.name}
                        </div>
                        <Pill
                          tone={p.status === 'active' ? 'green' : 'muted'}
                          dot
                        >
                          {p.status === 'active' ? 'Activo' : 'Inactivo'}
                        </Pill>
                      </div>
                      {p.description && (
                        <div className="mt-1 line-clamp-2 text-xs text-muted">
                          {p.description}
                        </div>
                      )}
                      <div className="mt-2 flex items-center gap-3 text-[11px] text-text-sec">
                        <span>
                          <span className="font-semibold text-text">
                            {p.member_count}
                          </span>{' '}
                          colab.
                        </span>
                        <span className="text-muted">·</span>
                        <span>{formatDate(p.created_at)}</span>
                      </div>
                    </div>
                  </button>
                </li>
              ))}
            </ul>

            {/* Desktop: table */}
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[640px] text-sm">
                <thead className="bg-subtle text-left text-xs uppercase tracking-wider text-muted">
                  <tr>
                    <th className="px-5 py-3 font-semibold">Proyecto</th>
                    <th className="px-5 py-3 font-semibold">Estado</th>
                    <th className="px-5 py-3 font-semibold">Colaboradores</th>
                    <th className="px-5 py-3 font-semibold">Creado</th>
                    <th className="w-10 px-5 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filtered.map((p) => (
                    <tr
                      key={p.id}
                      onClick={() => navigate(`/admin/projects/${p.id}`)}
                      className="cursor-pointer transition hover:bg-subtle"
                    >
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                            <FolderKanban size={16} />
                          </div>
                          <div>
                            <div className="font-semibold text-text">
                              {p.name}
                            </div>
                            {p.description && (
                              <div className="mt-0.5 line-clamp-1 max-w-md text-xs text-muted">
                                {p.description}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        <Pill
                          tone={p.status === 'active' ? 'green' : 'muted'}
                          dot
                        >
                          {p.status === 'active' ? 'Activo' : 'Inactivo'}
                        </Pill>
                      </td>
                      <td className="px-5 py-3.5 text-text-sec">
                        {p.member_count}
                      </td>
                      <td className="px-5 py-3.5 text-text-sec">
                        {formatDate(p.created_at)}
                      </td>
                      <td className="px-5 py-3.5 text-muted">
                        <ChevronRight size={16} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </Card>
    </AppShell>
  )
}

function EmptyProjectsState({ hasFilter }: { hasFilter: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center px-5 py-16 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
        <FolderKanban size={22} />
      </div>
      <h3 className="font-display mt-4 text-base font-bold text-text">
        {hasFilter ? 'Sin resultados' : 'Aún no hay proyectos'}
      </h3>
      <p className="mt-1 max-w-sm text-sm text-muted">
        {hasFilter
          ? 'Intenta ajustar los filtros o la búsqueda.'
          : 'Crea tu primer proyecto para empezar a asignar colaboradores y generar facturas.'}
      </p>
      {!hasFilter && (
        <Link
          to="/admin/projects/new"
          className="mt-5 inline-flex h-10 items-center gap-1.5 rounded-xl bg-primary px-4 text-sm font-semibold text-white shadow-glow hover:bg-primary-dark"
        >
          <Plus size={15} strokeWidth={2.6} /> Nuevo proyecto
        </Link>
      )}
    </div>
  )
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('es-CO', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}
