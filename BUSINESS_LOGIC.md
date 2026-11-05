# Invoxa — Lógica de negocio

> Reconstruida el 2026-11-04 a partir del código (migraciones, Edge Functions y frontend) y de
> `docs/instructions.md` (el brief original). Donde el código y el brief difieren, este documento
> describe **lo que hace el código** y señala la diferencia. Los huecos conocidos están al final.

## Visión

Invoxa es una aplicación interna de **Informage Studios** para automatizar la facturación mensual de
sus colaboradores externos. Es un producto de **Fullkod**. Cada colaborador emite cada mes **una sola
factura** a Informage Studios que agrupa todo lo que trabajó en todos sus proyectos, con un número
consecutivo propio, y la descarga en PDF. El admin la revisa, la aprueba y la marca como pagada.

Es **multi-empresa** desde el 2026-11-04 (PRP-001): cada empresa (`companies`) tiene su admin, sus
colaboradores, proyectos y facturas, aislados de las demás por RLS. El destinatario de cada factura es la
empresa del colaborador (datos de `companies`). Informage Studios es la primera empresa. Fullkod gestiona
todas con el rol **super admin**. No hay registro público ni cobro de suscripciones.

## Actores

- **Super admin** (`role = 'super_admin'`, Fullkod; hoy `invoxa@fullkod.com`): no pertenece a ninguna
  empresa. En `/super/companies` crea empresas (con la invitación a su primer admin), edita sus datos,
  las activa/desactiva y **entra** en una (`profiles.active_company_id`): dentro actúa como su admin.
  Solo se crea a mano: el email debe estar en `super_admin_allowlist`.
- **Admin** (`profiles.role = 'admin'`) **de su empresa**: invita y borra usuarios, crea proyectos, asigna miembros y
  sus tarifas, solicita facturas (individual o masivamente), revisa y cambia el estado de las facturas,
  cambia consecutivos directamente y resuelve las solicitudes de cambio de los usuarios. Puede generar
  facturas e informes en nombre de cualquier usuario.
- **Colaborador** (`role = 'user'`): completa su perfil de facturación, registra tareas (si cobra por
  hora), genera su factura mensual, descarga PDFs, genera su informe de horas y solicita cambios de
  consecutivo.

No hay registro público: **solo se entra por invitación**, y el invitado entra en la empresa del admin
que lo invita. Los usuarios de una empresa desactivada no pueden usar la app.

### Aislamiento entre empresas
- Toda tabla de negocio tiene `company_id`, que rellenan triggers en el servidor (desde el usuario, la
  factura o la sesión); el cliente no puede elegirla.
- RLS: un admin solo ve y toca filas con `is_company_admin(company_id)`; proyectos visibles solo de tu
  empresa; un admin no puede crear super admins ni mover usuarios de empresa.
- Edge Functions (service role): comprueban a mano que el objetivo es de la empresa del llamante
  (`supabase/functions/_shared/company.ts`).
- Consecutivo: `{PREFIJO_EMPRESA}-{USER_CODE}-{AÑO}-{NNNN}` (Informage = `INF`); `user_code` y número
  de factura son únicos **por empresa**.
- Funciones SQL privilegiadas (`generate_user_invoice`, `apply_invoice_number_change`, `next_invoice_number`,
  `notify_user`): solo `service_role` puede ejecutarlas (fuga cerrada en la auditoría del 2026-11-05,
  migración `20261105000000`). Toda función nueva declara sus grants.
- Prueba de aislamiento: `supabase/tests/company_isolation_test.sql` (todas las tablas + RPCs; cualquier
  token terminado en `!` es una fuga). Evidencia: `.titan/qa/2026-11-05-isolation-audit/`.

## Entidades

| Entidad | Qué es |
|---------|--------|
| `profiles` | Usuario (1:1 con `auth.users`): nombre, email, `user_code`, rol y estado (`invited` → `active`, o `inactive`). |
| `user_billing_profiles` | Datos fiscales y de cobro del colaborador: razón social, NIF/tax id, dirección, ciudad, país, email de facturación, banco, cuenta, método de pago y notas por defecto. |
| `projects` | Proyecto de Informage (`active` / `inactive`). |
| `user_project_assignments` | Pertenencia N:M usuario–proyecto, con `is_current`, `start_date` y `end_date`. |
| `compensation_settings` | Tarifa del usuario **por proyecto**: `hourly` (`hourly_rate`) o `fixed` (`monthly_rate`), con moneda (por defecto USD). Solo una activa por usuario y proyecto. |
| `tasks` | Horas trabajadas por un colaborador por hora: proyecto, fecha, horas (> 0), descripción. `invoice_id` se rellena al facturarse. |
| `invoices` | Factura de un usuario para un periodo: número, secuencia, fechas, moneda, subtotal, impuestos (0), total, estado, notas y ruta del PDF. |
| `invoice_items` | Línea de factura, **una por proyecto**, con su tipo de pago, cantidad, precio unitario y total (instantánea; no cambia si luego cambia la tarifa). |
| `invoice_requests` | Petición del admin a un usuario para que facture un periodo (`pending` / `completed` / `expired`). |
| `invoice_number_change_requests` | Petición de cambio de consecutivo (`pending` / `approved` / `rejected` / `applied`). |
| `invoice_number_history` | Auditoría de cada cambio de número aplicado. |
| `notifications` | Avisos in-app en tiempo real (Supabase Realtime). |
| `api_keys` | Keys personales de agentes (PRP-002): nombre, prefijo, hash SHA-256, último uso, revocación. Sin escritura directa desde el cliente: RPC `create_api_key` / `revoke_api_key`. |
| `email_logs` | Registro de los correos que el sistema "envía" (ver Pendientes: hoy casi ninguno sale). |

## Flujos

### 1. Invitación y alta

1. El admin invita con email, nombre, `user_code` (hasta 8 caracteres, mayúsculas y números, p. ej. `RCA`),
   rol y, opcionalmente, una asignación inicial a un proyecto con su tarifa (`invite-user`).
2. Supabase Auth envía el correo de invitación (SMTP de Supabase) con enlace a `/accept-invite`.
3. Un trigger crea el `profile` con estado `invited`; al confirmar el email pasa a `active`.
4. Si la asignación inicial falla, la invitación no se deshace: el admin la corrige desde los miembros del proyecto.

### 2. Proyectos, miembros y tarifas

- Un usuario puede estar en varios proyectos a la vez, con tarifas y tipos de pago distintos en cada uno.
- Editar la tarifa **modifica la fila activa** (no se guarda historial de tarifas; las facturas ya emitidas
  conservan su importe porque las líneas son instantáneas).
- Terminar una asignación marca `is_current = false`, pone `end_date = hoy` y desactiva la tarifa.

### 3. Perfil de facturación

Obligatorio para facturar: **razón social, tax id, email de facturación y país**. El resto (dirección,
banco, cuenta, método de pago, notas por defecto) es opcional y aparece en el PDF si existe.

### 4. Tareas (solo pago por hora)

- El colaborador registra tareas en sus proyectos: fecha, horas, nombre, descripción y observaciones.
- Mientras no estén facturadas puede editarlas y borrarlas; **una tarea facturada queda bloqueada**
  (RLS: solo el admin puede tocarla).
- Puede generar un **informe PDF de horas** de un periodo, agrupado por proyecto con subtotales, para
  justificar su trabajo (`generate-tasks-report-pdf`, bucket `reports`).

- **Desde un agente (PRP-002, 2026-11-04):** el colaborador crea en *Datos de facturación → Acceso para
  agentes* hasta 5 **API keys personales** (`ivx_…`, se ven una sola vez; en BD solo el hash SHA-256 en
  `api_keys`). Con ella, Claude Code, Codex o n8n usan la Edge Function `agent-api` (sin JWT, valida la key)
  para listar sus proyectos, crear/editar/borrar tareas **no facturadas** de proyectos por hora, y consultar
  tareas, resumen mensual (importe estimado) y facturas propias. La key actúa como ese colaborador, nunca
  como admin, y deja de valer al revocarla (él o el admin de su empresa), si el usuario pasa a `inactive` o
  si su empresa se desactiva. Las tareas creadas así llevan `tasks.source = 'api'` y se ven con la marca
  "Agente". Skill para agentes: `.claude/skills/invoxa/` (gemelo Codex en `plugins/titan-factory-codex/skills/invoxa/`).

### 4b. Revisión de horas por responsables (PRP-003, 2026-11-05)

- En cada proyecto, el admin nombra **responsables** (cualquier persona activa de la empresa) y les asigna
  los colaboradores **por hora** que revisan (`project_supervisions`). Es por proyecto y por persona: R1
  puede revisar a A en X y a B en Y, y un proyecto puede tener varios responsables.
- Cada tarea tiene un estado de revisión (`tasks.review_status`): `pending` → `approved`, o
  `changes_proposed` (el responsable **propone** otras horas con un comentario). El colaborador acepta (las
  horas cambian y queda aprobada) o la rechaza con un motivo (vuelve a `pending`). El admin también puede
  **ajustar y aprobar** directamente. Nadie revisa sus propias tareas ni tareas facturadas.
- Editar una tarea ya revisada la devuelve a `pending` (también por la Agent API).
- **Privacidad:** el responsable no tiene acceso RLS nuevo; ve fecha, horas, nombre y descripción a través
  de RPCs (`list_review_tasks`, `review_task`). Nunca ve tarifas, facturas ni datos de cobro.
- Proyecto con **"Exigir aprobación"** (`projects.requires_approval`, apagado por defecto): **no se puede
  facturar el mes** mientras haya tareas del periodo sin aprobar en ese proyecto (decisión de Roberto,
  2026-11-05). `generate_user_invoice` lo rechaza y la pantalla "Generar factura" lo avisa antes con el
  número de tareas y el proyecto. Así ninguna hora se queda fuera de su factura.
- Avisos in-app: al responsable cuando su gente registra horas y cuando le responden; al colaborador cuando
  revisan su tarea. Bandejas: `/app/review` (responsable) y `/admin/review` (admin).
- Prueba: `supabase/tests/supervision_test.sql`.

### 5. Solicitud de facturas (admin)

- **Individual** (`request-invoice`): crea una solicitud `pending` para un usuario y periodo. Es idempotente:
  si ya hay una pendiente la reutiliza; si el usuario ya tiene factura no cancelada del periodo, no la crea.
- **Masiva** (`request-invoices-bulk`): para una lista de usuarios o, si no se indica, para todos los activos
  con al menos una asignación vigente. Por usuario: omite si ya facturó, reutiliza y "re-envía" la pendiente,
  o crea una nueva. Devuelve un resumen (creadas, reenviadas, omitidas con motivo).
- El usuario recibe una notificación in-app. Cuando genera la factura del periodo, la solicitud pasa
  automáticamente a `completed` y el admin que la pidió recibe aviso.

### 6. Generación de la factura

El colaborador elige un **mes** (del día 1 al último) y, opcionalmente, notas (precargadas con sus notas por
defecto). La Edge Function `generate-invoice` llama a la función SQL transaccional `generate_user_invoice`:

1. Valida: periodo correcto, usuario `active`, perfil de facturación completo y que no exista otra factura
   no cancelada del mismo usuario y periodo.
2. Toma los proyectos **vigentes** del usuario (asignación `is_current` + tarifa activa). Todas sus tarifas
   deben tener **la misma moneda**; si hay varias, falla ("genera facturas separadas o unifica la moneda").
   No se pueden generar facturas separadas por moneda hoy.
3. Por cada proyecto:
   - **Por hora:** suma las horas de las tareas del periodo aún no facturadas. Si hay horas, crea la línea
     "Horas trabajadas — {proyecto}" (horas × tarifa) y vincula esas tareas a la factura. Sin horas, no hay línea.
   - **Fijo:** crea la línea "Tarifa mensual — {proyecto}" (1 × tarifa mensual), siempre completa.
4. Si no sale ninguna línea, falla y no se crea nada.
5. Total = subtotal; **impuestos = 0** (no hay soporte de impuestos).
6. La factura nace en estado `generated`; todos los admins activos reciben aviso.

El usuario nunca envía importes: todo se calcula en la base de datos. El PDF **no se crea automáticamente**:
el usuario o el admin pulsan "Generar PDF" en el detalle de la factura.

### 7. Consecutivo

- Formato: `INF-{USER_CODE}-{AÑO}-{NNNN}`, p. ej. `INF-RCA-2026-0001`. Sin `user_code` se usan los 6 primeros
  caracteres del UUID del usuario.
- La secuencia es **por usuario** y la calcula el backend con un bloqueo por usuario (sin carreras).
- El año sale del inicio del periodo (`invoices.invoice_year`) y **la secuencia se reinicia cada año**
  (2026-0007 → 2027-0001). Única por usuario, año y secuencia. *(Desde 2026-11-04, PRP-001 fase 0.)*
- El número es único en todo el sistema.

### 8. Cambio de consecutivo

- **Admin:** lo cambia directamente (`change-invoice-number`).
- **Colaborador:** solo puede **solicitarlo** sobre sus facturas, con motivo (`request-invoice-number-change`).
  Los admins reciben aviso; el admin aprueba o rechaza con notas (`resolve-invoice-number-change`). Al aprobar
  se aplica y la solicitud queda `applied`; al rechazar, el usuario recibe el motivo.
- Todo cambio aplicado valida unicidad, queda en `invoice_number_history` y **regenera el PDF**.

### 9. Estados de la factura

Camino normal: `generated` → (`sent` / `reviewed`) → `approved` → `paid`.

| Desde | Puede pasar a |
|-------|---------------|
| `draft` | `generated`, `cancelled` |
| `generated` | `sent`, `reviewed`, `approved`, `rejected`, `cancelled` |
| `sent` | `reviewed`, `approved`, `rejected`, `cancelled` |
| `reviewed` | `approved`, `rejected`, `cancelled` |
| `approved` | `paid`, `cancelled` |
| `rejected` | `generated`, `cancelled` |
| `paid`, `cancelled` | — (finales) |

Lo valida un trigger en la base de datos; solo el admin cambia estados. Cada cambio avisa al colaborador.
Una factura cancelada libera el periodo (se puede generar otra) y **sus tareas** (`invoice_id = null`,
trigger `invoices_release_tasks_on_cancel`), que vuelven a entrar al regenerar. Conserva su número.

### 10. PDF de factura

Remitente = datos de facturación del colaborador; destinatario = Informage Studios S.L.U. (B-97776744,
Rafelbunyol, Valencia, España), fijo en el código. Tabla Cant. / Descripción / P. unitario / Importe, total,
observaciones y datos de pago. Se guarda en el bucket privado `invoices` como `{user_id}/{invoice_id}.pdf` y se
descarga con URL firmada de 60 s. Cada usuario solo lee sus PDFs; el admin, todos.

### 11. Notificaciones

In-app y en tiempo real: solicitud creada / completada, factura creada (a los admins), cambio de estado
(al colaborador), solicitud de cambio de consecutivo (a los admins) y su resolución (al colaborador).

### 12. Borrado de usuarios

Solo el admin. Se **bloquea** si el usuario tiene facturas emitidas, solicitudes de factura creadas por él,
solicitudes de cambio de consecutivo o entradas en el historial de números (trazabilidad contable). Tampoco
se puede borrar uno mismo ni al último admin. Si se permite, se borra en cascada su perfil, datos de
facturación, asignaciones, tarifas, tareas y solicitudes recibidas.

## Reglas de negocio

1. Una sola factura no cancelada por usuario y periodo, que agrupa todos sus proyectos.
2. Solo usuarios activos con perfil de facturación completo pueden facturar.
3. Los totales y el consecutivo se calculan en el backend; el frontend nunca los envía.
4. Una factura tiene una sola moneda.
5. Las tareas facturadas no se editan (salvo el admin).
6. El admin cambia el consecutivo; el usuario solo lo solicita. Todo cambio queda auditado y regenera el PDF.
7. Las líneas de factura son instantáneas: cambiar una tarifa no altera facturas emitidas.
8. Los datos financieros no se borran: un usuario con facturas no se puede eliminar.
9. Cada usuario ve solo sus datos; el admin ve todo (RLS en todas las tablas).
10. Un responsable solo ve las tareas de sus colaboradores en ese proyecto, y nunca importes.

## Diferencias con el brief (`docs/instructions.md`)

- El brief pide enviar correos de solicitud y avisos; hoy **solo la invitación sale por correo** (ver Pendientes).
- El brief permite al admin "regenerar" una factura; no existe: solo cambiar estado, cancelar o cambiar número.
- El brief menciona varias monedas y facturas separadas por moneda como mejora futura; hoy se bloquea.
- Ejemplos del brief en inglés ("Invoice Number"…); el PDF real está en español.

## Pendientes y huecos conocidos (2026-11-04)

- **Correo:** las funciones solo insertan en `email_logs` con `pending`; no hay `send-email` ni proveedor.
  Plan en `docs/pending/email-integration.md` (Resend). `invoice_generated` ni siquiera se registra.
- ~~Cancelar una factura no libera sus tareas~~ — resuelto 2026-11-04 (PRP-001 fase 0).
- **Factura rechazada:** puede volver a `generated`, pero no hay forma de corregir sus líneas; la vía es
  cancelar y regenerar.
- **Periodo vs. asignaciones:** la generación usa los proyectos y tarifas **vigentes hoy**, no los del periodo;
  facturar un mes pasado tras cambiar tarifas o terminar una asignación da otro resultado.
- **Tarifa fija:** se cobra el mes completo aunque la asignación empezara o terminara a mitad de mes.
- **`expired`** existe en solicitudes y en la UI, pero nada pone una solicitud en ese estado.
- ~~Secuencia anual~~ — se reinicia cada año desde 2026-11-04 (PRP-001 fase 0).
- **Impuestos:** siempre 0.
- ~~Aprobación tardía~~ — resuelto 2026-11-05: con "Exigir aprobación" el mes no se factura con tareas sin
  aprobar.
- **Fechas en UTC:** la fecha de inicio de asignaciones se ve un día antes (`new Date('YYYY-MM-DD')`).
