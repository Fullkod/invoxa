---
name: embeds-ambiguos-postgrest
description: Si una tabla tiene dos FKs a la misma tabla, el embed de PostgREST debe nombrar el FK (PGRST201); si no, la consulta falla
metadata:
  type: reference
---

# Embeds ambiguos en PostgREST (PGRST201) — 2026-11-05

- **Qué pasó:** PRP-003 añadió `tasks.reviewed_by → profiles`. Desde entonces `tasks` tiene dos FKs a
  `profiles` (`user_id`, `reviewed_by`) y `select('..., user:profiles(...)')` falla con PGRST201
  ("more than one relationship"). La tarjeta de tareas del detalle de proyecto (admin) se quedaba en
  «Cargando…» para siempre porque solo miraba `data == null` y no el error. Fix en `330ae21`.
- **Regla:** cuando una tabla tiene (o va a tener) más de un FK hacia la misma tabla, nombra el FK en el
  embed: `user:profiles!tasks_user_id_fkey(...)`. Ya se hace así en `invoice_requests`,
  `invoice_number_change_requests` y `project_supervisions`.
- **Al añadir un FK** a una tabla que ya apunta a esa misma tabla: busca en `src/` y `supabase/functions/`
  los embeds sin `!` (`grep -rn "profiles(" | grep -v "profiles!"`) y corrígelos en el mismo cambio.
- **En la UI:** distingue `error` de cargando (`isLoading`) y muestra el error con reintento; un
  «Cargando…» que depende solo de `data` esconde los fallos.
