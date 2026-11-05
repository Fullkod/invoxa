---
name: invoxa
description: >
  Registrar y consultar las horas de trabajo del usuario en Invoxa (facturación de colaboradores de
  Fullkod / Informage Studios) vía su Agent API, con la key personal INVOXA_API_KEY. Crear, editar y
  borrar tareas (horas) no facturadas, ver proyectos y tarifas, resumen del mes e importe estimado, y
  facturas propias. Usar cuando el usuario diga: "registra 3 h en X", "apunta las horas de hoy",
  "carga esto en Invoxa", "cuántas horas llevo este mes", "qué tengo registrado esta semana",
  "corrige la tarea de ayer", "borra esa tarea", "mis facturas de Invoxa", o al cerrar un bloque de
  trabajo cuando el usuario quiera dejarlo apuntado. NO USAR para tareas de equipo (eso es Tasknic) ni
  para nada de admin (pedir facturas, ver horas de otros): esta API actúa solo como el colaborador.
---

# Invoxa Agent API

Invoxa es donde el usuario registra sus horas para facturarlas cada mes. Tú actúas **como ese
colaborador** con su key personal: solo ves y tocas sus propios datos. No hay acceso de admin.

## Configuración

- `INVOXA_API_KEY` (`ivx_…`): la crea el propio usuario en Invoxa → **Datos de facturación →
  Acceso para agentes**. Se guarda en el `.env.local` del repo donde trabajas (o en el entorno). Si no
  está, **no la pidas por el chat**: dile dónde crearla y que la ponga en `.env.local`.
- `INVOXA_API_URL` (opcional). Por defecto: `https://prabpfidllznbtthmkxz.supabase.co/functions/v1/agent-api`.

Carga las variables sin imprimirlas (nunca hagas `echo` de la key, ni la pegues en commits, memoria o
tareas):

```bash
set -a; [ -f .env.local ] && . ./.env.local; set +a
API="${INVOXA_API_URL:-https://prabpfidllznbtthmkxz.supabase.co/functions/v1/agent-api}"
AUTH="Authorization: Bearer $INVOXA_API_KEY"
curl -s "$API/" -H "$AUTH"
```

En PowerShell: `$k = (Select-String -Path .env.local -Pattern '^INVOXA_API_KEY=(.+)$').Matches[0].Groups[1].Value`
y `Invoke-RestMethod "$API/" -Headers @{ Authorization = "Bearer $k" }`.

## Reglas (no te las saltes)

1. **Nunca inventes horas.** Las horas y el proyecto los dice el humano. Puedes **proponer** una
   estimación a partir del trabajo de la sesión ("hemos estado ~2 h con el checkout, ¿lo registro
   como 2 h en Adeslas?"), pero **solo registras tras su confirmación explícita**.
2. Antes de `POST`/`PATCH`/`DELETE`, confirma en una línea: proyecto, fecha, horas y nombre.
3. **Fecha:** manda siempre `task_date` (`YYYY-MM-DD`) con la fecha local del usuario. Si dice
   "ayer", calcúlala tú. El servidor, si falta, usa el día de hoy en UTC.
4. Horas entre 0.25 y 24, con punto decimal (`2.5`). "2 h 30" = `2.5`, "45 min" = `0.75`.
5. **Nombre** (2–200 caracteres) = qué se hizo, en corto y entendible para quien paga
   ("Integración de pagos en el checkout"). Detalle técnico opcional en `description` (≤ 1000).
6. Las tareas **facturadas** no se editan ni se borran (`409`). Díselo al usuario; no lo reintentes.
7. Proyectos de **tarifa fija** no admiten horas (`400`): para esos la API es solo de consulta.
8. Si el proyecto por nombre es ambiguo (`409` con `candidates`), pregunta cuál y reintenta con el `id`.
9. Tras crear o cambiar algo, informa del resultado real (id, horas, proyecto) devuelto por la API.

## Endpoints

Todas las respuestas son JSON. Errores: `{ "error": "...", "details"?: [...], "candidates"?: [...] }`.

| Método | Ruta | Qué hace |
|---|---|---|
| GET | `/` | Quién soy (nombre, empresa) e índice de endpoints |
| GET | `/projects` | Mis proyectos actuales: `name`, `payment_type` (`hourly`/`fixed`), tarifa, moneda |
| GET | `/tasks?from=&to=&project=&billed=&limit=` | Mis tareas (por defecto las 100 más recientes); `project` acepta nombre o id; `billed=true/false` |
| GET | `/tasks/:id` | Una tarea |
| POST | `/tasks` | Crear: `project` (nombre o id), `hours`, `name`, `task_date?`, `description?`, `observations?` |
| PATCH | `/tasks/:id` | Editar una tarea no facturada (mismos campos, todos opcionales) |
| DELETE | `/tasks/:id` | Borrar una tarea no facturada |
| GET | `/summary?month=YYYY-MM` | Horas por proyecto, horas ya facturadas e importe estimado (por hora × tarifa; fijo = mensualidad) |
| GET | `/invoices?year=` | Mis facturas: número, periodo, total, moneda, estado |

Códigos: `401` key ausente, inválida, revocada o usuario/empresa inactivos (dile al usuario que revise
su key en Invoxa) · `404` no existe o no es tuyo · `409` facturada o nombre ambiguo · `400` datos
inválidos (lee `details`).

## Ejemplos

```bash
# Proyectos
curl -s "$API/projects" -H "$AUTH"

# Registrar 2.5 h hoy en Adeslas (tras confirmar con el usuario)
curl -s -X POST "$API/tasks" -H "$AUTH" -H "Content-Type: application/json" \
  -d '{"project":"Adeslas","task_date":"2026-11-04","hours":2.5,"name":"Integración de pagos en el checkout"}'

# Tareas de esta semana sin facturar
curl -s "$API/tasks?from=2026-11-02&to=2026-11-08&billed=false" -H "$AUTH"

# Corregir horas
curl -s -X PATCH "$API/tasks/<id>" -H "$AUTH" -H "Content-Type: application/json" -d '{"hours":3}'

# Borrar
curl -s -X DELETE "$API/tasks/<id>" -H "$AUTH"

# ¿Cuántas horas llevo este mes?
curl -s "$API/summary?month=2026-11" -H "$AUTH"
```

En Windows con Git Bash, usa `--data-binary @archivo.json` si el JSON lleva tildes o comillas
complicadas, para evitar problemas de codificación.

## Cómo responder

- Resumen del mes: total de horas, desglose por proyecto e importe estimado con su moneda, aclarando
  que es una **estimación** (la factura real se genera en Invoxa).
- Tras registrar: "Registradas 2,5 h en Adeslas el 04/11 («Integración de pagos…»), id `…`."
- La factura mensual se genera desde la app de Invoxa (`/app/invoices`), no desde esta API.
