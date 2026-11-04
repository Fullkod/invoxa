# Core contract — 100% portable

These four files are copied **verbatim** into every project. Nothing here
references a specific business, design system, or auth provider — only the
project-specific schema (Paso 4 en SKILL.md) and the UI components
(`ui-components.md`) touch that.

Two independent dimensions drive what gets generated:

- `audience: 'worker' | 'admin'` — filters **which content** appears (admin
  sees everything, worker sees only end-user-facing modules/workflows).
- `locale: 'es' | 'en'` — selects **which language** the generated static
  copy (section titles, access-flow steps, security tips, etc.) is written
  in. The client's own data (module names, descriptions, actions, FAQs) is
  never translated automatically — whatever language the schema author typed
  is what ships. `locale` only swaps the template scaffolding around it.

Four manuals come out of one schema: `worker+es`, `worker+en`, `admin+es`,
`admin+en`. Nothing is duplicated — add a language by writing one more entry
in `LOCALES`, not by forking components.

---

## `src/features/client-docs/generators/types.ts`

```ts
export type Audience = 'end-user' | 'admin' | 'support'

/** Which manual variant this is — filters content. */
export type ManualAudience = 'worker' | 'admin'

/** Which language the generated static copy is written in. */
export type ManualLocale = 'es' | 'en'

export type DocSectionType =
  | 'overview'
  | 'access'
  | 'roles'
  | 'module'
  | 'workflow'
  | 'faq'
  | 'support'
  | 'policy'

export interface ClientDocsRole {
  name: string
  description: string
  permissions: string[]
}

export interface ClientDocsModule {
  name: string
  description: string
  endUserActions: string[]
  adminActions?: string[]
  /**
   * Audience override. If omitted, it's derived from the actions (worker if
   * endUserActions is non-empty, admin if adminActions is non-empty). Use
   * this only for edge cases the derivation gets wrong — e.g. a screen that
   * uses endUserActions phrasing but is admin-only (an "admin login" screen).
   */
  audience?: ManualAudience
  /** Optional screenshot: the generator injects `![alt](src)` under the title. */
  image?: { src: string; alt: string }
}

export interface ClientDocsWorkflow {
  title: string
  audience: Audience
  steps: string[]
}

export interface ClientDocsFaq {
  question: string
  answer: string
}

export interface ClientDocsInput {
  appName: string
  clientName: string
  appUrl: string
  /** Optional: omit the whole "Support" section by leaving this unset. */
  supportEmail?: string
  supportHours?: string
  primaryAdminEmail?: string
  modules: ClientDocsModule[]
  roles: ClientDocsRole[]
  workflows: ClientDocsWorkflow[]
  faqs: ClientDocsFaq[]
  policies?: string[]
}

export interface DocSection {
  id: string
  title: string
  type: DocSectionType
  content: string
}

export interface GeneratedClientDocs {
  title: string
  subtitle: string
  audience: ManualAudience
  locale: ManualLocale
  generatedAt: string
  sections: DocSection[]
}
```

---

## `src/features/client-docs/generators/copy.ts`

All static, user-facing template strings live here — nothing else in the
feature hardcodes a language. Adding a third language later means adding one
entry to `LOCALES`, not touching the generator or the components.

```ts
import type { Audience, ManualAudience, ManualLocale } from './types'

interface LocaleCopy {
  sectionTitle: Record<'overview' | 'access' | 'roles' | 'faq' | 'support' | 'policy', string>
  sectionTypeLabel: Record<DocSectionTypeKey, string>
  overview: {
    welcome: (appName: string, clientName: string) => string
    whatYouCanDo: string
    accessDetails: string
    url: string
    support: string
    supportHours: string
  }
  access: {
    signIn: string
    signInSteps: (appUrl: string) => string[]
    recoverPassword: string
    recoverPasswordSteps: string[]
    securityTips: string
    securityTipsList: (supportEmail: string) => string[]
  }
  module: {
    titlePrefix: string
    userActions: string
    adminActions: string
  }
  workflow: {
    titlePrefix: string
    aimedAt: string
    audienceLabel: Record<Audience, string>
  }
  support: {
    mainChannel: string
    email: string
    hours: string
    primaryAdmin: string
    whatToInclude: string
    whatToIncludeList: string[]
  }
  fallback: {
    noItems: string
    noSteps: string
  }
  manual: {
    title: (audience: ManualAudience, appName: string) => string
    subtitle: (audience: ManualAudience, clientName: string) => string
  }
  export: {
    generatedAt: string
    dateLocaleTag: string
  }
  print: {
    notice: { title: string; body: string }
    coverEyebrow: (audience: ManualAudience) => string
    tableOfContents: string
    generatedOn: (date: string) => string
  }
}

type DocSectionTypeKey = 'overview' | 'access' | 'roles' | 'module' | 'workflow' | 'faq' | 'support' | 'policy'

export const LOCALES: Record<ManualLocale, LocaleCopy> = {
  es: {
    sectionTitle: {
      overview: 'Vista general',
      access: 'Acceso al sistema',
      roles: 'Roles y permisos',
      faq: 'Preguntas frecuentes',
      support: 'Soporte y contacto',
      policy: 'Políticas de uso',
    },
    sectionTypeLabel: {
      overview: 'Vista general',
      access: 'Acceso',
      roles: 'Roles',
      module: 'Módulo',
      workflow: 'Flujo',
      faq: 'FAQ',
      support: 'Soporte',
      policy: 'Política',
    },
    overview: {
      welcome: (appName, clientName) =>
        `Bienvenido a ${appName}, la plataforma configurada para ${clientName}.`,
      whatYouCanDo: 'Qué puede hacer',
      accessDetails: 'Datos de acceso',
      url: 'URL:',
      support: 'Soporte:',
      supportHours: 'Horario de soporte:',
    },
    access: {
      signIn: 'Entrar a la plataforma',
      signInSteps: (appUrl) => [
        `Abre ${appUrl} en tu navegador.`,
        'Introduce tu correo y contraseña.',
        'Si es tu primer acceso, cambia la contraseña temporal cuando el sistema lo pida.',
        'Revisa que tu nombre, rol y datos de perfil sean correctos en Ajustes.',
      ],
      recoverPassword: 'Recuperar contraseña',
      recoverPasswordSteps: [
        'En la pantalla de login, pulsa "¿La has olvidado?".',
        'Introduce el correo asociado a tu cuenta.',
        'Pulsa "Enviar enlace" y revisa tu correo (también la carpeta de spam).',
        'Abre el enlace recibido (válido 1 hora) y define tu nueva contraseña.',
      ],
      securityTips: 'Recomendaciones de seguridad',
      securityTipsList: (supportEmail) => [
        'No compartas tus credenciales con nadie del equipo.',
        'Usa una contraseña única para esta plataforma.',
        'Cierra sesión al terminar si trabajas en un equipo compartido.',
        `Si detectas actividad sospechosa, escribe a ${supportEmail}.`,
      ],
    },
    module: {
      titlePrefix: 'Módulo: ',
      userActions: 'Acciones para usuarios',
      adminActions: 'Acciones para administradores',
    },
    workflow: {
      titlePrefix: 'Flujo: ',
      aimedAt: 'Dirigido a:',
      audienceLabel: { 'end-user': 'Usuario final', admin: 'Administrador', support: 'Soporte' },
    },
    support: {
      mainChannel: 'Canal principal',
      email: 'Email:',
      hours: 'Horario:',
      primaryAdmin: 'Administrador principal:',
      whatToInclude: 'Qué incluir al pedir ayuda',
      whatToIncludeList: [
        'Nombre del usuario afectado.',
        'Módulo donde ocurre el problema.',
        'Pasos realizados antes del error.',
        'Captura de pantalla si es posible.',
        'Fecha y hora aproximada del incidente.',
      ],
    },
    fallback: {
      noItems: '- No hay elementos configurados.',
      noSteps: '1. No hay pasos configurados.',
    },
    manual: {
      title: (audience, appName) =>
        audience === 'admin' ? `Manual de administración · ${appName}` : `Manual de usuario · ${appName}`,
      subtitle: (audience, clientName) =>
        audience === 'admin'
          ? `Guía para la administración de ${clientName}`
          : `Guía para el personal de ${clientName}`,
    },
    export: { generatedAt: 'Generado:', dateLocaleTag: 'es-ES' },
    print: {
      notice: {
        title: 'Antes de guardar como PDF',
        body: 'En el diálogo que se abrirá, pulsa "Más ajustes" y desactiva "Encabezados y pies de página". De lo contrario verás la URL, la fecha del sistema y el título del navegador encima de cada página, sobre el logo y la cabecera reales de la app.',
      },
      coverEyebrow: (audience) => (audience === 'admin' ? 'Manual de administración' : 'Manual de usuario'),
      tableOfContents: 'Índice',
      generatedOn: (date) => `Generado el ${date}`,
    },
  },
  en: {
    sectionTitle: {
      overview: 'Overview',
      access: 'System access',
      roles: 'Roles and permissions',
      faq: 'Frequently asked questions',
      support: 'Support and contact',
      policy: 'Usage policies',
    },
    sectionTypeLabel: {
      overview: 'Overview',
      access: 'Access',
      roles: 'Roles',
      module: 'Module',
      workflow: 'Flow',
      faq: 'FAQ',
      support: 'Support',
      policy: 'Policy',
    },
    overview: {
      welcome: (appName, clientName) => `Welcome to ${appName}, the platform configured for ${clientName}.`,
      whatYouCanDo: 'What you can do',
      accessDetails: 'Access details',
      url: 'URL:',
      support: 'Support:',
      supportHours: 'Support hours:',
    },
    access: {
      signIn: 'Signing in',
      signInSteps: (appUrl) => [
        `Open ${appUrl} in your browser.`,
        'Enter your email and password.',
        'If this is your first login, change the temporary password when prompted.',
        "Check that your name, role and profile details are correct under Settings.",
      ],
      recoverPassword: 'Recovering your password',
      recoverPasswordSteps: [
        'On the login screen, tap "Forgot it?".',
        'Enter the email associated with your account.',
        'Tap "Send link" and check your inbox (also your spam folder).',
        'Open the link you received (valid for 1 hour) and set your new password.',
      ],
      securityTips: 'Security recommendations',
      securityTipsList: (supportEmail) => [
        'Never share your credentials with anyone on the team.',
        'Use a password that is unique to this platform.',
        "Sign out when you're done if you're on a shared computer.",
        `If you notice suspicious activity, contact ${supportEmail}.`,
      ],
    },
    module: {
      titlePrefix: 'Module: ',
      userActions: 'Actions for users',
      adminActions: 'Actions for administrators',
    },
    workflow: {
      titlePrefix: 'Flow: ',
      aimedAt: 'Aimed at:',
      audienceLabel: { 'end-user': 'End user', admin: 'Administrator', support: 'Support' },
    },
    support: {
      mainChannel: 'Main channel',
      email: 'Email:',
      hours: 'Hours:',
      primaryAdmin: 'Primary administrator:',
      whatToInclude: 'What to include when asking for help',
      whatToIncludeList: [
        'Name of the affected user.',
        'Module where the issue happens.',
        'Steps you took before the error.',
        'A screenshot if possible.',
        'Approximate date and time of the incident.',
      ],
    },
    fallback: {
      noItems: '- No items configured.',
      noSteps: '1. No steps configured.',
    },
    manual: {
      title: (audience, appName) => (audience === 'admin' ? `Admin manual · ${appName}` : `User manual · ${appName}`),
      subtitle: (audience, clientName) =>
        audience === 'admin' ? `Guide for ${clientName}'s administration` : `Guide for ${clientName}'s staff`,
    },
    export: { generatedAt: 'Generated:', dateLocaleTag: 'en-US' },
    print: {
      notice: {
        title: 'Before saving as PDF',
        body: 'In the print dialog that opens, click "More settings" and turn off "Headers and footers". Otherwise you\'ll see the browser\'s URL, system date and tab title printed on every page, on top of the app\'s real logo and header.',
      },
      coverEyebrow: (audience) => (audience === 'admin' ? 'Admin manual' : 'User manual'),
      tableOfContents: 'Table of contents',
      generatedOn: (date) => `Generated on ${date}`,
    },
  },
}
```

---

## `src/features/client-docs/generators/generateClientDocs.ts`

```ts
import { LOCALES } from './copy'
import type {
  ClientDocsInput,
  ClientDocsModule,
  DocSection,
  GeneratedClientDocs,
  ManualAudience,
  ManualLocale,
} from './types'

// Resolves which audiences a module belongs to. Uses the explicit override if
// present; otherwise derives it from the actions.
function moduleAudiences(module: ClientDocsModule): { worker: boolean; admin: boolean } {
  if (module.audience) {
    return { worker: module.audience === 'worker', admin: module.audience === 'admin' }
  }
  return {
    worker: module.endUserActions.length > 0,
    admin: (module.adminActions?.length ?? 0) > 0,
  }
}

// The admin manual includes every module; the worker manual only the ones
// that carry end-user content.
function includeModule(module: ClientDocsModule, audience: ManualAudience): boolean {
  return audience === 'admin' || moduleAudiences(module).worker
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function listItems(items: string[], locale: ManualLocale) {
  if (!items.length) return LOCALES[locale].fallback.noItems
  return items.map((item) => `- ${item}`).join('\n')
}

function numberedSteps(steps: string[], locale: ManualLocale) {
  if (!steps.length) return LOCALES[locale].fallback.noSteps
  return steps.map((step, index) => `${index + 1}. ${step}`).join('\n')
}

function createOverviewSection(
  input: ClientDocsInput,
  audience: ManualAudience,
  locale: ManualLocale
): DocSection {
  const t = LOCALES[locale]
  const audienceModules = input.modules.filter((m) => includeModule(m, audience))
  const accessLines = [
    `- ${t.overview.url} ${input.appUrl}`,
    input.supportEmail ? `- ${t.overview.support} ${input.supportEmail}` : '',
    input.supportHours ? `- ${t.overview.supportHours} ${input.supportHours}` : '',
  ].filter(Boolean)

  return {
    id: 'overview',
    title: t.sectionTitle.overview,
    type: 'overview',
    content: `# ${input.appName}

${t.overview.welcome(input.appName, input.clientName)}

## ${t.overview.whatYouCanDo}

${listItems(audienceModules.map((module) => `${module.name}: ${module.description}`), locale)}

## ${t.overview.accessDetails}

${accessLines.join('\n')}`,
  }
}

function createAccessSection(input: ClientDocsInput, locale: ManualLocale): DocSection {
  const t = LOCALES[locale]
  return {
    id: 'access',
    title: t.sectionTitle.access,
    type: 'access',
    content: `# ${t.sectionTitle.access}

## ${t.access.signIn}

${numberedSteps(t.access.signInSteps(input.appUrl), locale)}

## ${t.access.recoverPassword}

${numberedSteps(t.access.recoverPasswordSteps, locale)}

## ${t.access.securityTips}

${listItems(t.access.securityTipsList(input.supportEmail ?? ''), locale)}`,
  }
}

function createRolesSection(input: ClientDocsInput, locale: ManualLocale): DocSection {
  const t = LOCALES[locale]
  return {
    id: 'roles',
    title: t.sectionTitle.roles,
    type: 'roles',
    content: `# ${t.sectionTitle.roles}

${input.roles
  .map((role) => `## ${role.name}\n\n${role.description}\n\n${listItems(role.permissions, locale)}`)
  .join('\n\n')}`,
  }
}

function createModuleSections(
  input: ClientDocsInput,
  audience: ManualAudience,
  locale: ManualLocale
): DocSection[] {
  const t = LOCALES[locale]
  return input.modules
    .filter((module) => includeModule(module, audience))
    .map((module) => {
      const blocks: string[] = []
      if (module.endUserActions.length) {
        blocks.push(`## ${t.module.userActions}\n\n${listItems(module.endUserActions, locale)}`)
      }
      // Admin-only actions only surface in the admin manual.
      if (audience === 'admin' && module.adminActions?.length) {
        blocks.push(`## ${t.module.adminActions}\n\n${listItems(module.adminActions, locale)}`)
      }
      return {
        id: `module-${slugify(module.name)}`,
        title: `${t.module.titlePrefix}${module.name}`,
        type: 'module' as const,
        content: `# ${module.name}
${module.image ? `\n![${module.image.alt}](${module.image.src})\n` : ''}
${module.description}

${blocks.join('\n\n')}`,
      }
    })
}

function createWorkflowSections(
  input: ClientDocsInput,
  audience: ManualAudience,
  locale: ManualLocale
): DocSection[] {
  const t = LOCALES[locale]
  // The worker manual only includes end-user workflows.
  const workflows = audience === 'admin' ? input.workflows : input.workflows.filter((w) => w.audience === 'end-user')

  return workflows.map((workflow) => ({
    id: `workflow-${slugify(workflow.title)}`,
    title: `${t.workflow.titlePrefix}${workflow.title}`,
    type: 'workflow',
    content: `# ${workflow.title}

${t.workflow.aimedAt} ${t.workflow.audienceLabel[workflow.audience] ?? workflow.audience}

${numberedSteps(workflow.steps, locale)}`,
  }))
}

function createFaqSection(input: ClientDocsInput, locale: ManualLocale): DocSection {
  const t = LOCALES[locale]
  return {
    id: 'faq',
    title: t.sectionTitle.faq,
    type: 'faq',
    content: `# ${t.sectionTitle.faq}

${input.faqs.map((faq) => `## ${faq.question}\n\n${faq.answer}`).join('\n\n')}`,
  }
}

function createSupportSection(input: ClientDocsInput, locale: ManualLocale): DocSection | null {
  if (!input.supportEmail) return null
  const t = LOCALES[locale]

  return {
    id: 'support',
    title: t.sectionTitle.support,
    type: 'support',
    content: `# ${t.sectionTitle.support}

## ${t.support.mainChannel}

- ${t.support.email} ${input.supportEmail}
${input.supportHours ? `- ${t.support.hours} ${input.supportHours}\n` : ''}${
      input.primaryAdminEmail ? `- ${t.support.primaryAdmin} ${input.primaryAdminEmail}\n` : ''
    }
## ${t.support.whatToInclude}

${listItems(t.support.whatToIncludeList, locale)}`,
  }
}

function createPolicySection(input: ClientDocsInput, locale: ManualLocale): DocSection | null {
  if (!input.policies?.length) return null
  const t = LOCALES[locale]

  return {
    id: 'policies',
    title: t.sectionTitle.policy,
    type: 'policy',
    content: `# ${t.sectionTitle.policy}

${listItems(input.policies, locale)}`,
  }
}

export function generateClientDocs(
  input: ClientDocsInput,
  audience: ManualAudience = 'worker',
  locale: ManualLocale = 'es'
): GeneratedClientDocs {
  const t = LOCALES[locale]
  const supportSection = createSupportSection(input, locale)
  const policySection = createPolicySection(input, locale)

  // Note: access / roles / faq / policies carry no audience signal, so they
  // ship in BOTH manuals. Only overview, modules and workflows are filtered.
  const sections = [
    createOverviewSection(input, audience, locale),
    createAccessSection(input, locale),
    createRolesSection(input, locale),
    ...createModuleSections(input, audience, locale),
    ...createWorkflowSections(input, audience, locale),
    createFaqSection(input, locale),
    ...(supportSection ? [supportSection] : []),
    ...(policySection ? [policySection] : []),
  ]

  return {
    title: t.manual.title(audience, input.appName),
    subtitle: t.manual.subtitle(audience, input.clientName),
    audience,
    locale,
    generatedAt: new Date().toISOString(),
    sections,
  }
}
```

---

## `src/features/client-docs/services/exportDocs.ts`

```ts
import { LOCALES } from '../generators/copy'
import type { GeneratedClientDocs } from '../generators/types'

export function docsToMarkdown(docs: GeneratedClientDocs) {
  const t = LOCALES[docs.locale]
  const header = `# ${docs.title}

${docs.subtitle}

${t.export.generatedAt} ${new Date(docs.generatedAt).toLocaleString(t.export.dateLocaleTag)}
`

  const sections = docs.sections.map((section) => `\n\n---\n\n${section.content.trim()}`).join('')

  return `${header}${sections}\n`
}

export function downloadTextFile(fileName: string, content: string) {
  const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')

  anchor.href = url
  anchor.download = fileName
  anchor.click()

  URL.revokeObjectURL(url)
}
```

**Why `copy.ts` and not two schema files:** the client's own data (module
names, FAQs, workflow steps) is never machine-translated — only the
scaffolding around it changes with `locale`. If a project genuinely needs the
client-authored content itself in two languages (not just the chrome around
it), that's a different, heavier feature (duplicate `ClientDocsInput` objects
per locale) — see the "quick alternative" callout in `SKILL.md` before
reaching for it.
