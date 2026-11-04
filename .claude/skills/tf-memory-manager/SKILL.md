---
name: tf-memory-manager
description: |
  Sistema de memoria persistente POR PROYECTO. Guarda conocimiento en .titan/memory/ dentro del repo,
  versionado con git, compartido con el equipo. Reemplaza la auto-memory de Claude Code que es local
  y no viaja con el proyecto. Usar PROACTIVAMENTE al inicio de sesion para cargar contexto,
  cuando el usuario corrige algo, cuando se descubre un patron nuevo, cuando se resuelve un bug,
  o cuando el usuario dice recordar/recuerda/guarda esto/no olvides.
  Triggers: recuerda, remember, guarda esto, no olvides, te acuerdas, recuerdas, memoria,
  en que quedamos, contexto anterior, que sabes de, conversacion pasada, sesion anterior.
allowed-tools: Read, Write, Edit, Glob, Grep, Bash
---

# Memory Manager — Memoria Persistente por Proyecto

> La memoria vive en `.titan/memory/` DENTRO del repo. Versionada en git. El usuario tiene control total.
> Auto-memory de Claude Code esta DESACTIVADO (`.claude/settings.json`). Esta skill es el unico mecanismo de memoria.

## Memoria compartida con Codex

En este repo conviven Titan Factory para **Claude Code** (`.claude/`) y **Titan Factory Codex**
(`plugins/titan-factory-codex/`). Ambos leen y escriben **la misma memoria**: `.titan/memory/`.
Lo mismo aplica a planes (`.titan/plans/`) y evidencia de QA (`.titan/qa/`).

- NUNCA crear `.claude/memory/` ni otra copia: una sola fuente de verdad.
- Lo que guardes aqui lo lee Codex (`tf-memory-manager` del plugin) y viceversa.
- Respeta el formato existente para que ambos agentes lo entiendan (ver "Como GUARDAR").
- Si una memoria escrita por el otro agente contradice el codigo actual, el codigo gana:
  marcala como superada en vez de borrarla.

---

## Activacion

**SIEMPRE ACTIVO EN TITAN FACTORY:** Este skill se activa automaticamente en cada sesion
via el Paso 0 del skill `tf-primer` (no es opcional — en Titan Factory trabajan varios
programadores sobre el mismo repo y la memoria debe viajar con el).

El setup ya existe en este repo: `.claude/settings.json` con `"autoMemoryEnabled": false`
y `.titan/memory/MEMORY.md` con las 4 carpetas. Si algo faltara, recrear SOLO lo que falte:

1. `.claude/settings.json`: agregar `"autoMemoryEnabled": false` sin borrar otras claves.
   (La auto-memory de Claude Code vive en `~/.claude/projects/`, local a la maquina: no viaja
   con el repo, no se versiona y el equipo no la ve.)
2. Carpetas: `mkdir -p .titan/memory/{user,feedback,project,reference}`
3. `.titan/memory/MEMORY.md`: crear un indice vacio solo si no existe. NUNCA sobrescribir el
   existente — tiene entradas escritas por Claude Code y por Codex.

---

## Arquitectura

```
.titan/memory/
├── MEMORY.md              <- Indice (max 200 lineas, se carga al inicio)
├── user/                  <- Sobre el usuario/equipo (preferencias, como trabajan)
├── feedback/              <- Correcciones del usuario (que hacer/no hacer y POR QUE)
├── project/               <- Estado de iniciativas en curso (fechas absolutas)
└── reference/             <- Donde encontrar cosas, patrones descubiertos, soluciones
```

La carpeta ES el tipo. No se usa frontmatter en los archivos de memoria.

---

## Cuando CONSULTAR Memoria

### Automatico (sin que el usuario lo pida)
- **Inicio de sesion**: Leer MEMORY.md para orientarte. Si un tema del indice es relevante al trabajo actual, leer el archivo de detalle.
- **Tema recurrente**: Si el usuario menciona algo que suena a una correccion o decision pasada, buscar en memoria antes de responder.
- **Antes de proponer algo**: Si vas a sugerir una arquitectura, flujo, o decision, verificar que no contradiga una decision guardada.

### Cuando el usuario lo pide
- "Te acuerdas de...?" / "En que quedamos con...?" / "Que sabes de...?"
- Buscar en MEMORY.md primero, luego en archivos de detalle si hay match.

### Como consultar
1. Leer `.titan/memory/MEMORY.md` (el indice)
2. Si hay un archivo de detalle relevante, leerlo
3. Si no encuentras nada, decirlo honestamente: "No tengo eso en memoria"

---

## Cuando GUARDAR Memoria

### Triggers de guardado (proactivo)

| Trigger | Tipo | Ejemplo |
|---------|------|---------|
| El usuario te corrige | `feedback` | "No hagas eso, mejor asi..." |
| El usuario dice "recuerda" | cualquiera | "Recuerda que el deploy es manual" |
| Se resuelve un bug no obvio | `reference` | "El error era por X, la solucion es Y" |
| Decision de arquitectura importante | `project` | "Vamos a usar Stripe en vez de Polar" |
| Descubres un patron util | `reference` | "Este endpoint necesita el header X" |
| Preferencias del usuario/equipo | `user` | "Prefiero componentes funcionales" |
| Algo se rompio y se arreglo | `feedback` | "Nunca uses --force en ese repo" |

### Triggers de guardado (cuando el usuario lo pide)
- "Guarda esto" / "No olvides" / "Recuerda que" / "Anotalo"

### Que NO guardar (NUNCA)
- Cosas derivables del codigo actual (leer el repo es mejor)
- Git history (git log/blame es la fuente de verdad)
- Lo que ya esta en CLAUDE.md (no duplicar)
- Estado temporal de la conversacion actual (efimero)
- Soluciones de debugging triviales (el fix esta en el codigo)

---

## Como GUARDAR

### Paso 1: Verificar que no existe
Leer MEMORY.md. Si ya hay un archivo sobre ese tema, ACTUALIZAR en vez de crear uno nuevo.

### Paso 2: Escribir/actualizar el archivo de detalle

Crear el archivo en la carpeta correcta segun el tipo:

| Carpeta | Contenido |
|---------|-----------|
| `user/` | Sobre el usuario/equipo (preferencias, como trabajan) |
| `feedback/` | Correcciones del usuario (que hacer/no hacer y POR QUE) |
| `project/` | Estado de iniciativas en curso (con fechas absolutas, no relativas) |
| `reference/` | Donde encontrar cosas, patrones, soluciones a problemas recurrentes |

Formato (compartido con Codex — no cambiarlo):

- Markdown plano. Sin frontmatter. Empieza con `# Titulo`.
- Nombre de archivo: `YYYY-MM-DD-tema-en-kebab-case.md` (ej. `project/2026-10-01-portable-agent-tooling.md`).
- Segunda linea: `Date: YYYY-MM-DD`. Incluir la fuente/evidencia (instruccion del usuario, archivo, QA).
- Hechos verificados, no hipotesis. Sin credenciales ni datos personales innecesarios.

### Paso 3: Actualizar el indice MEMORY.md

Agregar una linea al indice bajo la seccion correcta con el formato existente:
`- [YYYY-MM-DD — Titulo](carpeta/archivo.md)`. Agregar lineas; no reordenar ni reescribir
el indice completo (reduce conflictos de merge cuando Claude y Codex guardan en paralelo).
Mantener MEMORY.md bajo 200 lineas.
Organizar por tema, no cronologicamente.

### Paso 4: Informar al usuario

Decir que guardaste y en que archivo. No pedir permiso (el lo vera en el diff de git).
Si el usuario revierte el cambio, respetar sin discutir.

---

## Reglas de Oro

1. **Consultar es gratis, guardar es caro.** Lee memoria seguido. Escribe solo cuando el conocimiento sobrevive a la sesion actual.
2. **Fechas absolutas siempre.** "Jueves" -> "2026-03-12". Las memorias se leen semanas despues.
3. **Un archivo por tema.** No mezclar. Si crece mucho, dividir.
4. **El usuario es el dueno.** El puede borrar, editar, revertir cualquier memoria. Tu no borras sin que lo pida.
5. **Sin duplicados con CLAUDE.md / AGENTS.md.** Si algo ya esta en las instrucciones del proyecto, no repetirlo en memoria.
6. **Honestidad sobre limites.** Si no tienes algo en memoria, dilo. No inventes.
7. **Guardar no es commitear.** No crear commits solo para guardar memoria salvo que el usuario lo pida.
