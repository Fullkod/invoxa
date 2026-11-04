# Optional — capturing real screenshots with Playwright

Once a module's schema has an `image: { src, alt }` field wired in, the PNGs
need to exist for real. Doing it by hand (walk every screen, crop, save)
works once and rots on the next UI change. A Playwright script that logs in
and walks every route is worth it as soon as the manual has more than a
couple of screenshots.

This is a bulk, unattended capture across many routes in one session — a
different job from the `playwright-cli` skill (which is for one-off
navigate/click/screenshot during interactive testing). Use `playwright-cli`
to explore an unfamiliar screen first if needed; use this script to produce
the final PNG set.

## Pre-requisites

```bash
npm i -D playwright
npx playwright install chromium
npm run dev   # app must be running with real seed data
```

## `scripts/capture-manual-screenshots.mjs`

Only four things change per project (marked `CHANGE:` below): `ROUTES`, the
login selectors, the "find the first real resource" heuristic for any
editor-with-an-id screen, and `BASE_URL`.

```js
#!/usr/bin/env node
/**
 * Captures the manual's screenshots.
 *
 * Usage:
 *   ADMIN_EMAIL=... ADMIN_PASSWORD=... node scripts/capture-manual-screenshots.mjs
 */
import { chromium } from 'playwright'
import { mkdir } from 'node:fs/promises'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const BASE = process.env.BASE_URL || 'http://localhost:3000' // CHANGE: if the app runs elsewhere
const EMAIL = process.env.ADMIN_EMAIL
const PASSWORD = process.env.ADMIN_PASSWORD
const OUT_DIR = resolve(__dirname, '..', 'public', 'manual')

if (!EMAIL || !PASSWORD) {
  console.error('Missing ADMIN_EMAIL and/or ADMIN_PASSWORD env vars')
  process.exit(1)
}

// CHANGE: the route list. `slug` must match the `image.src` filename used in the schema.
const ROUTES = [
  { slug: 'dashboard', path: '/dashboard' },
  { slug: 'settings', path: '/settings' },
  // ...one entry per screen the manual documents
]

async function settle(page, ms = 800) {
  // Short rest + best-effort networkidle. Some pages never reach idle
  // (websockets, polling) — hence the short timeout and catch.
  try {
    await page.waitForLoadState('networkidle', { timeout: 3000 })
  } catch {
    /* keep going */
  }
  await page.waitForTimeout(ms)
}

async function captureRoute(page, slug, path) {
  const url = `${BASE}${path}`
  const file = resolve(OUT_DIR, `${slug}.png`)
  process.stdout.write(`[${slug}] navigating to ${path}... `)
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 })
    await settle(page)
    await page.screenshot({ path: file, fullPage: false })
    console.log(`OK -> ${file}`)
    return { slug, ok: true, file }
  } catch (err) {
    console.log(`FAIL: ${err.message}`)
    return { slug, ok: false, error: err.message }
  }
}

async function captureFirstResource(page, { slug, listPath, linkPrefix, exclude = [] }) {
  // CHANGE: this whole function's selector logic if the resource list isn't
  // a plain <a href="/prefix/<id>"> table/list.
  process.stdout.write(`[${slug}] looking for the first resource... `)
  try {
    await page.goto(`${BASE}${listPath}`, { waitUntil: 'domcontentloaded' })
    await settle(page, 1500)
    const href = await page.evaluate(
      ({ linkPrefix, exclude, listPath }) => {
        const links = Array.from(document.querySelectorAll(`a[href^="${linkPrefix}"]`))
        const match = links.find((a) => {
          const h = a.getAttribute('href') || ''
          return h !== listPath && !exclude.includes(h)
        })
        return match ? match.getAttribute('href') : null
      },
      { linkPrefix, exclude, listPath }
    )
    if (!href) {
      console.log('none found -> capturing the empty list as a fallback')
      const file = resolve(OUT_DIR, `${slug}.png`)
      await page.screenshot({ path: file, fullPage: false })
      return { slug, ok: true, file, note: 'fallback: empty list' }
    }
    console.log(`following ${href}`)
    return await captureRoute(page, slug, href)
  } catch (err) {
    console.log(`FAIL: ${err.message}`)
    return { slug, ok: false, error: err.message }
  }
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true })

  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2, // retina-ish, sharp screenshots
    locale: 'en-US', // CHANGE: 'es-ES' if the UI itself should render in Spanish for the capture
  })
  const page = await context.newPage()

  // --- LOGIN --- CHANGE: selectors for the project's real login form.
  console.log('--- login ---')
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' })
  await page.fill('#login-email', EMAIL)
  await page.fill('#login-password', PASSWORD)
  await Promise.all([
    page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 15000 }),
    page.click('button[type="submit"]'),
  ])
  console.log(`login OK -> ${page.url()}`)

  // --- CAPTURES ---
  const results = []
  for (const route of ROUTES) {
    results.push(await captureRoute(page, route.slug, route.path))
  }
  // Example editor-with-id capture — CHANGE or remove if not needed:
  // results.push(await captureFirstResource(page, {
  //   slug: 'resource-editor', listPath: '/invoices', linkPrefix: '/invoices/',
  //   exclude: ['/invoices/new'],
  // }))

  await browser.close()

  console.log('\n=== summary ===')
  for (const r of results) {
    console.log(`${r.ok ? '✔' : '✘'} ${r.slug}${r.note ? ` (${r.note})` : ''}${r.error ? ` - ${r.error}` : ''}`)
  }
  const failed = results.filter((r) => !r.ok)
  if (failed.length) process.exit(2)
}

main().catch((err) => {
  console.error('fatal error:', err)
  process.exit(1)
})
```

### Design notes

- **One session, all captures.** Log in once, reuse the same `page`.
- **`domcontentloaded` + `settle(800ms)`** is the balance that works best:
  `networkidle` hangs on polling/websocket pages; `load` alone doesn't wait
  for client-side fetches.
- **`fullPage: false`** on purpose — the "above the fold" view a user sees on
  arrival, not an endless scroll dumped into the PDF.
- **Exits `2` if anything failed** — safe to wire into CI so a broken capture
  fails the job instead of silently shipping stale screenshots.
- **No retries** — if a capture flaked on timing, just rerun the script.

### If the manual is bilingual (worker-en / worker-es, etc.)

Two options, in order of how much this actually matters for the project:

1. **UI screenshots are language-agnostic enough to reuse.** Most apps look
   almost identical in ES/EN except for labels — one screenshot set usually
   reads fine either way. Do this unless a reviewer specifically flags it.
2. **Capture two sets.** Duplicate the script (or parametrize `locale` in the
   context + a `LOCALE_SUFFIX` on the output filenames, e.g. `dashboard-en.png`
   vs `dashboard-es.png`) and point each locale's schema `image.src` at its
   own set. Only worth it if the app itself switches language and the
   screenshots would otherwise show the wrong one.

### Extending it

- **More than one shot per module:** add a `beforeShot: async (page) => {...}`
  callback per route that opens a modal / scrolls before the screenshot.
- **Regression checking:** combine with `playwright-test`'s
  `toHaveScreenshot()` to catch UI drift between manual regenerations.
