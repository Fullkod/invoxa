// QA PRP-003 — supervision end-to-end with Playwright, against production Supabase.
// Usage: node ui.mjs <outDir> <qa-users.json>
// Throwaway company/users come from setup.mjs (scratchpad); passwords never leave that file
// and password inputs are masked in screenshots.
import { chromium } from 'playwright'
import fs from 'node:fs'

const [OUT, USERS] = process.argv.slice(2)
const S = JSON.parse(fs.readFileSync(USERS, 'utf8'))
const BASE = 'http://localhost:5180'
const ANON = fs
  .readFileSync('C:/Local-Disc-D/Project/Fullkod/invoxa/.env.local', 'utf8')
  .match(/^VITE_SUPABASE_ANON_KEY=(.+)$/m)[1]
  .trim()
  .replace(/"/g, '')
fs.mkdirSync(`${OUT}/screenshots`, { recursive: true })
const results = []
let n = 0
const record = (name, ok, detail = '', shot = null) => {
  results.push({ name, ok, detail, shot })
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ' — ' + detail : ''}`)
}
const browser = await chromium.launch({ headless: true })

async function as(who, fn, viewport = { width: 1280, height: 860 }) {
  const ctx = await browser.newContext({ viewport, acceptDownloads: true })
  const page = await ctx.newPage()
  const shot = async (name) => {
    n += 1
    const f = `screenshots/${String(n).padStart(2, '0')}-${name}.png`
    await page.screenshot({ path: `${OUT}/${f}`, fullPage: true, mask: [page.locator('input[type=password]')] })
    return f
  }
  await page.goto(`${BASE}/login`)
  await page.locator('input[type=email]').fill(S.users[who].email)
  await page.locator('input[name=password]').fill(S.users[who].password)
  await page.locator('button[type=submit]').click()
  await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 30000 })
  try {
    await fn(page, shot)
  } catch (e) {
    record(`${who}: unexpected error`, false, String(e).slice(0, 400), await shot(`${who}-error`))
  }
  await ctx.close()
}

// Direct REST probe with the signed-in user's JWT (what a curious user could do)
const restAs = (page, path) =>
  page.evaluate(
    async ([url, anon, path]) => {
      const k = Object.keys(localStorage).find((x) => x.startsWith('sb-') && x.endsWith('-auth-token'))
      const t = JSON.parse(localStorage.getItem(k)).access_token
      const r = await fetch(`${url}/rest/v1/${path}`, { headers: { apikey: anon, Authorization: `Bearer ${t}` } })
      return { status: r.status, body: await r.json() }
    },
    [S.url, ANON, path],
  )

// 1. Admin assigns the supervisor and turns on approval
await as('adm', async (page, shot) => {
  await page.goto(`${BASE}/admin/projects/${S.project}/members`)
  await page.getByText('Responsables', { exact: true }).waitFor()
  await page.getByLabel('Responsable').selectOption({ label: 'QA Responsable' })
  await page.getByRole('button', { name: 'QA Colaboradora Uno' }).click()
  await page.getByRole('button', { name: 'Asignar', exact: true }).click()
  await page.getByRole('button', { name: /Quitar a QA Colaboradora Uno/ }).waitFor()
  record('Admin asigna responsable → tutelada', true, '', await shot('admin-supervisors'))

  await page.goto(`${BASE}/admin/projects/${S.project}`)
  const box = page.getByRole('checkbox', { name: /Exigir aprobación/ })
  await box.check()
  await page.getByRole('button', { name: 'Guardar cambios' }).click()
  await page.waitForTimeout(1500)
  await page.reload()
  await box.waitFor()
  record('Admin activa "Exigir aprobación"', await box.isChecked(), '', await shot('admin-requires-approval'))
})

// 2. Member logs hours
await as('m1', async (page, shot) => {
  await page.goto(`${BASE}/app/tasks/new`)
  await page.getByLabel('Proyecto').selectOption({ label: 'QA Proyecto' })
  await page.getByLabel('Nombre de la tarea').fill('Tarea QA de M1')
  await page.getByLabel('Fecha').fill('2026-11-05')
  await page.getByLabel('Horas').fill('6')
  await page.getByRole('button', { name: 'Guardar tarea' }).click()
  await page.waitForURL(/\/app\/tasks$/)
  await page.getByText('Pendiente de revisión').first().waitFor({ timeout: 15000 })
  record('Colaboradora registra 6 h → "Pendiente de revisión"', true, '', await shot('member-task-pending'))
})

// 3. Supervisor reviews: sees only supervised work, never money
await as('sup', async (page, shot) => {
  await page.getByRole('link', { name: 'Revisión de horas' }).first().waitFor({ timeout: 15000 })
  record('Responsable ve "Revisión de horas" en el menú', true)

  const rpcBodies = []
  page.on('response', async (r) => {
    if (r.url().includes('/rpc/list_review_tasks')) rpcBodies.push(await r.text().catch(() => ''))
  })
  await page.goto(`${BASE}/app/review`)
  await page.getByText('Tarea QA de M1').waitFor()
  const seesM2 = await page.getByText('Tarea de M2 (no supervisada)').count()
  record('Bandeja: ve la tarea de su tutelada y no la de M2', seesM2 === 0, `M2 visibles: ${seesM2}`, await shot('supervisor-inbox'))
  const money = rpcBodies.join('').match(/rate|total|currency|EUR|"42/gi)
  const pageMoney = (await page.locator('main').innerText()).match(/€|EUR|\b42\b/g)
  record('Sin importes en la respuesta RPC ni en la página', !money && !pageMoney, `rpc: ${money ?? 'none'} · page: ${pageMoney ?? 'none'}`)

  for (const table of ['tasks', 'compensation_settings', 'invoices', 'invoice_items', 'user_billing_profiles']) {
    const r = await restAs(page, `${table}?select=*`)
    record(
      `REST directo como responsable: ${table} vacío`,
      r.status === 200 && Array.isArray(r.body) && r.body.length === 0,
      `status ${r.status}, filas ${Array.isArray(r.body) ? r.body.length : '?'}`,
    )
  }
  const prof = await restAs(page, 'profiles?select=id')
  record('REST directo: profiles = solo el propio', Array.isArray(prof.body) && prof.body.length === 1, `filas ${prof.body.length}`)

  await page.getByRole('button', { name: 'Proponer otras horas' }).click()
  await page.getByLabel('Horas propuestas').fill('4')
  await page.getByLabel(/Comentario/).fill('La reunión de planificación no se factura')
  await page.getByRole('button', { name: 'Enviar propuesta' }).click()
  await page.getByText('Tarea QA de M1').waitFor({ state: 'detached', timeout: 15000 })
  await page.getByRole('button', { name: 'Propuestas' }).click()
  await page.getByText(/Propuesta:\s*4 h/).waitFor({ timeout: 15000 })
  record('Responsable propone 4 h con comentario', true, '', await shot('supervisor-proposed'))

  await page.goto(`${BASE}/app/notifications`)
  await page.getByText('Horas por revisar').first().waitFor({ timeout: 15000 })
  record('Responsable recibió "Horas por revisar"', true, '', await shot('supervisor-notifications'))
})

// 4. Member accepts, logs another task, and is blocked from closing the month
await as('m1', async (page, shot) => {
  await page.goto(`${BASE}/app/notifications`)
  await page.getByText('Te proponen otras horas').first().waitFor({ timeout: 15000 })
  record('Colaboradora recibió "Te proponen otras horas"', true, '', await shot('member-notification'))

  await page.goto(`${BASE}/app/tasks`)
  await page.getByText('Tarea QA de M1').click()
  await page.getByText(/Te proponen\s*4 h/).waitFor()
  await shot('member-proposal')
  await page.getByRole('button', { name: 'Aceptar 4 h' }).click()
  await page.getByText('Aprobada', { exact: true }).first().waitFor({ timeout: 15000 })
  await page.waitForTimeout(1000)
  const hours = await page.getByLabel('Horas').inputValue()
  record('Colaboradora acepta → 4 h y "Aprobada"', Number(hours) === 4, `horas en el formulario: ${hours}`, await shot('member-accepted'))

  await page.goto(`${BASE}/app/tasks/new`)
  await page.getByLabel('Proyecto').selectOption({ label: 'QA Proyecto' })
  await page.getByLabel('Nombre de la tarea').fill('Tarea QA pendiente')
  await page.getByLabel('Fecha').fill('2026-11-05')
  await page.getByLabel('Horas').fill('2')
  await page.getByRole('button', { name: 'Guardar tarea' }).click()
  await page.waitForURL(/\/app\/tasks$/)

  await page.goto(`${BASE}/app/invoices/new`)
  await page.getByText(/1 tarea sin aprobar en QA Proyecto/).waitFor({ timeout: 20000 })
  const disabled = await page.getByRole('button', { name: 'Generar factura' }).isDisabled()
  record('Cierre de mes bloqueado con 1 tarea sin aprobar', disabled, `botón deshabilitado: ${disabled}`, await shot('member-invoice-blocked'))
})

// 5. Admin approves the pending task from the admin inbox
await as('adm', async (page, shot) => {
  await page.goto(`${BASE}/admin/review`)
  const card = page.locator('li', { has: page.getByText('Tarea QA pendiente', { exact: true }) }).last()
  await card.waitFor({ timeout: 15000 })
  await shot('admin-inbox')
  await card.getByRole('button', { name: 'Aprobar', exact: true }).click()
  await page.getByText('Tarea QA pendiente').waitFor({ state: 'detached', timeout: 15000 })
  record('Admin aprueba desde /admin/review (sale de "Por revisar")', true, '', await shot('admin-approved'))
})

// 6. Member closes the month (4 + 2 = 6 h) and downloads the skill
await as('m1', async (page, shot) => {
  await page.goto(`${BASE}/app/invoices/new`)
  const btn = page.getByRole('button', { name: 'Generar factura' })
  await page.waitForTimeout(2500)
  await shot('member-invoice-ready')
  await btn.click()
  await page.waitForURL(/\/app\/invoices\/[0-9a-f-]{36}$/, { timeout: 30000 })
  await page.waitForTimeout(2500)
  const text = await page.locator('main').innerText()
  const invId = page.url().split('/').pop()
  const items = await restAs(page, `invoice_items?select=quantity&invoice_id=eq.${invId}`)
  const qty = items.body.reduce((s, i) => s + Number(i.quantity), 0)
  record('Factura generada con las horas aprobadas (4 + 2 = 6 h)', qty === 6, `${text.match(/QAS-[A-Z0-9-]+/)?.[0] ?? ''} · ${qty} h`, await shot('member-invoice'))

  await page.goto(`${BASE}/app/billing-profile`)
  const dl = page.getByRole('button', { name: 'Descargar SKILL.md' })
  await dl.scrollIntoViewIfNeeded()
  const [download] = await Promise.all([page.waitForEvent('download'), dl.click()])
  const content = fs.readFileSync(await download.path(), 'utf8')
  record(
    'Descarga del skill: SKILL.md con el skill invoxa',
    download.suggestedFilename() === 'SKILL.md' && content.includes('name: invoxa') && content.includes('Revisión de horas'),
    `${download.suggestedFilename()} · ${content.length} caracteres`,
    await shot('member-skill-download'),
  )
})

// 7. Mobile
await as(
  'sup',
  async (page, shot) => {
    await page.goto(`${BASE}/app/review`)
    await page.getByRole('button', { name: 'Todas' }).click()
    await page.getByText('Tarea QA de M1').waitFor()
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
    record('Móvil 390 px sin scroll horizontal', overflow <= 0, `overflow ${overflow}px`, await shot('mobile-review'))
  },
  { width: 390, height: 844 },
)

await browser.close()
fs.writeFileSync(`${OUT}/results.json`, JSON.stringify(results, null, 2))
console.log(`\n${results.filter((r) => r.ok).length}/${results.length} passed`)
