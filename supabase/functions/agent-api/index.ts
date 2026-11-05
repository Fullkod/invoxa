// =============================================================================
// agent-api — Edge Function (PRP-002, Phase 2, INV0010)
// =============================================================================
// REST API for agents (Claude Code, Codex, n8n, scripts) acting as ONE
// collaborator, authenticated with a personal key: "Authorization: Bearer ivx_…".
// Deployed with verify_jwt = false: the key is validated here (_shared/apiKey.ts).
//
// The service role bypasses RLS, so EVERY query below is filtered by the key
// owner's user_id. user_id / company_id are never read from the request.
// Billed tasks (invoice_id not null) cannot be edited or deleted.
// =============================================================================

import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'
import { z } from 'https://esm.sh/zod@3.23.8'
import { authenticateApiKey, readApiKey, type ApiKeyOwner } from '../_shared/apiKey.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-api-key, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' },
  })
}

class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public extra: Record<string, unknown> = {},
  ) {
    super(message)
  }
}

// ---------------------------------------------------------------------------
// Validation (same rules as src/features/user/tasks/taskSchema.ts)
// ---------------------------------------------------------------------------

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

const isoDate = z
  .string()
  .regex(DATE_RE, 'Fecha con formato YYYY-MM-DD')
  .refine((v) => !Number.isNaN(Date.parse(`${v}T00:00:00Z`)), 'Fecha inválida')

// Accepts 2.5, "2.5" or "2,5".
const hours = z.preprocess(
  (v) => (typeof v === 'string' ? Number(v.trim().replace(',', '.')) : v),
  z
    .number({ invalid_type_error: 'Horas numéricas' })
    .min(0.25, 'Mínimo 0.25 horas (15 min)')
    .max(24, 'Máximo 24 horas en un día'),
)

const optionalLongText = z
  .string()
  .trim()
  .max(1000, 'Máximo 1000 caracteres')
  .nullable()
  .optional()
  .transform((v) => (v === undefined ? undefined : v ? v : null))

const CreateTaskSchema = z
  .object({
    project: z.string().trim().min(1, 'Indica el proyecto (nombre o id)'),
    task_date: isoDate.optional(),
    hours,
    name: z.string().trim().min(2, 'Mínimo 2 caracteres').max(200, 'Máximo 200 caracteres'),
    description: optionalLongText,
    observations: optionalLongText,
  })
  .strict()

const UpdateTaskSchema = z
  .object({
    project: z.string().trim().min(1).optional(),
    task_date: isoDate.optional(),
    hours: hours.optional(),
    name: z.string().trim().min(2).max(200).optional(),
    description: optionalLongText,
    observations: optionalLongText,
  })
  .strict()
  .refine((v) => Object.values(v).some((x) => x !== undefined), 'Nada que actualizar')

const TasksQuerySchema = z.object({
  from: isoDate.optional(),
  to: isoDate.optional(),
  project: z.string().trim().min(1).optional(),
  billed: z.enum(['true', 'false']).optional(),
  limit: z.coerce.number().int().min(1).max(500).default(100),
})

const MonthSchema = z
  .string()
  .regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Mes con formato YYYY-MM')

const InvoicesQuerySchema = z.object({
  year: z.coerce.number().int().min(2000).max(2100).optional(),
})

function parse<T extends z.ZodTypeAny>(schema: T, value: unknown): z.infer<T> {
  const result = schema.safeParse(value)
  if (!result.success) {
    throw new ApiError(400, 'Datos inválidos', {
      details: result.error.issues.map((i) => ({ field: i.path.join('.') || null, message: i.message })),
    })
  }
  return result.data
}

async function readJson(req: Request): Promise<unknown> {
  try {
    return await req.json()
  } catch {
    throw new ApiError(400, 'El cuerpo debe ser JSON válido')
  }
}

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10)
}

function monthBounds(month: string): { start: string; end: string } {
  const [y, m] = month.split('-').map(Number)
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate()
  return { start: `${month}-01`, end: `${month}-${String(last).padStart(2, '0')}` }
}

// ---------------------------------------------------------------------------
// Data access — always scoped to owner.userId
// ---------------------------------------------------------------------------

type MyProject = {
  id: string
  name: string
  status: string
  payment_type: 'hourly' | 'fixed'
  hourly_rate: number | null
  monthly_rate: number | null
  currency: string
}

async function myProjects(db: SupabaseClient, owner: ApiKeyOwner): Promise<MyProject[]> {
  const { data, error } = await db
    .from('compensation_settings')
    .select('payment_type, hourly_rate, monthly_rate, currency, project:projects(id, name, status, company_id)')
    .eq('user_id', owner.userId)
    .eq('is_active', true)
  if (error) throw new ApiError(500, 'No se pudieron leer los proyectos')

  type Row = {
    payment_type: 'hourly' | 'fixed'
    hourly_rate: number | null
    monthly_rate: number | null
    currency: string
    project: { id: string; name: string; status: string; company_id: string } | null
  }
  return ((data ?? []) as unknown as Row[])
    .filter((r) => r.project && r.project.company_id === owner.companyId)
    .map((r) => ({
      id: r.project!.id,
      name: r.project!.name,
      status: r.project!.status,
      payment_type: r.payment_type,
      hourly_rate: r.hourly_rate === null ? null : Number(r.hourly_rate),
      monthly_rate: r.monthly_rate === null ? null : Number(r.monthly_rate),
      currency: r.currency,
    }))
    .sort((a, b) => a.name.localeCompare(b.name))
}

/** Resolves "Adeslas" / a uuid among the given projects. 404 / 409 on miss / ambiguity. */
function resolveProject(projects: MyProject[], ref: string): MyProject {
  if (UUID_RE.test(ref)) {
    const byId = projects.find((p) => p.id === ref.toLowerCase())
    if (byId) return byId
    throw new ApiError(404, 'Proyecto no encontrado entre tus proyectos actuales')
  }
  const needle = ref.trim().toLocaleLowerCase('es')
  const exact = projects.filter((p) => p.name.toLocaleLowerCase('es') === needle)
  if (exact.length === 1) return exact[0]
  const partial = exact.length > 1 ? exact : projects.filter((p) => p.name.toLocaleLowerCase('es').includes(needle))
  if (partial.length === 1) return partial[0]
  if (partial.length > 1) {
    throw new ApiError(409, 'Nombre de proyecto ambiguo: usa el id', {
      candidates: partial.map((p) => ({ id: p.id, name: p.name })),
    })
  }
  throw new ApiError(404, 'Proyecto no encontrado entre tus proyectos actuales', {
    available: projects.map((p) => p.name),
  })
}

function hourlyProject(projects: MyProject[], ref: string): MyProject {
  const project = resolveProject(projects, ref)
  if (project.payment_type !== 'hourly') {
    throw new ApiError(400, `En "${project.name}" cobras una cantidad fija: no se registran horas`)
  }
  return project
}

const TASK_SELECT =
  'id, task_date, hours, name, description, observations, source, invoice_id, review_status, proposed_hours, review_comment, created_at, updated_at, project:projects(id, name)'

type TaskRow = {
  id: string
  task_date: string
  hours: number
  name: string
  description: string | null
  observations: string | null
  source: string
  invoice_id: string | null
  review_status: string
  proposed_hours: number | null
  review_comment: string | null
  created_at: string
  updated_at: string
  project: { id: string; name: string } | null
}

function presentTask(t: TaskRow) {
  return {
    id: t.id,
    task_date: t.task_date,
    hours: Number(t.hours),
    name: t.name,
    description: t.description,
    observations: t.observations,
    project: t.project,
    billed: t.invoice_id !== null,
    // PRP-003: editing a reviewed task sends it back to 'pending' (DB trigger).
    review: {
      status: t.review_status,
      proposed_hours: t.proposed_hours === null ? null : Number(t.proposed_hours),
      comment: t.review_comment,
    },
    source: t.source,
    created_at: t.created_at,
    updated_at: t.updated_at,
  }
}

async function loadOwnTask(db: SupabaseClient, owner: ApiKeyOwner, id: string): Promise<TaskRow> {
  if (!UUID_RE.test(id)) throw new ApiError(404, 'Tarea no encontrada')
  const { data, error } = await db
    .from('tasks')
    .select(TASK_SELECT)
    .eq('id', id)
    .eq('user_id', owner.userId)
    .maybeSingle()
  if (error) throw new ApiError(500, 'No se pudo leer la tarea')
  if (!data) throw new ApiError(404, 'Tarea no encontrada')
  return data as unknown as TaskRow
}

function assertUnbilled(task: TaskRow) {
  if (task.invoice_id !== null) {
    throw new ApiError(409, 'La tarea ya está facturada: no se puede modificar ni borrar')
  }
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

const ENDPOINTS = [
  { method: 'GET', path: '/', description: 'Quién soy e índice de endpoints' },
  { method: 'GET', path: '/projects', description: 'Mis proyectos actuales con tipo de pago y tarifa' },
  { method: 'GET', path: '/tasks?from=&to=&project=&billed=&limit=', description: 'Mis tareas (proyecto por nombre o id)' },
  { method: 'POST', path: '/tasks', description: 'Crear tarea: project, hours, name, task_date?, description?, observations?' },
  { method: 'PATCH', path: '/tasks/:id', description: 'Editar una tarea no facturada' },
  { method: 'DELETE', path: '/tasks/:id', description: 'Borrar una tarea no facturada' },
  { method: 'GET', path: '/summary?month=YYYY-MM', description: 'Horas por proyecto e importe estimado del mes' },
  { method: 'GET', path: '/invoices?year=', description: 'Mis facturas' },
]

function handleIndex(owner: ApiKeyOwner) {
  return json({
    api: 'Invoxa Agent API',
    version: 1,
    me: {
      name: owner.fullName,
      email: owner.email,
      user_code: owner.userCode,
      role: 'user',
      company: owner.companyName,
    },
    endpoints: ENDPOINTS,
  })
}

async function handleProjects(db: SupabaseClient, owner: ApiKeyOwner) {
  const projects = await myProjects(db, owner)
  return json({ projects })
}

async function handleListTasks(db: SupabaseClient, owner: ApiKeyOwner, params: URLSearchParams) {
  const q = parse(TasksQuerySchema, Object.fromEntries(params))
  let query = db
    .from('tasks')
    .select(TASK_SELECT)
    .eq('user_id', owner.userId)
    .order('task_date', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(q.limit)

  if (q.from) query = query.gte('task_date', q.from)
  if (q.to) query = query.lte('task_date', q.to)
  if (q.billed === 'true') query = query.not('invoice_id', 'is', null)
  if (q.billed === 'false') query = query.is('invoice_id', null)
  if (q.project) {
    const project = resolveProject(await myProjects(db, owner), q.project)
    query = query.eq('project_id', project.id)
  }

  const { data, error } = await query
  if (error) throw new ApiError(500, 'No se pudieron leer las tareas')
  const tasks = ((data ?? []) as unknown as TaskRow[]).map(presentTask)
  return json({
    tasks,
    count: tasks.length,
    total_hours: Math.round(tasks.reduce((s, t) => s + t.hours, 0) * 100) / 100,
  })
}

async function handleCreateTask(db: SupabaseClient, owner: ApiKeyOwner, req: Request) {
  const body = parse(CreateTaskSchema, await readJson(req))
  const project = hourlyProject(await myProjects(db, owner), body.project)

  const { data, error } = await db
    .from('tasks')
    .insert({
      user_id: owner.userId,
      project_id: project.id,
      task_date: body.task_date ?? todayUtc(),
      hours: body.hours,
      name: body.name,
      description: body.description ?? null,
      observations: body.observations ?? null,
      source: 'api',
    })
    .select(TASK_SELECT)
    .single()
  if (error || !data) throw new ApiError(500, 'No se pudo crear la tarea')
  return json({ task: presentTask(data as unknown as TaskRow) }, 201)
}

async function handleUpdateTask(db: SupabaseClient, owner: ApiKeyOwner, id: string, req: Request) {
  const task = await loadOwnTask(db, owner, id)
  assertUnbilled(task)
  const body = parse(UpdateTaskSchema, await readJson(req))

  const patch: Record<string, unknown> = {}
  if (body.project !== undefined) patch.project_id = hourlyProject(await myProjects(db, owner), body.project).id
  if (body.task_date !== undefined) patch.task_date = body.task_date
  if (body.hours !== undefined) patch.hours = body.hours
  if (body.name !== undefined) patch.name = body.name
  if (body.description !== undefined) patch.description = body.description
  if (body.observations !== undefined) patch.observations = body.observations

  const { data, error } = await db
    .from('tasks')
    .update(patch)
    .eq('id', task.id)
    .eq('user_id', owner.userId)
    .is('invoice_id', null)
    .select(TASK_SELECT)
    .maybeSingle()
  if (error) throw new ApiError(500, 'No se pudo actualizar la tarea')
  if (!data) throw new ApiError(409, 'La tarea ya está facturada: no se puede modificar ni borrar')
  return json({ task: presentTask(data as unknown as TaskRow) })
}

async function handleDeleteTask(db: SupabaseClient, owner: ApiKeyOwner, id: string) {
  const task = await loadOwnTask(db, owner, id)
  assertUnbilled(task)
  const { data, error } = await db
    .from('tasks')
    .delete()
    .eq('id', task.id)
    .eq('user_id', owner.userId)
    .is('invoice_id', null)
    .select('id')
  if (error) throw new ApiError(500, 'No se pudo borrar la tarea')
  if (!data || data.length === 0) {
    throw new ApiError(409, 'La tarea ya está facturada: no se puede modificar ni borrar')
  }
  return json({ deleted: true, id: task.id })
}

async function handleSummary(db: SupabaseClient, owner: ApiKeyOwner, params: URLSearchParams) {
  const month = parse(MonthSchema, params.get('month') ?? todayUtc().slice(0, 7))
  const { start, end } = monthBounds(month)

  const [projects, tasksRes] = await Promise.all([
    myProjects(db, owner),
    db
      .from('tasks')
      .select('hours, invoice_id, project:projects(id, name)')
      .eq('user_id', owner.userId)
      .gte('task_date', start)
      .lte('task_date', end),
  ])
  if (tasksRes.error) throw new ApiError(500, 'No se pudieron leer las tareas')

  type Row = { hours: number; invoice_id: string | null; project: { id: string; name: string } | null }
  const byProject = new Map<string, { name: string; hours: number; billed_hours: number; tasks: number }>()
  for (const t of (tasksRes.data ?? []) as unknown as Row[]) {
    if (!t.project) continue
    const acc = byProject.get(t.project.id) ?? { name: t.project.name, hours: 0, billed_hours: 0, tasks: 0 }
    acc.hours += Number(t.hours)
    if (t.invoice_id !== null) acc.billed_hours += Number(t.hours)
    acc.tasks += 1
    byProject.set(t.project.id, acc)
  }

  const round = (n: number) => Math.round(n * 100) / 100
  const ids = new Set([...projects.map((p) => p.id), ...byProject.keys()])
  const rows = [...ids].map((id) => {
    const p = projects.find((x) => x.id === id)
    const worked = byProject.get(id)
    const hoursWorked = round(worked?.hours ?? 0)
    const estimated =
      p?.payment_type === 'fixed'
        ? p.monthly_rate
        : p?.payment_type === 'hourly' && p.hourly_rate !== null
          ? round(hoursWorked * p.hourly_rate)
          : null
    return {
      project: { id, name: p?.name ?? worked?.name ?? '' },
      payment_type: p?.payment_type ?? null,
      hours: hoursWorked,
      billed_hours: round(worked?.billed_hours ?? 0),
      tasks: worked?.tasks ?? 0,
      rate: p ? (p.payment_type === 'hourly' ? p.hourly_rate : p.monthly_rate) : null,
      currency: p?.currency ?? null,
      estimated_amount: estimated,
    }
  })
  rows.sort((a, b) => a.project.name.localeCompare(b.project.name))

  const totals: Record<string, number> = {}
  for (const r of rows) {
    if (r.currency && r.estimated_amount !== null) {
      totals[r.currency] = round((totals[r.currency] ?? 0) + r.estimated_amount)
    }
  }

  return json({
    month,
    period: { start, end },
    total_hours: round(rows.reduce((s, r) => s + r.hours, 0)),
    projects: rows,
    estimated_totals: totals,
    note: 'Estimación con las tarifas vigentes hoy; la factura real se calcula al generarla en Invoxa.',
  })
}

async function handleInvoices(db: SupabaseClient, owner: ApiKeyOwner, params: URLSearchParams) {
  const q = parse(InvoicesQuerySchema, Object.fromEntries(params))
  let query = db
    .from('invoices')
    .select('id, invoice_number, invoice_date, period_start, period_end, total, currency, status')
    .eq('user_id', owner.userId)
    .order('invoice_date', { ascending: false })
  if (q.year) query = query.gte('period_start', `${q.year}-01-01`).lte('period_start', `${q.year}-12-31`)

  const { data, error } = await query
  if (error) throw new ApiError(500, 'No se pudieron leer las facturas')
  type Row = {
    id: string
    invoice_number: string
    invoice_date: string
    period_start: string
    period_end: string
    total: number
    currency: string
    status: string
  }
  return json({
    invoices: ((data ?? []) as Row[]).map((i) => ({ ...i, total: Number(i.total) })),
  })
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

/** "/functions/v1/agent-api/tasks/123" or "/agent-api/tasks/123" → ["tasks", "123"]. */
function routeSegments(url: URL): string[] {
  const parts = url.pathname.split('/').filter(Boolean)
  const at = parts.indexOf('agent-api')
  return at >= 0 ? parts.slice(at + 1) : parts
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    if (!supabaseUrl || !serviceKey) throw new ApiError(500, 'Server misconfigured')

    const apiKey = readApiKey(req)
    if (!apiKey) {
      throw new ApiError(401, 'Falta la API key: usa "Authorization: Bearer ivx_…"')
    }

    const db = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    const owner = await authenticateApiKey(db, apiKey)
    if (!owner) throw new ApiError(401, 'API key inválida, revocada o de un usuario inactivo')

    const url = new URL(req.url)
    const [resource = '', id, ...rest] = routeSegments(url)
    if (rest.length > 0) throw new ApiError(404, 'Ruta no encontrada')
    const m = req.method

    if (resource === '' && m === 'GET') return handleIndex(owner)
    if (resource === 'projects' && !id && m === 'GET') return await handleProjects(db, owner)
    if (resource === 'tasks' && !id && m === 'GET') return await handleListTasks(db, owner, url.searchParams)
    if (resource === 'tasks' && !id && m === 'POST') return await handleCreateTask(db, owner, req)
    if (resource === 'tasks' && id && m === 'GET') return json({ task: presentTask(await loadOwnTask(db, owner, id)) })
    if (resource === 'tasks' && id && m === 'PATCH') return await handleUpdateTask(db, owner, id, req)
    if (resource === 'tasks' && id && m === 'DELETE') return await handleDeleteTask(db, owner, id)
    if (resource === 'summary' && !id && m === 'GET') return await handleSummary(db, owner, url.searchParams)
    if (resource === 'invoices' && !id && m === 'GET') return await handleInvoices(db, owner, url.searchParams)

    const known = ['', 'projects', 'tasks', 'summary', 'invoices'].includes(resource)
    throw known ? new ApiError(405, 'Método no permitido en esta ruta') : new ApiError(404, 'Ruta no encontrada')
  } catch (err) {
    if (err instanceof ApiError) return json({ error: err.message, ...err.extra }, err.status)
    console.error('agent-api unexpected error', err instanceof Error ? err.message : 'unknown')
    return json({ error: 'Error interno' }, 500)
  }
})
