# PRP-003: Supervisión de horas por proyecto (responsables)

> **Estado**: COMPLETADO (2026-11-05) — migraciones aplicadas en producción, `agent-api` desplegada, QA
> 21/21 (`.titan/qa/2026-11-05-supervision/`), commit y push con permiso de Roberto.
> **Tasknic**: INV0014 (madre) · INV0015–INV0022. El estado se consulta en Tasknic, no aquí.
> **Fecha**: 2026-11-05
> **Proyecto**: Invoxa
> **Pedido por**: Roberto Gabriel Cabrera Álvarez (idea de CommerceCraft)
> **Antes de empezar**: leer `.titan/memory/MEMORY.md`, `BUSINESS_LOGIC.md` ("Aislamiento entre empresas"),
> PRP-001 y PRP-002. **Requisito previo:** la auditoría de aislamiento
> (`.titan/memory/project/2026-11-05-auditoria-aislamiento.md`) debe estar hecha y en verde.

---

## Objetivo

Que un admin o un **responsable** (cualquier miembro de la empresa) revise las tareas y horas de los
colaboradores que tiene a su cargo en un proyecto concreto: aprobarlas o proponer otras horas, con un
comentario. El responsable **no ve** cuánto cobra nadie, ni facturas ni datos fiscales.

## Por Qué

| Problema | Solución |
|----------|----------|
| El admin no puede revisar a mano las horas de todo el equipo | Delega la revisión de cada proyecto en quien lo conoce (un líder técnico) |
| Las horas mal cargadas se descubren en la factura, tarde | Se revisan antes, tarea a tarea, con una propuesta de corrección |
| Un líder de equipo no debe saber las tarifas de sus compañeros | Lee solo fecha, horas y descripción; nunca importes |

**Valor de negocio**: facturas más fiables para empresas con equipos (CommerceCraft) y argumento de venta
de Invoxa frente a una hoja de horas.

## Qué

### Decisiones tomadas (2026-11-05)
1. **El responsable propone, no edita.** El colaborador acepta la propuesta (las horas cambian) o la
   rechaza/comenta. El admin sí puede aplicar el cambio directamente.
2. **Aprobación obligatoria para facturar: opción por proyecto**, apagada por defecto (Informage sigue
   igual). Encendida, **no se puede facturar el mes con tareas sin aprobar** (decisión del 2026-11-05: la
   factura se bloquea y la app avisa antes), en vez de facturar solo las aprobadas.
3. **Cualquier miembro de la misma empresa** puede ser responsable (sin rol nuevo en `profiles`).
4. **Solo colaboradores por hora.** Los de tarifa fija no entran en la supervisión.
5. **Supervisión por proyecto y por persona:** una persona puede ser responsable en varios proyectos y
   tutelar a gente distinta en cada uno, y un proyecto puede tener varios responsables
   (p. ej. R1 en X e Y, R2 en Z y W). Ser responsable en X no da nada en otro proyecto.

### Criterios de Éxito
- [ ] El admin asigna, en cada proyecto, qué responsable tutela a qué colaboradores (y lo quita).
- [ ] El responsable ve una bandeja "Por revisar" con las tareas de sus tutelados, solo de esos proyectos.
- [ ] Puede aprobar una tarea, o proponer otras horas con comentario; el colaborador recibe aviso.
- [ ] El colaborador acepta (horas actualizadas, tarea aprobada) o rechaza con comentario.
- [ ] Con la opción del proyecto encendida, una tarea no aprobada no entra en la factura.
- [ ] Test SQL: un responsable **no puede** leer `compensation_settings`, `invoices`, `invoice_items`,
      `user_billing_profiles`, ni tareas de no tutelados, ni nada de otra empresa.
- [ ] La Agent API (PRP-002) respeta el estado: `GET /tasks` devuelve `review`, y editar una tarea
      revisada la devuelve a `pending` (igual que en la app; cambiado en la implementación: bloquearla
      por API habría sido incoherente con la UI).
- [ ] `npm run build` y `npm run lint` pasan; QA con Playwright en `.titan/qa/`.

### Comportamiento Esperado
1. El admin abre el proyecto X → "Responsables" → elige a R1 y marca a A y B como sus tutelados.
2. A registra 6 h. La tarea queda `pendiente`; R1 recibe una notificación.
3. R1 abre "Por revisar", ve la tarea de A (fecha, nombre, descripción, horas) y propone 4 h con el
   comentario "la reunión no cuenta". La tarea pasa a `cambios_propuestos`; A recibe aviso.
4. A acepta: la tarea queda en 4 h y `aprobada`. (O rechaza con comentario y vuelve a R1.)
5. A fin de mes, si X exige aprobación, la factura de A solo incluye las tareas aprobadas.
6. Si A edita una tarea ya aprobada, vuelve a `pendiente`.

---

## Contexto

### Referencias
- `supabase/migrations/20261104000003_company_scoped_security.sql` — patrón de RLS por empresa (`is_company_admin`).
- `supabase/migrations/20261104000000_cancel_releases_tasks_yearly_sequence.sql` — `generate_user_invoice` (toma tareas con `invoice_id is null`).
- `supabase/migrations/20261104000006_agent_api_keys.sql` — patrón de RPC `security definer` sin escritura directa.
- `supabase/tests/company_isolation_test.sql` — patrón del test que se revierte.
- `src/features/admin/projects/` (miembros) y `src/features/user/tasks/` (tareas) — UI a extender.
- `supabase/functions/agent-api/index.ts` — reglas de edición de tareas por API.

### Arquitectura Propuesta
```
src/features/review/          # bandeja del responsable (nueva)
├── ReviewInboxPage.tsx       # /app/review
├── ReviewTaskCard.tsx
└── queries.ts                # solo RPC, nunca .from('tasks')
src/features/admin/projects/  # + gestión de responsables por proyecto
src/features/user/tasks/      # + estado de revisión y aceptar/rechazar propuesta
```

### Modelo de Datos (borrador)
```sql
-- Quién tutela a quién, en qué proyecto. N:M en ambos sentidos.
create table project_supervisions (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id),      -- trigger, como el resto
  project_id uuid not null references projects(id) on delete cascade,
  supervisor_id uuid not null references profiles(id) on delete cascade,
  member_id uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (project_id, supervisor_id, member_id),
  check (supervisor_id <> member_id)
);
alter table project_supervisions enable row level security;
-- Escritura: solo admin de la empresa. Lectura: admin, o el propio supervisor/miembro.

alter table projects add column requires_approval boolean not null default false;

alter table tasks
  add column review_status text not null default 'pending'
    check (review_status in ('pending','approved','changes_proposed')),
  add column proposed_hours numeric(6,2) check (proposed_hours > 0),
  add column review_comment text,
  add column reviewed_by uuid references profiles(id),
  add column reviewed_at timestamptz;
-- El colaborador no puede tocar review_* directamente (trigger o columnas revocadas);
-- editar horas/descripción de una tarea aprobada la devuelve a 'pending'.

-- Acceso del responsable SOLO por RPC security definer, que devuelven columnas permitidas:
--   list_supervised_tasks(project?, status?, from?, to?)
--   review_task(task_id, action 'approve'|'propose', proposed_hours?, comment?)
--   respond_to_proposal(task_id, accept boolean, comment?)   -- el colaborador
-- Sin políticas nuevas de SELECT sobre tasks para el responsable.
```

---

## Blueprint

### Fase 0: Auditoría de aislamiento (requisito previo)
**Objetivo**: demostrar que hoy no hay fugas entre empresas (ver la memoria de la auditoría).
**Validación**: test ampliado en verde y evidencia en `.titan/qa/`.

### Fase 1: Base de datos
**Objetivo**: `project_supervisions`, columnas de revisión, `requires_approval`, RPCs, filtro de
`generate_user_invoice`, notificaciones y test de privacidad del responsable.
**Validación**: `--dry-run`, migración aplicada con permiso, test SQL en verde (incluye "no ve importes").

### Fase 2: Admin — responsables por proyecto
**Objetivo**: en el proyecto, asignar/quitar responsables y sus tutelados (solo miembros por hora), y
la opción "exigir aprobación".
**Validación**: Playwright como admin.

### Fase 3: Bandeja del responsable
**Objetivo**: `/app/review` (enlace visible solo si tutela a alguien): aprobar o proponer horas.
**Validación**: Playwright como responsable; no aparece ningún importe en la red ni en la UI.

### Fase 4: Colaborador y Agent API
**Objetivo**: estado de revisión en la lista de tareas, aceptar/rechazar propuesta, aviso; la API
respeta el estado y lo devuelve; actualizar skill `invoxa` (en Claude y Codex).
**Validación**: Playwright como colaborador + llamadas a la API.

### Implementado (2026-11-05)
- Migraciones: `20261105000000_restrict_privileged_functions.sql`, `20261105000001_task_review_notification_types.sql`,
  `20261105000002_task_supervision.sql`.
- Tests: `supabase/tests/company_isolation_test.sql` (ampliado), `supabase/tests/supervision_test.sql`.
- Frontend: `src/features/review/` (bandeja, panel del colaborador, queries), `src/types/supervision.ts`,
  `admin/projects/SupervisorsCard.tsx` + `supervisionQueries.ts`, opción en `ProjectForm`, rutas
  `/app/review` y `/admin/review`, menú lateral, notificaciones.
- `agent-api`: devuelve `review` en cada tarea. Skill `invoxa` actualizado (Claude y Codex).

### Fase 5: Validación final
**Validación**:
- [ ] `npm run build` y `npm run lint` pasan
- [ ] Flujo completo admin → colaborador → responsable → factura en Playwright
- [ ] `BUSINESS_LOGIC.md` actualizado
- [ ] Criterios de éxito cumplidos

---

## Aprendizajes

### 2026-11-05: Funciones SECURITY DEFINER expuestas por defecto (Fase 0)
- **Error**: Supabase da EXECUTE a `anon`/`authenticated` en toda función nueva; 4 funciones privilegiadas
  eran invocables por `/rest/v1/rpc/` con la anon key y ids de otra empresa.
- **Fix**: migración `20261105000000` (solo `service_role`) + regla en `AGENTS.md` + check en el test.
- **Aplicar en**: toda función nueva (las de este PRP ya declaran sus grants).

### 2026-11-05: Valores nuevos de un enum
- **Error**: un valor añadido con `alter type ... add value` no se puede usar en la misma transacción.
- **Fix**: migración aparte (`20261105000001`) antes de la que lo usa.

### 2026-11-05: Probar migraciones sin tocar producción
- **Fix**: PGlite (Postgres en WASM) + stubs de `auth`/`storage`/roles de Supabase: aplica las 23
  migraciones y corre `supabase/tests/*.sql` en local. Hoy vive en el scratchpad de la sesión; se puede
  traer al repo si Roberto quiere (`npm run test:db`).
- **Ojo**: PGlite no trae pgcrypto; se stubbea `extensions.gen_random_bytes`.

### 2026-11-05: Caché persistida de TanStack Query
- **Error**: un `Set` en el resultado de una query no sobrevive a la serialización JSON.
- **Fix**: devolver arrays.

### 2026-11-05: Formulario con datos viejos tras una mutación (QA)
- **Error**: `TaskForm` lee `initial` solo al montarse; tras aceptar una propuesta mostraba 6 h y guardar
  habría revertido la tarea.
- **Fix**: `key={`${task.id}-${task.updated_at}`}` para remontarlo cuando la tarea cambia.
- **Aplicar en**: cualquier formulario con `defaultValues` cuya entidad pueda cambiar por otra vía.

### 2026-11-05: `Select` sin `id`
- **Error**: el componente `Select` asocia la etiqueta por `id || name`; sin ninguno, el label no apunta al
  `<select>` (Playwright y lectores de pantalla no lo encuentran).
- **Fix**: pasar siempre `id` (o `name`).

## Decisiones tomadas durante la implementación

- **Aprobación tardía** (pregunta abierta): resuelta por Roberto — el mes no se cierra con tareas sin aprobar.
- **Descarga del skill** (petición de Roberto, 2026-11-05): botón "Descargar SKILL.md" / "Copiar contenido"
  en *Acceso para agentes*; el archivo sale del mismo `.claude/skills/invoxa/SKILL.md` del repo (`?raw`).

---

## Gotchas

- [ ] **No dar al responsable `select` sobre `tasks` por RLS**: una política nueva abriría también los
      joins del cliente. Todo por RPC con columnas explícitas.
- [ ] Las notificaciones al responsable no deben incluir importes.
- [ ] Tareas antiguas: al añadir `review_status` quedan `pending`; en proyectos sin `requires_approval`
      no bloquea nada. Decidir si se marcan `approved` las ya facturadas.
- [ ] Un miembro que pasa a tarifa fija o sale del proyecto: su supervisión deja de aplicar (no borrar
      historial de revisiones).
- [ ] El supervisor y el tutelado deben ser de la misma empresa y miembros actuales del proyecto (trigger).
- [ ] El responsable también puede ser colaborador del mismo proyecto: sus propias horas las revisa otro
      o el admin, nunca él mismo.
- [ ] Todo contra producción: `migration list` + `--dry-run`, y permiso de Roberto antes de aplicar.

## Anti-Patrones

- NO crear un rol nuevo en `profiles` (decisión 3).
- NO exponer tarifas en vistas, RPCs o notificaciones del responsable.
- NO `any`; Zod en formularios y en `agent-api`.

---

*PRP pendiente de aprobación. No se ha modificado código.*
