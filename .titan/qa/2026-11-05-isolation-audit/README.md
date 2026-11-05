# Auditoría de aislamiento entre empresas — 2026-11-05

Fase 0 del PRP-003. Contra producción (`prabpfidllznbtthmkxz`), sin dejar datos (el test se revierte solo).

## Qué se revisó

| Capa | Cómo | Resultado |
|------|------|-----------|
| RLS de las 15 tablas de `public` | catálogo (`pg_class.relrowsecurity`, `pg_policy`) + lectura de las políticas | RLS activa en todas; sin vistas |
| Storage | políticas de `storage.objects` + buckets | buckets privados; lectura = dueño por carpeta o admin de su empresa |
| Edge Functions (12) | lectura de cada `index.ts`: ids que vienen del cliente | todas validan la empresa del objetivo (`_shared/company.ts`); `agent-api` nunca lee `user_id`/`company_id` del request |
| Triggers | `check_project_company`, `set_company_*` | impiden mezclar proyecto/usuario de empresas distintas |
| Funciones SQL (RPC) | `has_function_privilege` por rol | **FUGA** (ver abajo) |
| Test SQL ampliado | `supabase/tests/company_isolation_test.sql` | ver salida |

## Fuga encontrada

Postgres/Supabase dan EXECUTE a `anon` y `authenticated` en toda función nueva. Cuatro funciones
`SECURITY DEFINER` (saltan RLS) no comprobaban al llamante y se podían invocar con la anon key pública
por `/rest/v1/rpc/`, con ids de **cualquier** empresa:

- `apply_invoice_number_change` — renombrar cualquier factura (y falsear `changed_by`).
- `generate_user_invoice` — generar una factura a nombre de cualquier usuario.
- `notify_user` — notificación con texto libre a cualquier usuario (phishing).
- `next_invoice_number` — leer código y contador de facturas de cualquier usuario.

Mitigación de facto: había que conocer UUIDs. No hay indicios de abuso (no se buscó en logs).

**Fix:** `supabase/migrations/20261105000000_restrict_privileged_functions.sql` (EXECUTE solo para
`service_role`; las Edge Functions ya las llaman con service role).

## Salida del test ANTES del fix

```
A_admin sees B tasks=0 ... upd_B_tasks=0 self_promote=blocked move_user=blocked
B_admin ... upd_A_invoices=0 del_A_tasks=0 spoof_project=blocked
AUDIT A_admin sees B billing=0 assignments=0 inv_requests=0 invoices=0 num_requests=0 num_history=0
  email_logs=0 company=0 upd_B_billing=0 upd_B_company=0 upd_B_assign=0 del_B_requests=0
  cross_assign=blocked spoof_request=blocked
  RPC_RENAME_B=ALLOWED! rpc_generate=blocked(*) RPC_NOTIFY_B=ALLOWED! RPC_NEXT_NUMBER_B=ALLOWED!
A_user sees B billing=0 inv_requests=0
exposed_rpcs=apply_invoice_number_change,generate_user_invoice,next_invoice_number,notify_user
```
(*) bloqueada por una validación de negocio, no por permisos: también estaba expuesta.

## Salida DESPUÉS del fix

Migración aplicada en producción el 2026-11-05 (con permiso de Roberto). Test repetido:

```
AUDIT ... cross_assign=blocked spoof_request=blocked rpc_rename=blocked rpc_generate=blocked
  rpc_notify=blocked rpc_next_number=blocked A_user sees B billing=0 inv_requests=0
exposed_rpcs=none
```

## Riesgos menores (no fuga de datos)

- `is_admin(uuid)` / `is_super_admin(uuid)` aceptan cualquier id: permiten saber si un UUID es admin. Se
  usan dentro de RLS, así que no se revocan; aceptable.
