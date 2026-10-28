---
name: correo-fullkod-resend
description: El correo de @fullkod.com va por Resend (buzones contact@ y support@, sin reenvío); cada proyecto decide cómo avisar de sus formularios
metadata:
  type: reference
---

# Correo de Fullkod (@fullkod.com) — 2026-10-28

- `fullkod.com` está verificado en **Resend** (cuenta de Roberto, plan Free) para **enviar y recibir**. El MX del dominio
  apunta a Resend; el reenvío de Porkbun ya no se usa.
- Buzones: **`contact@fullkod.com`** (comercial, formulario de la web) y **`support@fullkod.com`** (soporte de las apps).
  Se leen y responden en `resend.com/inboxes`. **No hay reenvío automático** a Gmail ni a nadie: Resend no lo ofrece y se
  decidió no montarlo.
- Límites del plan Free, **compartidos entre todos los proyectos** que envíen desde `@fullkod.com`: 3.000 correos/mes,
  100/día, 1 webhook, 3 buzones (queda uno libre). Un subdominio (p. ej. `lensspace.fullkod.com`) es otro dominio para
  Resend: habría que añadirlo y verificarlo aparte.
- Detalle del DNS: `memoria/reference/dominio-fullkod-dns.md` en el repo `Fullkod/hub`.

**Cómo aplicarlo en este proyecto:** si tiene (o va a tener) un formulario de contacto o cualquier mensaje que deba
leer el equipo, **el proyecto tiene que buscar su propia forma de avisar** (notificación en la app, alerta por
WhatsApp, tarea en Tasknic, correo a una dirección que alguien lea…). No dar por hecho que alguien mira los buzones de
Resend a diario. Si envía desde `@fullkod.com`, usar un remitente propio (p. ej. `noreply@` o `web@`) y tener en cuenta
la cuota compartida. Nunca guardar la clave de API en el repo: va en variables de entorno.
