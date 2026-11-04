// =============================================================================
// generate-tasks-report-pdf — Edge Function
// =============================================================================
// Renders a monthly "worked hours justification" report for a worker: all of
// their tasks within a period, grouped into one section per project, with a
// per-project subtotal and a grand total. Stores the PDF in the `reports`
// bucket and returns its storage path.
//
// Path convention: {user_id}/tasks-{period_start}_{period_end}.pdf
//
// A worker generates this to hand to their manager. Auth: the caller can only
// generate their own report unless they're an admin (an admin may pass a
// `user_id` to generate it for someone else).
//
// Brand mirrors generate-invoice-pdf: brown ink, terracotta accent,
// Times-Roman serif for titles/totals, Helvetica for body. Built-in WinAnsi
// encoding handles Spanish accents fine. Supports multiple pages.
// =============================================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'
import { loadCaller, userInCompany } from '../_shared/company.ts'
import {
  PDFDocument,
  PDFFont,
  PDFPage,
  StandardFonts,
  rgb,
} from 'https://esm.sh/pdf-lib@1.17.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function jsonResponse(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

type TaskRow = {
  id: string
  name: string
  description: string | null
  task_date: string
  hours: number
  observations: string | null
  project: { id: string; name: string } | null
}

type ProfileData = {
  full_name: string | null
  email: string
  user_code: string | null
}

type ProjectGroup = {
  projectId: string
  projectName: string
  tasks: TaskRow[]
  totalHours: number
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405)
  }

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) {
    return jsonResponse({ error: 'Missing authorization header' }, 401)
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
    return jsonResponse({ error: 'Server misconfigured' }, 500)
  }

  const userClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  })
  const { data: userResult, error: userErr } = await userClient.auth.getUser()
  if (userErr || !userResult?.user) {
    return jsonResponse({ error: 'Invalid auth' }, 401)
  }

  const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false },
  })

  let body: { period_start?: string; period_end?: string; user_id?: string }
  try {
    body = await req.json()
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400)
  }

  const periodStart = body.period_start
  const periodEnd = body.period_end
  if (!periodStart || !periodEnd) {
    return jsonResponse(
      { error: 'period_start y period_end son obligatorios' },
      400,
    )
  }

  // Authorization: default to the caller; an admin may target another user.
  const callerId = userResult.user.id
  const targetUserId = body.user_id ?? callerId
  if (targetUserId !== callerId) {
    const caller = await loadCaller(adminClient, callerId)
    if (
      !caller ||
      !caller.isAdmin ||
      !(await userInCompany(adminClient, targetUserId, caller.companyId))
    ) {
      return jsonResponse({ error: 'Forbidden' }, 403)
    }
  }

  // Worker info for the header
  const { data: profileRaw } = await adminClient
    .from('profiles')
    .select('full_name, email, user_code')
    .eq('id', targetUserId)
    .single()
  const profileData = (profileRaw as ProfileData) ?? {
    full_name: null,
    email: '',
    user_code: null,
  }
  const profile: ProfileData = {
    ...profileData,
    full_name: profileData.full_name
      ? sanitizeWinAnsi(profileData.full_name)
      : null,
    email: sanitizeWinAnsi(profileData.email),
  }

  // All tasks in the period, with their project
  const { data: tasksRaw, error: tasksErr } = await adminClient
    .from('tasks')
    .select(
      'id, name, description, task_date, hours, observations, project:projects(id, name)',
    )
    .eq('user_id', targetUserId)
    .gte('task_date', periodStart)
    .lte('task_date', periodEnd)
    .order('task_date', { ascending: true })
    .order('created_at', { ascending: true })
  if (tasksErr) {
    return jsonResponse({ error: tasksErr.message }, 500)
  }
  const tasks = ((tasksRaw ?? []) as unknown as TaskRow[]).map((t) => ({
    ...t,
    name: sanitizeWinAnsi(t.name),
    description: t.description ? sanitizeWinAnsi(t.description) : null,
    observations: t.observations ? sanitizeWinAnsi(t.observations) : null,
    project: t.project
      ? { ...t.project, name: sanitizeWinAnsi(t.project.name) }
      : null,
  }))

  // Group by project (sorted by project name; tasks already date-ordered)
  const groupsMap = new Map<string, ProjectGroup>()
  for (const t of tasks) {
    const pid = t.project?.id ?? 'sin-proyecto'
    const pname = t.project?.name ?? 'Sin proyecto'
    let g = groupsMap.get(pid)
    if (!g) {
      g = { projectId: pid, projectName: pname, tasks: [], totalHours: 0 }
      groupsMap.set(pid, g)
    }
    g.tasks.push(t)
    g.totalHours += Number(t.hours)
  }
  const groups = [...groupsMap.values()].sort((a, b) =>
    a.projectName.localeCompare(b.projectName, 'es'),
  )

  let pdfBytes: Uint8Array
  try {
    pdfBytes = await renderTasksReportPdf(
      groups,
      profile,
      periodStart,
      periodEnd,
    )
  } catch (e) {
    return jsonResponse(
      { error: e instanceof Error ? e.message : 'Render error' },
      500,
    )
  }

  // Upload (overwrite on re-download so the file is always fresh)
  const path = `${targetUserId}/tasks-${periodStart}_${periodEnd}.pdf`
  const { error: uploadErr } = await adminClient.storage
    .from('reports')
    .upload(path, pdfBytes, {
      contentType: 'application/pdf',
      upsert: true,
    })
  if (uploadErr) {
    return jsonResponse({ error: uploadErr.message }, 500)
  }

  return jsonResponse({ success: true, pdf_path: path }, 200)
})

// =============================================================================
// PDF rendering
// =============================================================================

const COLOR = {
  ink: rgb(42 / 255, 31 / 255, 23 / 255), // #2A1F17
  ink2: rgb(74 / 255, 58 / 255, 44 / 255),
  ink3: rgb(122 / 255, 106 / 255, 88 / 255),
  accent: rgb(194 / 255, 65 / 255, 12 / 255), // #C2410C
  line: rgb(212 / 255, 200 / 255, 173 / 255), // #D4C8AD
  lineSoft: rgb(230 / 255, 220 / 255, 198 / 255), // #E6DCC6
  bgSoft: rgb(244 / 255, 237 / 255, 224 / 255), // #F4EDE0
}

const PAGE_W = 612 // Letter
const PAGE_H = 792
const MARGIN = 50
const BOTTOM = MARGIN + 24 // keep clear of the footer

async function renderTasksReportPdf(
  groups: ProjectGroup[],
  profile: ProfileData,
  periodStart: string,
  periodEnd: string,
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create()
  const sans = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const sansBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
  const serif = await pdfDoc.embedFont(StandardFonts.TimesRomanBold)

  const fonts = { sans, sansBold, serif }
  const contentW = PAGE_W - 2 * MARGIN

  let page = pdfDoc.addPage([PAGE_W, PAGE_H])
  let y = PAGE_H - MARGIN

  // Adds a new page when there isn't room for `needed` more vertical points.
  const ensure = (needed: number) => {
    if (y - needed < BOTTOM) {
      page = pdfDoc.addPage([PAGE_W, PAGE_H])
      y = PAGE_H - MARGIN
    }
  }

  const grandHours = groups.reduce((s, g) => s + g.totalHours, 0)
  const grandTasks = groups.reduce((s, g) => s + g.tasks.length, 0)

  // ─── Document header ───
  page.drawText('REPORTE DE TAREAS', {
    x: MARGIN,
    y: y - 22,
    size: 22,
    font: serif,
    color: COLOR.accent,
  })
  page.drawText('Justificante de horas trabajadas', {
    x: MARGIN,
    y: y - 38,
    size: 10,
    font: sans,
    color: COLOR.ink3,
  })
  y -= 58

  const workerName = profile.full_name || profile.email || ''
  drawLabelValue(page, MARGIN, y, 'Trabajador:', workerName, fonts)
  drawLabelValue(
    page,
    MARGIN + 280,
    y,
    'Periodo:',
    `${formatDate(periodStart)} — ${formatDate(periodEnd)}`,
    fonts,
  )
  y -= 16
  drawLabelValue(
    page,
    MARGIN,
    y,
    'Total horas:',
    `${formatHours(grandHours)} h`,
    fonts,
  )
  drawLabelValue(
    page,
    MARGIN + 280,
    y,
    'Total tareas:',
    `${grandTasks}`,
    fonts,
  )
  y -= 14

  // Divider under the header
  page.drawLine({
    start: { x: MARGIN, y },
    end: { x: PAGE_W - MARGIN, y },
    thickness: 0.8,
    color: COLOR.line,
  })
  y -= 24

  if (groups.length === 0) {
    page.drawText('No hay tareas registradas en este periodo.', {
      x: MARGIN,
      y,
      size: 11,
      font: sans,
      color: COLOR.ink3,
    })
  }

  // ─── One section per project ───
  for (const g of groups) {
    // Section header (project name + count/hours). Keep it with at least one
    // following row so a section title never dangles at the bottom of a page.
    ensure(26 + 20)

    const sectionH = 26
    page.drawRectangle({
      x: MARGIN,
      y: y - sectionH,
      width: contentW,
      height: sectionH,
      color: COLOR.bgSoft,
    })
    page.drawRectangle({
      x: MARGIN,
      y: y - sectionH,
      width: contentW,
      height: sectionH,
      borderColor: COLOR.line,
      borderWidth: 0.8,
    })
    page.drawText(truncate(g.projectName, 48), {
      x: MARGIN + 10,
      y: y - 17,
      size: 11.5,
      font: sansBold,
      color: COLOR.ink,
    })
    const meta = `${g.tasks.length} ${
      g.tasks.length === 1 ? 'tarea' : 'tareas'
    } · ${formatHours(g.totalHours)} h`
    drawRightAlignedText(
      page,
      meta,
      PAGE_W - MARGIN - 10,
      y - 17,
      sansBold,
      9.5,
      COLOR.ink2,
    )
    y -= sectionH

    // Column header row
    const dateX = MARGIN + 10
    const taskX = MARGIN + 90
    const hoursRightX = PAGE_W - MARGIN - 10
    const taskW = hoursRightX - 50 - taskX

    ensure(18)
    page.drawText('FECHA', {
      x: dateX,
      y: y - 13,
      size: 7.5,
      font: sansBold,
      color: COLOR.ink3,
    })
    page.drawText('TAREA', {
      x: taskX,
      y: y - 13,
      size: 7.5,
      font: sansBold,
      color: COLOR.ink3,
    })
    drawRightAlignedText(
      page,
      'HORAS',
      hoursRightX,
      y - 13,
      sansBold,
      7.5,
      COLOR.ink3,
    )
    y -= 18

    // Task rows
    for (const t of g.tasks) {
      const descLines = t.description
        ? wrapText(t.description, sans, 8.5, taskW)
        : []
      const rowH = 16 + descLines.length * 11 + 6

      ensure(rowH)

      const rowTop = y
      // Date
      page.drawText(formatDate(t.task_date), {
        x: dateX,
        y: rowTop - 12,
        size: 9,
        font: sans,
        color: COLOR.ink2,
      })
      // Task name
      page.drawText(truncate(t.name, 64), {
        x: taskX,
        y: rowTop - 12,
        size: 9.5,
        font: sansBold,
        color: COLOR.ink,
      })
      // Hours
      drawRightAlignedText(
        page,
        formatHours(t.hours),
        hoursRightX,
        rowTop - 12,
        sans,
        9.5,
        COLOR.ink,
      )
      // Description (wrapped, muted)
      let dy = rowTop - 12 - 11
      for (const line of descLines) {
        page.drawText(line, {
          x: taskX,
          y: dy,
          size: 8.5,
          font: sans,
          color: COLOR.ink3,
        })
        dy -= 11
      }

      y = rowTop - rowH
      // Soft separator between tasks
      page.drawLine({
        start: { x: MARGIN, y: y + 3 },
        end: { x: PAGE_W - MARGIN, y: y + 3 },
        thickness: 0.4,
        color: COLOR.lineSoft,
      })
    }

    // Section subtotal
    ensure(20)
    drawRightAlignedText(
      page,
      `Subtotal ${truncate(g.projectName, 30)}: ${formatHours(
        g.totalHours,
      )} h`,
      PAGE_W - MARGIN - 10,
      y - 13,
      sansBold,
      9.5,
      COLOR.accent,
    )
    y -= 28
  }

  // ─── Grand total box ───
  if (groups.length > 0) {
    ensure(40)
    const totalH = 36
    page.drawRectangle({
      x: MARGIN,
      y: y - totalH,
      width: contentW,
      height: totalH,
      color: COLOR.bgSoft,
    })
    page.drawRectangle({
      x: MARGIN,
      y: y - totalH,
      width: contentW,
      height: totalH,
      borderColor: COLOR.line,
      borderWidth: 0.8,
    })
    page.drawText('TOTAL DE HORAS', {
      x: MARGIN + 12,
      y: y - 23,
      size: 12,
      font: sansBold,
      color: COLOR.ink,
    })
    drawRightAlignedText(
      page,
      `${formatHours(grandHours)} h`,
      PAGE_W - MARGIN - 12,
      y - 23,
      serif,
      15,
      COLOR.accent,
    )
    y -= totalH
  }

  // ─── Footer with page numbers ───
  const pages = pdfDoc.getPages()
  const total = pages.length
  pages.forEach((p, i) => {
    const left = `Generado con Invoxa · ${workerName}`
    p.drawText(left, {
      x: MARGIN,
      y: 30,
      size: 8,
      font: sans,
      color: COLOR.ink3,
    })
    const right = `Página ${i + 1} de ${total}`
    const rw = sans.widthOfTextAtSize(right, 8)
    p.drawText(right, {
      x: PAGE_W - MARGIN - rw,
      y: 30,
      size: 8,
      font: sans,
      color: COLOR.ink3,
    })
  })

  return await pdfDoc.save()
}

// =============================================================================
// Helpers
// =============================================================================

// The standard fonts only support WinAnsi (cp1252). Any character outside it
// (arrows, emojis, math symbols…) makes pdf-lib throw, so user text must be
// sanitized before drawing: known symbols get an ASCII equivalent and the
// rest are dropped.
const WINANSI_EXTRAS = new Set([
  0x20ac, 0x201a, 0x0192, 0x201e, 0x2026, 0x2020, 0x2021, 0x02c6, 0x2030,
  0x0160, 0x2039, 0x0152, 0x017d, 0x2018, 0x2019, 0x201c, 0x201d, 0x2022,
  0x2013, 0x2014, 0x02dc, 0x2122, 0x0161, 0x203a, 0x0153, 0x017e, 0x0178,
])

const CHAR_FALLBACKS: Record<string, string> = {
  '→': '->',
  '←': '<-',
  '↔': '<->',
  '⇒': '=>',
  '⇐': '<=',
  '−': '-',
  '≥': '>=',
  '≤': '<=',
  '≠': '!=',
  '≈': '~',
  '∞': 'inf',
  '✓': 'v',
  '✔': 'v',
  '★': '*',
  '☆': '*',
}

function sanitizeWinAnsi(text: string): string {
  let out = ''
  for (const ch of text) {
    const cp = ch.codePointAt(0) ?? 0
    if (
      cp === 0x0a ||
      (cp >= 0x20 && cp <= 0x7e) ||
      (cp >= 0xa0 && cp <= 0xff) ||
      WINANSI_EXTRAS.has(cp)
    ) {
      out += ch
    } else if (CHAR_FALLBACKS[ch]) {
      out += CHAR_FALLBACKS[ch]
    }
  }
  return out
}

function drawLabelValue(
  page: PDFPage,
  x: number,
  y: number,
  label: string,
  value: string,
  fonts: { sans: PDFFont; sansBold: PDFFont },
) {
  page.drawText(label, {
    x,
    y,
    size: 9,
    font: fonts.sansBold,
    color: COLOR.ink3,
  })
  const labelW = fonts.sansBold.widthOfTextAtSize(label, 9)
  page.drawText(value, {
    x: x + labelW + 6,
    y,
    size: 10,
    font: fonts.sans,
    color: COLOR.ink,
  })
}

function drawRightAlignedText(
  page: PDFPage,
  text: string,
  rightX: number,
  y: number,
  font: PDFFont,
  size: number,
  color: ReturnType<typeof rgb>,
) {
  const w = font.widthOfTextAtSize(text, size)
  page.drawText(text, { x: rightX - w, y, size, font, color })
}

function truncate(text: string, max: number) {
  return text.length > max ? text.slice(0, max - 1) + '…' : text
}

function wrapText(
  text: string,
  font: PDFFont,
  size: number,
  maxWidth: number,
): string[] {
  const out: string[] = []
  for (const paragraph of text.split('\n')) {
    const words = paragraph.split(' ')
    let current = ''
    for (const w of words) {
      const candidate = current ? current + ' ' + w : w
      if (font.widthOfTextAtSize(candidate, size) > maxWidth) {
        if (current) out.push(current)
        // A single word longer than the line: hard-break it.
        if (font.widthOfTextAtSize(w, size) > maxWidth) {
          let chunk = ''
          for (const ch of w) {
            if (font.widthOfTextAtSize(chunk + ch, size) > maxWidth) {
              out.push(chunk)
              chunk = ch
            } else {
              chunk += ch
            }
          }
          current = chunk
        } else {
          current = w
        }
      } else {
        current = candidate
      }
    }
    if (current) out.push(current)
  }
  return out
}

function formatHours(value: number) {
  const n = new Intl.NumberFormat('es-CO', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(Number(value))
  return n
}

function formatDate(value: string) {
  // value is YYYY-MM-DD
  const [y, m, d] = value.split('-').map(Number)
  if (!y || !m || !d) return value
  const months = [
    'ene',
    'feb',
    'mar',
    'abr',
    'may',
    'jun',
    'jul',
    'ago',
    'sep',
    'oct',
    'nov',
    'dic',
  ]
  return `${d} ${months[m - 1]} ${y}`
}
