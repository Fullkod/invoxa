# Integration — routes, auth gate, sidebar, design system

## Routes

Default recommendation (matches both real Titan Factory reference
implementations — see SKILL.md): **no auth gate, route not linked from any
nav.** Put the routes **outside** any route group that has a layout/sidebar,
so they don't inherit session guards or navigation chrome:

```bash
mkdir -p src/app/manual/print
```

### `src/app/manual/page.tsx`

```tsx
import type { Metadata } from 'next'
import { ClientDocsGenerator } from '@/features/client-docs/components/ClientDocsGenerator'

// No auth gate by design — see "Auth gate" below for when to add one.
// noindex: this is an internal tool, not a page for search engines.
export const metadata: Metadata = {
  title: 'Manual generator',
  robots: { index: false, follow: false, nocache: true },
}

export default function ManualPage() {
  return <ClientDocsGenerator />
}
```

### `src/app/manual/print/page.tsx`

```tsx
import type { Metadata } from 'next'
import { PrintView } from '@/features/client-docs/components/PrintView'

export const metadata: Metadata = {
  title: 'Manual — print view',
  robots: { index: false, follow: false, nocache: true },
}

const MONTHS: Record<'es' | 'en', string[]> = {
  es: ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'],
  en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
}

export default async function ManualPrintPage({
  searchParams,
}: {
  searchParams: Promise<{ locale?: string }>
}) {
  // The date is pre-formatted server-side and passed down as a string.
  // PrintView never calls `new Date()` during render — see the hydration
  // gotcha in checklist.md. Locale for the date label comes straight from
  // the query param (same source PrintView itself reads) so both agree
  // without a second localStorage round-trip on the server.
  const { locale } = await searchParams
  const resolvedLocale = locale === 'en' ? 'en' : 'es'
  const now = new Date()
  const generatedDateLabel =
    resolvedLocale === 'en'
      ? `${MONTHS.en[now.getMonth()]} ${now.getDate()}, ${now.getFullYear()}`
      : `${now.getDate()} de ${MONTHS.es[now.getMonth()]} de ${now.getFullYear()}`

  return <PrintView generatedDateLabel={generatedDateLabel} />
}
```

## Auth gate

**Default: none.** Both real reference implementations (a role-based SaaS and
a plain internal tool project) independently landed on the same decision:
`/manual` is a hidden, unauthenticated route — nobody links to it, only
someone who already knows the URL can reach it. It's the pragmatic choice
when the project either has no role system yet, or restricting just this one
route would be inconsistent with the rest of the app.

If the project's Supabase `profiles` table already has a working `role` (or
similar) column and other admin routes are already gated by it, gate this
route the same way for consistency — don't introduce a second, weaker
pattern. Two common shapes, pick whichever the project already uses:

**Role column on `profiles`** (if `/tf-add-login` was extended with one):

```ts
// src/app/manual/page.tsx — becomes async
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function ManualPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') redirect('/dashboard')

  return <ClientDocsGenerator />
}
```

**Fixed admin-email allowlist** (no DB migration needed — good when the
project has one or two admins and no role system at all):

```ts
const ADMIN_EMAILS = (process.env.MANUAL_ADMIN_EMAILS ?? '').split(',').map((e) => e.trim())

export default async function ManualPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !ADMIN_EMAILS.includes(user.email ?? '')) redirect('/login')

  return <ClientDocsGenerator />
}
```

Apply the same gate to `src/app/manual/print/page.tsx`.

## Sidebar entry

**Default: don't add one** — consistent with "no gate, hidden route". If the
project later restricts `/manual` by role, add an entry to whatever
component renders the app's primary navigation, gated to that role:

```tsx
import { BookOpen } from 'lucide-react'

// In the admin/system section of the nav items array:
{ href: '/manual', label: 'Manual', icon: BookOpen, roles: ['admin'] }
```

## Adapting the design system

The components in `ui-components.md` ship with plain Tailwind utility
classes (slate/blue) so they render correctly on a blank Titan Factory
project with no work. If the project already has a chosen design system —
one of `.claude/design-systems/*` (neobrutalism, liquid-glass, gradient-mesh,
bento-grid, neumorphism) or its own custom tokens — remap the classes so the
manual generator doesn't look like a foreign screen bolted onto the app:

1. Open one existing polished screen in the project (e.g. the dashboard or
   settings page) and note its real tokens: background/surface colors, border
   color, primary/brand color, radius, font.
2. Find+replace across the 9 component files in `ui-components.md` — the
   generic classes used there map roughly like this:

```
Generic (this skill)        →  Look for in the project's real classes
──────────────────────────────────────────────────────────────────────
bg-white / bg-slate-50       →  surface / card background token
border-slate-200             →  default border token
text-slate-900               →  primary text token
text-slate-600 / text-slate-500 →  secondary/muted text token
text-slate-400               →  faint/placeholder text token
bg-blue-600 / text-blue-600  →  brand/primary token
bg-blue-500 (hover)          →  brand hover token
bg-blue-50                   →  selection/soft-brand token
rounded-md / rounded-lg      →  the project's actual radius scale
```

3. In `print.css`'s `@media screen` block, if the project uses CSS custom
   properties (`--surface`, `--ink`, etc.), swap the literal hex values for
   `var(--token)` — but check whether those vars are raw color components
   (e.g. oklch channels like `0.20 0.01 255`) rather than full color values;
   if so wrap them: `color: oklch(var(--ink))`, not `var(--ink)` bare.
4. The `@media print` block stays hardcoded to light colors on purpose —
   printed pages are never dark-mode, regardless of the app's theme.

## Explorer prompt — mapping the target project

Before writing the schema (Paso 4 in SKILL.md), map every real screen the
manual needs to describe. Launch an `Explore` agent (or do it yourself) with
this prompt, filled in with the real project's routes and domain:

```
I'm writing an end-user manual for the app <APP_NAME> (Next.js + Supabase).
Map EVERY screen a human user interacts with, what they can do on it, what's
visible, and which roles can reach it. This is NOT for developers — it's for
a real end user of the client's product.

The project is at <ABSOLUTE_PROJECT_PATH>

Routes to inspect (Next.js App Router page.tsx files):
- <one absolute path per page.tsx>

Also check the main sidebar/nav component (likely under src/components/ or
src/shared/) to see which nav entries each role sees.

Domain essentials:
- Roles: <list, e.g. admin, worker, viewer>
- <any core domain concept: jobs, integrations, resources...>

For EACH screen, give me:
1. Route (e.g. /dashboard, /settings)
2. Visible title in the UI
3. What's on it (cards, tables, charts...) — 1-2 sentences
4. Actions the user can take — bullets, written as imperatives directed at
   the user ("Review the status of...", "Trigger manually..."). Be
   EXHAUSTIVE: every button/action counts.
5. Role restrictions, if any

Also flag whether there's: a global notification bell, a usage/credits
system, multi-tenancy, an onboarding flow (what steps).

Return structured Markdown, one section per screen. If a screen doesn't
exist or is empty, say so. Do NOT invent actions — only what's actually in
the code. Read every page.tsx in full, not fragments — this feeds the real
manual the client receives.
```

The Explorer's output feeds `ClientDocsModule.endUserActions` /
`.adminActions` and `ClientDocsWorkflow.steps` directly — one bullet per
action, imperative voice, one action per bullet (never "create a client and
then assign a project" — that's two).

**Rules for a manual that reads well** (apply when turning the Explorer
output into the schema):

- Imperative, addressed to the user: "Click…", "Review…" — never third
  person ("The user can click…").
- One action per bullet.
- Workflows are exhaustive end-to-end: start with "Open X" and end with
  "Confirm with Y", never a fragment.
- Business vocabulary lives ONLY in the schema. Nothing else in the feature
  should mention the client's brand — that's what keeps `core-contract.md`
  and `ui-components.md` reusable across every project.
