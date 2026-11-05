# Auditoría de aislamiento entre empresas

Date: 2026-11-05
Fuente: conversación con Roberto (petición de CommerceCraft); auditoría hecha el mismo día (Fase 0 de PRP-003).
Evidencia: `.titan/qa/2026-11-05-isolation-audit/README.md`.

- **Requisito de Roberto:** un admin de una empresa no puede ver ni tocar NADA de otra empresa, "ni por el
  más mínimo error". Se demuestra con evidencia, no se supone.
- **Hecho (2026-11-05):** RLS de las 15 tablas, Storage, las 12 Edge Functions y triggers revisados; test
  `supabase/tests/company_isolation_test.sql` ampliado a todas las tablas + RPCs. Tablas/Storage/funciones:
  aisladas.
- **Fuga encontrada:** 4 funciones `SECURITY DEFINER` (`apply_invoice_number_change`,
  `generate_user_invoice`, `notify_user`, `next_invoice_number`) eran ejecutables por `anon`/`authenticated`
  vía `/rest/v1/rpc/` con ids de cualquier empresa. Fix: migración `20261105000000` (EXECUTE solo
  `service_role`). Regla nueva en `AGENTS.md`: toda función declara sus grants.
- **Fix aplicado en producción el 2026-11-05** y verificado (`exposed_rpcs=none`). Tasknic: INV0015.
- **Cómo repetirla:** `supabase db query --linked -f supabase/tests/company_isolation_test.sql` desde
  PowerShell en la raíz; cualquier token terminado en `!` es una fuga. Repetirla tras cada PRP que toque RLS
  o funciones.
