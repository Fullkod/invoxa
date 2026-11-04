# Auto-Blindaje — known gotchas

Lessons from three real implementations (RosetAI, ROBERSA, control-horario-app).
Each one costs 30min–2h to rediscover from scratch — apply the fix directly if
you hit the same symptom.

## Hydration breaks because `new Date()` runs on both server and client

**Symptom:** React throws "Hydration failed because the server rendered text
didn't match the client." `PrintView` is `'use client'` but Next SSRs it
before hydrating — if it calls `new Date()` internally, it runs once on the
server (UTC) and once on the client (local timezone), producing two
different date strings.

**Fix:** pre-format the date **in the server component** and pass it down as
a plain string. The client never calls `new Date()` during render — see
`generatedDateLabel` in `integration-guide.md`'s `manual/print/page.tsx`.

**Applies to:** any client component rendering a computed date/time. Not
specific to this feature.

## `position: fixed` doesn't repeat per printed page

**Symptom:** a `position: fixed` header (for a logo repeated on every PDF
page) renders **once**, pinned to its physical position in the document —
modern Chrome doesn't repeat fixed elements per page like old browsers did.
It ends up overlapping mid-document content instead.

**Fix:** use `@page` margin boxes (`@top-left`, `@top-right`, `@bottom-left`,
`@bottom-right`) for content that must repeat on every page — see
`print.css` in `ui-components.md`.

**Hard limitation:** `content:` in a margin box only accepts strings,
`counter()`, `attr()` and `string()` — **no `url()`, no inline SVG**. A logo
repeated on every page requires server-side PDF generation (Playwright,
Puppeteer, wkhtmltopdf) — the browser print dialog can't do it.

## `content:` can't hold a locale-dependent string directly

**New in this skill's dual-locale version.** The `@top-right` margin box
needs to say "User manual" or "Manual de usuario" depending on which locale
was picked — but `content:` is pure CSS, evaluated with no access to JS
state.

**Fix:** bridge through an HTML attribute and `content: attr(...)`. `PrintView`
sets `data-doc-type={t.print.coverEyebrow(audience)}` on `[data-print-root]`;
`print.css`'s `@top-right` reads it with `content: attr(data-doc-type)`. See
both files in `ui-components.md`. This is the *only* margin-box technique
that can vary at runtime — text/counters/attrs, never computed via JS.

## The browser injects its own URL + date + title, and CSS can't suppress it

**Symptom:** even with custom `@page` margin boxes, Chrome still prints ITS
OWN header/footer (URL, system date, tab title) on top if "Headers and
footers" is enabled in the print dialog. It visually collides with the app's
real branding.

**Fix:** there's no CSS-side fix. The user has to disable "Headers and
footers" in the print dialog (Chrome remembers this per site). To avoid
relying on the user learning that on their own, `PrintView` shows a
prominent on-screen-only notice (`data-no-print`, hidden in `@media print`)
right above the manual, before the dialog opens — see `print-screen-notice`
in `ui-components.md`.

**Applies to:** any feature relying on the browser's print dialog for PDFs.

## `noopener` doesn't inherit `sessionStorage` — the PDF always came out the same

**Symptom:** the "Download PDF" button stored the current input in
`sessionStorage` and opened the print tab with
`window.open(url, '_blank', 'noopener,noreferrer')`. With audience/locale
toggles, the PDF **always generated the default variant**, never the one
selected. Cause: `noopener` creates an isolated browsing context that does
**not** inherit the opener's `sessionStorage` — `/manual/print` read nothing
and fell back to defaults.

**Fix:** use **`localStorage`** (shared across same-origin tabs, survives
`noopener`) and, as an authoritative backup, pass the selection in the
**URL** too: `?audience=admin&locale=en`. `PrintView` reads both — payload
from `localStorage`, and the query params win if present. See
`ClientDocsGenerator.tsx` / `PrintView.tsx` in `ui-components.md`.

**Applies to:** any flow passing state into a tab opened with `noopener`. If
you keep `noopener` (recommended, for security), never use `sessionStorage`
for that handoff.

## Index keys in editable lists pin local state to the wrong row

**Symptom:** in the form editor, each section card keeps local state (open /
"confirm delete"). With `key={index}` in the `.map`, deleting or reordering
an item leaves that state pinned to the **position** — delete item #3 and
whatever now sits in its slot appears in "confirm delete" mode.

**Fix:** stable **per-item** keys, never index-based. `ListSection` keeps a
parallel array of keys (`item-0`, `item-1`, …), mutated on every
add/remove/move, regenerated only if the array length changes from outside
(e.g. "Reset"). Render with `key={keys[i]}`. See `ListSection.tsx` in
`ui-components.md`.

**Applies to:** any reorderable/deletable list whose rows carry local state.

## Zombie service worker in dev serves stale chunks

**Symptom (only if the project is a PWA with a service worker — e.g.
`$tf-add-mobile` was installed):** after editing a component, the browser kept
showing the old version even though curl/SSR served the new one. A
cache-first SW registered in a previous session assumed hashed, immutable
filenames under `/next/static/*` — true in production builds, **not** in dev
with Turbopack (unhashed chunk URLs → stale JS gets served forever).

**Fix:** in the component that registers the service worker, on the **dev**
branch specifically, unregister and clear caches instead of just returning
early:

```ts
navigator.serviceWorker.getRegistrations()
  .then((regs) => Promise.all(regs.map((r) => r.unregister())))
  .then(() => caches?.keys().then((ks) => Promise.all(ks.map((k) => caches.delete(k)))))
```

One-off manual fix: hard reload (Ctrl+Shift+R) or DevTools → Application →
Service Workers → Unregister.

**Applies to:** any PWA project with a cache-first SW over static assets, in dev.

---

# Validation checklist

Run through this after implementing.

### Core functionality
- [ ] `/manual` loads without a 500
- [ ] The editor shows the default schema data on load
- [ ] Add / delete (with inline confirm) / reorder a list item updates the preview live
- [ ] Deleting an item does NOT leave its neighbor in "confirm delete" mode (stable keys)
- [ ] Section navigation works (click in the right-hand sidebar)
- [ ] The mobile section `<select>` works
- [ ] "Reset" restores the original schema data
- [ ] The Audience toggle (worker/admin) filters preview + both downloads; the worker manual shows no admin-only modules/workflows
- [ ] The Language toggle (es/en) changes every static label AND the schema's own content (module names, FAQs, etc.) stays exactly as authored, untranslated

### Markdown download
- [ ] "Markdown" button downloads `manual-<audience>-<locale>-<app>-<client>.md`
- [ ] The `.md` renders cleanly in any viewer (VS Code, GitHub)
- [ ] Includes cover, every section, generation date in the right locale

### PDF download
- [ ] "Download PDF" opens `/manual/print` in a new tab
- [ ] Switching Audience or Locale before clicking "Download PDF" changes what actually prints — if it always prints the same variant, check the `noopener`/`localStorage` gotcha above
- [ ] `/manual/print` loads with no hydration error
- [ ] The yellow on-screen notice about "Headers and footers" appears
- [ ] The print dialog opens after ~400ms
- [ ] With "Headers and footers" disabled: the PDF is clean, no browser chrome
- [ ] Cover has logo + title + client + date, in the selected language
- [ ] Page 2 is the table of contents
- [ ] Each section starts on a new page
- [ ] Every non-cover page shows: app name top-left, doc type (localized) top-right, URL bottom-left, "X / N" bottom-right

### Integration
- [ ] `/manual` is not linked from any sidebar/nav (unless the project explicitly gated + linked it)
- [ ] If a gate was added: a non-admin hitting `/manual` directly gets redirected

### Types
- [ ] `tsc --noEmit` (or the project's typecheck script) passes
- [ ] The schema satisfies `ClientDocsInput` at compile time
