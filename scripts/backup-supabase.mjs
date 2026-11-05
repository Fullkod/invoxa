#!/usr/bin/env node
// Full off-site backup of the Invoxa Supabase project (database + Storage files).
//
//   node scripts/backup-supabase.mjs [output-dir]
//
// Default output: C:\Local-Disc-D\Backups\invoxa\<timestamp>\ (OUTSIDE the repo: it holds
// personal data, bank details and password hashes; never commit it).
//
// Needs: SUPABASE_ACCESS_TOKEN (env or .env.local), Supabase CLI linked to the project, Docker running.
// Secrets fetched at runtime (service role key) are used in memory only and never written to disk.
//
// Produces:
//   roles.sql / schema.sql / data.sql  -> `supabase db dump` (data includes auth.users)
//   storage/<bucket>/<path>             -> every Storage object
//   storage-buckets.json                -> bucket config
//   counts.json                         -> row counts per table + object counts (to verify restores/transfers)

import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const REF = readFileSync(join(ROOT, 'supabase/.temp/project-ref'), 'utf8').trim()
const API = 'https://api.supabase.com/v1'

function readEnvLocal(name) {
  if (process.env[name]) return process.env[name]
  const file = join(ROOT, '.env.local')
  if (!existsSync(file)) return undefined
  const line = readFileSync(file, 'utf8').split(/\r?\n/).find((l) => l.startsWith(`${name}=`))
  return line?.slice(name.length + 1).trim().replace(/^["']|["']$/g, '')
}

const TOKEN = readEnvLocal('SUPABASE_ACCESS_TOKEN')
if (!TOKEN) throw new Error('SUPABASE_ACCESS_TOKEN not found (env or .env.local)')

const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
const OUT = resolve(process.argv[2] ?? resolve(ROOT, '../../../Backups/invoxa'), stamp)
mkdirSync(OUT, { recursive: true })
console.log(`Backup of ${REF} -> ${OUT}`)

async function api(path, init = {}) {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json', ...init.headers },
  })
  if (!res.ok) throw new Error(`${path}: ${res.status} ${await res.text()}`)
  return res.json()
}

// 1. Database dumps via Supabase CLI (temporary login role, no DB password needed)
const dumps = [
  ['roles.sql', ['--role-only']],
  ['schema.sql', []],
  ['data.sql', ['--data-only', '--use-copy']],
]
for (const [file, flags] of dumps) {
  console.log(`- db dump ${file}`)
  // Single command string: the scoop/npm shim needs a shell on Windows, and Node deprecates args + shell.
  const cmd = ['supabase', 'db', 'dump', '--linked', '-f', `"${join(OUT, file)}"`, ...flags].join(' ')
  const r = spawnSync(cmd, {
    cwd: ROOT,
    stdio: 'inherit',
    shell: true,
    env: { ...process.env, SUPABASE_ACCESS_TOKEN: TOKEN },
  })
  if (r.status !== 0) throw new Error(`supabase db dump ${file} failed (${r.status})`)
}

// 2. Row counts (reference to verify the backup and the project after the transfer)
const countSql = `
  select 'auth.users' as t, count(*)::int as n from auth.users
  union all select 'storage.objects', count(*)::int from storage.objects
  union all select table_schema || '.' || table_name,
    (xpath('/row/c/text()', query_to_xml(format('select count(*) as c from %I.%I', table_schema, table_name), false, true, '')))[1]::text::int
  from information_schema.tables where table_schema = 'public' and table_type = 'BASE TABLE'
  order by 1`
const counts = await api(`/projects/${REF}/database/query`, {
  method: 'POST',
  body: JSON.stringify({ query: countSql }),
})

// 3. Storage objects (service role key fetched at runtime, kept in memory)
const keys = await api(`/projects/${REF}/api-keys?reveal=true`)
const serviceKey = (keys.find((k) => k.name === 'service_role') ?? keys.find((k) => k.type === 'secret'))?.api_key
if (!serviceKey) throw new Error('Service role key not available for this token')
const supabase = createClient(`https://${REF}.supabase.co`, serviceKey, { auth: { persistSession: false } })

const { data: buckets, error: bErr } = await supabase.storage.listBuckets()
if (bErr) throw bErr
writeFileSync(join(OUT, 'storage-buckets.json'), JSON.stringify(buckets, null, 2))

async function listAll(bucket, prefix = '') {
  const files = []
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await supabase.storage.from(bucket).list(prefix, { limit: 1000, offset })
    if (error) throw error
    for (const item of data) {
      const path = prefix ? `${prefix}/${item.name}` : item.name
      if (item.id === null) files.push(...(await listAll(bucket, path)))
      else files.push(path)
    }
    if (data.length < 1000) return files
  }
}

const storageSummary = {}
for (const b of buckets) {
  const files = await listAll(b.name)
  let bytes = 0
  for (const path of files) {
    const { data, error } = await supabase.storage.from(b.name).download(path)
    if (error) throw new Error(`${b.name}/${path}: ${error.message}`)
    const buf = Buffer.from(await data.arrayBuffer())
    const dest = join(OUT, 'storage', b.name, ...path.split('/'))
    mkdirSync(dirname(dest), { recursive: true })
    writeFileSync(dest, buf)
    bytes += buf.length
  }
  storageSummary[b.name] = { files: files.length, bytes }
  console.log(`- storage ${b.name}: ${files.length} files, ${bytes} bytes`)
}

writeFileSync(
  join(OUT, 'counts.json'),
  JSON.stringify({ project: REF, takenAt: new Date().toISOString(), tables: counts, storage: storageSummary }, null, 2),
)
console.log('Done. counts.json:', join(OUT, 'counts.json'))
