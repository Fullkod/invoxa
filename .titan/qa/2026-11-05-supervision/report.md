# QA Report: Supervisión de horas (PRP-003)

**Date**: 2026-11-05
**Status**: PASSED (SQL 2/2 · UI 21/21)
**Entorno**: frontend local (`localhost:5180`) contra Supabase de **producción**, con las migraciones
`20261105000000`–`20261105000002` aplicadas y `agent-api` desplegada. Empresa temporal **QA PRP-003**
(prefijo `QAS`) con 4 usuarios de prueba creados por la Admin API (sin correos): admin, responsable y dos
colaboradores por hora (42 EUR/h). Todo se borró al terminar (comprobado: 0 empresas, 0 usuarios auth, 0
supervisiones de QA). Scripts: `ui.mjs` (este directorio) y `setup.mjs` (scratchpad, crea/borra la empresa).

## 1. SQL en producción (transacciones revertidas)
- `supabase/tests/company_isolation_test.sql`: todo aislado; `rpc_*=blocked`, `exposed_rpcs=none`.
- `supabase/tests/supervision_test.sql`: responsable sin acceso a tareas/tarifas/facturas/cobro; no
  falsificable; propuesta → aceptación → edición vuelve a pendiente; admin ajusta; **factura bloqueada con
  1 tarea sin aprobar**, y tras aprobarla se factura 8 h; grants sin `anon`.

## 2. UI (Playwright, `ui.mjs`)
| # | Paso | Resultado |
|---|------|-----------|
| 1 | Admin asigna responsable → tutelada en el proyecto | PASS — `01-admin-supervisors.png` |
| 2 | Admin activa "Exigir aprobación" | PASS — `02` |
| 3 | Colaboradora registra 6 h → "Pendiente de revisión" | PASS — `03` |
| 4 | Responsable ve "Revisión de horas" en el menú | PASS |
| 5 | Bandeja: la tarea de su tutelada sí, la del colaborador no supervisado no | PASS — `04` |
| 6 | Sin importes en la respuesta de `list_review_tasks` ni en la página | PASS |
| 7–11 | REST directo con el JWT del responsable: `tasks`, `compensation_settings`, `invoices`, `invoice_items`, `user_billing_profiles` → 0 filas | PASS |
| 12 | REST `profiles` → solo el propio | PASS |
| 13 | Responsable propone 4 h con comentario | PASS — `05` |
| 14 | Responsable recibió "Horas por revisar" | PASS — `06` |
| 15 | Colaboradora recibió "Te proponen otras horas" | PASS — `07` |
| 16 | Colaboradora acepta → 4 h y "Aprobada" | PASS — `08`, `09` |
| 17 | Generar factura bloqueado con 1 tarea sin aprobar (aviso + botón deshabilitado) | PASS — `10` |
| 18 | Admin aprueba desde `/admin/review` | PASS — `11`, `12` |
| 19 | Factura generada con 4 + 2 = 6 h (`QAS-QM1-2026-0001`) | PASS — `13`, `14` |
| 20 | "Descargar SKILL.md" en Acceso para agentes → archivo con el skill `invoxa` | PASS — `15` |
| 21 | Móvil 390 px sin scroll horizontal | PASS — `16` |

## Findings
- **Corregido durante el QA:** tras aceptar una propuesta, el formulario de la tarea seguía mostrando las
  horas viejas (el form solo lee `initial` al montarse). Guardar habría devuelto la tarea a 6 h y a
  pendiente. Fix: `key={task.id-updated_at}` en `TaskDetailPage`.
- **Corregido durante el QA:** el `<select>` "Responsable" no estaba asociado a su etiqueta (accesibilidad).
- **Cambio menor:** el pill de la cabecera de la tarea dice "Sin facturar" en vez de "Pendiente", para no
  confundirlo con el estado de revisión.
- **Bug previo, no de este PRP:** la fecha de inicio de las asignaciones se ve un día antes ("31 de oct"
  para 2026-11-01): `new Date('YYYY-MM-DD')` se interpreta en UTC (`ProjectMembersPage.formatDate`).

## No probado
- Rechazar una propuesta desde la UI (cubierto por el test SQL vía RPC, no en Playwright).
- App nativa (Capacitor): la descarga del skill usa un Blob; en la app nativa queda el botón "Copiar contenido".
