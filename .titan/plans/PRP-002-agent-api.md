# PRP-002: API para agentes (Claude Code, Codex, n8n) — registrar y consultar horas

> **Estado**: APROBADO (Roberto, 2026-11-04) — pendiente de implementar en otro chat
> **Fecha**: 2026-11-04
> **Proyecto**: Invoxa
> **Pedido por**: Roberto Gabriel Cabrera Álvarez
> **Tasknic**: INV0008 (tarea madre) · Fases 1–5: INV0009–INV0013 (encadenadas por dependencias).
> El estado de cada una se consulta en Tasknic, no aquí.
> **Antes de empezar**: leer `.titan/memory/MEMORY.md`, `BUSINESS_LOGIC.md` (sobre todo "Aislamiento entre
> empresas") y el PRP-001 (`.titan/plans/PRP-001-multi-empresa.md`), que dejó el modelo multi-empresa.

---

## Objetivo

Una API REST (Edge Function `agent-api`) autenticada con **API keys personales** para que un agente
(Claude Code, Codex, n8n, un script) registre y consulte las horas de **un colaborador** en Invoxa, más
un skill de Claude Code que la explica. Inspirado en la Agent API de Tasknic.

## Por Qué

| Problema | Solución |
|----------|----------|
| Los colaboradores olvidan apuntar horas o las apuntan a fin de mes de memoria | El agente con el que trabajan las registra al terminar ("registra 3 h en Adeslas: refactor del checkout") |
| Para saber cuántas horas llevan hay que entrar en la app | `GET /summary?month=` responde desde el terminal |
| Automatizaciones (n8n, scripts) no pueden hablar con Invoxa | API estable y documentada con keys revocables |

**Valor de negocio**: facturas más completas y a tiempo (menos horas perdidas), y argumento de venta del
producto Invoxa para empresas técnicas.

## Qué

### Decisiones tomadas (2026-11-04)
- **Fase 1 de la API: solo colaboradores** (rol `user`). La key actúa como ese usuario, nunca como admin.
  Las funciones de admin (pedir facturas, ver las de todos) quedan para un PRP futuro.
- **API REST + skill primero.** MCP más adelante, como capa fina encima de esta misma API (fuera de alcance).
- Colaboradores con **tarifa fija** no registran horas: para ellos la API es solo de consulta.
- Sin `any`, validación con **Zod** en la Edge Function, migración con RLS, nada de secretos en el repo.

### Criterios de Éxito
- [ ] Un colaborador crea una key desde su perfil, la ve **una sola vez**, y puede revocarla.
- [ ] Con la key, un agente lista sus proyectos por hora, crea/edita/borra tareas **no facturadas** y
      consulta tareas, resumen mensual y facturas propias.
- [ ] La key no puede ver ni tocar nada de otro usuario ni de otra empresa (probado).
- [ ] La key deja de funcionar al revocarla, si el usuario pasa a `inactive` o si su empresa se desactiva.
- [ ] En la BD solo se guarda el **hash** de la key; la key nunca aparece en logs ni en respuestas posteriores.
- [ ] Las tareas creadas por API quedan marcadas (`tasks.source = 'api'`) y el admin lo ve en la UI.
- [ ] Existe un skill `invoxa` para Claude Code (y su gemelo de Codex) que explica cómo usar la API.
- [ ] `npm run build` y `npm run lint` limpios; QA en navegador + llamadas reales con una key de prueba.

### Comportamiento Esperado (happy path)
1. El colaborador entra en Invoxa → Perfil → **Acceso para agentes** → "Crear key" con un nombre
   ("Claude Code portátil") → ve `ivx_…` una vez y la copia al `.env.local` de su repo como `INVOXA_API_KEY`.
2. En Claude Code: "registra 2,5 h hoy en Adeslas: integración de pagos" → el skill llama a
   `GET /projects` (resuelve "Adeslas") y `POST /tasks` → la tarea aparece en `/app/tasks`.
3. "¿Cuántas horas llevo este mes?" → `GET /summary?month=2026-11` → horas por proyecto e importe estimado.
4. Si pierde el portátil, revoca la key desde la misma pantalla y deja de funcionar al instante.

---

## Contexto

### Lo que ya existe y hay que reutilizar
- Edge Functions con service role + comprobación manual del dueño/empresa:
  `supabase/functions/_shared/company.ts` (`loadCaller`, `userInCompany`). Patrón de CORS/`jsonResponse`
  en cualquier función (p. ej. `create-company/index.ts`, que ya valida con Zod vía `https://esm.sh/zod@3.23.8`).
- Tabla `tasks` (`user_id`, `project_id`, `invoice_id`, `name`, `description`, `task_date`, `hours` > 0,
  `observations`, `company_id`). `company_id` lo rellena el trigger `tasks_set_company`; el trigger
  `tasks_zcheck_project_company` exige que el proyecto sea de la misma empresa. **Una tarea con
  `invoice_id` no nulo está facturada y no se edita ni borra** (misma regla que la RLS
  `tasks_self_update_unbilled` / `tasks_self_delete_unbilled`).
- Reglas de validación de tareas del frontend: `src/features/user/tasks/taskSchema.ts`
  (nombre 2–200, descripción ≤ 1000, horas 0.25–24, fecha `YYYY-MM-DD`). La API usa las mismas.
- Proyectos donde el usuario cobra por hora: `user_project_assignments.is_current = true` +
  `compensation_settings` activa con `payment_type = 'hourly'` (ver `src/features/user/tasks/queries.ts`).
- Facturas: `invoices` (`user_id`, `invoice_number`, `status`, `total`, `currency`, periodo).
- Empresa desactivada: `companies.status = 'inactive'`. Usuario desactivado: `profiles.status = 'inactive'`.
- Referencia de diseño de API para agentes: el skill de Tasknic (`.claude/skills/tf-tasknic/SKILL.md`):
  `GET /` como índice, errores 4xx con campo `error`, nombres en vez de UUID cuando se pueda.

### Arquitectura propuesta
```
supabase/
  migrations/2026XXXXXXXXXX_agent_api_keys.sql
  functions/agent-api/index.ts          # router por método + ruta, Zod, auth por key
  functions/_shared/apiKey.ts           # hash + lookup de la key (sin exponerla)
src/features/user/api-keys/
  ApiKeysPage.tsx (o sección en BillingProfilePage)  # crear / listar / revocar
  queries.ts
.claude/skills/invoxa/SKILL.md           # skill para Claude Code (y gemelo en plugins/titan-factory-codex)
```

### Modelo de Datos
```sql
create table api_keys (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  company_id uuid not null references companies(id) on delete restrict,  -- trigger set_company_from_user
  name text not null check (char_length(name) between 2 and 80),
  key_prefix text not null,          -- primeros 8 caracteres tras "ivx_", para reconocerla en la UI
  key_hash text not null unique,     -- sha256 hex de la key completa
  last_used_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);
alter table api_keys enable row level security;
-- RLS: el dueño ve y revoca las suyas (update solo de revoked_at); el admin de la empresa ve/revoca las
-- de su empresa (is_company_admin(company_id)). INSERT solo vía función (la key se genera en servidor).

alter table tasks add column source text not null default 'app' check (source in ('app', 'api'));
```
Generación: `ivx_` + 32 bytes aleatorios en base64url. Se crea en servidor (RPC `security definer`
`create_api_key(p_name)` que devuelve la key en claro **una vez** y guarda solo el hash; o un endpoint de
`agent-api` autenticado con JWT). Límite sugerido: 5 keys activas por usuario.

### Endpoints (`/functions/v1/agent-api`, header `Authorization: Bearer ivx_…`)
| Método | Ruta | Qué hace |
|---|---|---|
| GET | `/` | Quién soy (nombre, empresa, rol) + índice de endpoints |
| GET | `/projects` | Mis proyectos actuales: nombre, `payment_type`, tarifa, moneda |
| GET | `/tasks?from=&to=&project=&billed=` | Mis tareas (proyecto por nombre o id) |
| POST | `/tasks` | Crear tarea: `project` (nombre o id), `task_date` (por defecto hoy), `hours`, `name`, `description?`, `observations?` — solo proyectos por hora |
| PATCH | `/tasks/:id` | Editar tarea **no facturada** |
| DELETE | `/tasks/:id` | Borrar tarea **no facturada** |
| GET | `/summary?month=YYYY-MM` | Horas por proyecto + importe estimado (horas × tarifa; fijo = mensualidad) |
| GET | `/invoices` | Mis facturas: número, periodo, total, moneda, estado |

Reglas comunes: Zod en todos los cuerpos y queries; 401 si la key no existe, está revocada o el
usuario/empresa están inactivos; 404 (no 403) para recursos de otro usuario; proyecto ambiguo por
nombre → 409 con `candidates`; actualizar `last_used_at` como mucho una vez por minuto.

---

## Blueprint (Assembly Line)

> Solo fases. Las subtareas se generan al entrar a cada fase (tf-bucle-agentico).

### Fase 1: Modelo de datos y emisión de keys (INV0009)
**Objetivo**: Migración con `api_keys` + RLS + `tasks.source`; función de servidor que crea la key
(devuelve el texto plano una vez, guarda el hash) y revocación.
**Validación**: crear y revocar una key en producción dentro de una transacción revertida; un usuario no
ve keys de otro; admin de otra empresa no ve nada (ampliar `supabase/tests/company_isolation_test.sql`).

### Fase 2: Edge Function `agent-api` (INV0010)
**Objetivo**: Router, autenticación por key (`_shared/apiKey.ts`), los 8 endpoints con Zod, errores
consistentes, `source = 'api'` en las tareas creadas.
**Validación**: deploy con `supabase functions deploy agent-api --use-api`; con una key de prueba:
crear/editar/borrar tarea, intentar tocar una tarea facturada (400/409), una de otro usuario (404), key
revocada (401).

### Fase 3: UI de keys + marca en tareas (INV0011)
**Objetivo**: Sección "Acceso para agentes" en el perfil del colaborador (crear con nombre, mostrar una
vez con botón copiar, listar con prefijo y último uso, revocar). En listas de tareas (usuario y admin),
indicador discreto de "registrada por agente".
**Validación**: Playwright (crear → copiar → revocar), móvil sin scroll horizontal, build + lint.

### Fase 4: Skill para agentes (INV0012)
**Objetivo**: `SKILL.md` "invoxa" para Claude Code y su gemelo Codex (mantener sincronizados los
catálogos, ver `AGENTS.md`): cómo cargar `INVOXA_API_KEY` del `.env.local`, ejemplos curl de cada
endpoint, cuándo registrar horas (al cerrar un bloque de trabajo, confirmando con el humano proyecto y
horas), nunca inventar horas. `GET /skill` en la API para descargar la versión vigente (opcional).
**Validación**: desde otro repo, Claude Code registra una tarea real de prueba con el skill y luego la borra.

### Fase 5: Validación final y salida a producción (INV0013)
**Objetivo**: QA end-to-end, documentación (`BUSINESS_LOGIC.md`, memoria) y push (Vercel despliega).
**Validación**:
- [ ] `npm run build` y `npm run lint` pasan
- [ ] Prueba de aislamiento SQL ampliada pasa
- [ ] QA en navegador con evidencia en `.titan/qa/`
- [ ] Criterios de éxito cumplidos

---

## 🧠 Aprendizajes (Self-Annealing)

_(vacío)_

---

## Gotchas

- [ ] Las Edge Functions de este proyecto tienen `verify_jwt = true` por defecto: `agent-api` recibe una
      key, no un JWT → desplegarla con `--no-verify-jwt` (y validar la key dentro). Revisar `supabase/config.toml`.
- [ ] La key nunca debe loguearse (`console.log` de headers) ni devolverse salvo en su creación.
- [ ] Comparar hashes, no keys; usar `crypto.subtle.digest('SHA-256', …)` en Deno.
- [ ] La API usa service role: **cada consulta filtra por `user_id` del dueño de la key** (y la empresa sale
      del trigger). No confiar en `user_id`/`company_id` del cuerpo.
- [ ] Horas: mismo rango que la UI (0.25–24) y decimales con punto; aceptar "2,5" solo si se normaliza.
- [ ] Antes de `db push`: `supabase migration list` + `--dry-run` (ver aprendizajes de PRP-001). En Git Bash,
      exportar `SUPABASE_ACCESS_TOKEN` desde `.env.local`.
- [ ] Trabajamos directamente sobre el Supabase de producción (decisión de Roberto): pruebas destructivas
      siempre dentro de transacciones revertidas o con datos de prueba que se borran al final.

## Anti-Patrones

- NO dar a la key permisos de admin en esta fase.
- NO guardar la key en claro ni en la memoria del repo ni en Tasknic.
- NO crear un segundo modelo de tareas: la API escribe en la misma tabla `tasks`.
- NO omitir validación Zod en ninguna entrada.

---

*PRP aprobado por Roberto el 2026-11-04 ("perfecto, escribe el PRP"). Implementación en otro chat.*
