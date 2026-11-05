# Correos de Auth desde no-reply@fullkod.com (Resend)

Date: 2026-11-05
Fuente: conversación con Roberto, configuración de Auth leída por la Management API y prueba real.

- **Decisión:** los correos de Supabase Auth (invitación desde `invite-user` y `create-company`, y recuperación
  de contraseña) salen de **«Invoxa» `<no-reply@fullkod.com>`** por el SMTP de Resend (`smtp.resend.com:465`,
  usuario `resend`, password = API key propia de Invoxa con *Sending access* a `fullkod.com`; la puso Roberto
  en el dashboard, no está en el repo). Se descartó `support@`/`contact@`: son buzones, y `no-reply@` no ocupa
  ninguno. Las plantillas remiten a `support@fullkod.com` para dudas.
- **Cuota:** el remitente NO ahorra cuota. Todo lo que sale de `fullkod.com` cuenta contra el plan Free de Resend
  compartido por los proyectos de Fullkod (100/día, 3.000/mes). Invoxa hoy envía muy poco. Cuando se haga
  `send-email` (avisos de factura, masivos), valorar cuenta o subdominio Resend propio para Invoxa: solo cambia
  el SMTP.
- **Plantillas:** `supabase/templates/invite.html` y `recovery.html` (español, crema/tinta/terracota, saludo con
  `{{ .Data.full_name }}`). Asuntos: «Te han invitado a Invoxa» y «Restablece tu contraseña de Invoxa». Se suben
  con `npm run auth:templates` (`scripts/push-auth-templates.mjs`, PATCH solo de esas claves). **Nunca
  `supabase config push`**: sobrescribiría toda la config remota de Auth con los valores locales.
- **Config de Auth:** `rate_limit_email_sent` = 30/h (antes 2/h con el SMTP de Supabase); `mailer_otp_exp` =
  3600, los enlaces caducan en **1 hora** y las plantillas lo dicen. Si se sube (p. ej. 24 h para invitaciones),
  cambiar también el texto de las plantillas.
- **Probado 2026-11-05:** invitación a una cuenta de prueba recibida en Recibidos (no spam), remitente, nombre y
  diseño correctos; usuario de prueba borrado (sin datos asociados). `robert.cabrer92@gmail.com` es admin de
  Informage: no usarlo para pruebas de invitación ni borrarlo.
- **Pendiente:** decidir si la caducidad de las invitaciones sube a 24 h.
