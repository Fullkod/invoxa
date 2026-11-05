# Pendientes y riesgos conocidos

Date: 2026-11-04
Fuente: lectura de `supabase/migrations/` (sobre todo `20260506000007_fix_generate_invoice.sql`),
`supabase/functions/` y `docs/pending/`. Nada de esto está decidido con Roberto: son hallazgos para priorizar.

## Pendiente documentado
- **Envío de correos** (`docs/pending/email-integration.md`). *2026-11-05:* los de Auth (invitación y
  recuperación) ya salen por Resend desde `no-reply@fullkod.com`, ver [correo de Auth](2026-11-05-correo-auth-resend.md);
  sigue pendiente todo lo demás: las funciones solo insertan en `email_logs`
  con `status='pending'`. Falta `send-email` + proveedor (propuesta: Resend) y plantillas. `generate-invoice`
  no registra `invoice_generated`. Si se usa `@fullkod.com`, ver [correo Fullkod](../reference/correo-fullkod-resend.md)
  (cuota compartida, remitente propio).
- **Rendimiento** (`docs/pending/performance-improvements.md`): casi todo hecho; diferidos Suspense por
  sección, memoización/virtualización (medir antes) y Lighthouse CI.

## Huecos de lógica encontrados en el código
1. ~~**Cancelar no libera tareas**~~ (resuelto 2026-11-04, migración `20261104000000`): `tasks.invoice_id` sigue apuntando a la factura cancelada, así que al
   regenerar el periodo esas horas no entran. Nada pone `invoice_id = null`.
2. **Rechazada sin corrección:** `rejected → generated` es posible, pero no se pueden editar líneas;
   la única salida es cancelar (y choca con el punto 1).
3. **Usa lo vigente hoy, no lo del periodo:** `generate_user_invoice` filtra por `is_current` y tarifa
   activa, no por `start_date/end_date` del periodo.
4. **Tarifa fija sin prorrateo:** siempre el mes completo.
5. ~~**Secuencia no anual**~~ (resuelto 2026-11-04: se reinicia por año, `invoices.invoice_year`): `next_invoice_number` toma `max(user_invoice_sequence)` de todas las facturas
   del usuario; el año del número cambia pero el contador no se reinicia.
6. **`expired`** en `invoice_requests`: nada lo asigna (no hay cron).
7. **Monedas:** una factura por usuario y periodo + una sola moneda ⇒ un usuario con proyectos en dos
   monedas no puede facturar.
8. ~~**Lint:**~~ (resuelto 2026-11-04: 0 errores, 3 avisos intencionados) `npm run lint` da 8 errores y 4 avisos en `src/` y `supabase/functions/` (2026-11-04).
   `npm run build` pasa.
