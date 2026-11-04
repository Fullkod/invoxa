<!-- titan-factory-codex:start -->
## Titan Factory Codex

- At the start of a relevant project task, read `.titan/memory/MEMORY.md` if present and only its relevant linked entries.
- Use available `tf-` skills for matching work. Skills do not imply connected services or permission for unrelated actions.
- This project has its own stack (see below). Never migrate it to the Titan Factory golden path. Preserve this project's stack and the user's explicit choices.
- Keep project decisions in `.titan/memory/`, feature plans in `.titan/plans/` and useful QA evidence in `.titan/qa/`. Read-only tasks must not write state.
- Reuse authorization already given for the task. Delegate only when the user requests or authorizes delegation; do not launch agents merely because role files exist.
- Preserve local code and project knowledge during toolkit updates. Never store credentials in shared memory.
<!-- titan-factory-codex:end -->

<!-- titan-factory-shared:start -->
## Shared agent tooling

- This repository hosts two Titan Factory toolboxes: Codex (`plugins/titan-factory-codex/`, `.codex/`, `.agents/`) and Claude Code (`CLAUDE.md`, `.claude/`). Both use the same 29 `tf-` skills and 7 `tf-` agents; keep the two catalogs in sync when adding, renaming or removing one.
- Third-party skills (`supabase`, `supabase-postgres-best-practices`, `logo-design`) live once in `.agents/skills/`, locked in `skills-lock.json`. `.claude/skills/` only holds thin bridges to them.
- Both share one project memory: `.titan/memory/` (plus `.titan/plans/` and `.titan/qa/`). Never create a second copy such as `.claude/memory/`. Entries may come from either agent; keep the existing format (plain Markdown, `# Title`, one-line index entries appended to `MEMORY.md`).
- Do not modify the other agent's toolbox unless the task is about it.
<!-- titan-factory-shared:end -->

# Invoxa — reglas del proyecto (comunes a Claude Code y Codex)

> App interna de facturación de colaboradores para Informage Studios, producto de **Fullkod**: el admin
> invita usuarios, les asigna proyecto y modalidad de pago (por hora o fijo mensual); cada usuario registra
> tareas y genera su factura mensual (consecutivo, PDF). El admin pide facturas por correo, individual o masivo.
> Requisitos completos: `docs/instructions.md`. Titan Factory es **solo la capa de agente**; el código NO
> sigue el Golden Path.

## Al empezar cada sesión

1. Leer `.titan/memory/MEMORY.md` y las entradas relevantes ANTES de tocar código. La lógica de negocio
   vigente está en `BUSINESS_LOGIC.md`. El código actual gana sobre una nota vieja o sobre `docs/instructions.md`.
2. Si un skill asume el Golden Path (Next.js, Server Actions, Polar, Prisma…), **las reglas de este archivo
   ganan**. Adapta el skill al proyecto; no migres el proyecto al skill.
3. Features complejas: PRP en `.titan/plans/` (plantilla `prp-base.md`) aprobado por Roberto → implementación →
   verificación (`npm run build`, `npm run lint`, prueba en navegador) → commit.
4. **Nada de push, deploy ni cambios en servicios externos** (Supabase, Vercel, GitHub, tiendas de apps) sin
   permiso explícito.

## Stack

| Capa | Tecnología |
|------|------------|
| Web | **Vite + React 19 + TypeScript**, React Router 7, TanStack Query (con persistencia) |
| Formularios / validación | react-hook-form + **Zod** |
| Estilos | Tailwind CSS 3.4 |
| Apps nativas | **Capacitor 8** (`android/`, `ios/`); scripts `native:*` en `package.json` |
| BD / Auth / Storage | **Supabase** (Postgres + RLS, Auth, Storage para PDFs) |
| Lógica sensible | **Supabase Edge Functions** (`supabase/functions/`): invitaciones, facturas, PDFs, correos, cambios de número |
| Deploy web | Vercel (SPA con rewrite a `/`, ver `vercel.json`) |

Código organizado por feature en `src/features/` (admin, auth, user, invoiceNumberChange, notifications, landing).

## Reglas de código

- Sin Server Actions ni rutas API de Next: toda lógica privilegiada (service role, correo, PDFs, consecutivos)
  vive en Edge Functions; el cliente usa solo la anon key.
- **NUNCA** exponer secretos (ni en código, ni en memoria, ni en variables `VITE_*`). `.env.local` está en `.gitignore`.
- Cambios de esquema como migraciones en `supabase/migrations/`, con RLS en toda tabla.
- Validar con Zod la entrada de formularios y de Edge Functions.
- Nuevo `any` prohibido (usar `unknown`).
- Commits: `feat:` / `fix:` / `refactor:` / `chore:` / `docs:` en inglés.

## Comandos

```
npm run dev       # Vite
npm run build     # tsc -b && vite build
npm run lint      # ESLint
npm run native:sync / native:android / native:ios
```

## Auto-blindaje

Error → fix → documentar. Errores de una feature en su PRP (`.titan/plans/`); patrones recurrentes en
`.titan/memory/reference/`; reglas críticas para todo el proyecto en este archivo.
