// QA PRP-001 Phase 4 — super admin flow. Read-only except "Entrar" (sets the
// super admin's active company to Informage). Screenshots go to OUT.
import { chromium } from 'playwright'
import { mkdirSync, writeFileSync } from 'node:fs'

const dir = new URL('.', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')
const OUT = process.argv[2]
mkdirSync(`${OUT}/screenshots`, { recursive: true })
const BASE = 'http://localhost:5173'
const results = []
const consoleErrors = []
let n = 0

const browser = await chromium.launch()
const context = await browser.newContext({
  storageState: `${dir}/state.json`,
  viewport: { width: 1280, height: 860 },
})
const page = await context.newPage()
page.on('console', (m) => {
  if (m.type() === 'error') consoleErrors.push(`${page.url()} :: ${m.text()}`)
})
page.on('pageerror', (e) => consoleErrors.push(`${page.url()} :: ${e.message}`))

async function shot(name) {
  n += 1
  const file = `screenshots/${String(n).padStart(2, '0')}-${name}.png`
  await page.screenshot({ path: `${OUT}/${file}`, fullPage: true })
  return file
}
async function check(name, fn) {
  try {
    const detail = await fn()
    results.push({ name, ok: true, detail, shot: await shot(name) })
  } catch (e) {
    results.push({ name, ok: false, detail: String(e.message ?? e).split('\n')[0], shot: await shot(name) })
  }
}
const text = async (sel = 'body') => (await page.locator(sel).innerText()).replace(/\s+/g, ' ')
const expectText = async (t) => {
  // Pages render a hidden mobile list next to the desktop table: only visible matches count.
  await page.getByText(t, { exact: false }).filter({ visible: true }).first().waitFor({ timeout: 10_000 })
}

await check('companies-list', async () => {
  await page.goto(`${BASE}/super/companies`)
  await expectText('Informage Studios')
  await expectText('prefijo INF')
  const nav = await text('aside')
  if (!nav.includes('Empresas')) throw new Error('Sidebar sin "Empresas"')
  return 'Lista con Informage (prefijo INF); sidebar con Empresas'
})

await check('company-detail', async () => {
  await page.getByText('Informage Studios S.L.U.').first().click()
  await page.waitForURL(/\/super\/companies\/[0-9a-f-]+$/)
  await expectText('Datos de la empresa')
  const v = await page.locator('input[name="tax_id"]').inputValue()
  const prefixDisabled = await page.locator('input[name="invoice_prefix"]').isDisabled()
  if (v !== 'B-97776744') throw new Error(`NIF inesperado: ${v}`)
  if (!prefixDisabled) throw new Error('El prefijo debería estar bloqueado')
  return `NIF ${v}; prefijo bloqueado`
})

await check('new-company-validation', async () => {
  await page.goto(`${BASE}/super/companies/new`)
  await page.getByRole('button', { name: /Crear empresa/ }).click()
  await expectText('Mínimo 2 caracteres')
  await page.locator('input[name="invoice_prefix"]').fill('in-f')
  await page.getByRole('button', { name: /Crear empresa/ }).click()
  await expectText('De 1 a 8 mayúsculas o números')
  return 'Formulario vacío y prefijo inválido muestran errores (no se envía nada)'
})

await check('enter-company', async () => {
  await page.goto(`${BASE}/super/companies`)
  await page.getByRole('button', { name: 'Entrar' }).first().click()
  await page.waitForURL('**/admin/dashboard', { timeout: 15_000 })
  await expectText('· Informage Studios')
  const nav = await text('aside')
  for (const item of ['Empresas', 'Usuarios', 'Proyectos', 'Facturas']) {
    if (!nav.includes(item)) throw new Error(`Sidebar sin "${item}"`)
  }
  if (!nav.includes('Super admin')) throw new Error('Tarjeta sin rol "Super admin"')
  return 'Dashboard de Informage; sidebar con Empresas + secciones de admin'
})

await check('admin-users', async () => {
  await page.goto(`${BASE}/admin/users`)
  await expectText('alucard.test.92@gmail.com')
  const body = await text()
  if (body.includes('invoxa@fullkod.com')) throw new Error('El super admin aparece en la lista de usuarios')
  return 'Usuarios de Informage visibles; el super admin no aparece'
})

await check('admin-projects', async () => {
  await page.goto(`${BASE}/admin/projects`)
  await expectText('Gestiona los proyectos de Informage Studios')
  await page.locator('table tbody tr').first().waitFor({ timeout: 10_000 })
  const rows = await page.locator('table tbody tr').count()
  if (rows < 1) throw new Error('Sin proyectos')
  return `${rows} proyectos`
})

await check('admin-invoices', async () => {
  await page.goto(`${BASE}/admin/invoices`)
  await expectText('INF-ALUCARD-2026-0001')
  return 'Facturas de Informage visibles'
})

await check('mobile-companies', async () => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto(`${BASE}/super/companies`)
  await expectText('Informage Studios')
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth + 1,
  )
  if (overflow) throw new Error('Scroll horizontal en móvil')
  return 'Móvil 390px sin scroll horizontal'
})

await browser.close()
writeFileSync(`${OUT}/results.json`, JSON.stringify({ results, consoleErrors }, null, 2))
for (const r of results) console.log(`${r.ok ? 'PASS' : 'FAIL'} ${r.name} — ${r.detail}`)
console.log(`CONSOLE_ERRORS ${consoleErrors.length}`)
for (const e of consoleErrors.slice(0, 10)) console.log('  ' + e)
