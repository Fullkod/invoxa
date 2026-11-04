// QA PRP-001 Phase 5 — Edge Functions with a real super admin session.
// Operating in "QA Temporal" every call that targets Informage must fail;
// back in Informage the invoice PDF must regenerate with Informage as recipient.
import { chromium } from 'playwright'
import { mkdirSync, writeFileSync } from 'node:fs'

const dir = new URL('.', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')
const OUT = process.argv[2]
const SUPA = process.argv[3]
mkdirSync(`${OUT}/screenshots`, { recursive: true })
const BASE = 'http://localhost:5173'
const INF_INVOICE = '4876f0d7-031f-4039-8e05-cf752341d7dc'
const INF_USER = 'e0b535ee-d812-4b92-ab37-014169f71487'
const results = []
let n = 0

const browser = await chromium.launch()
const context = await browser.newContext({ storageState: `${dir}/state.json`, viewport: { width: 1280, height: 860 } })
const page = await context.newPage()

const shot = async (name) => {
  n += 1
  const f = `screenshots/${String(n).padStart(2, '0')}-${name}.png`
  await page.screenshot({ path: `${OUT}/${f}`, fullPage: true })
  return f
}
const record = (name, ok, detail, shotFile) => results.push({ name, ok, detail, shot: shotFile })

async function enter(companyName) {
  await page.goto(`${BASE}/super/companies`)
  const row = page.locator('li').filter({ hasText: companyName })
  await row.getByRole('button', { name: 'Entrar' }).click()
  await page.waitForURL('**/admin/dashboard', { timeout: 15_000 })
  await page.getByText(`· ${companyName}`).first().waitFor({ timeout: 10_000 })
}

// Calls an Edge Function from inside the page with the logged-in session.
async function call(fn, body) {
  return page.evaluate(
    async ({ supa, fn, body }) => {
      const key = Object.keys(localStorage).find((k) => k.startsWith('sb-') && k.endsWith('-auth-token'))
      const token = JSON.parse(localStorage.getItem(key)).access_token
      const res = await fetch(`${supa}/functions/v1/${fn}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      return { status: res.status, body: (await res.text()).slice(0, 160) }
    },
    { supa: SUPA, fn, body },
  )
}

// ---- Operating in QA Temporal -------------------------------------------------
await enter('QA Temporal')
{
  const body = (await page.locator('body').innerText()).replace(/\s+/g, ' ')
  record('qa-dashboard', body.includes('QA Temporal'), 'Dashboard de QA Temporal', await shot('qa-dashboard'))
}
await page.goto(`${BASE}/admin/users`)
await page.waitForLoadState('networkidle')
{
  const body = await page.locator('body').innerText()
  const leaks = ['alucard.test.92', 'robert.cabrer92', 'felipe.piquer'].filter((e) => body.includes(e))
  record('qa-users-empty', leaks.length === 0, leaks.length ? `Se ven usuarios de Informage: ${leaks}` : 'Ningún usuario de Informage', await shot('qa-users'))
}
await page.goto(`${BASE}/admin/invoices`)
await page.waitForLoadState('networkidle')
{
  const body = await page.locator('body').innerText()
  record('qa-invoices-empty', !body.includes('INF-ALUCARD'), body.includes('INF-ALUCARD') ? 'Se ven facturas de Informage' : 'Ninguna factura de Informage', await shot('qa-invoices'))
}

const blocked = [
  ['generate-invoice-pdf', { invoice_id: INF_INVOICE }, [403]],
  ['generate-tasks-report-pdf', { user_id: INF_USER, period_start: '2026-01-01', period_end: '2026-01-31' }, [403]],
  ['generate-invoice', { user_id: INF_USER, period_start: '2026-01-01', period_end: '2026-01-31' }, [403]],
  ['request-invoice', { user_id: INF_USER, period_start: '2026-01-01', period_end: '2026-01-31' }, [404]],
  ['change-invoice-number', { invoice_id: INF_INVOICE, new_invoice_number: 'HACK-0001' }, [404]],
  ['delete-user', { id: INF_USER }, [404]],
]
for (const [fn, body, expected] of blocked) {
  const r = await call(fn, body)
  record(`qa-blocks-${fn}`, expected.includes(r.status), `${r.status} ${r.body}`, null)
}
{
  const r = await call('request-invoices-bulk', { period_start: '2026-01-01', period_end: '2026-01-31' })
  let created = -1
  try { created = JSON.parse(r.body).summary.created } catch { /* keep -1 */ }
  record('qa-bulk-only-own-company', r.status === 200 && created === 0, `${r.status} ${r.body}`, null)
}

// ---- Back in Informage ----------------------------------------------------------
await enter('Informage Studios')
{
  const r = await call('generate-invoice-pdf', { invoice_id: INF_INVOICE })
  record('informage-pdf-regenerates', r.status === 200, `${r.status} ${r.body}`, await shot('informage-dashboard'))
}

await browser.close()
writeFileSync(`${OUT}/results.json`, JSON.stringify(results, null, 2))
for (const r of results) console.log(`${r.ok ? 'PASS' : 'FAIL'} ${r.name} — ${r.detail}`)
