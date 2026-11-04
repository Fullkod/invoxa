---
name: tasknic
description: >
  Conectar con Tasknic (el gestor de tareas del equipo) vía su Agent API: crear tareas
  para humanos, leer proyectos/tareas, mover tareas de estado, dejar comentarios,
  adjuntar archivos, y leer/escribir el Espacio del proyecto (documentos, notas y
  transcripciones de reuniones Leexi). También cubre administración: crear/editar/borrar
  proyectos y sus miembros, invitar o editar gente del equipo, plantillas de tareas,
  columnas del tablero, dependencias entre tareas, historial de actividad y novedades
  (changelog) — paridad casi completa con lo que un admin puede hacer desde la UI web.
  Y Soporte: tickets de clientes que entran por el correo o el WhatsApp de cada proyecto
  (leer, notas internas, estado, borrador con IA, responder al cliente, escalar a tarea).
  Usar cuando el usuario diga: "deja esta tarea en tasknic", "crea una tarea en tasknic
  para X", "qué tareas hay en tasknic", "mueve la tarea a hecho", "adjunta esto a la
  tarea", "lee la reunión / grabación", "guarda esta nota en el espacio", "crea un
  proyecto en tasknic", "invita a X al equipo", "bloquea esta tarea con la otra",
  "crea una plantilla de tarea", o cualquier variante de delegar/consultar trabajo o
  administración en Tasknic.
---

# Tasknic Agent API

Eres un agente conectado a **Tasknic**, el gestor de tareas del equipo. Apareces ahí como el usuario "Claude (Agente IA)". Cuando creas o comentas una tarea, el humano asignado recibe notificación in-app y WhatsApp automáticamente — no necesitas avisarle por otro canal.

**Atribución (`requested_by`) — regla fija, no la saltes "para simplificar":** cuando crees una tarea (`POST /tasks`), la muevas de estado o la edites (`PATCH /tasks/:id`), dejes un comentario (`POST /tasks/:id/comments`), o subas un adjunto (`POST /tasks/:id/attachments`), si sabes con qué humano estás chateando en esta sesión (quien te lo pidió), **siempre** manda su nombre en el campo `requested_by`. **Las keys de Claude Code de los repos lo exigen**: si lo omites, la API responde `400` ("esta API key exige requested_by") — no reintentes sin él ni inventes un nombre: pregunta "¿a nombre de quién lo dejo?" y reintenta con la respuesta. `GET /` te dice cómo está configurada tu key (`api_key.requires_requested_by`, y `api_key.default_requested_by` si un admin le puso una persona por defecto: entonces, si lo omites, se atribuye a esa persona — pero si quien te habla es otra, manda su nombre, que siempre gana). Aunque tu key no lo exija, omitirlo cuando sí sabes quién te lo pidió es un error — le quitas a esa persona algo que le corresponde. Efectos concretos de mandarlo bien:
- Puede borrar esa tarea/comentario/adjunto sin ser admin (si eres `member`, no `admin`, y el archivo lo subió el agente, sin este campo NUNCA vas a poder borrarlo vos — quedás afuera para siempre, no es un botón que "tarda en aparecer").
- En el Kanban/Lista/Drawer/comentarios se ve su avatar con el tuyo superpuesto ("con ayuda de Claude Code") en vez de solo "Claude (Agente IA)" (tareas y comentarios; los adjuntos todavía no tienen ese avatar en la UI, solo heredan el permiso de borrado).
- En el Historial de la tarea (quién la creó, quién comentó, quién la movió de estado) se ve su nombre + 🤖 en vez de "Claude (Agente IA)" a secas — esto incluye los cambios de estado y asignaciones que hagas con `PATCH /tasks/:id`: **manda `requested_by` también en cada PATCH**, con quien te pide ESE cambio. No se hereda de quien pidió crear la tarea: si lo omites, el historial dice solo "Claude (Agente IA)" (y si tu key exige `requested_by`, la respuesta trae un `warning` recordándotelo). Ejemplo típico: la tarea la pidió crear una persona hace semanas y hoy otra te pide cerrarla — el cambio de estado va a nombre de la de hoy.

Si NO sabes quién te lo pidió (por ejemplo, te llegó de un cron o de otro sistema sin contexto humano), no inventes un nombre: deja `requested_by` afuera y va a quedar atribuido solo al agente. Si tu key lo exige, ese create fallará con `400`: cuéntaselo al humano responsable en vez de rellenar un nombre cualquiera (un admin puede desmarcar "Exigir" o poner una persona por defecto en Configuración → Agentes).

### ¿Quién es "el humano que te lo pidió"?

Es la persona con la que estás conversando **en esta sesión, ahora** — no un nombre fijo. A Tasknic le puede escribir cualquier miembro del equipo, cada uno con su propia cuenta, y quien te habla hoy no tiene por qué ser el mismo que ayer, ni el dueño del repo, ni el que aparece en los ejemplos de esta guía. Por eso, a partir de aquí, todos los ejemplos usan `<nombre>` como marcador de posición: reemplazalo siempre por el nombre real que determinaste — nunca lo copies literal, y nunca reutilices un nombre que viste en otra parte de este documento o de una sesión anterior.

Cómo determinarlo, en este orden:

1. **Lo que te haya dicho la conversación.** Si la persona se identificó, o el contexto deja claro quién es, usa ese nombre.
2. **Si no está claro, pregunta.** Un "¿a nombre de quién dejo esto?" antes de crear la tarea/comentario es mucho mejor que adivinar mal — te lleva dos segundos y evita atribuirle el pedido a la persona equivocada (le da permiso de borrado a quien no corresponde, y queda mal en el Historial de la tarea, visible para todo el equipo).
3. **Nunca asumas por defecto.** Este es justamente el bug que esta sección existe para prevenir: `requested_by` terminó saliendo siempre con el mismo nombre (el que aparecía en los ejemplos de esta guía) aunque quien pedía la acción, sesión tras sesión, era otra persona distinta del equipo.
4. Si de verdad no hay forma de saberlo (cron, otro sistema, sin humano de por medio), deja `requested_by` afuera — como ya dice la regla de arriba.

## Conexión

- Base URL: `https://usqjmmkwdfugwcrfgojw.supabase.co/functions/v1/agent-api`
- Auth: header `Authorization: Bearer $TASKNIC_API_KEY`
- La key vive en la variable de entorno `TASKNIC_API_KEY`, o en el `.env.local`/`.env` del proyecto como `TASKNIC_API_KEY=tk_...`. Antes de la primera llamada, cárgala así:

```bash
export TASKNIC_API_KEY="${TASKNIC_API_KEY:-$(grep -h '^TASKNIC_API_KEY=' .env.local .env 2>/dev/null | head -1 | cut -d= -f2)}"
export BASE="https://usqjmmkwdfugwcrfgojw.supabase.co/functions/v1/agent-api"
``` Si no aparece en ningún lado, pide al usuario que un admin genere una en Tasknic → Configuración → "Agentes de IA — API keys" y la guarde en `.env.local`. NUNCA commitees la key.

Todas las llamadas son `curl` simples con JSON. `GET /` devuelve el índice de endpoints si necesitas recordarlos.

**Cada API key pertenece a una empresa** (Tasknic es multi-empresa): `GET /` devuelve `workspace {id, name}`, y todo lo que hagas con esa key (proyectos, tareas, equipo, etiquetas, claves) ocurre solo dentro de esa empresa. Si el usuario te habla de un proyecto que no aparece en `GET /projects`, lo más probable es que sea de otra empresa: necesita una key creada desde esa empresa (un admin, estando en ella con el selector de empresa, en Configuración → "Agentes de IA"). No intentes adivinar ni cambiar de empresa con cabeceras.

### Al empezar (una vez por sesión): ¿está al día este skill?

La versión oficial de este skill es la de la rama `main` del repo de Tasknic. Tu copia puede haberse quedado vieja. Compruébalo antes de la primera operación:

```bash
ROOT=$(git rev-parse --show-toplevel 2>/dev/null || pwd); F="$ROOT/.claude/skills/tasknic/SKILL.md"
if [ -f "$F" ] && [ ! -d "$ROOT/supabase/functions/agent-api" ]; then   # en el repo de Tasknic NO: ahí está la fuente
  REMOTE=$(curl -s "$BASE/skill/version" -H "Authorization: Bearer $TASKNIC_API_KEY" | sed -n 's/.*"sha256":"\([0-9a-f]\{64\}\)".*/\1/p')
  if [ -n "$REMOTE" ] && [ "$REMOTE" != "$(sha256sum "$F" | cut -d' ' -f1)" ]; then
    if git -C "$ROOT" diff --quiet -- "$F" 2>/dev/null; then
      curl -sf "$BASE/skill" -H "Authorization: Bearer $TASKNIC_API_KEY" -o "$F.new" \
        && [ "$(sha256sum "$F.new" | cut -d' ' -f1)" = "$REMOTE" ] && mv "$F.new" "$F" && echo SKILL_UPDATED || rm -f "$F.new"
    else echo SKILL_LOCAL_CHANGES; fi
  fi
fi
```

- Sin salida → estás al día, sigue.
- `SKILL_UPDATED` → se descargó la versión nueva. **Vuelve a leer este archivo antes de seguir**, porque las instrucciones cambiaron. Avisa al usuario: "Actualicé el skill de Tasknic a la versión oficial; quedó como cambio sin commitear en `.claude/skills/tasknic/SKILL.md`, commitéalo cuando puedas". No lo commitees tú salvo que te lo pida.
- `SKILL_LOCAL_CHANGES` → alguien editó la copia local y no se sobrescribe. Díselo al usuario: los cambios al skill se hacen en el repo de Tasknic, no aquí.
- Si `GET /skill/version` falla, sigue con tu copia sin bloquearte.

## Operaciones

### Dejar una tarea a alguien ("deja esta tarea en tasknic para X")

1. Si no sabes el proyecto exacto, lista: `GET /projects` (o pregunta al usuario cuál).
2. Crea la tarea — proyecto y asignados van **por nombre**, no hace falta UUID:

```bash
curl -s -X POST "$BASE/tasks" -H "Authorization: Bearer $TASKNIC_API_KEY" \
  -H "Content-Type: application/json" -d '{
    "project": "Content OS",
    "title": "Título corto y accionable",
    "description": "Contexto en Markdown: qué hay que hacer, criterios de listo, links.",
    "priority": "alta",
    "due_date": "2026-08-01",
    "assignees": ["<nombre>"],
    "tags": ["bug", "cliente"],
    "requested_by": "<nombre>"
  }'
```

- `priority`: `baja|media|alta|urgente` (o low/medium/high/urgent). `due_date` opcional, formato YYYY-MM-DD.
- `recurrence` (opcional, default `none`): `none|daily|weekly|monthly` — para tareas que se repiten.
- `tags` (opcional): nombres de etiquetas (ver sección "Tags" más abajo).
- `requested_by` (opcional): el humano que te pidió crear esta tarea (ver "Atribución" arriba). Mandalo si lo sabes.
- `blocked_by_external` (opcional): a quién espera la tarea si depende de un tercero — ver "Tareas que esperan a un externo" más abajo.
- `requires_approval_to_start` (opcional, `true`/`false`): nadie debe empezarla sin OK explícito de un humano — ver "Antes de EMPEZAR una tarea".
- Si el nombre es ambiguo la API responde `409` con `candidates` — elige o pregunta al usuario.
- Escribe título y descripción en el idioma del equipo (español), con el contexto suficiente para que el humano no tenga que preguntarte nada.

### Runbooks: usa las plantillas, no reescribas la receta

Para trabajos que tienen runbook, **no redactes el checklist a mano**: instancia la plantilla del equipo. Hoy existen:

| Cuándo | Plantilla (`name`) |
|---|---|
| Deploy a producción de cualquier proyecto en EasyPanel | `Deploy a prod (EasyPanel)` |
| Dar de alta un proyecto nuevo de punta a punta (Tasknic, repo, vault, VPS dev, Titan Factory, EasyPanel) — rellena primero la "Ficha de datos" de la descripción con el usuario | `Alta de proyecto nuevo` |
| Rotar una API key, password o token | `Rotación de credencial` |

La API no tiene un "instanciar" directo — se hace en 2 pasos:

1. `GET /templates` → toma la plantilla por `name` (trae `title`, `description`, `priority`, `subtasks: [{title}]`).
2. `POST /tasks` con esos campos (reemplaza el `<proyecto>`/`<nombre>` del título por el real), y luego un `POST /tasks` por cada subtarea con `"parent_task_id": "<code de la tarea padre>"`.

Ve marcando las subtareas como hechas a medida que las completas (`PATCH /tasks/<code-subtarea> {"status": "Hecho"}`) — el checklist vivo es la evidencia de que no se saltó ningún paso. La tarea padre sigue la regla normal: "En revisión", nunca "Hecho". Si el runbook real cambia (un gotcha nuevo), avisa al usuario para actualizar la plantilla en vez de desviarte en silencio.

### Consultar trabajo

```bash
curl -s "$BASE/projects/CIDI%20INTEGRALE/tasks?status=Por%20hacer&assignee=<nombre>" -H "Authorization: Bearer $TASKNIC_API_KEY"   # espacios en la URL = %20 (o usa el UUID)
curl -s "$BASE/tasks/<id-o-code>" -H "Authorization: Bearer $TASKNIC_API_KEY"   # detalle + subtareas + comentarios
curl -s "$BASE/team" -H "Authorization: Bearer $TASKNIC_API_KEY"          # miembros, para resolver nombres
```

Cada tarea trae `code` (ej. `CID0001`): un identificador corto legible, prefijo del
proyecto + secuencia, autogenerado e inmutable — útil para referenciarla en texto sin
pegar el UUID completo. Es solo de lectura, no se manda al crear ni al actualizar.

**Todo `<id>` de tarea en esta guía acepta el UUID o el `code`, indistintamente** —
`GET/PATCH/DELETE /tasks/:id`, sus subrutas (`/activity`, `/comments`, `/attachments`,
`/dependencies`) y el campo `depends_on`/`parent_task_id` en el body. No hace falta
resolver el código a UUID tú mismo: manda `"CID0001"` directo donde iría el UUID
(insensible a mayúsculas). Si preferís usar el UUID igual funciona — es la misma
tarea, dos formas de referenciarla.

**Estado de varias tareas en una sola llamada** (máx. 100 códigos, de cualquier proyecto):

```bash
curl -s "$BASE/tasks/status?codes=TRA0045,CID0001,AND0058" -H "Authorization: Bearer $TASKNIC_API_KEY"
# → {"tasks": [{code, title, status, status_label, project, updated_at}], "not_found": [...]}
```

### Memoria del repo: solo códigos, nunca estados

Tasknic es la **única fuente de verdad del estado** de una tarea. En la memoria git del
repo (`.claude/memory/`, CLAUDE.md, PRPs, notas) y en cualquier resumen que persista:

- Cita **solo el código** de la tarea (`TRA0045`), con su título si ayuda a leerlo.
- **Nunca copies su estado** ("en revisión", "hecha", "Estado Tasknic revisado el día X: ...")
  ni listas de tareas abiertas/cerradas: envejecen en cuanto alguien mueve la tarea, y la
  memoria termina corrigiendo a la memoria.
- Cuando necesites el estado (al arrancar la sesión, en `/primer`, o antes de decir "eso
  ya está hecho"), **consúltalo en vivo** con `GET /tasks/status?codes=...` juntando todos
  los códigos que cite la memoria en una sola llamada.
- Si encuentras estados copiados en una memoria existente, no los "actualices": reemplázalos
  por los códigos.

### Mover una tarea / actualizarla

```bash
curl -s -X PATCH "$BASE/tasks/<id>" -H "Authorization: Bearer $TASKNIC_API_KEY" \
  -H "Content-Type: application/json" -d '{"status": "En progreso", "requested_by": "<nombre>"}'
```

`requested_by`: quien te pide **este** cambio (ver "Atribución" arriba) — no lo omitas al mover tareas.

`status` acepta la etiqueta visible de la columna ("Por hacer", "En progreso", "En revisión", "Hecho", o columnas custom) o su key, además de `discarded` ("Descartada", exige `discard_reason`: ver "Descartar una tarea"). También puedes cambiar `title`, `description`, `priority`, `due_date`, `recurrence`, `assignees`, `tags` (estos dos reemplazan el set completo — manda la lista final, no un delta) y `blocked_by_external`/`blocked_since` y `remind_at` (ver "Recordatorio con fecha").

### Antes de EMPEZAR una tarea: dependencias y "requiere OK"

Antes de pasar una tarea a "En progreso" (o de ponerte a trabajar en ella), haz `GET /tasks/<code>` y mira dos cosas:

1. **`requires_approval_to_start: true`** → **NO la empieces** salvo que el humano con el que hablas te haya dado un OK explícito *en esta conversación* para esa tarea. Si no, dile que la tarea está marcada "requiere OK para empezar" y pregúntale. No lo deduzcas de memorias ni de conversaciones anteriores.
2. **`blockers`** con alguno que no esté cerrado (`status_label` distinto de "Hecho") → dile al humano de cuál depende y en qué estado está, y pregunta si sigues igualmente.

Si aun así un `PATCH` devuelve **`warnings`**, el cambio **se aplicó igual** (son avisos, no bloqueos): frena, cuéntaselo al humano tal cual y pregunta. Si te dice que no, devuelve la tarea a su estado anterior.

Para marcar una tarea así (p. ej. cuando el usuario diga "que nadie la empiece sin hablar conmigo"): `PATCH /tasks/<code> {"requires_approval_to_start": true}`. **No** lo escribas en la descripción ("NO empezar por cuenta propia…"): usa el campo.

### Revisión: cola "Para tu OK"

Cada tarea en "En revisión" tiene un **revisor** (`reviewer`): la persona que da el OK. Si no lo mandas, al pasar a "En revisión" se pone solo el **revisor por defecto del proyecto** (o quien pidió la tarea), y la tarea le aparece en su cola **"Para tu OK"** en Inicio, con botones Aprobar → Hecho / Devolver → En progreso.

- En esa cola el revisor ve, de tu último comentario, **solo la sección `## Cómo probarlo`**. Escríbela siempre en el comentario de cierre (si trabajaste con borrador, en la versión consolidada que publicas con `draft/publish`), concreta y accionable:

```markdown
## Cómo probarlo
1. Abre <URL exacta> (en producción tras el Deploy / en dev en ...)
2. Pulsa <botón> → debería aparecer <qué se ve>
3. <caso límite a comprobar>
```

- Cambiar el revisor de una tarea: `PATCH /tasks/<code> {"reviewer": "<nombre>"}` (`null` lo quita). Filtrar: `GET /projects/:id/tasks?status=En revisión&reviewer=<nombre>`.
- Revisor por defecto del proyecto: `PATCH /projects/:id {"default_reviewer": "<nombre>"}` — cámbialo solo si el usuario lo pide.
- Si te devuelven la tarea, el motivo llega como comentario "↩️ Devuelta a En progreso": léelo antes de seguir.

### Tareas que esperan a un externo (cliente, asesor, partner)

Si una tarea no puede avanzar porque espera algo de **un tercero de fuera del equipo** (un Excel del cliente, unas credenciales, la respuesta de un asesor), **márcalo con el campo, no lo escribas en el título ni en una memoria**:

```bash
curl -s -X PATCH "$BASE/tasks/<code>" -H "Authorization: Bearer $TASKNIC_API_KEY" \
  -H "Content-Type: application/json" -d '{"blocked_by_external": "Ricard (muestra de extracto BBVA)"}'
```

- `blocked_by_external`: texto libre con **a quién** y, si ayuda, **qué** se espera. Se muestra como "Esperando a …" en la UI, así que escríbelo como nombre (`"Cliente CIDI"`, no `"el cliente"`).
- `blocked_since` (opcional, `YYYY-MM-DD`): se pone solo a hoy al marcar el bloqueo. Mándalo solo si la espera empezó antes (ej. la fecha del comentario en que se pidió).
- Cada **5 días** de espera, Tasknic avisa a los asignados (app, push y WhatsApp): "lleva N días esperando a X — ¿lo persigues?".
- Para quitarlo: `{"blocked_by_external": null}`. Al pasar la tarea a "Hecho" se quita solo.
- Consultar las bloqueadas de un proyecto: `GET /projects/:id/tasks?blocked=true`.
- No lo confundas con las **dependencias** (`/dependencies`): esas son "esta tarea espera a OTRA tarea de Tasknic"; `blocked_by_external` es "espera a una persona de fuera".

### Registrar un deploy (qué corre en producción)

Cada vez que despliegues a producción o staging (EasyPanel, Edge Functions, migraciones…), el **último paso** es registrarlo en Tasknic. Así la ficha de Despliegue del proyecto dice qué corre de verdad y nadie tiene que averiguarlo por SSH.

**1. El SHA tiene que existir en GitHub** (nunca un commit sin pushear):

```bash
set -e
git fetch -q
# EasyPanel construye desde GitHub → el SHA de la rama que despliega (no siempre main):
SHA=$(git rev-parse origin/main)
# Edge Functions / migraciones se despliegan desde tu árbol local → despliega con el árbol
# limpio y HEAD ya pusheado, y usa HEAD (comprueba que coincide con origin):
#   test -z "$(git status --porcelain)" && test "$(git rev-parse HEAD)" = "$(git rev-parse origin/main)" && SHA=$(git rev-parse HEAD)
echo "$SHA" | grep -Eq '^[0-9a-f]{40}$'
```

**2. Registrar** — en la URL usa el **UUID del proyecto** (de `GET /projects`); si usas el nombre, codifica los espacios (`TaskNic%20Evolutivo`): con un espacio sin codificar curl falla sin decir nada.

```bash
curl -sS --fail-with-body -X POST "$BASE/projects/<uuid-del-proyecto>/deployments" \
  -H "Authorization: Bearer $TASKNIC_API_KEY" -H "Content-Type: application/json" \
  -d "{\"sha\": \"$SHA\", \"environment\": \"production\", \"branch\": \"main\", \"migrations_applied\": [\"0031_x\"], \"status\": \"success\", \"verified\": true, \"task\": \"<código de la tarea del deploy>\", \"requested_by\": \"<quién te lo pidió>\"}"
```

- **`environment`**: `production` (por defecto) o `staging`.
- **`target`**: omítelo si desplegaste el proyecto entero (sustituye a los parciales anteriores). Si solo una parte: `web`, `edge-functions/<nombre>` o `migrations`.
- **`status`**: `success`, `failed` o `rolled_back` (en un rollback, `sha` = la versión **a la que volviste**, la que corre ahora). Un deploy que falló también se registra: no cambia lo que corre, pero queda a la vista.
- **`verified`**: `true` o `false` sin comillas; `true` solo si comprobaste en vivo que funciona (marcador de versión, curl, la app responde), no solo que lo lanzaste.
- **`migrations_applied`**: array de strings con los nombres tal cual. **`task`**: la tarea del runbook. **`requested_by`**: el humano que te lo pidió.
- Los registros no se editan ni se borran. Si te equivocaste, registra otro. No hagas registros de prueba.
- "¿Qué hay en prod?": `GET /projects/<uuid>/deployments` → `running[]` por entorno y parte (`running` = lo que corre, `last_failed` = intento fallido posterior) + `history`.

### Recordatorio con fecha: caducidades y esperas con día conocido

Cuando algo tiene que pasar **un día concreto** (caduca un token, una credencial o un certificado; "el día X del cliente"; "revísalo en 90 días"), **crea una tarea con `remind_at`**, no lo apuntes en la memoria del repo: la memoria no avisa a nadie.

```bash
curl -s -X POST "$BASE/tasks" -H "Authorization: Bearer $TASKNIC_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"project": "…", "title": "Rotar credencial — API key de X", "status": "Backlog", "due_date": "2027-08-10", "remind_at": "2027-07-27"}'
```

- `remind_at`: `"YYYY-MM-DD"` (ese día a las 09:00, hora de Madrid) o fecha-hora ISO. Tiene que ser futuro; `null` lo quita.
- Hasta esa fecha la tarea "duerme" (se ve con 💤 en el tablero). Ese día vuelve a **Por hacer**, salvo que ya esté En progreso o En revisión, y avisa por app, push y WhatsApp a los asignados (si no hay, a quien la pidió). Una descartada no despierta.
- Para caducidades pon `due_date` = el día que caduca y `remind_at` con margen (unas 2 semanas antes). Si es una credencial, usa la plantilla "Rotación de credencial" y termina creando la siguiente tarea de rotación.
- Tareas dormidas de un proyecto: `GET /projects/:id/tasks?sleeping=true`.

### Tags (etiquetas)

Catálogo de la empresa (no por proyecto), nombre único dentro de la empresa. Se pasan **por nombre**, nunca por UUID:

```bash
curl -s "$BASE/labels" -H "Authorization: Bearer $TASKNIC_API_KEY"   # catálogo existente: [{id, name, color}]
```

En `POST /tasks` y `PATCH /tasks/:id` el campo `tags: string[]` resuelve cada nombre contra ese catálogo; si un tag no existe **se crea al vuelo** (igual que en la UI web — cualquier miembro puede crear tags, no hace falta ser admin). Antes de inventar un nombre nuevo, revisa `GET /labels` para reusar uno existente y evitar duplicados por variaciones de escritura (`"Bug"` vs `"bug"` sí matchea insensible a mayúsculas; `"bug"` vs `"bugs"` no). En `PATCH`, `tags` reemplaza el set completo de la tarea, igual que `assignees`. `GET /tasks/:id` y los listados devuelven `tags` como array de nombres.

Renombrar/recolorear o borrar un tag (solo admin, RLS — igual que la UI web en Configuración → Etiquetas):

```bash
curl -s -X PATCH "$BASE/labels/<id>" -H "Authorization: Bearer $TASKNIC_API_KEY" \
  -H "Content-Type: application/json" -d '{"name": "bug crítico", "color": "#ef4444"}'

curl -s -X DELETE "$BASE/labels/<id>" -H "Authorization: Bearer $TASKNIC_API_KEY"
```

Borrar un tag lo quita en cascada de todas las tareas que lo tengan. El `id` sale de `GET /labels`.

### Adjuntar archivos a una tarea

```bash
# desde un archivo local (base64) o desde una URL
curl -s -X POST "$BASE/tasks/<id>/attachments" -H "Authorization: Bearer $TASKNIC_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"file_name": "reporte.pdf", "mime_type": "application/pdf", "content_base64": "'"$(base64 -w0 reporte.pdf)"'", "requested_by": "<nombre>"}'

curl -s -X POST "$BASE/tasks/<id>/attachments" -H "Authorization: Bearer $TASKNIC_API_KEY" \
  -H "Content-Type: application/json" -d '{"url": "https://ejemplo.com/captura.png", "requested_by": "<nombre>"}'
```

Máx 50 MB. La respuesta trae la `url` pública. Los adjuntos existentes vienen en `GET /tasks/:id`. `requested_by` (opcional): ver "Atribución" arriba — mandalo si sabes quién te pidió subir el archivo, si no la única forma de borrarlo después va a ser que un admin lo haga.

### Espacio del proyecto (documentos, notas, reuniones)

El "Espacio" guarda el conocimiento del proyecto: notas Markdown, archivos y grabaciones de reuniones (Leexi) con transcripción. Úsalo para dar contexto o dejarlo:

```bash
curl -s "$BASE/projects/<proyecto>/space" -H "Authorization: Bearer $TASKNIC_API_KEY"     # listado
curl -s "$BASE/documents/<id>" -H "Authorization: Bearer $TASKNIC_API_KEY"                # nota/archivo completo
curl -s "$BASE/recordings/<id>" -H "Authorization: Bearer $TASKNIC_API_KEY"               # summary + transcript completos

# dejar una nota (Markdown) o subir un archivo al espacio
curl -s -X POST "$BASE/projects/<proyecto>/documents" -H "Authorization: Bearer $TASKNIC_API_KEY" \
  -H "Content-Type: application/json" -d '{"title": "Decisiones sprint 3", "body": "# Markdown…"}'
```

Si necesitas contexto de una reunión ("¿qué se decidió con el cliente?"), lee el `transcript`/`summary` de la grabación correspondiente.

**Corregir o borrar lo que hay en el Espacio** (los `id` salen del listado `GET /projects/<proyecto>/space`):

```bash
# editar una NOTA: título y/o contenido (manda el body completo, no un parche)
curl -s -X PATCH "$BASE/documents/<id>" -H "Authorization: Bearer $TASKNIC_API_KEY" \
  -H "Content-Type: application/json" -d '{"title": "Decisiones sprint 3", "body": "# Markdown corregido…"}'

# en un ARCHIVO solo se puede cambiar el title; para cambiar el contenido, bórralo y sube el nuevo
curl -s -X DELETE "$BASE/documents/<id>" -H "Authorization: Bearer $TASKNIC_API_KEY"    # nota o archivo (limpia el storage)
curl -s -X DELETE "$BASE/recordings/<id>" -H "Authorization: Bearer $TASKNIC_API_KEY"   # grabación
```

- Si una nota tiene un error (enlaces rotos, datos equivocados), **corrígela con `PATCH`**; no añadas una nota nueva "de corrección" encima: el cliente puede ver el Espacio.
- Borrar es irreversible: confirma con el usuario antes de borrar un documento o una grabación que no hayas creado tú en esta sesión.
- Lo que **no** está en la API a propósito: los enlaces públicos para compartir y la importación de llamadas de Leexi (se hacen desde la UI).

### Descartar una tarea (abandonar un enfoque): con motivo, nunca borrando

Si una tarea ya no se va a hacer (se cambió de enfoque, dejó de tener sentido, la resolvió otra cosa), **descártala**, no la borres: borrar destruye el porqué y alguien volverá a explorar el mismo camino.

```bash
curl -s -X PATCH "$BASE/tasks/<id>" -H "Authorization: Bearer $TASKNIC_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"status": "discarded", "discard_reason": "Se descarta el enfoque X porque Y (ver ROS0012)"}'
```

- Sin `discard_reason` (mín. 3 caracteres) el API responde `400`: el motivo es obligatorio (también en la BD).
- La descartada sale del tablero y de `GET /projects/:id/tasks`; para consultarlas: `?status=discarded` (o `?include_discarded=true` para mezclarlas). Traen `discard_reason` y `discarded_at`.
- Antes de proponer un enfoque en un proyecto, mira sus descartadas: puede que ya se probó y por qué no.
- Reabrir = `PATCH` con otro `status` (el motivo se borra de la tarea, pero queda en su historial de actividad).
- No se puede crear una tarea ya descartada.

### Tareas que salen de una reunión: enlázalas a su grabación

Si creas tareas a partir de una reunión del Espacio (lo que alguien se comprometió a hacer), **enlaza cada tarea a la grabación y a la frase exacta**. En la tarea se verá de qué reunión sale, quién lo dijo y desde qué minuto, con un enlace a la transcripción en ese punto. Así cualquiera puede comprobarlo contra la fuente.

```bash
# 1. La transcripción numerada por intervenciones (en vez del texto corrido):
curl -s "$BASE/recordings/<id-grabación>?segments=true" -H "Authorization: Bearer $TASKNIC_API_KEY"
#    → recording.segments[] = {index, speaker, start_seconds, text}

# 2. Crear la tarea con su origen:
curl -sS --fail-with-body -X POST "$BASE/tasks" -H "Authorization: Bearer $TASKNIC_API_KEY" -H "Content-Type: application/json" \
  -d '{"project": "<uuid>", "title": "…", "source_recording_id": "<id-grabación>",
       "source_quote": {"text": "<frase LITERAL del segmento>", "speaker": "<segments[i].speaker>", "start_seconds": <segments[i].start_seconds>, "segment_index": <i>}}'
```

- La **cita es literal**, copiada del segmento en su idioma original: no la traduzcas ni la resumas.
- La grabación tiene que ser **del mismo proyecto** que la tarea; si no, el API responde 400.
- "Titanic Factory Media" es la cuenta de grabación del equipo, **no una persona**: no asignes la tarea deduciendo quién hablaba; pregunta.
- En la web, quien tenga el permiso «Reuniones — extraer compromisos» puede pedirle a Nic que proponga los compromisos de una reunión y revisarlos antes de crearlos. No hace falta que lo repliques a mano si el humano puede usar eso.

### Borrar una tarea (o solo un comentario/adjunto puntual)

```bash
curl -s -X DELETE "$BASE/tasks/<id>" -H "Authorization: Bearer $TASKNIC_API_KEY"
```

Borra la tarea entera: subtareas, comentarios y adjuntos en cascada. **Borrar es solo para basura real** (duplicados, tareas de prueba); si la tarea simplemente no se hará, descártala con motivo (sección anterior). Solo borra tareas que creaste tú o que el usuario te pida explícitamente borrar.

Para limpiar sin borrar la tarea (ej. sacar un comentario viejo o un adjunto de una versión anterior sin perder el resto del historial), hay borrado puntual:

```bash
curl -s -X DELETE "$BASE/tasks/<id>/comments/<comment_id>" -H "Authorization: Bearer $TASKNIC_API_KEY"
curl -s -X DELETE "$BASE/tasks/<id>/attachments/<attachment_id>" -H "Authorization: Bearer $TASKNIC_API_KEY"
```

Los ids salen de `GET /tasks/:id` (cada comentario y adjunto trae su `id`). Ambos limpian también el archivo en storage cuando aplica — no dejan basura. Devuelven `404` si el id no pertenece a esa tarea.

### Responder a los humanos (comentar)

```bash
curl -s -X POST "$BASE/tasks/<id>/comments" -H "Authorization: Bearer $TASKNIC_API_KEY" \
  -H "Content-Type: application/json" -d '{"body": "Hecho — detalles en **Markdown**.", "mentions": ["<nombre>"], "requested_by": "<nombre>"}'
```

Usa `mentions` cuando quieras que alguien concreto reciba la notificación de mención. Usa `requested_by` (ver "Atribución" arriba) si sabes quién te pidió dejar este comentario.

Para corregir un comentario ya publicado (tuyo o de un humano, si eres admin) en vez de borrarlo y crear uno nuevo:

```bash
curl -s -X PATCH "$BASE/tasks/<id>/comments/<comment_id>" -H "Authorization: Bearer $TASKNIC_API_KEY" \
  -H "Content-Type: application/json" -d '{"body": "texto corregido", "mentions": ["<nombre>"]}'
```

Reemplaza el cuerpo completo (no es un append) y marca `edited_at` — `GET /tasks/:id` lo devuelve para que sepas si un comentario fue editado. Mismo permiso que borrar: autor, quien lo pidió (`requested_by`), o admin.

### Mientras trabajas en una tarea: borrador, no un comentario por avance

**Regla por defecto:** mientras iteras sobre una tarea (varios avances en la misma sesión o en varias), **no publiques un comentario por cada avance** — cada comentario avisa a los asignados y llena la tarea de ruido. Súmalos a un **borrador** con `"draft": true`:

```bash
curl -s -X POST "$BASE/tasks/<code>/comments" -H "Authorization: Bearer $TASKNIC_API_KEY" \
  -H "Content-Type: application/json" -d '{"body": "Avance: migración aplicada.", "draft": true, "requested_by": "<nombre>"}'
# → {"draft": {id, body (todo lo acumulado), entries, requested_by, updated_at}}
```

- El borrador es **uno por tarea** (compartido por todos los agentes), **no avisa a nadie** y los humanos lo ven en gris en la tarea ("✏️ Borrador … — en curso").
- Se publica como **UN solo comentario** (con sus avisos normales):
  - **solo, al pasar la tarea a En revisión, Hecho o Descartada** (la mueva quien la mueva),
  - **solo, tras 4 h sin tocarlo** (sesión cortada o te olvidaste),
  - o cuando tú lo pidas: `POST /tasks/<code>/comments/draft/publish` con `{"body": "..."}` opcional para publicar una **versión consolidada** en lugar de la suma de avances.
- **Al cerrar** (antes de mover a En revisión): consolida el borrador en el comentario de cierre con su `## Cómo probarlo` — `POST .../comments/draft/publish {"body": "<resumen final + ## Cómo probarlo>"}` — y luego mueve la tarea. Si mueves sin publicar, se publica tal cual está.
- Ver / reescribir / descartar: `GET`, `PATCH {"body"}` (reemplaza el texto entero), `DELETE` sobre `/tasks/<code>/comments/draft`. `GET /tasks/<code>` también devuelve `draft` (o `null`): míralo al retomar una tarea para seguir sumando en vez de repetir.
- **Excepción — comenta directo (sin `draft`)** cuando necesitas que un humano responda ya: una pregunta, un bloqueo, una decisión. Ahí usa `mentions` para que le llegue el aviso. Las menciones dentro de un borrador solo avisan al publicarse.
- Los adjuntos van a la tarea como siempre (`POST /tasks/<code>/attachments`); un borrador no tiene adjuntos propios.

### Soporte: tickets de clientes (correo y WhatsApp por proyecto)

Soporte se configura **por empresa** (la de tu key): un buzón (y más adelante un WhatsApp) para todos sus clientes, que vive en su proyecto bandeja «Soporte general», un **responsable de soporte** (ve todos los tickets y atiende lo que no tiene agente) y el acuse automático. Cada proyecto decide si tiene soporte (`enabled`), quién lo atiende, su agente por defecto y los dominios de correo del cliente. Cada mensaje va al proyecto de su cliente (ticket existente → persona ya conocida → dominio en `email_domains` de un proyecto con soporte activado → la IA, si está segura → si no, se queda en la bandeja; en ese caso el ticket puede traer `suggested_project` con el proyecto que la IA cree probable). Lo que escribe un cliente crea o continúa un **ticket** (código `<PREFIJO>-S0001`, p. ej. `WEB-S0001`) asignado al agente por defecto del proyecto. Es un proceso aparte de las tareas: hay gente con rol «Solo soporte» que ve tickets y ninguna tarea. Los tickets solo existen en la empresa de tu key.

```bash
# Por atender (Nuevo, Abierto, En curso); scope=waiting|resolved|all, o status= exacto
curl -s "$BASE/support/tickets?project=Web%20y%20reservas" -H "Authorization: Bearer $TASKNIC_API_KEY"
# Ticket + conversación completa (cliente, respuestas, notas, sistema) + tarea enlazada
curl -s "$BASE/support/tickets/WEB-S0001" -H "Authorization: Bearer $TASKNIC_API_KEY"
# Nota interna (el cliente no la ve)
curl -s -X POST "$BASE/support/tickets/WEB-S0001/notes" -H "Authorization: Bearer $TASKNIC_API_KEY" \
  -H "Content-Type: application/json" -d '{"body": "Reproducido en local: falla la zona horaria", "requested_by": "<humano>"}'
```

- **Estado** (`PATCH /support/tickets/:id {status?, priority?, assignee?, subject?, discard_reason?}`): Nuevo → Abierto → En curso → Esperando al cliente → Resuelto → Cerrado (se cierra solo 7 días después de Resuelto); Descartado exige motivo. **Cambiar el estado nunca avisa al cliente.** Si el cliente vuelve a escribir, el ticket se reabre solo.
- **Responder al cliente** (`POST /support/tickets/:id/reply {text, status_after?, requested_by}`) **envía de verdad** por la misma vía (correo en el mismo hilo o WhatsApp). Solo con el OK explícito del humano en esta conversación y con el texto exacto que aprobó. Para proponerlo: `POST /support/tickets/:id/draft {instructions?}` devuelve un borrador con IA (no envía nada). `status_after`: Esperando al cliente (por defecto), En curso, Abierto o Resuelto.
- **Escalar a tarea** cuando el ticket necesita trabajo del equipo: `POST /support/tickets/:id/escalate {title, description?, priority?, assignee?, requested_by?}` crea la tarea en «Por hacer» enlazada al ticket (con una referencia al final de la descripción). Cuando la tarea pase a **Hecho** o **Descartada**, el ticket recibe una nota y quien lo atiende un aviso; **no avises tú al cliente**: lo decide la persona que atiende. Si trabajas en una tarea que viene de un ticket, al cerrarla basta con moverla: el ticket se entera solo.
- **Mover de proyecto** (solo tickets del canal compartido, sin tarea enlazada): `POST /support/tickets/:id/move {project, remember_domain?}` → código nuevo del proyecto destino; el anterior queda en `previous_codes` y sigue sirviendo para buscar el ticket y para las respuestas del cliente. `remember_domain: true` añade el dominio del cliente a ese proyecto (no admite Gmail, Hotmail… ni un dominio que ya tenga otro proyecto). Confirma proyecto y dominio con el humano antes.
- **Fusionar duplicados** (mismo proyecto): `POST /support/tickets/:id/merge {into}` — el ticket `:id` (el que sobra) pasa sus mensajes a `into` y queda Cerrado; sus códigos siguen llevando al que queda. Confirma con el humano cuál se queda.
- **Contactos**: `GET /support/contacts?project=&q=` · `PATCH /support/contacts/:id {name?, email?, phone?}` · `DELETE /support/contacts/:id` (solo admins; 409 si tiene tickets abiertos: primero se cierran, descartan o fusionan). Confirma con el humano antes de borrar.
- **Ajustes de la empresa**: `GET /support/settings` (bandeja, buzones sin secretos, responsable, acuse, proyectos con soporte) · `PATCH /support/settings {lead?: nombre|null, auto_ack?}`. Los buzones y su contraseña solo se conectan desde la web (Configuración → Soporte, con «Probar conexión»).
- **Ajustes del proyecto**: `GET /support/projects/:id` (`enabled`, `is_inbox`, agentes, agente por defecto, `email_domains`) · `PATCH /support/projects/:id {enabled?, default_assignee?, email_domains?: ["cliente.es"]}` (la lista sustituye a la anterior). Sin agente por defecto, los tickets van al responsable de la empresa · `POST /support/projects/:id/agents {member}` / `DELETE /support/projects/:id/agents/:userId`. Un **miembro** que atiende soporte necesita además el permiso «Soporte» (`support_access`); admin y «Solo soporte» no.
- **No expuesto**: crear canales y guardar contraseñas de buzones (solo desde la web; las contraseñas van a Vault y no se pueden leer).

## Administración (paridad con la UI web)

El agente opera con permisos de **admin**, igual que un humano admin en `/settings` — puede hacer casi todo lo que la UI permite. Estos endpoints son menos frecuentes que crear/mover tareas, así que aquí solo un resumen; `GET /` siempre trae la lista completa y actualizada con el shape de cada body.

- **Proyectos**: `POST /projects {name, description?, color?, status?, members?[]}` · `PATCH /projects/:id {name?, description?, color?, status?, default_reviewer?}` (status: `preparation|active|paused|archived`; `archived` = cliente que cerró: se conserva todo, sale del menú, de Tareas y de «Para tu OK», y no envía recordatorios — se restaura con `active`) · `DELETE /projects/:id` (borra tareas/documentos/grabaciones en cascada — confirma con el usuario antes; si solo quiere quitarlo de en medio, propón archivarlo) · `POST /projects/:id/members {member}` / `DELETE /projects/:id/members/:userId`.
- **Equipo** (de la empresa de tu key): `PATCH /team/:userId {full_name?, phone?, role?}` (`admin|member|support`, este último = «Solo soporte»; el rol es el de esa persona EN ESTA empresa) · `DELETE /team/:userId` (la quita de esta empresa; su cuenta solo se borra si no pertenece a ninguna otra — confirma siempre). `POST /invitations {email, phone, role?}` invita por WhatsApp (el mismo flujo que la UI) · `DELETE /invitations/:id` revoca.
- **Plantillas de tareas**: `GET /templates` · `POST /templates {name, title, description?, priority?, subtasks?: [{title}]}` · `DELETE /templates/:id`.
- **Columnas del tablero** (globales, un solo Kanban para todo el workspace, no por proyecto): `GET /board-columns` · `PATCH /board-columns {columns: [{key?, label, color?, is_closing?}]}` — manda el set COMPLETO en el orden final (la posición es el índice); sin `key` crea una columna nueva, las de sistema (`todo/in_progress/in_review/done`) nunca se borran.
- **Dependencias entre tareas** ("la tarea X bloquea a Y"): `POST /tasks/:id/dependencies {depends_on: uuid|code}` · `DELETE /tasks/:id/dependencies/:dependsOnId`. `GET /tasks/:id` devuelve `blockers: [{id, title, status}]`. `depends_on` acepta UUID o el `code` de la tarea (no nombre).
- **Historial de actividad** (solo lectura): `GET /projects/:id/activity` y `GET /tasks/:id/activity`.
- **Novedades del producto**: `GET /changelogs` · `POST /changelogs {title, body, version}` (semver, ej. `1.2.0`) — notifica in-app a todo el equipo y por WhatsApp a los admins, usalo solo cuando el usuario pida explícitamente publicar una novedad.

**NO expuesto a propósito** (no son gaps, son límites de seguridad — no los pidas ni los simules): que el agente cree o revoque sus propias API keys (`tk_...`, eso es solo humano-admin vía UI), enlaces públicos para compartir documentos/grabaciones (`share_token`), e integración en vivo con Leexi (listar/importar/grabar llamadas).

## Reglas

- NUNCA inventes UUIDs: usa nombres o ids que obtuviste de la propia API.
- Si sabes con qué humano estás chateando (quien te pidió la tarea o el comentario), manda siempre `requested_by` con su nombre — no lo omitas "por las dudas". Le da a esa persona el permiso de borrar lo que pidió y trazabilidad visual en la UI (avatar superpuesto + nombre con 🤖 en el Historial, ver "Atribución" arriba). Determinarlo bien es responsabilidad tuya en cada sesión: nunca un nombre fijo ni asumido — ver "¿Quién es 'el humano que te lo pidió'?" arriba.
- Antes de crear una tarea revisa si ya existe una equivalente en el proyecto (`GET /projects/:ref/tasks`) para no duplicar.
- Al terminar un trabajo que te delegaron desde una tarea de Tasknic: muévela a "En revisión" (no a "Hecho" — eso lo decide un humano) y deja un comentario con el resultado **que incluya una sección `## Cómo probarlo`** (ver "Revisión" abajo).
- Mientras trabajas en una tarea, acumula los avances en el **borrador** (`"draft": true`) y publica UN comentario al cerrar — no un comentario por avance (ver "Mientras trabajas en una tarea" arriba). Comenta directo solo para preguntas o bloqueos que necesitan a un humano ya.
- **Si la mejora cambia la interfaz de Tasknic** (pantallas, textos, chips, flujos), antes de cerrarla revisa la ayuda: qué guías de `src/features/help/content/` describen lo que cambió (y el copy de marketing en `src/features/marketing/content/`), corrígelas, regenera capturas y PDFs con `npm run help:shots && npm run help:pdf` (producción https, cuenta demo; ~6 min) y commitea las PNG/PDF junto con el texto. El build falla a propósito si una guía referencia una captura sin PNG. Nunca edites `public/help/*.md` ni los PDF a mano.
- **Nunca escribas a un cliente de Soporte** (`/support/tickets/:id/reply`) sin el OK explícito del humano en esta conversación sobre ese texto exacto. Notas internas, estados y escalados no salen al cliente; la respuesta sí.
- Errores 4xx traen un campo `error` explicativo (y `valid`/`candidates` cuando aplica): corrige y reintenta; no repitas la misma llamada tal cual.
- El agente opera con permisos de **admin** (puede borrar proyectos enteros, eliminar miembros del equipo, reescribir las columnas del tablero, etc.). Antes de cualquier `DELETE /projects/:id`, `DELETE /team/:userId`, o `PATCH /board-columns` que quite/renombre columnas existentes, confirma explícitamente con el usuario — son cambios destructivos e irreversibles que afectan a todo el equipo, no solo una tarea puntual.
