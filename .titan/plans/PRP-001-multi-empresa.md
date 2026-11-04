# PRP-001: Invoxa multi-empresa (SaaS) con super admin

> **Estado**: COMPLETADO (2026-11-04) — pendiente de revisión de Roberto en Tasknic
> **Fecha**: 2026-11-04
> **Proyecto**: Invoxa
> **Pedido por**: Roberto Gabriel Cabrera Álvarez
> **Tasknic**: INV0001 (tarea madre) · Fases 0–5: INV0002–INV0007 (encadenadas por dependencias).
> El estado de cada una se consulta en Tasknic, no aquí.

---

## Objetivo

Que Invoxa sirva a varias empresas a la vez. Cada empresa tiene su admin, sus colaboradores, sus
proyectos y sus facturas, totalmente aislados de las demás. Un **super admin** (Fullkod) da de alta
las empresas y puede ver y gestionar todas. Informage Studios pasa a ser la primera empresa, sin
perder datos.

**Fuera de alcance (decidido 2026-11-04):** registro público de empresas y cobro de suscripciones.

## Por Qué

| Problema | Solución |
|----------|----------|
| Invoxa está hecho solo para Informage: el destinatario de la factura, el prefijo `INF-` y la marca están fijos en el código | Datos de la empresa en BD (`companies`) y usados en PDF, numeración y UI |
| Para dar el servicio a otra empresa habría que desplegar otra copia (otro Supabase, otro Vercel) | Una sola instalación, separada por `company_id` con RLS |
| Fullkod no tiene una vista global | Rol `super_admin` con panel de empresas |

**Valor de negocio**: Invoxa pasa de ser un desarrollo a medida a un producto de Fullkod que se puede
vender a más empresas sin coste de infraestructura adicional por cliente.

## Qué

### Decisiones tomadas
- Las empresas las crea el **super admin** (sin registro público ni pagos).
- **Un usuario pertenece a una sola empresa** (`profiles.company_id`). Si en el futuro un colaborador
  trabaja para dos empresas, usará dos cuentas o se hará un PRP de "membresías". *(Recomendación de
  Claude; Roberto puede cambiarla al aprobar.)*
- El super admin no pertenece a ninguna empresa; elige una empresa "activa" en un selector y opera
  en ella con permisos de admin.

### Criterios de Éxito
- [ ] Existe la tabla `companies` y todas las tablas de negocio tienen `company_id` NOT NULL con RLS.
- [ ] Un admin de la empresa A no puede leer ni modificar **nada** de la empresa B (probado con SQL
      como cada rol, por Edge Function y por la UI).
- [ ] El super admin crea una empresa con su primer admin (invitación) desde la UI.
- [ ] El super admin ve la lista de empresas y puede operar dentro de cualquiera.
- [ ] El PDF de factura usa los datos fiscales de la empresa del colaborador (no Informage fijo).
- [ ] El número de factura usa el prefijo de la empresa (Informage conserva `INF-`) y `user_code` es
      único **por empresa**.
- [ ] Los datos actuales quedan en la empresa "Informage Studios" y siguen funcionando igual.
- [ ] `npm run build` y `npm run lint` pasan; prueba en navegador con 2 empresas.

### Comportamiento Esperado
1. El super admin entra → ve `/super/companies` → "Nueva empresa": nombre, datos fiscales, prefijo de
   factura, moneda por defecto y email del primer admin → se crea la empresa y se envía la invitación.
2. El admin de la empresa acepta la invitación y usa Invoxa como hoy, viendo solo su empresa: invita
   colaboradores, crea proyectos, pide facturas.
3. Los colaboradores trabajan igual que hoy; su factura sale a nombre de su empresa.
4. El super admin elige una empresa en el selector y puede revisar sus facturas, usuarios, etc.;
   puede desactivar una empresa (sus usuarios dejan de poder entrar).

---

## Contexto

### Puntos del código que dependen de "una sola empresa"
- `is_admin()` en `supabase/migrations/20260506000001_helpers.sql`: base de ~45 políticas RLS
  (`20260506000002_rls_policies.sql`) más Storage (`..._storage_invoices.sql`, `..._storage_reports.sql`)
  y notificaciones.
- `next_invoice_number()`: prefijo `'INF-'` fijo; `profiles.user_code` e `invoices.invoice_number`
  son `unique` globales.
- `generate-invoice-pdf/index.ts`: datos de Informage Studios S.L.U. fijos.
- Triggers de notificación (`20260506000010_notifications.sql`, líneas ~221 y ~290): avisan a **todos**
  los admins activos → deben filtrar por empresa.
- `request-invoices-bulk`: "todos los activos" → debe ser "todos los activos de la empresa".
- Las 10 Edge Functions comprueban `role !== 'admin'` → deben comprobar además la empresa del objetivo.
- `handle_new_user()`: crea el perfil desde `raw_user_meta_data` → debe recibir `company_id`.
- Frontend: `role === 'admin'` en Sidebar, MobileBottomNav, HomeRedirect, RoleRoute y páginas de
  usuarios; "Informage" en Sidebar, AdminDashboardPage y ProjectsListPage.

### Modelo de Datos (propuesta)
```sql
create table companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  legal_name text not null,
  tax_id text not null,
  address text, city text, postal_code text, country text not null,
  billing_email text,
  invoice_prefix text not null,          -- 'INF' para Informage
  default_currency text not null default 'USD',
  logo_path text,
  status text not null default 'active', -- active | inactive
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table companies enable row level security;

-- user_role: añadir 'super_admin'
-- company_id uuid not null references companies(id) en: profiles (null solo para super_admin),
-- projects, user_project_assignments, compensation_settings, tasks, invoices, invoice_items,
-- invoice_requests, invoice_number_change_requests, invoice_number_history, notifications,
-- email_logs, user_billing_profiles. Índice en cada company_id.

-- Helpers (security definer, stable):
--   current_company_id()  -> company_id del usuario, o la empresa activa elegida por el super admin
--   is_super_admin()
--   is_company_admin(p_company_id uuid default current_company_id())
-- Unicidad: unique (company_id, user_code); unique (company_id, invoice_number)
```
Cómo sabe el servidor qué empresa eligió el super admin: guardarlo en `profiles.active_company_id`
(lo actualiza una Edge Function) en vez de un header, para que RLS lo lea sin confiar en el cliente.

---

## Blueprint (Assembly Line)

> Solo fases. Las subtareas se generan al entrar a cada fase (tf-bucle-agentico).

### Fase 0: Base estable antes de migrar
**Objetivo**: Corregir los huecos que se multiplicarían por empresa: cancelar factura libera sus
tareas, secuencia anual del consecutivo, y dejar `npm run lint` en cero errores.
**Validación**: build y lint limpios; cancelar → regenerar una factura incluye las horas otra vez.

### Fase 1: Modelo de datos multi-empresa
**Objetivo**: Migración con `companies`, rol `super_admin`, `company_id` en todas las tablas, empresa
"Informage Studios" creada con los datos actuales del PDF, backfill de todas las filas, `NOT NULL`,
índices y unicidad por empresa. Roberto pasa a `super_admin`.
**Validación**: migración aplicada en una rama/proyecto de prueba de Supabase; conteos antes/después
iguales; ninguna fila con `company_id` nulo.

### Fase 2: Seguridad (RLS, Storage, funciones SQL)
**Objetivo**: Helpers nuevos; reescribir todas las políticas para filtrar por empresa; Storage con
rutas `{company_id}/{user_id}/…`; `next_invoice_number`, `generate_user_invoice`,
`apply_invoice_number_change` y triggers de notificación por empresa.
**Validación**: script SQL de pruebas de aislamiento (usuario y admin de A contra datos de B → 0 filas
/ error; super admin ve ambas).

### Fase 3: Edge Functions
**Objetivo**: Las 10 funciones validan la empresa del llamante contra la del objetivo; `invite-user`
asigna `company_id`; nueva función `create-company` (solo super admin) y `set-active-company`;
`request-invoices-bulk` limitado a la empresa; PDF con los datos de la empresa.
**Validación**: llamadas cruzadas entre empresas devuelven 403; PDF de cada empresa con su emisor.

### Fase 4: Frontend
**Objetivo**: Rutas `/super/*` (lista, alta y detalle de empresa, selector de empresa activa);
`role` con `super_admin` en Sidebar, MobileBottomNav, HomeRedirect, RoleRoute; textos "Informage"
sustituidos por el nombre de la empresa; caché de TanStack Query separada por empresa.
**Validación**: navegación completa como super admin, admin y colaborador de 2 empresas.

### Fase 5: Validación final y salida a producción
**Objetivo**: QA end-to-end con dos empresas, migración en producción con respaldo previo y
actualización de `BUSINESS_LOGIC.md` y la memoria.
**Validación**:
- [ ] `npm run build` y `npm run lint` pasan
- [ ] Prueba en navegador con evidencia en `.titan/qa/`
- [ ] Criterios de éxito cumplidos
- [ ] Respaldo de la BD antes de migrar producción (con permiso de Roberto)

---

## 🧠 Aprendizajes (Self-Annealing)

### 2026-11-04: Historial de migraciones desalineado en producción
- **Error**: `supabase migration list` mostraba `20260529000000` y `20260619000000` sin aplicar en remoto,
  aunque el bucket `reports` y `ping()` ya existían (se aplicaron a mano). Un `db push` las habría re-ejecutado.
- **Fix**: comprobar los objetos en remoto y `supabase migration repair --status applied <versiones>`; luego `db push --dry-run`.
- **Aplicar en**: cada fase con migraciones (1 y 2): siempre `migration list` + `--dry-run` antes de `db push`.

### 2026-11-04: Fase 1 — rellenar company_id sin tocar el cliente
- **Decisión**: `company_id` lo rellenan triggers (`set_company_from_user`, `set_company_from_invoice`,
  `set_company_from_session`), no el cliente. En tablas con `user_id` el trigger **siempre** pone la
  empresa del usuario (ignora lo que mande el cliente). Proyecto y miembros/tareas/líneas deben ser de la
  misma empresa (`check_project_company`, triggers `*_zcheck_*` para que corran después).
- **Pendiente Fase 3**: quitar los fallbacks "si solo hay una empresa" de `set_company_from_session` y
  `handle_new_user` cuando `invite-user`/Edge Functions manden `company_id`. `email_logs.company_id` y
  `profiles.company_id` siguen nullable (CHECK de super admin en Fase 2).
- Informage: id fijo `5b1c2e0a-7d43-4f8e-9a61-3c0f5e2d9b17`, prefijo `INF`.

### 2026-11-04: Fase 2 — `using`/`with check` necesitan paréntesis
- **Error**: `db push` falló con `syntax error at or near "is_company_admin"`: al regenerar políticas desde
  `pg_policies`, `qual` sin paréntesis (`using is_company_admin(...)`) no es SQL válido.
- **Fix**: siempre `using (<expr>)` / `with check (<expr>)`. La migración va en una transacción: no quedó nada a medias.
- **Decisión**: Storage NO se movió a `{company_id}/...`; la política de admin resuelve la empresa por el
  perfil dueño de la carpeta (`{user_id}`). Sin migrar archivos ni `pdf_url`.
- **Prueba de aislamiento** reutilizable: `supabase/tests/company_isolation_test.sql` (todo en una
  transacción revertida). Correrla tras cada cambio de RLS.

### 2026-11-04: Fase 3 — Edge Functions por empresa
- `_shared/company.ts` (`loadCaller`, `userInCompany`): toda función que usa service role comprueba que
  el usuario/factura/solicitud objetivo es de la empresa del llamante (si no, 403/404 "no encontrado").
- **Decisión**: NO hay `set-active-company`. El super admin cambia `profiles.active_company_id` desde el
  cliente; la política `profiles_self_update_safe_fields` lo permite y solo surte efecto si es super admin.
- `create-company` (Zod, solo super admin): crea la empresa + invita a su primer admin; si la invitación
  falla, borra la empresa.
- Deploy sin Docker: `supabase functions deploy --use-api` (bundle en el servidor). Smoke test: las 11
  responden 401 sin sesión.
- Quitados los fallbacks "si solo hay una empresa" (migración `20261104000004`): una invitación sin
  `company_id` ahora falla. `email_logs` tolera `company_id` nulo para no romper flujos.
- **Sin probar con sesión real**: las funciones con JWT de admin/colaborador se prueban en la Fase 5 (navegador).

---

## Gotchas

- [ ] Supabase Free se pausa y tiene límites: valorar plan Pro antes de meter clientes reales.
- [ ] RLS que consulta `profiles` dentro de políticas de `profiles` → recursión; usar helpers `security definer`.
- [ ] Mover archivos de Storage a rutas nuevas: los `pdf_path` guardados en `invoices` deben actualizarse en la misma migración/script.
- [ ] Realtime de notificaciones respeta RLS: comprobar que no se filtran avisos entre empresas.
- [ ] El correo de invitación lo envía Supabase Auth (SMTP con límite bajo): con varias empresas se nota antes. El envío real de correos sigue pendiente (ver memoria).
- [ ] `appId` nativo y marca de la app siguen siendo de Invoxa/Fullkod, no de cada empresa.

## Anti-Patrones

- NO confiar en un `company_id` enviado por el cliente: el servidor lo deduce del usuario.
- NO usar service role en Edge Functions sin filtrar explícitamente por la empresa del llamante.
- NO aplicar migraciones en producción sin respaldo ni permiso explícito.

---

## Pendiente tras el PRP
- Probar `create-company` con una empresa real (envía la invitación al correo real del admin).
- Envío real de correos (sigue pendiente, ver memoria): con varias empresas el SMTP de Supabase se queda corto.
- Valorar plan Pro de Supabase antes de meter clientes reales.
- Bug previo (no de este PRP): en el PDF de factura, la línea "Cuenta:" de los datos de pago no hace
  salto de línea y se sale de la página si el texto es largo.

*PRP aprobado por Roberto el 2026-11-04.*
