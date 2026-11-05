#!/usr/bin/env node
// Push the Supabase Auth email templates in supabase/templates/ to the linked project.
//
//   node scripts/push-auth-templates.mjs
//
// Only touches the subjects/contents listed below (no `supabase config push`, which would
// overwrite the whole remote Auth config with the local defaults). Needs SUPABASE_ACCESS_TOKEN.

import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const REF = readFileSync(join(ROOT, 'supabase/.temp/project-ref'), 'utf8').trim()

function readEnvLocal(name) {
  if (process.env[name]) return process.env[name]
  const file = join(ROOT, '.env.local')
  if (!existsSync(file)) return undefined
  const line = readFileSync(file, 'utf8').split(/\r?\n/).find((l) => l.startsWith(`${name}=`))
  return line?.slice(name.length + 1).trim().replace(/^["']|["']$/g, '')
}

const TOKEN = readEnvLocal('SUPABASE_ACCESS_TOKEN')
if (!TOKEN) throw new Error('SUPABASE_ACCESS_TOKEN not found (env or .env.local)')

const templates = {
  invite: 'Te han invitado a Invoxa',
  recovery: 'Restablece tu contraseña de Invoxa',
}

const body = {}
for (const [name, subject] of Object.entries(templates)) {
  body[`mailer_subjects_${name}`] = subject
  body[`mailer_templates_${name}_content`] = readFileSync(join(ROOT, 'supabase/templates', `${name}.html`), 'utf8')
}

const res = await fetch(`https://api.supabase.com/v1/projects/${REF}/config/auth`, {
  method: 'PATCH',
  headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
})
if (!res.ok) throw new Error(`PATCH config/auth: ${res.status} ${await res.text()}`)
const after = await res.json()
for (const name of Object.keys(templates)) {
  const ok = after[`mailer_templates_${name}_content`] === body[`mailer_templates_${name}_content`]
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${name}: "${after[`mailer_subjects_${name}`]}"`)
}
