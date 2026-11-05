// QA PRP-002 Phase 3 — "Acceso para agentes" UI + "Agente" pill, with Playwright.
// Usage: node qa-ui.mjs <outDir>
// The user logs in by hand in the headed window (no credentials in this script).
// The API key is only held in memory and masked in every screenshot.
import { chromium } from 'playwright'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'

const OUT = process.argv[2]
const HERE = new URL('.', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')
const STATE = `${HERE}/state.json`
const BASE = 'http://localhost:5173'
const API = 'https://prabpfidllznbtthmkxz.supabase.co/functions/v1/agent-api'
const KEY_NAME = 'QA Playwright PRP-002'
mkdirSync(`${OUT}/screenshots`, { recursive: true })

const results = []
let n = 0
const record = (name, ok, detail, shot) => {
  results.push({ name, ok, detail, shot })
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name} — ${detail}`)
}

const browser = await chromium.launch({ headless: false })
let context = await browser.newContext({
  viewport: { width: 1280, height: 860 },
  ...(existsSync(STATE) ? { storageState: STATE } : {}),
})
let page = await context.newPage()

const shot = async (name, mask = []) => {
  n += 1
  const f = `screenshots/${String(n).padStart(2, '0')}-${name}.png`
  await page.screenshot({ path: `${OUT}/${f}`, fullPage: true, mask })
  return f
}

// ---- Login (manual) -----------------------------------------------------------
await page.goto(`${BASE}/login`)
console.log('>>> Inicia sesión como roberto@commercecraft.ai en la ventana de Playwright (10 min)')
await page.waitForFunction(
  () =>
    !location.pathname.startsWith('/login') &&
    Object.keys(localStorage).some((k) => k.startsWith('sb-') && k.endsWith('-auth-token')),
  null,
  { timeout: 600_000, polling: 1000 },
)
await context.storageState({ path: STATE })
await page.goto(`${BASE}/app/billing-profile`)

let apiKey = null
let taskId = null
const api = async (method, path, body) => {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
  return { status: res.status, json: await res.json().catch(() => null) }
}

try {
  // 1. Section visible
  const card = page.getByText('Acceso para agentes').first()
  await card.waitFor({ timeout: 15_000 })
  await card.scrollIntoViewIfNeeded()
  record('section', true, 'Sección "Acceso para agentes" en Datos de facturación', await shot('section'))

  // 2. Create key
  await page.getByRole('button', { name: 'Crear key' }).click()
  await page.getByLabel('Nombre de la key').fill(KEY_NAME)
  await page.getByRole('button', { name: 'Crear', exact: true }).click()
  const keyBox = page.getByTestId('new-api-key')
  await keyBox.waitFor({ timeout: 15_000 })
  apiKey = (await keyBox.innerText()).trim()
  record('create', /^ivx_[A-Za-z0-9_-]{43}$/.test(apiKey), `Key mostrada una vez (ivx_ + 43 chars)`, await shot('created', [keyBox]))

  // 3. Copy button
  await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: BASE })
  await page.getByRole('button', { name: 'Copiar' }).click()
  const copied = await page
    .getByRole('button', { name: 'Copiada' })
    .waitFor({ timeout: 5_000 })
    .then(() => true)
    .catch(() => false)
  const clip = await page.evaluate(() => navigator.clipboard.readText()).catch(() => '')
  record('copy', copied && clip === apiKey, 'Botón Copiar copia la key al portapapeles', null)

  // 4. Key works against the API; task via API shows the "Agente" pill
  const me = await api('GET', '/')
  record('api-auth', me.status === 200 && me.json?.me?.email === 'roberto@commercecraft.ai', `GET / → ${me.status}`, null)
  const created = await api('POST', '/tasks', {
    project: 'Microscope',
    task_date: new Date().toISOString().slice(0, 10),
    hours: 0.25,
    name: 'QA PRP-002 UI: tarea registrada por agente',
  })
  taskId = created.json?.task?.id ?? null
  record('api-create', created.status === 201 && taskId !== null, `POST /tasks → ${created.status}`, null)

  await page.goto(`${BASE}/app/tasks`)
  const row = page.locator('li').filter({ hasText: 'QA PRP-002 UI: tarea registrada por agente' })
  await row.first().waitFor({ timeout: 15_000 })
  const pill = await row.first().getByText('Agente', { exact: true }).isVisible()
  record('agent-pill', pill, 'La tarea creada por API muestra la marca "Agente" en /app/tasks', await shot('tasks-agent-pill'))

  // 5. List shows prefix + last use; reload hides the plain key
  await page.goto(`${BASE}/app/billing-profile`)
  const keyRow = page.locator('li').filter({ hasText: KEY_NAME })
  await keyRow.first().waitFor({ timeout: 15_000 })
  await keyRow.first().getByText(/último uso/).waitFor({ timeout: 10_000 }).catch(() => null)
  const rowText = (await keyRow.first().innerText()).replace(/\s+/g, ' ')
  const plainGone = !(await page.locator('body').innerText()).includes(apiKey)
  record(
    'list',
    rowText.includes(`ivx_${apiKey.slice(4, 12)}`) && rowText.includes('último uso') && plainGone,
    'Lista con prefijo y último uso; la key completa ya no aparece',
    await shot('list'),
  )

  // 6. Mobile: no horizontal scroll
  await page.setViewportSize({ width: 390, height: 844 })
  await page.reload()
  await page.getByText('Acceso para agentes').first().scrollIntoViewIfNeeded()
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  record('mobile', overflow <= 0, `Móvil 390px, desbordamiento horizontal = ${overflow}px`, await shot('mobile'))
  await page.setViewportSize({ width: 1280, height: 860 })
  await page.reload()

  // 7. Delete the API task, then revoke from the UI
  if (taskId) {
    const del = await api('DELETE', `/tasks/${taskId}`)
    record('api-delete', del.status === 200, `DELETE /tasks/:id → ${del.status}`, null)
    if (del.status === 200) taskId = null
  }
  const revokeRow = page.locator('li').filter({ hasText: KEY_NAME }).first()
  await revokeRow.getByRole('button', { name: 'Revocar' }).click()
  await revokeRow.getByRole('button', { name: 'Sí, revocar' }).click()
  await page.getByText(/1 key revocada/).waitFor({ timeout: 15_000 })
  const after = await api('GET', '/')
  record('revoke', after.status === 401, `Revocada desde la UI; GET / → ${after.status}`, await shot('revoked'))
} catch (err) {
  record('error', false, err instanceof Error ? err.message.split('\n')[0] : String(err), await shot('error'))
} finally {
  if (taskId && apiKey) await api('DELETE', `/tasks/${taskId}`).catch(() => null)
  apiKey = null
  writeFileSync(`${OUT}/results.json`, JSON.stringify(results, null, 2))
  await browser.close()
}
