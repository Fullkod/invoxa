# Skills System - Titan Factory V4

> Todo es un Skill. Hot reload. Auto-discovery. Zero config.

---

## Inventario de Skills (34 total)

### Invocables por el Usuario (/)

| Skill | Comando | Descripcion |
|-------|---------|-------------|
| `tf-new-app` | `/tf-new-app` | Entrevista de negocio → BUSINESS_LOGIC.md |
| `landing` | `/landing` | Landing cinematica: scroll-driven video + copy AIDA/PAS + glass-morphism |
| `tf-primer` | `/tf-primer` | Inicializar contexto del proyecto |
| `tf-add-login` | `/tf-add-login` | Auth completo Supabase (login, signup, password reset, profiles, RLS) |
| `tf-add-payments` | `/tf-add-payments` | Pagos con Polar (MoR): checkout, webhooks, suscripciones, acceso |
| `tf-add-emails` | `/tf-add-emails` | Emails transaccionales: Resend + React Email + batch + unsubscribe |
| `tf-add-mobile` | `/tf-add-mobile` | PWA instalable + push notifications (iOS compatible) |
| `tf-add-manual` | `/tf-add-manual` | Manual de usuario para clientes: editor, preview, descarga MD/PDF, dual audiencia (trabajador/admin) y dual idioma (es/en) |
| `tf-eject-tf` | `/tf-eject-tf` | Remover Titan Factory del proyecto (DESTRUCTIVO) |
| `tf-update-tf` | `/tf-update-tf` | Actualizar a ultima version |
| `tf-bucle-agentico` | `/tf-bucle-agentico` | Bucle Agentico para sistemas complejos (por fases) |
| `sprint` | `/sprint` | Bucle Agentico para tareas rapidas |
| `tf-prp` | `/tf-prp [feature]` | Generar Product Requirements Proposal |
| `tf-ai` | `/tf-ai [template]` | Implementar AI Templates (chat, RAG, vision, tools) |
| `qa` | `/qa [descripcion]` | QA automatizado con Playwright CLI |
| `tf-skill-creator` | `/tf-skill-creator` | Crear nuevos skills |
| `tf-memory-manager` | `/tf-memory-manager` | Memoria persistente por proyecto (reemplaza auto-memory) |
| `tf-image-generation` | `/tf-image-generation` | Generar/editar imagenes con OpenRouter + Gemini |
| `tf-autoresearch` | `/tf-autoresearch [skill]` | Auto-optimizar skills con loop autonomo (Karpathy) |
| `tf-easypanel-deploy` | `/tf-easypanel-deploy` | Deploy en VPS con EasyPanel: Docker + Prisma SQLite + SSL |

### Invocables por Claude (automaticos)

| Skill | Se activa cuando... |
|-------|---------------------|
| `backend` | Tareas de Server Actions, APIs, logica de negocio, validaciones |
| `frontend` | UI/UX, componentes React, Tailwind, animaciones |
| `tf-supabase-admin` | Migraciones, RLS, queries SQL, auth config |
| `tf-codebase-analyst` | Analisis de patrones, convenciones, arquitectura |
| `tf-vercel-deployer` | Deploy, env vars, dominios, rollbacks |
| `documentacion` | Actualizar docs despues de cambios en codigo |
| `calidad` | Testing, quality gates, validacion |

### Suite n8n — Interconexion con Otros Sistemas (de czlonkowski/n8n-skills, MIT)

> Requiere MCP `n8n-mcp` configurado en `.mcp.json` (N8N_API_URL + N8N_API_KEY).

| Skill | Se activa cuando... |
|-------|---------------------|
| `tf-n8n-mcp-tools-expert` | SIEMPRE PRIMERO antes de usar cualquier tool n8n-mcp |
| `tf-n8n-workflow-patterns` | Disenar workflows (webhook, API, DB, AI, scheduled) |
| `tf-n8n-node-configuration` | Configurar nodos, campos requeridos por operacion |
| `tf-n8n-expression-syntax` | Escribir expresiones `{{}}`, mapear data entre nodos |
| `tf-n8n-validation-expert` | Interpretar errores de validacion, falsos positivos |
| `tf-n8n-code-javascript` | Code nodes en JavaScript (95% de los casos) |
| `tf-n8n-code-python` | Code nodes en Python (solo si el usuario lo pide) |

---

## Estructura de un Skill

```
skill-name/
├── SKILL.md              # Requerido: frontmatter YAML + instrucciones
├── scripts/              # Opcional: codigo ejecutable (.py, .sh, .js)
├── references/           # Opcional: docs de referencia (>5k palabras)
└── assets/               # Opcional: templates, imagenes, fonts
```

### Frontmatter YAML

```yaml
---
name: skill-name                    # Identificador (lowercase, hyphens, max 64 chars)
description: Que hace               # Claude usa esto para decidir cuando activarlo
argument-hint: "[argumento]"        # Hint en autocomplete (opcional)
user-invocable: false               # Solo Claude puede invocarlo (opcional)
disable-model-invocation: true      # Solo el usuario puede invocarlo (opcional)
allowed-tools: Read, Write, Bash    # Tools permitidos sin pedir permiso (opcional)
model: claude-sonnet-4-6            # Modelo especifico (opcional)
context: fork                       # Ejecuta en subagent aislado (opcional)
agent: Explore                      # Tipo de agente (opcional)
---
```

### Variables de Sustitucion

| Variable | Descripcion |
|----------|-------------|
| `$ARGUMENTS` | Todos los argumentos del usuario |
| `$ARGUMENTS[N]` o `$N` | Argumento por indice (0-based) |
| `${CLAUDE_SESSION_ID}` | ID de sesion actual |
| `${CLAUDE_SKILL_DIR}` | Directorio del skill |
| `` !`comando` `` | Inyeccion de contexto dinamico (ejecuta shell) |

### Progressive Disclosure

1. **Metadata** (~100 palabras) - Siempre en contexto (frontmatter)
2. **SKILL.md** (<5k palabras) - Cuando se activa
3. **Resources** (unlimited) - Bajo demanda (scripts/, references/, assets/)

---

## Memoria Persistente (.titan/memory/)

Titan Factory incluye un sistema de memoria persistente POR PROYECTO que reemplaza la auto-memory de Claude Code.

**Por que?** La auto-memory de Claude Code guarda notas en `~/.claude/projects/` (local a tu maquina). Eso significa que no viaja con el repo, no es versionado, no es compartido con tu equipo, y Claude decide que guardar sin tu control.

**Como funciona:**
- `.titan/memory/MEMORY.md` es el indice (max 200 lineas, se carga automaticamente)
- Carpetas por tipo: `user/`, `feedback/`, `project/`, `reference/`
- Git-versioned: cada cambio es un commit que puedes revertir
- El skill `tf-memory-manager` gestiona cuando consultar y cuando guardar

**Activacion:** La primera vez que se usa el skill `tf-memory-manager`, automaticamente deshabilita la auto-memory de Claude Code en `.claude/settings.json` y crea la estructura de carpetas.

---

## Recursos Compartidos

Los skills referencian estos directorios (NO se mueven):

| Recurso | Path | Usado por |
|---------|------|-----------|
| PRP Template | `.claude/skills/tf-prp/references/prp-base.md` | Skill `tf-prp` |
| AI Templates | `.claude/skills/tf-ai/references/` | Skill `tf-ai` |
| Design Systems | `.claude/design-systems/` | Directo (5 sistemas) |

---

## Crear un Nuevo Skill

```bash
# Opcion 1: Usar tf-skill-creator
/skill-creator

# Opcion 2: Manual
mkdir .claude/skills/mi-skill
# Crear SKILL.md con frontmatter + instrucciones
```

### Checklist

- [ ] SKILL.md con YAML frontmatter valido (name + description)
- [ ] Contenido <5k palabras, forma imperativa
- [ ] Scripts con --help y manejo de errores
- [ ] References para docs >5k palabras
- [ ] Descripcion clara de cuando usarlo

---

## Migracion V3 → V4

| V3 | V4 |
|----|-----|
| `.claude/commands/*.md` | `.claude/skills/*/SKILL.md` |
| `.claude/agents/*.md` | `.claude/skills/*/SKILL.md` (user-invocable: false, context: fork) |
| `.claude/prompts/*.md` | `.claude/skills/*/SKILL.md` |
| Agentes como archivos sueltos | Frontmatter `agent:` y `context: fork` en skills |
| AI Templates como docs | Skill `/tf-ai` con `references/` colocalizados |
| PRPs como template suelto | Skill `/tf-prp` que genera PRPs con context: fork |

---

*Titan Factory V4: Todo es un Skill.*
*Basado en Claude Code Skills 2.0 (CC 2.1.0+)*
