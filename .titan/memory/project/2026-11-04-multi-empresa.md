# Invoxa multi-empresa (PRP-001)

Date: 2026-11-04
Fuente: PRP-001 (`.titan/plans/PRP-001-multi-empresa.md`), aprobado y ejecutado con Roberto el 2026-11-04.
Tareas Tasknic: INV0001 (madre), INV0002–INV0007.

- Invoxa es multi-empresa: tabla `companies` + `company_id` en todas las tablas, aislamiento por RLS
  (`is_company_admin`) y por comprobaciones en las Edge Functions (`_shared/company.ts`).
- **Decisiones de Roberto:** sin registro público ni cobro de suscripciones; un usuario = una empresa;
  todo se trabaja directamente sobre el Supabase de producción (sin Supabase local).
- **Super admin:** `invoxa@fullkod.com` (en `super_admin_allowlist`; creada a mano en el dashboard con
  Auto Confirm). El buzón no recibe correo: la contraseña se restablece desde Supabase. La cuenta de
  Roberto (`robert.cabrer92@gmail.com`) sigue siendo admin de Informage.
- Informage: id fijo `5b1c2e0a-7d43-4f8e-9a61-3c0f5e2d9b17`, prefijo `INF`.
- El super admin "entra" en una empresa cambiando `profiles.active_company_id` desde el cliente (lo
  permite RLS); al cambiar se vacía la caché de TanStack Query.
- Storage no se movió: el admin lee los PDF de su empresa resolviendo la empresa por la carpeta `{user_id}`.
- Antes de un `db push`: `supabase migration list` + `--dry-run` (en Git Bash exportar
  `SUPABASE_ACCESS_TOKEN` desde `.env.local`). Edge Functions: `supabase functions deploy --use-api`.
