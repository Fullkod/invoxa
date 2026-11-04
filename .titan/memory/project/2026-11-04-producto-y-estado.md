# Invoxa: producto, cliente y estado

Date: 2026-11-04
Fuente: inspección del código, `docs/instructions.md` y `git log` (2026-11-04).

- **Qué es:** app interna de facturación mensual de colaboradores para **Informage Studios S.L.U.**
  (Valencia, España). Producto de Fullkod (marca y crédito "Developed by Fullkod" añadidos el 2026-10-28/29;
  licencia propietaria de Fullkod). La lógica completa está en `BUSINESS_LOGIC.md`.
- **Historia:** MVP construido entre 2026-05-06 y 2026-07-31 (schema, facturas, tareas, PDFs,
  notificaciones, borrado de usuarios, keepalive, saneado WinAnsi de PDFs). Desde agosto solo cambios de marca.
- **Funciona hoy:** invitación por correo, proyectos/miembros/tarifas, perfil de facturación, tareas,
  generación de factura, estados, consecutivo y su cambio auditado, PDF de factura e informe de horas,
  notificaciones in-app en tiempo real, borrado protegido de usuarios.
- **Bloqueante del MVP del brief:** el envío real de correos (solo sale la invitación). Ver
  [pendientes](2026-11-04-pendientes-y-riesgos.md).
- El destinatario de las facturas (Informage) está fijo en `supabase/functions/generate-invoice-pdf`:
  si cambian sus datos fiscales hay que editar el código y regenerar los PDF.
