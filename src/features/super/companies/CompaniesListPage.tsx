import { Building2, ChevronRight, LogIn, Plus } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { AppShell } from '../../../components/layout/AppShell'
import { Button } from '../../../components/ui/Button'
import { Card } from '../../../components/ui/Card'
import { Pill } from '../../../components/ui/Pill'
import type { Company } from '../../../types/company'
import { useProfile } from '../../auth/useProfile'
import { useCompanies, useSetActiveCompany } from '../../companies/queries'

export function CompaniesListPage() {
  const navigate = useNavigate()
  const { data: profile } = useProfile()
  const { data: companies = [], isLoading, error } = useCompanies()
  const setActive = useSetActiveCompany()

  const enter = async (company: Company) => {
    await setActive.mutateAsync(company.id)
    navigate('/admin/dashboard')
  }

  return (
    <AppShell
      title="Empresas"
      subtitle="Todas las empresas que usan Invoxa"
      breadcrumbs={[{ label: 'Super admin' }, { label: 'Empresas' }]}
      rightAction={
        <Button
          size="md"
          leftIcon={<Plus size={15} strokeWidth={2.6} />}
          onClick={() => navigate('/super/companies/new')}
          aria-label="Nueva empresa"
        >
          <span className="hidden sm:inline">Nueva empresa</span>
        </Button>
      }
    >
      <Card>
        {isLoading ? (
          <div className="px-5 py-12 text-center text-sm text-muted">Cargando empresas…</div>
        ) : error ? (
          <div className="px-5 py-12 text-center text-sm text-red">
            Error: {(error as Error).message}
          </div>
        ) : companies.length === 0 ? (
          <div className="px-5 py-12 text-center text-sm text-muted">
            Todavía no hay empresas.
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {companies.map((c) => {
              const isCurrent = profile?.active_company_id === c.id
              return (
                <li
                  key={c.id}
                  className="flex flex-wrap items-center gap-3 px-4 py-4 sm:flex-nowrap sm:px-5"
                >
                  <button
                    type="button"
                    onClick={() => navigate(`/super/companies/${c.id}`)}
                    className="flex min-w-0 flex-1 items-center gap-3 text-left"
                  >
                    <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <Building2 size={16} />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-display truncate text-sm font-bold text-text">
                          {c.name}
                        </span>
                        {isCurrent && <Pill tone="blue">Trabajando aquí</Pill>}
                      </div>
                      <div className="mt-0.5 truncate text-xs text-muted">
                        {c.legal_name} · {c.tax_id} · prefijo {c.invoice_prefix}
                      </div>
                    </div>
                  </button>
                  <Pill tone={c.status === 'active' ? 'green' : 'muted'} dot>
                    {c.status === 'active' ? 'Activa' : 'Desactivada'}
                  </Pill>
                  <Button
                    size="sm"
                    variant={isCurrent ? 'secondary' : 'primary'}
                    leftIcon={<LogIn size={14} />}
                    onClick={() => enter(c)}
                    disabled={setActive.isPending}
                  >
                    Entrar
                  </Button>
                  <ChevronRight size={16} className="hidden text-muted sm:block" />
                </li>
              )
            })}
          </ul>
        )}
      </Card>
    </AppShell>
  )
}
