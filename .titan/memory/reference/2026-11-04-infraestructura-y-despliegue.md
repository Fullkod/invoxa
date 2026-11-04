# Infraestructura, despliegue y dónde está cada cosa

Date: 2026-11-04
Fuente: `vercel.json`, `capacitor.config.ts`, `.github/workflows/`, `supabase/`, `.env.local.example`.

- **Supabase en plan Free:** se pausa tras ~7 días sin actividad. `.github/workflows/keep-supabase-alive.yml`
  llama a diario (06:00 UTC) al RPC `public.ping()` con los secrets `SUPABASE_URL` y `SUPABASE_ANON_KEY`
  del repo. Si el proyecto aparece pausado, revisar primero ese workflow.
- **Variables:** el frontend solo usa `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`. Las Edge Functions usan
  `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` y `APP_URL` (para el enlace de invitación a
  `/accept-invite`; por defecto `http://localhost:5173`, así que **debe estar configurada en producción**).
- **Correo de invitación:** lo envía Supabase Auth con su SMTP (límites bajos del SMTP por defecto).
- **Web:** Vercel, SPA con rewrite a `/`, PWA con Workbox (`sw.js` sin caché) y compresión Brotli/Gzip.
- **Nativo:** Capacitor 8, `appId: ai.commercecraft.invoxa` (dominio CommerceCraft, no `com.fullkod.*`).
  Assets nativos con `npm run native:assets` (fondo `#FBF7F0`).
- **Storage:** buckets privados `invoices` (`{user_id}/{invoice_id}.pdf`) y `reports`
  (`{user_id}/tasks-{inicio}_{fin}.pdf`), 10 MB, solo PDF. Lectura: dueño por carpeta o admin.
- **Edge Functions:** todas verifican el JWT con la anon key y operan con service role. La lógica de dinero
  y consecutivos está en SQL (`generate_user_invoice`, `next_invoice_number`, `apply_invoice_number_change`),
  no en TypeScript.
- **Diseño:** prototipo en `docs/design/` (`Invoxa.html`, pantallas JSX); estilo tinta marrón + acento
  terracota, Fraunces/Geist. Plantilla original de factura: `docs/empty.docx`.
- **Brief original:** `docs/instructions.md` (requisitos; algunas partes superadas por el código, ver
  `BUSINESS_LOGIC.md`).
