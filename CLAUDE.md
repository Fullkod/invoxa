@AGENTS.md

<!-- titan-factory-claude:start -->
# Titan Factory (Claude Code) — Invoxa

`AGENTS.md` (importado arriba) contiene las reglas del proyecto comunes a Claude Code y Codex
(stack, reglas de código, comandos). Este bloque agrega lo propio de Claude Code. Si algo choca,
gana la instrucción explícita del usuario, luego `AGENTS.md`, luego este bloque.

## Memoria compartida con Codex (SIEMPRE ACTIVA)

Claude Code y Codex comparten **una sola** memoria versionada en git:

| Qué | Dónde |
|-----|-------|
| Decisiones, feedback, referencias | `.titan/memory/` (índice: `MEMORY.md`) |
| PRPs / planes | `.titan/plans/` (plantilla: `prp-base.md`) |
| Evidencia de QA (notas, capturas) | `.titan/qa/` |

- Al empezar una tarea relevante, lee `.titan/memory/MEMORY.md` y solo las entradas
  relacionadas (`tf-primer` lo hace al inicio de sesión; `tf-memory-manager` define formato).
- Auto-memory de Claude Code está desactivada en `.claude/settings.json`. NUNCA crees
  `.claude/memory/` ni otra copia de la memoria.
- Puede haber entradas escritas por Codex: trátalas igual. El código actual gana sobre una
  nota vieja; marca lo superado en vez de borrarlo.
- Las tareas de solo lectura no escriben memoria. Nunca guardes credenciales.

## Coexistencia con Titan Factory Codex

| Claude Code | Codex |
|-------------|-------|
| `CLAUDE.md` (+ `@AGENTS.md`) | `AGENTS.md` |
| `.claude/skills/tf-*` | `plugins/titan-factory-codex/skills/tf-*` (marketplace `invoxa`, `.codex/config.toml`) |
| `.claude/agents/tf-*.md` | `.codex/agents/tf-*.toml` |
| `.claude/skills/{supabase,supabase-postgres-best-practices,logo-design}` (puentes) | `.agents/skills/` (fuente real, `skills-lock.json`) |
| `.claude/design-systems/` | `plugins/titan-factory-codex/design-systems/` |

Los skills y agentes tienen el mismo nombre en ambos lados: un cambio de catálogo en uno se
replica en el otro. No edites `plugins/`, `.codex/` ni `.agents/` salvo que la tarea sea sobre
Codex o los skills compartidos. Para actualizar la fábrica de Claude usa `tf-update-tf` (nunca
copies el template encima).

## Qué skill usar en Invoxa

```
├── Feature compleja (DB + Edge Function + UI)
│       → tf-prp (plan en .titan/plans/) → Roberto aprueba → tf-bucle-agentico
├── Base de datos, RLS, Edge Functions, Storage
│       → tf-supabase + supabase + supabase-postgres-best-practices (migraciones en supabase/)
├── Revisar / testear / bug en UI → tf-playwright-cli (evidencia en .titan/qa/)
├── App nativa (Capacitor)       → tf-add-mobile como referencia, respetando el stack de AGENTS.md
├── Correos / IA / imágenes      → tf-add-emails / tf-ai / tf-image-generation
├── Logo / marca                  → logo-design
├── Automatizaciones / n8n        → tf-n8n-mcp-tools-expert primero, luego tf-n8n-workflow-patterns
├── Manual de usuario             → tf-add-manual
├── "Recuerda…", "en qué quedamos" → tf-memory-manager
├── Contexto del proyecto         → tf-primer
├── Crear/optimizar skills        → tf-skill-creator / tf-autoresearch
├── Tareas del equipo             → tf-tasknic (TASKNIC_API_KEY de este repo, en .env.local)
└── Nada encaja → leer el código, seguir sus patrones y ejecutar
```

**No aplican tal cual:**
- `tf-new-app`, `tf-website-3d`: la app ya existe (Vite + React, no Next.js); no rehacer el proyecto.
- `tf-add-login`: la auth es por invitación del admin con Supabase Auth; usar el skill solo como referencia.
- `tf-add-payments` (Polar), `tf-easypanel-deploy` (Prisma): no aplican; Supabase + Vercel.
- `tf-eject-tf`, `tf-update-tf`: revisar antes de ejecutar; `tf-eject-tf` es DESTRUCTIVO (confirmar siempre).

Los estilos de `.claude/design-systems/` solo aplican si el usuario los pide explícitamente; el
diseño de Invoxa vive en `docs/design/`.

## Subagentes: solo con permiso

`.claude/agents/` tiene 7 subagentes `tf-*` (backend-specialist, frontend-specialist,
supabase-admin, codebase-analyst, vercel-deployer, gestor-documentacion, validacion-calidad).

1. Se invocan a petición del usuario.
2. Si consideras útil delegar, **pide permiso ANTES**, cada vez. Una aprobación anterior no cubre la siguiente.
<!-- titan-factory-claude:end -->
