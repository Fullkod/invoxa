---
name: tf-primer
description: "Cargar contexto completo del proyecto al inicio de una conversacion. SIEMPRE activa la memoria persistente (tf-memory-manager) como primer paso. Lee .titan/memory/MEMORY.md, BUSINESS_LOGIC.md, estructura de features, estado de la BD, y configuracion actual. Activar cuando el agente no tiene contexto del proyecto o el usuario dice: que tenemos, donde estamos, dame contexto, resumeme el proyecto."
allowed-tools: Read, Grep, Glob, Bash
---

# Primer: Contexto Titan Factory

Este proyecto fue creado con **Titan Factory**, una template optimizada para desarrollo Agent-First. Al ejecutar este skill, el agente entiende inmediatamente que tiene disponible y como trabajar.

## Lo Que Ya Sabes (Titan Factory DNA)

### Golden Path (Stack Fijo)
No hay decisiones tecnicas que tomar. El stack esta definido:

| Capa | Tecnologia | Notas |
|------|------------|-------|
| Framework | Next.js 16 + Turbopack | App Router, Server Components |
| UI | React 19 + TypeScript | Strict mode |
| Styling | Tailwind CSS 3.4 | Sin CSS custom |
| Backend | Supabase | Auth + PostgreSQL + Storage + RLS |
| Validation | Zod | Schemas compartidos client/server |

### Arquitectura Feature-First
```
src/
├── app/                    # Next.js App Router
│   ├── (auth)/            # Route group: pages without sidebar
│   ├── (main)/            # Route group: pages with sidebar
│   └── api/               # API Routes
├── features/              # Everything colocated by feature
│   └── [feature-name]/
│       ├── components/    # Feature UI
│       ├── services/      # Business logic
│       ├── hooks/         # React hooks
│       └── types/         # TypeScript types
├── components/            # Shared components (Sidebar, etc.)
└── lib/
    └── supabase/          # Clients (client.ts, server.ts)
```

### MCPs Disponibles
Tienes 4 MCPs configurados. Usalos:

| MCP | Comandos Clave | Cuando Usar |
|-----|----------------|-------------|
| **Supabase** | `list_tables`, `execute_sql`, `apply_migration`, `get_logs` | SIEMPRE para BD. No uses CLI. |
| **Next.js DevTools** | `nextjs_index`, `nextjs_call`, `browser_eval` | Debug errores, ver estado del servidor |
| **Playwright** | `browser_navigate`, `browser_snapshot`, `browser_click` | Validacion visual, testing UI |
| **n8n** (opcional) | `search_nodes`, `validate_workflow`, `n8n_create_workflow` | Puente a otros sistemas. Consultar skill `tf-n8n-mcp-tools-expert` ANTES de usar |

### Skills Disponibles
Delega tareas complejas usando los skills especializados:

| Skill | Responsabilidad |
|-------|-----------------|
| `frontend` | UI/UX, componentes, Tailwind, animaciones |
| `backend` | Server Actions, APIs, logica de negocio |
| `tf-supabase-admin` | Migraciones, RLS policies, queries complejas |
| `calidad` | Tests, quality gates, verificacion |
| `tf-vercel-deployer` | Deploy, env vars, dominios |
| `documentacion` | README, docs tecnicos |
| `tf-codebase-analyst` | Patrones, convenciones del proyecto |

### Skills Slash Disponibles
- `tf-primer` - Este skill (contexto inicial)
- `tf-prp` - Generar Product Requirements Proposal
- `tf-new-app` - Crear nueva aplicacion desde cero
- `landing` - Crear landing page de alta conversion
- `tf-add-login` - Inyectar sistema de autenticacion completo
- `tf-easypanel-deploy` - Deploy en VPS con EasyPanel (Docker + SSL)
- `tf-eject-tf` - Eliminar configuracion Titan Factory
- `tf-update-tf` - Actualizar a la ultima version

---

## Proceso de Contextualizacion

### 0. Sincronizar Repositorio y Activar Memoria Persistente (OBLIGATORIO — SIEMPRE PRIMERO)

#### 0a. Sincronizar con git (pull si es seguro)

Antes de leer memoria o codigo, revisar si hay commits remotos pendientes y traerlos si no hay riesgo:

1. Si no es un repo git o no hay remoto configurado → omitir en silencio, no reportar nada.
2. Si `git status --porcelain` muestra cambios sin commitear, o hay un merge/rebase en curso →
   NO tocar el repo. Anotar para el resumen final: "pull pendiente, no aplicado por cambios
   locales sin commitear".
3. Si el working tree esta limpio: `git fetch`, luego comparar con el upstream.
   - Sin commits nuevos en el remoto → nada que reportar.
   - Con commits nuevos y el pull seria fast-forward puro (sin commits locales sin pushear
     que diverjan) → ejecutar `git pull --ff-only`. Anotar: "repo actualizado, N commits nuevos".
   - Con commits nuevos pero hay divergencia (commits locales propios) → NO mergear.
     Anotar: "pull pendiente, no aplicado por commits locales sin pushear (requiere merge manual)".
4. Si `fetch`/`pull` falla (sin red, etc.) → no reintentar. Anotar: "pull pendiente, no se pudo
   verificar/aplicar (sin conexion o error de git)".

Nunca se hace merge, rebase, ni pull forzado — solo fast-forward limpio. Todo caso ambiguo se
reporta al final del resumen (paso 4), nunca se fuerza.

#### 0b. Activar memoria persistente

En Titan Factory trabajan **varios programadores sobre el mismo repo de GitHub**.
La memoria del proyecto DEBE viajar con el repo — por eso el skill `tf-memory-manager`
se activa SIEMPRE, en cada sesion, sin que el usuario lo pida:

1. **Verificar setup** (viene de fabrica, pero puede faltar en proyectos viejos):
   - Existe `.claude/settings.json` con `"autoMemoryEnabled": false`? Si no → crearlo/actualizarlo.
   - Existe `.titan/memory/MEMORY.md` y las carpetas `user/`, `feedback/`, `project/`, `reference/`?
     Si no → recrear solo lo que falte segun `tf-memory-manager` (nunca sobrescribir el indice).
   - La memoria es COMPARTIDA con Titan Factory Codex: puede haber entradas escritas por Codex.
2. **Cargar memoria**: Leer `.titan/memory/MEMORY.md` (el indice). Si algun tema del indice
   es relevante al trabajo actual, leer el archivo de detalle correspondiente.
3. **Queda activo el resto de la sesion**: aplicar las reglas de `tf-memory-manager`
   (consultar antes de proponer, guardar feedback/decisiones/patrones segun sus triggers).

NO continuar al paso 1 sin haber leido MEMORY.md.

### 1. Leer Identidad del Proyecto

Lee `CLAUDE.md` (que importa `AGENTS.md`), `BUSINESS_LOGIC.md` y `README.md`, y extrae:
- **Nombre del proyecto**
- **Problema que resuelve** (propuesta de valor)
- **Usuario target** (avatar)
- **Reglas de negocio especificas**

### 2. Mapear Estado de BD (via Supabase MCP)

Ejecuta `list_tables` para ver:
- Que tablas existen
- Cuantos registros tiene cada una
- Si RLS esta habilitado
- Relaciones entre tablas (foreign keys)

### 3. Escanear Features Implementadas

Revisa `src/app/` y `src/features/` para entender:
- Que paginas existen
- Que features estan construidas
- Que API endpoints hay

### 4. Entregar Resumen

```markdown
# [Nombre del Proyecto]

## Template
Titan Factory (Claude Code + Codex) — Next.js 16 + Supabase + Vercel

## Proposito
[Que problema resuelve en 1-2 lineas]

## Estado Actual

### Base de Datos
| Tabla | Registros | RLS |
|-------|-----------|-----|
| ... | ... | SI/NO |

### Rutas Implementadas
- `/` -> [descripcion]
- `/dashboard` -> [descripcion]
- ...

### API Endpoints
- `POST /api/xxx` -> [que hace]
- ...

## MCPs Activos
SI Supabase | SI Next.js DevTools | SI Playwright

## Memoria Persistente
SI Activa (.titan/memory/ — git-versioned, compartida con el equipo y con Codex)
[N memorias cargadas | memoria vacia, se ira llenando durante el trabajo]

## Comandos
- `npm run dev` -> Desarrollo
- `npm run build` -> Build

[Solo si el paso 0a genero una nota — omitir esta seccion si el repo ya estaba al dia
o no es un repo git:]
## Sincronizacion
Repo actualizado automaticamente (N commits nuevos via git pull --ff-only)
-- o --
Pull pendiente: [razon] — hazlo manualmente cuando puedas

## Listo para trabajar
En que te ayudo?
```

---

## Filosofia Titan Factory

### El Humano Decide QUE, Tu Ejecutas COMO
- El humano define el problema de negocio
- Tu traduces a codigo usando el Golden Path
- No preguntas "que stack usar?" - ya esta decidido

### Velocidad = Inteligencia
- Turbopack permite 100 iteraciones en 30 segundos
- Usa Playwright para validar visualmente -> codigo -> screenshot -> iterar
- No planifiques de mas, ejecuta y ajusta

### MCPs son tus Sentidos
- **Supabase MCP** = Tu conexion a la BD (no uses CLI)
- **Next.js DevTools** = Tus ojos en errores/logs
- **Playwright** = Tu validacion visual

---

**Objetivo**: De 5-10 minutos de explicacion a 30 segundos de contexto automatico.

*Titan Factory: Agent-First Development*
