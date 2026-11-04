# UI components

These use plain Tailwind utility classes (no custom design tokens) so they
work out of the box on a fresh Titan Factory project. If the project already
has a design system (one of `.claude/design-systems/*` or its own tokens),
remap the classes per Paso 5 of `SKILL.md` — the structure/logic never
changes, only the class names.

All of them import `cn` from `@/lib/utils`. If that file doesn't exist yet in
the project, create it first:

```ts
// src/lib/utils.ts
export function cn(...inputs: Array<string | false | null | undefined>) {
  return inputs.filter(Boolean).join(' ')
}
```

(If the project already has `clsx` + `tailwind-merge` — e.g. shadcn/ui was
set up — reuse its existing `cn` instead of adding this one.)

---

## `src/features/client-docs/components/DocsSectionNav.tsx`

```tsx
'use client'

import {
  BookOpen,
  FileText,
  HelpCircle,
  KeyRound,
  LifeBuoy,
  ListChecks,
  Shield,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { DocSection } from '../generators/types'

const iconByType = {
  overview: BookOpen,
  access: KeyRound,
  roles: Shield,
  module: FileText,
  workflow: ListChecks,
  faq: HelpCircle,
  support: LifeBuoy,
  policy: Shield,
} as const

interface DocsSectionNavProps {
  sections: DocSection[]
  selectedSectionId: string
  onSelectSection: (sectionId: string) => void
}

export function DocsSectionNav({ sections, selectedSectionId, onSelectSection }: DocsSectionNavProps) {
  return (
    <nav className="flex flex-col gap-px">
      <p className="px-2 pb-1.5 text-[11.5px] font-semibold uppercase tracking-[0.06em] text-slate-400">
        Sections
      </p>
      {sections.map((section) => {
        const Icon = iconByType[section.type]
        const isSelected = section.id === selectedSectionId

        return (
          <button
            key={section.id}
            type="button"
            onClick={() => onSelectSection(section.id)}
            className={cn(
              'relative flex h-[28px] items-center gap-2.5 rounded px-2 text-left text-[13.5px] transition-colors',
              isSelected ? 'bg-blue-50 font-semibold text-slate-900' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            )}
          >
            {isSelected && (
              <span className="absolute left-0 top-[5px] bottom-[5px] w-[2.5px] rounded-full bg-blue-600" aria-hidden />
            )}
            <Icon size={16} className={cn('flex-shrink-0', isSelected ? 'text-blue-600' : 'text-slate-400')} />
            <span className="flex-1 truncate">{section.title}</span>
          </button>
        )
      })}
    </nav>
  )
}
```

---

## `src/features/client-docs/components/DocsPreview.tsx`

Detects `![alt](src)` lines and renders them as `<figure>` — a screenshot
with a caption. Any other Markdown variant (inline images, HTML, MDX) is out
of scope; extend the parser if the project needs it.

```tsx
'use client'

import type { DocSection } from '../generators/types'

const IMAGE_LINE = /^!\[(.*?)\]\((.+?)\)$/

function renderLine(line: string, index: number) {
  const trimmed = line.trim()

  if (!trimmed) return <div key={index} className="h-3" />

  const imageMatch = trimmed.match(IMAGE_LINE)
  if (imageMatch) {
    const [, alt, src] = imageMatch
    return (
      <figure key={index} className="my-3 overflow-hidden rounded-lg border border-slate-200">
        {/* eslint-disable-next-line @next/next/no-img-element -- client-authored screenshot, arbitrary path */}
        <img src={src} alt={alt} className="w-full" />
        {alt && <figcaption className="border-t border-slate-200 bg-slate-50 px-3 py-1.5 text-[12px] italic text-slate-500">{alt}</figcaption>}
      </figure>
    )
  }

  if (trimmed.startsWith('# ')) {
    return (
      <h2 key={index} className="mt-1 text-[22px] font-semibold leading-tight text-slate-900">
        {trimmed.slice(2)}
      </h2>
    )
  }
  if (trimmed.startsWith('## ')) {
    return (
      <h3 key={index} className="mt-5 text-[14px] font-semibold uppercase tracking-[0.04em] text-slate-600">
        {trimmed.slice(3)}
      </h3>
    )
  }
  if (trimmed.startsWith('- ')) {
    return (
      <div key={index} className="flex gap-3 text-[14px] leading-6 text-slate-600">
        <span className="mt-0.5 select-none text-blue-600">·</span>
        <span>{trimmed.slice(2)}</span>
      </div>
    )
  }
  if (/^\d+\./.test(trimmed)) {
    const dotIndex = trimmed.indexOf('.')
    return (
      <div key={index} className="flex gap-3 text-[14px] leading-6 text-slate-600">
        <span className="min-w-6 font-semibold text-blue-600">{trimmed.slice(0, dotIndex + 1)}</span>
        <span>{trimmed.slice(dotIndex + 1).trim()}</span>
      </div>
    )
  }

  return (
    <p key={index} className="text-[14px] leading-6 text-slate-600">
      {trimmed}
    </p>
  )
}

const sectionTypeLabel: Record<DocSection['type'], string> = {
  overview: 'Overview',
  access: 'Access',
  roles: 'Roles',
  module: 'Module',
  workflow: 'Flow',
  faq: 'FAQ',
  support: 'Support',
  policy: 'Policy',
}

interface DocsPreviewProps {
  section: DocSection
}

export function DocsPreview({ section }: DocsPreviewProps) {
  return (
    <article className="min-h-[560px] rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-5 flex items-center justify-between border-b border-slate-200 pb-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-blue-600">
            {sectionTypeLabel[section.type]}
          </p>
          <h1 className="mt-1 text-[18px] font-semibold text-slate-900">{section.title}</h1>
        </div>
      </div>
      <div className="space-y-1">{section.content.split('\n').map(renderLine)}</div>
    </article>
  )
}
```

> Note: `sectionTypeLabel` above is English-only for brevity in this preview
> UI (it's an editor tool, not the shipped manual). If the project needs the
> editor itself in Spanish, swap it for `LOCALES[locale].sectionTypeLabel`
> from `copy.ts` — the generated manual content is already fully localized
> regardless.

---

## `src/features/client-docs/components/editor/listOps.ts`

```ts
/** Immutable array operations for the manual's list editors. */

export function replaceAt<T>(items: T[], index: number, value: T): T[] {
  return items.map((item, i) => (i === index ? value : item))
}

export function removeAt<T>(items: T[], index: number): T[] {
  return items.filter((_, i) => i !== index)
}

export function insertAt<T>(items: T[], index: number, value: T): T[] {
  const next = items.slice()
  next.splice(index, 0, value)
  return next
}

/** Moves the item at `index` one slot in `dir` (-1 up, +1 down). */
export function moveBy<T>(items: T[], index: number, dir: -1 | 1): T[] {
  const target = index + dir
  if (target < 0 || target >= items.length) return items
  const next = items.slice()
  ;[next[index], next[target]] = [next[target], next[index]]
  return next
}
```

---

## `src/features/client-docs/components/editor/fields.tsx`

```tsx
'use client'

import { ChevronDown, ChevronUp, Plus, X } from 'lucide-react'
import { moveBy, removeAt, replaceAt } from './listOps'

const labelClass = 'block pb-1 text-[11.5px] font-semibold uppercase tracking-[0.05em] text-slate-400'
const controlClass =
  'w-full rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-[13px] text-slate-900 outline-none transition-colors focus:border-blue-500'

export function TextField({
  label, value, onChange, placeholder, type = 'text',
}: {
  label: string; value: string; onChange: (v: string) => void
  placeholder?: string; type?: string
}) {
  return (
    <label className="block">
      <span className={labelClass}>{label}</span>
      <input type={type} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} className={controlClass} />
    </label>
  )
}

export function TextAreaField({
  label, value, onChange, rows = 3, placeholder,
}: {
  label: string; value: string; onChange: (v: string) => void
  rows?: number; placeholder?: string
}) {
  return (
    <label className="block">
      <span className={labelClass}>{label}</span>
      <textarea
        value={value}
        rows={rows}
        placeholder={placeholder}
        spellCheck={false}
        onChange={(e) => onChange(e.target.value)}
        className={`${controlClass} resize-y leading-5`}
      />
    </label>
  )
}

export function SelectField({
  label, value, onChange, options,
}: {
  label: string; value: string; onChange: (v: string) => void
  options: { value: string; label: string }[]
}) {
  return (
    <label className="block">
      <span className={labelClass}>{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} className={controlClass}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </label>
  )
}

/** Editor for text lists (bullets, steps, permissions): add, delete, reorder. */
export function StringListEditor({
  label, items, onChange, placeholder, addLabel = 'Add item',
}: {
  label: string; items: string[]; onChange: (items: string[]) => void
  placeholder?: string; addLabel?: string
}) {
  return (
    <div>
      <span className={labelClass}>{label}</span>
      <div className="flex flex-col gap-1.5">
        {items.map((item, index) => (
          <div key={index} className="flex items-start gap-1">
            <textarea
              value={item}
              rows={1}
              placeholder={placeholder}
              spellCheck={false}
              onChange={(e) => onChange(replaceAt(items, index, e.target.value))}
              className={`${controlClass} min-h-[34px] resize-y leading-5`}
            />
            <div className="flex flex-col">
              <RowButton title="Move up" disabled={index === 0} onClick={() => onChange(moveBy(items, index, -1))}>
                <ChevronUp size={13} />
              </RowButton>
              <RowButton title="Move down" disabled={index === items.length - 1} onClick={() => onChange(moveBy(items, index, 1))}>
                <ChevronDown size={13} />
              </RowButton>
            </div>
            <RowButton title="Delete" tone="danger" onClick={() => onChange(removeAt(items, index))}>
              <X size={13} />
            </RowButton>
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={() => onChange([...items, ''])}
        className="mt-1.5 inline-flex items-center gap-1 rounded-md border border-dashed border-slate-300 px-2 py-1 text-[12px] font-medium text-slate-600 transition-colors hover:border-blue-500 hover:text-blue-600"
      >
        <Plus size={12} />
        {addLabel}
      </button>
    </div>
  )
}

export function RowButton({
  title, onClick, disabled, tone = 'default', children,
}: {
  title: string; onClick: () => void; disabled?: boolean
  tone?: 'default' | 'danger'; children: React.ReactNode
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      disabled={disabled}
      onClick={onClick}
      className={`flex h-[18px] w-[22px] items-center justify-center rounded text-slate-400 transition-colors disabled:cursor-not-allowed disabled:opacity-30 ${
        tone === 'danger' ? 'hover:bg-blue-50 hover:text-blue-600' : 'hover:bg-slate-100 hover:text-slate-900'
      }`}
    >
      {children}
    </button>
  )
}
```

---

## `src/features/client-docs/components/editor/ListSection.tsx`

Generic add / delete (inline-confirm) / reorder section with a collapsible
card per item.

> **Gotcha — index keys pin state to the wrong row.** Each card keeps local
> state (open / confirming-delete). With `key={index}`, deleting or
> reordering an item leaves that state pinned to the *position*: delete item
> #3 and whatever now occupies its slot inherits "confirm delete" mode. Fix:
> stable per-item keys (`item-0`, `item-1`, …) kept in parallel to `items` and
> mutated on every add/remove/move; they only regenerate if the array length
> changes from outside (e.g. "Reset"). Apply this to any reorderable/deletable
> list whose rows carry local state — never `key={index}` there.

```tsx
'use client'

import { ChevronDown, ChevronUp, GripVertical, Plus, Trash2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'
import { RowButton } from './fields'
import { moveBy, removeAt, replaceAt } from './listOps'

interface ListSectionProps<T> {
  title: string
  items: T[]
  onChange: (items: T[]) => void
  makeEmpty: () => T
  itemTitle: (item: T, index: number) => string
  renderItem: (item: T, update: (patch: Partial<T>) => void) => React.ReactNode
  addLabel: string
}

export function ListSection<T>({
  title, items, onChange, makeEmpty, itemTitle, renderItem, addLabel,
}: ListSectionProps<T>) {
  const counter = useRef(0)
  const makeKey = () => `item-${counter.current++}`
  const [keys, setKeys] = useState<string[]>(() => items.map(makeKey))

  useEffect(() => {
    if (keys.length !== items.length) setKeys(items.map(makeKey))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items])

  const apply = (nextItems: T[], nextKeys: string[]) => {
    onChange(nextItems)
    setKeys(nextKeys)
  }

  return (
    <section className="rounded-lg border border-slate-200 bg-white">
      <div className="flex items-center justify-between gap-2 border-b border-slate-200 px-3 py-2">
        <h3 className="flex items-center gap-2 text-[13px] font-semibold text-slate-900">
          {title}
          <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[11px] font-medium text-slate-500">
            {items.length}
          </span>
        </h3>
        <button
          type="button"
          onClick={() => apply([...items, makeEmpty()], [...keys, makeKey()])}
          className="inline-flex items-center gap-1 rounded-md bg-blue-600 px-2 py-1 text-[12px] font-semibold text-white transition-colors hover:bg-blue-500"
        >
          <Plus size={12} />
          {addLabel}
        </button>
      </div>

      <div className="flex flex-col gap-2 p-2">
        {items.length === 0 && (
          <p className="px-1 py-3 text-center text-[12.5px] text-slate-500">No items yet. Click &ldquo;{addLabel}&rdquo;.</p>
        )}
        {items.map((item, index) => (
          <ListItemCard
            key={keys[index] ?? index}
            title={itemTitle(item, index)}
            isFirst={index === 0}
            isLast={index === items.length - 1}
            onMoveUp={() => apply(moveBy(items, index, -1), moveBy(keys, index, -1))}
            onMoveDown={() => apply(moveBy(items, index, 1), moveBy(keys, index, 1))}
            onDelete={() => apply(removeAt(items, index), removeAt(keys, index))}
          >
            {renderItem(item, (patch) => onChange(replaceAt(items, index, { ...item, ...patch })))}
          </ListItemCard>
        ))}
      </div>
    </section>
  )
}

function ListItemCard({
  title, isFirst, isLast, onMoveUp, onMoveDown, onDelete, children,
}: {
  title: string; isFirst: boolean; isLast: boolean
  onMoveUp: () => void; onMoveDown: () => void; onDelete: () => void
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(false)
  const [confirming, setConfirming] = useState(false)

  return (
    <div className="rounded-md border border-slate-200 bg-slate-50">
      <div className="flex items-center gap-1 px-1.5 py-1">
        <GripVertical size={14} className="shrink-0 text-slate-300" />
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex min-w-0 flex-1 items-center gap-1.5 rounded px-1 py-1 text-left transition-colors hover:bg-white"
        >
          {open ? (
            <ChevronDown size={14} className="shrink-0 text-slate-400" />
          ) : (
            <ChevronUp size={14} className="shrink-0 rotate-90 text-slate-400" />
          )}
          <span className="truncate text-[13px] font-medium text-slate-900">{title || 'Untitled'}</span>
        </button>

        {confirming ? (
          <div className="flex items-center gap-1">
            <button type="button" onClick={onDelete} className="rounded bg-blue-600 px-1.5 py-0.5 text-[11px] font-semibold text-white">
              Delete
            </button>
            <button type="button" onClick={() => setConfirming(false)} className="rounded border border-slate-200 px-1.5 py-0.5 text-[11px] text-slate-600">
              Cancel
            </button>
          </div>
        ) : (
          <div className="flex items-center">
            <RowButton title="Move up" disabled={isFirst} onClick={onMoveUp}>
              <ChevronUp size={14} />
            </RowButton>
            <RowButton title="Move down" disabled={isLast} onClick={onMoveDown}>
              <ChevronDown size={14} />
            </RowButton>
            <RowButton title="Delete" tone="danger" onClick={() => setConfirming(true)}>
              <Trash2 size={13} />
            </RowButton>
          </div>
        )}
      </div>

      <div className={cn('flex-col gap-2.5 px-2.5 pb-3 pt-1', open ? 'flex' : 'hidden')}>{children}</div>
    </div>
  )
}
```

---

## `src/features/client-docs/components/editor/ManualEditor.tsx`

Composes general data + one `ListSection` per array. Adapt the field list to
the project's `ClientDocsInput` if it dropped optional fields (e.g. no
`supportEmail`).

```tsx
'use client'

import type {
  ClientDocsFaq,
  ClientDocsInput,
  ClientDocsModule,
  ClientDocsRole,
  ClientDocsWorkflow,
} from '../../generators/types'
import { SelectField, StringListEditor, TextAreaField, TextField } from './fields'
import { ListSection } from './ListSection'

const audienceOptions = [
  { value: 'end-user', label: 'End user' },
  { value: 'admin', label: 'Administrator' },
  { value: 'support', label: 'Support' },
]

export function ManualEditor({
  input, onChange,
}: {
  input: ClientDocsInput
  onChange: (input: ClientDocsInput) => void
}) {
  const setField = <K extends keyof ClientDocsInput>(key: K, value: ClientDocsInput[K]) =>
    onChange({ ...input, [key]: value })

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-3">
      <section className="rounded-lg border border-slate-200 bg-white p-3">
        <h3 className="mb-2.5 text-[13px] font-semibold text-slate-900">General data</h3>
        <div className="flex flex-col gap-2.5">
          <TextField label="App name" value={input.appName} onChange={(v) => setField('appName', v)} />
          <TextField label="Client" value={input.clientName} onChange={(v) => setField('clientName', v)} />
          <TextField label="App URL" value={input.appUrl} onChange={(v) => setField('appUrl', v)} />
          <TextField label="Support email (optional)" value={input.supportEmail ?? ''} onChange={(v) => setField('supportEmail', v || undefined)} />
          <TextField label="Support hours (optional)" value={input.supportHours ?? ''} onChange={(v) => setField('supportHours', v || undefined)} />
          <TextField label="Primary admin email (optional)" value={input.primaryAdminEmail ?? ''} onChange={(v) => setField('primaryAdminEmail', v || undefined)} />
        </div>
      </section>

      <ListSection<ClientDocsModule>
        title="Modules" addLabel="Module" items={input.modules}
        onChange={(modules) => setField('modules', modules)}
        makeEmpty={() => ({ name: '', description: '', endUserActions: [] })}
        itemTitle={(m) => m.name}
        renderItem={(module, update) => (
          <>
            <TextField label="Name" value={module.name} onChange={(v) => update({ name: v })} />
            <TextAreaField label="Description" value={module.description} onChange={(v) => update({ description: v })} />
            <StringListEditor label="Actions for users" addLabel="Add action" items={module.endUserActions} onChange={(endUserActions) => update({ endUserActions })} />
            <StringListEditor label="Actions for administrators" addLabel="Add admin action" items={module.adminActions ?? []} onChange={(a) => update({ adminActions: a.length ? a : undefined })} />
          </>
        )}
      />

      <ListSection<ClientDocsRole>
        title="Roles" addLabel="Role" items={input.roles}
        onChange={(roles) => setField('roles', roles)}
        makeEmpty={() => ({ name: '', description: '', permissions: [] })}
        itemTitle={(r) => r.name}
        renderItem={(role, update) => (
          <>
            <TextField label="Name" value={role.name} onChange={(v) => update({ name: v })} />
            <TextAreaField label="Description" value={role.description} onChange={(v) => update({ description: v })} />
            <StringListEditor label="Permissions" addLabel="Add permission" items={role.permissions} onChange={(permissions) => update({ permissions })} />
          </>
        )}
      />

      <ListSection<ClientDocsWorkflow>
        title="Workflows" addLabel="Workflow" items={input.workflows}
        onChange={(workflows) => setField('workflows', workflows)}
        makeEmpty={() => ({ title: '', audience: 'end-user', steps: [] })}
        itemTitle={(w) => w.title}
        renderItem={(workflow, update) => (
          <>
            <TextField label="Title" value={workflow.title} onChange={(v) => update({ title: v })} />
            <SelectField label="Aimed at" value={workflow.audience} options={audienceOptions} onChange={(v) => update({ audience: v as ClientDocsWorkflow['audience'] })} />
            <StringListEditor label="Steps" addLabel="Add step" items={workflow.steps} onChange={(steps) => update({ steps })} />
          </>
        )}
      />

      <ListSection<ClientDocsFaq>
        title="FAQs" addLabel="FAQ" items={input.faqs}
        onChange={(faqs) => setField('faqs', faqs)}
        makeEmpty={() => ({ question: '', answer: '' })}
        itemTitle={(f) => f.question}
        renderItem={(faq, update) => (
          <>
            <TextField label="Question" value={faq.question} onChange={(v) => update({ question: v })} />
            <TextAreaField label="Answer" value={faq.answer} onChange={(v) => update({ answer: v })} />
          </>
        )}
      />

      <section className="rounded-lg border border-slate-200 bg-white p-3">
        <h3 className="mb-2.5 text-[13px] font-semibold text-slate-900">Usage policies</h3>
        <StringListEditor label="Policies" addLabel="Add policy" items={input.policies ?? []} onChange={(p) => setField('policies', p.length ? p : undefined)} />
      </section>
    </div>
  )
}
```

---

## `src/features/client-docs/components/ClientDocsGenerator.tsx`

Main screen. Two independent toggle groups — **Audience** (worker/admin) and
**Language** (es/en) — both feed `generateClientDocs` and both are persisted
for the print view.

```tsx
'use client'

import { FileDown, FileText, RotateCcw } from 'lucide-react'
import { useMemo, useState } from 'react'
import { generateClientDocs } from '../generators/generateClientDocs'
import type { ClientDocsInput, ManualAudience, ManualLocale } from '../generators/types'
import { clientDocsInput } from '../schemas/clientDocsInput' // CHANGE to your schema
import { docsToMarkdown, downloadTextFile } from '../services/exportDocs'
import { DocsPreview } from './DocsPreview'
import { DocsSectionNav } from './DocsSectionNav'
import { ManualEditor } from './editor/ManualEditor'

const PRINT_STORAGE_KEY = 'manual-generator-input' // prefix with the project slug if you want it namespaced

const audienceOptions: { value: ManualAudience; label: string }[] = [
  { value: 'worker', label: 'Worker' },
  { value: 'admin', label: 'Admin' },
]

const localeOptions: { value: ManualLocale; label: string }[] = [
  { value: 'es', label: 'ES' },
  { value: 'en', label: 'EN' },
]

function getFileSafeName(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export function ClientDocsGenerator() {
  const [input, setInput] = useState<ClientDocsInput>(clientDocsInput)
  const [audience, setAudience] = useState<ManualAudience>('worker')
  const [locale, setLocale] = useState<ManualLocale>('es')
  const [selectedSectionId, setSelectedSectionId] = useState('overview')

  // `input` is the single source of truth; the preview is live (no "Generate" button).
  const docs = useMemo(() => generateClientDocs(input, audience, locale), [input, audience, locale])
  const selectedSection = docs.sections.find((section) => section.id === selectedSectionId) ?? docs.sections[0]

  const handleReset = () => {
    setInput(clientDocsInput)
    setSelectedSectionId('overview')
  }

  const handleDownloadMarkdown = () => {
    const fileName = `manual-${audience}-${locale}-${getFileSafeName(input.appName)}-${getFileSafeName(input.clientName)}.md`
    downloadTextFile(fileName, docsToMarkdown(docs))
  }

  // localStorage (NOT sessionStorage): /manual/print opens with `noopener`,
  // which does not inherit the opener's sessionStorage. Audience and locale
  // also travel in the URL as an authoritative fallback.
  const handleDownloadPdf = () => {
    try {
      localStorage.setItem(PRINT_STORAGE_KEY, JSON.stringify({ input, audience, locale }))
    } catch {
      // localStorage can throw in strict private-browsing mode — falls back to defaults
    }
    window.open(`/manual/print?audience=${audience}&locale=${locale}`, '_blank', 'noopener,noreferrer')
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex flex-col gap-4 border-b border-slate-200 bg-white px-6 py-5 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-blue-600">User manual</p>
          <h1 className="mt-1 text-[22px] font-semibold leading-tight text-slate-900">Client manual generator</h1>
          <p className="mt-1 max-w-3xl text-[13.5px] leading-5 text-slate-500">
            Edit the content, pick audience and language, and download that manual as Markdown or a print-ready PDF.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ToggleGroup label="Audience" value={audience} options={audienceOptions} onChange={(v) => { setAudience(v); setSelectedSectionId('overview') }} />
          <ToggleGroup label="Language" value={locale} options={localeOptions} onChange={(v) => { setLocale(v); setSelectedSectionId('overview') }} />
          <button
            type="button"
            onClick={handleReset}
            className="inline-flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-[13px] font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900"
            title="Back to the default data"
          >
            <RotateCcw size={14} />
            Reset
          </button>
          <button
            type="button"
            onClick={handleDownloadMarkdown}
            className="inline-flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-[13px] font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900"
            title="Download the manual as Markdown (.md)"
          >
            <FileText size={14} />
            Markdown
          </button>
          <button
            type="button"
            onClick={handleDownloadPdf}
            className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-3 py-1.5 text-[13px] font-semibold text-white transition-colors hover:bg-blue-500"
            title="Opens the print view: choose 'Save as PDF'"
          >
            <FileDown size={14} />
            Download PDF
          </button>
        </div>
      </header>

      <main className="grid min-h-0 flex-1 gap-4 overflow-hidden bg-slate-50 p-4 lg:grid-cols-[380px_1fr]">
        <section className="flex min-h-0 flex-col rounded-lg border border-slate-200 bg-white">
          <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
            <div>
              <h2 className="text-[14px] font-semibold text-slate-900">Manual content</h2>
              <p className="mt-0.5 text-[11.5px] text-slate-500">Edit, add, reorder and delete sections. The preview updates instantly.</p>
            </div>
          </div>
          <ManualEditor input={input} onChange={setInput} />
        </section>

        <section className="grid min-h-0 gap-4 overflow-hidden lg:grid-cols-[220px_1fr]">
          <aside className="hidden min-h-0 overflow-y-auto rounded-lg border border-slate-200 bg-white p-2 lg:block">
            <DocsSectionNav sections={docs.sections} selectedSectionId={selectedSection.id} onSelectSection={setSelectedSectionId} />
          </aside>

          <div className="flex min-h-0 flex-col gap-3 overflow-hidden">
            <div className="rounded-lg border border-slate-200 bg-white px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-slate-400">{docs.subtitle}</p>
              <h2 className="mt-0.5 text-[16px] font-semibold text-slate-900">{docs.title}</h2>
            </div>

            <div className="lg:hidden">
              <label htmlFor="section-select" className="block pb-1 text-[11.5px] font-semibold uppercase tracking-[0.06em] text-slate-400">
                Section
              </label>
              <select
                id="section-select"
                value={selectedSection.id}
                onChange={(event) => setSelectedSectionId(event.target.value)}
                className="w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-[13.5px] text-slate-900 outline-none focus:border-blue-500"
              >
                {docs.sections.map((section) => (
                  <option key={section.id} value={section.id}>{section.title}</option>
                ))}
              </select>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto">
              <DocsPreview section={selectedSection} />
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}

function ToggleGroup<T extends string>({
  label, value, options, onChange,
}: {
  label: string; value: T; options: { value: T; label: string }[]; onChange: (v: T) => void
}) {
  return (
    <div role="group" aria-label={label} className="flex items-center rounded-md border border-slate-200 bg-slate-50 p-0.5">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className={
            option.value === value
              ? 'rounded bg-blue-600 px-3 py-1 text-[12.5px] font-semibold text-white'
              : 'rounded px-3 py-1 text-[12.5px] font-semibold text-slate-600 transition-colors hover:text-slate-900'
          }
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}
```

---

## `src/features/client-docs/components/PrintView.tsx`

```tsx
'use client'

import { useEffect, useMemo, useState } from 'react'
import { generateClientDocs } from '../generators/generateClientDocs'
import { LOCALES } from '../generators/copy'
import type { ClientDocsInput, DocSection, ManualAudience, ManualLocale } from '../generators/types'
import { clientDocsInput } from '../schemas/clientDocsInput' // CHANGE to your schema
import './print.css'

const STORAGE_KEY = 'manual-generator-input' // localStorage; must match ClientDocsGenerator

interface PrintPayload {
  input: ClientDocsInput
  audience: ManualAudience
  locale: ManualLocale
}

function parsePrintPayload(raw: string): PrintPayload {
  const parsed = JSON.parse(raw)
  if (parsed && typeof parsed === 'object' && 'input' in parsed) {
    return {
      input: parsed.input as ClientDocsInput,
      audience: (parsed.audience as ManualAudience) ?? 'worker',
      locale: (parsed.locale as ManualLocale) ?? 'es',
    }
  }
  // Legacy payload: the object itself was the input.
  return { input: parsed as ClientDocsInput, audience: 'worker', locale: 'es' }
}

/**
 * App logo as inline SVG. Replace with the target project's real branding —
 * or swap for `<img src="/logo.png">` if the app already has a logo asset.
 * SVG because @page margin boxes only accept text, not images.
 */
function AppLogo({ size = 32, ink = '#0f172a', accent = '#2563eb' }: { size?: number; ink?: string; accent?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg" aria-label="App" role="img">
      <rect width="32" height="32" rx="7" ry="7" fill={ink} />
      <text x="50%" y="54%" textAnchor="middle" dominantBaseline="middle" fontFamily="ui-monospace, Consolas, monospace" fontSize="17" fontWeight="600" fill="#ffffff">
        A
      </text>
      <circle cx="25" cy="25" r="2.2" fill={accent} />
    </svg>
  )
}

interface PrintViewProps {
  /** Pre-formatted in the server component: "August 26, 2026". Avoids hydration mismatches. */
  generatedDateLabel: string
}

export function PrintView({ generatedDateLabel }: PrintViewProps) {
  const [input, setInput] = useState<ClientDocsInput>(clientDocsInput)
  const [audience, setAudience] = useState<ManualAudience>('worker')
  const [locale, setLocale] = useState<ManualLocale>('es')
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY) // localStorage, not sessionStorage — see gotcha in checklist.md
      if (raw) {
        const payload = parsePrintPayload(raw)
        setInput(payload.input)
        setAudience(payload.audience)
        setLocale(payload.locale)
      }
      // The URL wins over localStorage — authoritative fallback if storage is empty/blocked.
      const qp = new URLSearchParams(window.location.search)
      const qpAudience = qp.get('audience')
      const qpLocale = qp.get('locale')
      if (qpAudience === 'admin' || qpAudience === 'worker') setAudience(qpAudience)
      if (qpLocale === 'es' || qpLocale === 'en') setLocale(qpLocale)
    } catch {
      // falls back to defaults
    }
    setHydrated(true)
  }, [])

  const docs = useMemo(() => generateClientDocs(input, audience, locale), [input, audience, locale])
  const t = LOCALES[locale]

  useEffect(() => {
    if (!hydrated) return
    const id = window.setTimeout(() => {
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => {
          window.print()
        })
      })
    }, 400)
    return () => window.clearTimeout(id)
  }, [hydrated])

  return (
    <>
      <aside className="print-screen-notice" data-no-print>
        <div className="print-screen-notice-icon" aria-hidden>!</div>
        <div>
          <p className="print-screen-notice-title">{t.print.notice.title}</p>
          <p className="print-screen-notice-body">{t.print.notice.body}</p>
        </div>
      </aside>

      {/* data-doc-type feeds the @page top-right margin box via content: attr() —
          CSS `content:` can't hold a JS expression, this is the bridge. */}
      <div data-print-root data-doc-type={t.print.coverEyebrow(audience)}>
        <header className="print-cover">
          <div className="print-cover-logo">
            <AppLogo size={72} />
          </div>
          <p className="print-cover-eyebrow">{t.print.coverEyebrow(audience)}</p>
          <h1 className="print-cover-title">{docs.title.replace(/^.*?·\s*/, '')}</h1>
          <p className="print-cover-subtitle">{docs.subtitle}</p>
          <p className="print-cover-meta">{t.print.generatedOn(generatedDateLabel)}</p>
        </header>

        <nav className="print-toc">
          <h2>{t.print.tableOfContents}</h2>
          <ol>
            {docs.sections.map((section) => (
              <li key={section.id}>{section.title}</li>
            ))}
          </ol>
        </nav>

        {docs.sections.map((section) => (
          <section key={section.id} className="print-section">
            <p className="print-section-type">{t.sectionTypeLabel[section.type]}</p>
            <SectionBody content={section.content} />
          </section>
        ))}
      </div>
    </>
  )
}

const IMAGE_LINE = /^!\[(.*?)\]\((.+?)\)$/

function SectionBody({ content }: { content: string }) {
  const lines = content.split('\n')
  const blocks: React.ReactNode[] = []
  let listBuffer: string[] = []
  let listOrdered = false

  const flushList = () => {
    if (listBuffer.length === 0) return
    const items = listBuffer
    const Tag = listOrdered ? 'ol' : 'ul'
    blocks.push(
      <Tag key={`list-${blocks.length}`}>
        {items.map((item, idx) => (
          <li key={idx}>{item}</li>
        ))}
      </Tag>
    )
    listBuffer = []
  }

  lines.forEach((rawLine, idx) => {
    const line = rawLine.trim()
    if (!line) {
      flushList()
      return
    }

    const imageMatch = line.match(IMAGE_LINE)
    if (imageMatch) {
      flushList()
      const [, alt, src] = imageMatch
      blocks.push(
        <figure key={`img-${idx}`} className="print-figure">
          {/* eslint-disable-next-line @next/next/no-img-element -- client-authored screenshot, arbitrary path */}
          <img src={src} alt={alt} />
          {alt && <figcaption>{alt}</figcaption>}
        </figure>
      )
      return
    }

    if (line.startsWith('# ')) {
      flushList()
      blocks.push(<h1 key={`h1-${idx}`}>{line.slice(2)}</h1>)
      return
    }

    if (line.startsWith('## ')) {
      flushList()
      blocks.push(<h2 key={`h2-${idx}`}>{line.slice(3)}</h2>)
      return
    }

    if (line.startsWith('- ')) {
      if (listOrdered) { flushList(); listOrdered = false }
      listBuffer.push(line.slice(2))
      return
    }

    const orderedMatch = line.match(/^(\d+)\.\s+(.*)$/)
    if (orderedMatch) {
      if (!listOrdered) { flushList(); listOrdered = true }
      listBuffer.push(orderedMatch[2])
      return
    }

    flushList()
    blocks.push(<p key={`p-${idx}`}>{line}</p>)
  })

  flushList()
  return <>{blocks}</>
}
```

---

## `src/features/client-docs/components/print.css`

```css
/* === PRINT ============================================================ */
@media print {
  @page {
    size: A4;
    margin: 22mm 16mm 22mm;

    @top-left {
      content: 'AppName'; /* ← CHANGE to the app name */
      font-family: system-ui, sans-serif;
      font-size: 9pt;
      font-weight: 700;
      color: #0f172a;
      padding-bottom: 4pt;
    }

    @top-right {
      /* Pulled from [data-print-root]'s data-doc-type attribute — the only
         way to make this locale/audience-aware, since content: can't hold
         a JS expression. See PrintView.tsx. */
      content: attr(data-doc-type);
      font-family: system-ui, sans-serif;
      font-size: 9pt;
      color: #64748b;
      padding-bottom: 4pt;
    }

    @bottom-left {
      content: 'app.example.com'; /* ← CHANGE to the app's URL */
      font-family: system-ui, sans-serif;
      font-size: 9pt;
      color: #64748b;
    }

    @bottom-right {
      content: counter(page) ' / ' counter(pages);
      font-family: system-ui, sans-serif;
      font-size: 9pt;
      color: #64748b;
    }
  }

  @page :first {
    @top-left { content: ''; }
    @top-right { content: ''; }
  }

  body, html {
    background: #ffffff !important;
    color: #0f172a !important;
  }

  body * { visibility: hidden; }
  [data-print-root], [data-print-root] * { visibility: visible; }
  [data-no-print] { display: none !important; }

  [data-print-root] {
    position: absolute;
    inset: 0;
    width: 100%;
    padding: 0;
    background: #ffffff;
    color: #0f172a;
    font-family: system-ui, -apple-system, sans-serif;
    font-size: 11pt;
    line-height: 1.5;
  }

  .print-cover { page-break-after: always; padding-top: 28mm; text-align: left; }
  .print-cover-logo { margin-bottom: 28pt; }
  .print-cover-logo svg { width: 64pt; height: 64pt; }
  .print-cover-eyebrow { color: #2563eb; font-size: 10pt; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; }
  .print-cover-title { margin-top: 8pt; font-size: 30pt; font-weight: 700; line-height: 1.1; }
  .print-cover-subtitle { margin-top: 8pt; font-size: 13pt; color: #475569; }
  .print-cover-meta { margin-top: 28pt; font-size: 10pt; color: #64748b; }

  .print-toc { page-break-after: always; }
  .print-toc h2 { margin-bottom: 12pt; font-size: 14pt; font-weight: 700; }
  .print-toc ol { list-style: decimal; margin: 0; padding-left: 18pt; }
  .print-toc li { padding: 3pt 0; font-size: 11pt; }

  .print-section { page-break-before: always; }
  .print-section:first-of-type { page-break-before: auto; }
  .print-section h1 { margin: 0 0 4pt; font-size: 22pt; font-weight: 700; line-height: 1.15; border-bottom: 1pt solid #cbd5e1; padding-bottom: 6pt; }
  .print-section-type { color: #2563eb; font-size: 9pt; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; }
  .print-section h2 { margin: 18pt 0 6pt; font-size: 13pt; font-weight: 700; }
  .print-section h3 { margin: 14pt 0 4pt; font-size: 11.5pt; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; color: #1e293b; }
  .print-section p { margin: 0 0 6pt; }
  .print-section ul, .print-section ol { margin: 0 0 8pt; padding-left: 18pt; }
  .print-section li { margin: 0 0 3pt; padding-left: 2pt; }
  .print-section ::marker { color: #2563eb; font-weight: 700; }
  .print-section h2, .print-section h3 { page-break-after: avoid; }
  .print-section li, .print-section p { page-break-inside: avoid; }

  .print-figure { margin: 10pt 0; page-break-inside: avoid; max-height: 130mm; }
  .print-figure img { max-width: 100%; max-height: 120mm; border: 1pt solid #cbd5e1; border-radius: 4pt; }
  .print-figure figcaption { margin-top: 4pt; font-size: 9pt; font-style: italic; color: #64748b; }
}

/* === SCREEN (preview before printing) ================================= */
@media screen {
  .print-screen-notice {
    display: flex;
    align-items: flex-start;
    gap: 14px;
    max-width: 800px;
    margin: 32px auto 0;
    padding: 18px 20px;
    background: #fffbeb;
    border: 1px solid #f59e0b;
    border-left: 4px solid #f59e0b;
    border-radius: 6px;
    color: #0f172a;
    font-size: 14px;
    line-height: 1.55;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
  }
  .print-screen-notice-icon {
    flex-shrink: 0;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border-radius: 50%;
    background: #f59e0b;
    color: #ffffff;
    font-weight: 800;
    font-size: 16px;
  }
  .print-screen-notice-title { margin: 0 0 4px; font-weight: 700; font-size: 14.5px; color: #0f172a; }
  .print-screen-notice-body { margin: 0; color: #475569; }
  .print-screen-notice em { background: #f1f5f9; padding: 1px 6px; border-radius: 3px; font-style: normal; font-weight: 600; color: #0f172a; }

  [data-print-root] {
    max-width: 800px;
    margin: 16px auto 32px;
    padding: 48px 56px;
    background: #ffffff;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    color: #0f172a;
    line-height: 1.55;
  }
  [data-print-root] .print-cover-logo { margin-bottom: 24px; }
  [data-print-root] .print-cover-logo svg { width: 64px; height: 64px; }
  [data-print-root] .print-cover-title { font-size: 28px; font-weight: 700; margin-top: 8px; }
  [data-print-root] .print-cover-eyebrow { color: #2563eb; font-size: 11px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; }
  [data-print-root] .print-cover-subtitle { margin-top: 8px; font-size: 14px; color: #475569; }
  [data-print-root] .print-cover-meta { margin-top: 24px; font-size: 12px; color: #64748b; }
  [data-print-root] .print-toc { margin-top: 40px; padding-top: 24px; border-top: 1px solid #e2e8f0; }
  [data-print-root] .print-toc h2 { font-size: 14px; font-weight: 700; margin: 0 0 12px; color: #0f172a; }
  [data-print-root] .print-toc ol { list-style: decimal; padding-left: 22px; margin: 0; color: #475569; }
  [data-print-root] .print-toc li { padding: 4px 0; }
  [data-print-root] .print-section { margin-top: 40px; padding-top: 28px; border-top: 1px solid #e2e8f0; }
  [data-print-root] .print-section-type { color: #2563eb; font-size: 11px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; }
  [data-print-root] .print-section h1 { font-size: 22px; font-weight: 700; margin: 4px 0 12px; color: #0f172a; }
  [data-print-root] .print-section h2 { font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; margin: 20px 0 8px; color: #0f172a; }
  [data-print-root] .print-section p, [data-print-root] .print-section li { color: #475569; font-size: 14px; }
  [data-print-root] .print-section ul, [data-print-root] .print-section ol { padding-left: 22px; margin: 0 0 12px; }
  [data-print-root] .print-section li { padding: 2px 0; }
  [data-print-root] .print-figure { margin: 16px 0; }
  [data-print-root] .print-figure img { max-width: 100%; border-radius: 8px; border: 1px solid #e2e8f0; }
  [data-print-root] .print-figure figcaption { margin-top: 6px; font-size: 12px; font-style: italic; color: #64748b; }
}
```
