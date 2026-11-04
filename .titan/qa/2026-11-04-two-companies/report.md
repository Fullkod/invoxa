# QA Report: Dos empresas y Edge Functions (PRP-001, Fase 5)

**Date**: 2026-11-04
**Status**: PASSED (11/11)
**Entorno**: frontend local contra Supabase de producción; sesión real del super admin `invoxa@fullkod.com`.
Se creó una empresa temporal **QA Temporal** (sin usuarios ni invitaciones) y se borró al terminar.
Frontend nuevo desplegado en producción (Vercel, `https://invoxa-ten.vercel.app`, commit `1a92a72`).

## Test Steps
Operando en QA Temporal:
1. Dashboard de QA Temporal — `screenshots/01-qa-dashboard.png`
2. Usuarios: ninguno de Informage — `screenshots/02-qa-users.png`
3. Facturas: ninguna de Informage — `screenshots/03-qa-invoices.png`
4. Edge Functions contra datos de Informage, todas rechazadas:
   `generate-invoice-pdf` 403, `generate-tasks-report-pdf` 403, `generate-invoice` 403,
   `request-invoice` 404, `change-invoice-number` 404, `delete-user` 404.
5. `request-invoices-bulk` sin lista → 0 solicitudes (solo usuarios de la empresa).

De vuelta en Informage:
6. `generate-invoice-pdf` de `INF-ALUCARD-2026-0001` → 200. El PDF regenerado muestra en "Factura para"
   los mismos datos de antes (Informage Studios S.L.U., B-97776744, Rafelbunyol), ahora leídos de
   `companies` — `screenshots/04-informage-dashboard.png`

Antes, la prueba SQL `supabase/tests/company_isolation_test.sql` (admins, colaboradores y super admin de
dos empresas) también pasó. Script de esta prueba: `functions.mjs` (Playwright).

## Findings
- Aislamiento correcto en UI, RLS y Edge Functions.
- Bug previo, no de este PRP: en el PDF, la línea "Cuenta:" de los datos de pago no hace salto de línea y
  se sale de la página si el texto es largo.

## No probado
- `create-company` e `invite-user` reales (envían correo).
- Sesiones reales de admin y colaborador de una segunda empresa (todavía no existe ninguna).
