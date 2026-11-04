// =============================================================================
// generate-invoice-pdf — Edge Function
// =============================================================================
// Renders the PDF for an existing invoice and stores it in the `invoices`
// bucket. Updates invoices.pdf_url with the storage path.
//
// Layout follows docs/empty.docx:
//   - Sender block top-left (legal name, tax id, address)
//   - "FACTURA" + date/number box top-right
//   - Recipient: the invoice's company (companies table)
//   - Items table with Cant. / Descripción / P. Unitario / Importe
//   - TOTAL row
//   - Observaciones + datos de pago at the bottom
//
// Brand applied: brown ink, terracotta accent, Times-Roman serif for the
// FACTURA title and total (close to Fraunces vibe). Helvetica for body.
// Built-in WinAnsi encoding handles Spanish accents fine.
// =============================================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'
import { loadCaller } from '../_shared/company.ts'
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

type InvoiceItem = {
  id: string
  invoice_id: string
  project_id: string
  payment_type: 'hourly' | 'fixed'
  description: string
  quantity: number
  unit_price: number
  total: number
}

type InvoiceData = {
  id: string
  user_id: string
  company_id: string
  invoice_number: string
  invoice_date: string
  period_start: string
  period_end: string
  currency: string
  subtotal: number
  tax_amount: number
  total: number
  status: string
  notes: string | null
  items: InvoiceItem[]
}

type ProfileData = {
  full_name: string | null
  email: string
  user_code: string | null
}

type BillingData = {
  legal_name: string | null
  tax_id: string | null
  address: string | null
  city: string | null
  country: string | null
  billing_email: string | null
  bank_name: string | null
  bank_account: string | null
  payment_method: string | null
  default_invoice_notes: string | null
} | null

/** Recipient of the invoice: the company the collaborator bills. */
type CompanyData = {
  legal_name: string
  tax_id: string
  address_line: string | null
  postal_code: string | null
  city: string | null
  region: string | null
  country: string
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

  let body: { invoice_id?: string }
  try {
    body = await req.json()
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400)
  }
  const invoiceId = body.invoice_id
  if (!invoiceId) {
    return jsonResponse({ error: 'invoice_id is required' }, 400)
  }

  // Fetch invoice + items
  const { data: invoiceRaw, error: invErr } = await adminClient
    .from('invoices')
    .select('*, items:invoice_items(*)')
    .eq('id', invoiceId)
    .single()
  if (invErr || !invoiceRaw) {
    return jsonResponse({ error: 'Factura no encontrada' }, 404)
  }
  const invoice = invoiceRaw as InvoiceData

  // Authorization: caller must own the invoice or be admin
  const callerId = userResult.user.id
  if (invoice.user_id !== callerId) {
    const caller = await loadCaller(adminClient, callerId)
    if (!caller || !caller.isAdmin || caller.companyId !== invoice.company_id) {
      return jsonResponse({ error: 'Forbidden' }, 403)
    }
  }

  // Fetch sender info
  const { data: profileRaw } = await adminClient
    .from('profiles')
    .select('full_name, email, user_code')
    .eq('id', invoice.user_id)
    .single()
  const profile = profileRaw as ProfileData

  const { data: billingRaw } = await adminClient
    .from('user_billing_profiles')
    .select(
      'legal_name, tax_id, address, city, country, billing_email, bank_name, bank_account, payment_method, default_invoice_notes',
    )
    .eq('user_id', invoice.user_id)
    .maybeSingle()
  const billing = billingRaw as BillingData

  const { data: companyRaw } = await adminClient
    .from('companies')
    .select('legal_name, tax_id, address_line, postal_code, city, region, country')
    .eq('id', invoice.company_id)
    .single()
  if (!companyRaw) {
    return jsonResponse({ error: 'Empresa de la factura no encontrada' }, 500)
  }
  const company = companyRaw as CompanyData

  // Render PDF
  let pdfBytes: Uint8Array
  try {
    pdfBytes = await renderInvoicePdf(
      sanitizeDeep(invoice),
      sanitizeDeep(profile),
      sanitizeDeep(billing),
      sanitizeDeep(company),
    )
  } catch (e) {
    return jsonResponse(
      { error: e instanceof Error ? e.message : 'Render error' },
      500,
    )
  }

  // Upload to storage (overwrites if exists — used for regeneration too)
  const path = `${invoice.user_id}/${invoice.id}.pdf`
  const { error: uploadErr } = await adminClient.storage
    .from('invoices')
    .upload(path, pdfBytes, {
      contentType: 'application/pdf',
      upsert: true,
    })
  if (uploadErr) {
    return jsonResponse({ error: uploadErr.message }, 500)
  }

  await adminClient
    .from('invoices')
    .update({ pdf_url: path })
    .eq('id', invoice.id)

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

async function renderInvoicePdf(
  invoice: InvoiceData,
  profile: ProfileData,
  billing: BillingData,
  company: CompanyData,
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create()
  const page = pdfDoc.addPage([PAGE_W, PAGE_H])

  const sans = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const sansBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
  const serif = await pdfDoc.embedFont(StandardFonts.TimesRomanBold)

  let y = PAGE_H - MARGIN

  // ─── Header: sender (left) + FACTURA + invoice info (right) ───
  drawSender(page, y, profile, billing, sans, sansBold)
  drawInvoiceBox(page, y, invoice, sans, sansBold, serif)

  y -= 150

  // ─── Recipient block ───
  y = drawRecipient(page, y, company, sans, sansBold)

  y -= 16

  // ─── Period ───
  page.drawText('Periodo:', {
    x: MARGIN,
    y,
    size: 9,
    font: sansBold,
    color: COLOR.ink3,
  })
  page.drawText(
    `${formatDate(invoice.period_start)} — ${formatDate(invoice.period_end)}`,
    { x: MARGIN + 50, y, size: 10, font: sans, color: COLOR.ink2 },
  )
  y -= 24

  // ─── Items table ───
  y = drawItemsTable(page, y, invoice, sans, sansBold, serif)

  y -= 30

  // ─── Observaciones ───
  const notes = invoice.notes || billing?.default_invoice_notes || ''
  if (notes) {
    page.drawText('Observaciones:', {
      x: MARGIN,
      y,
      size: 10,
      font: sansBold,
      color: COLOR.ink2,
    })
    y -= 14
    for (const line of wrapText(notes, sans, 9, PAGE_W - 2 * MARGIN)) {
      page.drawText(line, {
        x: MARGIN,
        y,
        size: 9,
        font: sans,
        color: COLOR.ink2,
      })
      y -= 12
    }
    y -= 8
  }

  // ─── Datos de pago ───
  if (billing?.bank_name || billing?.bank_account || billing?.payment_method) {
    page.drawText('Datos de pago:', {
      x: MARGIN,
      y,
      size: 10,
      font: sansBold,
      color: COLOR.ink2,
    })
    y -= 14
    const lines: string[] = []
    if (billing.payment_method)
      lines.push(`Método: ${billing.payment_method}`)
    if (billing.bank_name) lines.push(`Banco: ${billing.bank_name}`)
    if (billing.bank_account) lines.push(`Cuenta: ${billing.bank_account}`)
    for (const l of lines) {
      page.drawText(l, {
        x: MARGIN,
        y,
        size: 9,
        font: sans,
        color: COLOR.ink2,
      })
      y -= 12
    }
  }

  // ─── Footer ───
  const footerText = `Generada con Invoxa · ${invoice.invoice_number}`
  const footerW = sans.widthOfTextAtSize(footerText, 8)
  page.drawText(footerText, {
    x: PAGE_W - MARGIN - footerW,
    y: 30,
    size: 8,
    font: sans,
    color: COLOR.ink3,
  })

  return await pdfDoc.save()
}

function drawSender(
  page: PDFPage,
  topY: number,
  profile: ProfileData,
  billing: BillingData,
  sans: PDFFont,
  sansBold: PDFFont,
) {
  const senderName =
    billing?.legal_name || profile?.full_name || profile?.email || ''
  let y = topY - 14
  page.drawText(senderName, {
    x: MARGIN,
    y,
    size: 12,
    font: sansBold,
    color: COLOR.ink,
  })

  const lines: string[] = []
  if (billing?.tax_id) lines.push(billing.tax_id)
  if (billing?.address) lines.push(billing.address)
  const cityCountry = [billing?.city, billing?.country].filter(Boolean).join(', ')
  if (cityCountry) lines.push(cityCountry)
  const email = billing?.billing_email || profile?.email
  if (email) lines.push(email)

  for (const line of lines) {
    y -= 14
    page.drawText(line, {
      x: MARGIN,
      y,
      size: 9.5,
      font: sans,
      color: COLOR.ink2,
    })
  }
}

function drawInvoiceBox(
  page: PDFPage,
  topY: number,
  invoice: InvoiceData,
  sans: PDFFont,
  sansBold: PDFFont,
  serif: PDFFont,
) {
  const boxW = 250
  const boxH = 56
  const boxX = PAGE_W - MARGIN - boxW
  const colSplit = 0.4 // FECHA narrower, Nº FACTURA wider

  // FACTURA title (serif, terracotta)
  const titleSize = 26
  const titleW = serif.widthOfTextAtSize('FACTURA', titleSize)
  page.drawText('FACTURA', {
    x: boxX + boxW - titleW,
    y: topY - titleSize,
    size: titleSize,
    font: serif,
    color: COLOR.accent,
  })

  // Box with FECHA / Nº FACTURA
  const boxTop = topY - titleSize - 18
  page.drawRectangle({
    x: boxX,
    y: boxTop - boxH,
    width: boxW,
    height: boxH,
    borderColor: COLOR.line,
    borderWidth: 0.8,
  })
  const splitX = boxX + boxW * colSplit
  page.drawLine({
    start: { x: splitX, y: boxTop },
    end: { x: splitX, y: boxTop - boxH },
    thickness: 0.8,
    color: COLOR.line,
  })
  page.drawLine({
    start: { x: boxX, y: boxTop - boxH / 2 },
    end: { x: boxX + boxW, y: boxTop - boxH / 2 },
    thickness: 0.8,
    color: COLOR.line,
  })

  // Header row (labels)
  page.drawText('FECHA', {
    x: boxX + 10,
    y: boxTop - 17,
    size: 8.5,
    font: sansBold,
    color: COLOR.ink3,
  })
  page.drawText('Nº FACTURA', {
    x: splitX + 10,
    y: boxTop - 17,
    size: 8.5,
    font: sansBold,
    color: COLOR.ink3,
  })

  // Values
  page.drawText(formatDate(invoice.invoice_date), {
    x: boxX + 10,
    y: boxTop - boxH / 2 - 17,
    size: 10,
    font: sans,
    color: COLOR.ink,
  })

  // Auto-shrink the invoice number if it doesn't fit the right cell
  const numCellW = boxX + boxW - splitX - 20 // 10px padding each side
  let numSize = 10
  while (
    sans.widthOfTextAtSize(invoice.invoice_number, numSize) > numCellW &&
    numSize > 7
  ) {
    numSize -= 0.5
  }
  page.drawText(invoice.invoice_number, {
    x: splitX + 10,
    y: boxTop - boxH / 2 - 17,
    size: numSize,
    font: sans,
    color: COLOR.ink,
  })
}

function drawRecipient(
  page: PDFPage,
  startY: number,
  company: CompanyData,
  sans: PDFFont,
  sansBold: PDFFont,
): number {
  const boxW = 280

  page.drawText('Factura para:', {
    x: MARGIN,
    y: startY,
    size: 9,
    font: sansBold,
    color: COLOR.ink3,
  })

  // Same layout as the original hardcoded Informage block:
  // legal name / tax id / street / "postal code + city" / "region – country".
  const cityLine = [company.postal_code, company.city].filter(Boolean).join(' ')
  const countryLine = [company.region, company.country].filter(Boolean).join(' – ')
  const lines = [
    company.legal_name,
    company.tax_id,
    company.address_line,
    cityLine,
    countryLine,
  ].filter((l): l is string => Boolean(l && l.trim()))

  const labelGap = 8
  const padTop = 16
  const padBottom = 14
  const lineH = 14
  const boxTop = startY - labelGap
  const blockH = padTop + (lines.length - 1) * lineH + padBottom

  page.drawRectangle({
    x: MARGIN,
    y: boxTop - blockH,
    width: boxW,
    height: blockH,
    borderColor: COLOR.line,
    borderWidth: 0.6,
  })

  let textY = boxTop - padTop
  for (const line of lines) {
    page.drawText(line, {
      x: MARGIN + 12,
      y: textY,
      size: 10,
      font: sans,
      color: COLOR.ink2,
    })
    textY -= lineH
  }

  return boxTop - blockH - 4
}

function drawItemsTable(
  page: PDFPage,
  startY: number,
  invoice: InvoiceData,
  sans: PDFFont,
  sansBold: PDFFont,
  serif: PDFFont,
): number {
  const tableX = MARGIN
  const tableW = PAGE_W - 2 * MARGIN
  const cols = {
    qty: 60,
    desc: 280,
    price: 90,
    total: tableW - 60 - 280 - 90,
  }
  const rowH = 28
  const headerH = 26

  let y = startY

  // Header
  page.drawRectangle({
    x: tableX,
    y: y - headerH,
    width: tableW,
    height: headerH,
    color: COLOR.bgSoft,
  })
  page.drawRectangle({
    x: tableX,
    y: y - headerH,
    width: tableW,
    height: headerH,
    borderColor: COLOR.line,
    borderWidth: 0.8,
  })

  drawCenteredText(
    page,
    'CANT.',
    tableX,
    cols.qty,
    y - 17,
    sansBold,
    8.5,
    COLOR.ink,
  )
  drawCenteredText(
    page,
    'DESCRIPCIÓN',
    tableX + cols.qty,
    cols.desc,
    y - 17,
    sansBold,
    8.5,
    COLOR.ink,
  )
  drawCenteredText(
    page,
    'P. UNITARIO',
    tableX + cols.qty + cols.desc,
    cols.price,
    y - 17,
    sansBold,
    8.5,
    COLOR.ink,
  )
  drawCenteredText(
    page,
    'IMPORTE',
    tableX + cols.qty + cols.desc + cols.price,
    cols.total,
    y - 17,
    sansBold,
    8.5,
    COLOR.ink,
  )

  y -= headerH

  // Rows
  for (const item of invoice.items) {
    page.drawRectangle({
      x: tableX,
      y: y - rowH,
      width: tableW,
      height: rowH,
      borderColor: COLOR.lineSoft,
      borderWidth: 0.5,
    })

    drawCenteredText(
      page,
      formatNumber(item.quantity),
      tableX,
      cols.qty,
      y - 17,
      sans,
      10,
      COLOR.ink2,
    )

    // Description aligned left with padding
    page.drawText(truncate(item.description, 50), {
      x: tableX + cols.qty + 10,
      y: y - 17,
      size: 10,
      font: sans,
      color: COLOR.ink2,
    })

    drawRightAlignedText(
      page,
      formatMoney(item.unit_price, invoice.currency),
      tableX + cols.qty + cols.desc + cols.price - 10,
      y - 17,
      sans,
      10,
      COLOR.ink2,
    )

    drawRightAlignedText(
      page,
      formatMoney(item.total, invoice.currency),
      tableX + tableW - 10,
      y - 17,
      sans,
      10,
      COLOR.ink,
    )

    y -= rowH
  }

  // Total row
  const totalH = 38
  page.drawRectangle({
    x: tableX,
    y: y - totalH,
    width: tableW,
    height: totalH,
    color: COLOR.bgSoft,
  })
  page.drawRectangle({
    x: tableX,
    y: y - totalH,
    width: tableW,
    height: totalH,
    borderColor: COLOR.line,
    borderWidth: 0.8,
  })

  page.drawText('TOTAL', {
    x: tableX + cols.qty + cols.desc + 10,
    y: y - 24,
    size: 12,
    font: sansBold,
    color: COLOR.ink,
  })

  drawRightAlignedText(
    page,
    formatMoney(invoice.total, invoice.currency),
    tableX + tableW - 10,
    y - 24,
    serif,
    14,
    COLOR.accent,
  )

  return y - totalH
}

// =============================================================================
// Helpers
// =============================================================================

function drawCenteredText(
  page: PDFPage,
  text: string,
  startX: number,
  width: number,
  y: number,
  font: PDFFont,
  size: number,
  color: ReturnType<typeof rgb>,
) {
  const w = font.widthOfTextAtSize(text, size)
  page.drawText(text, {
    x: startX + (width - w) / 2,
    y,
    size,
    font,
    color,
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

// Sanitizes every string in a plain data object (invoice, profile, billing).
function sanitizeDeep<T>(value: T): T {
  if (typeof value === 'string') return sanitizeWinAnsi(value) as unknown as T
  if (Array.isArray(value)) {
    return value.map((v) => sanitizeDeep(v)) as unknown as T
  }
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value)) out[k] = sanitizeDeep(v)
    return out as unknown as T
  }
  return value
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
        current = w
      } else {
        current = candidate
      }
    }
    if (current) out.push(current)
  }
  return out
}

function formatNumber(value: number) {
  return new Intl.NumberFormat('es-CO', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(Number(value))
}

function formatMoney(value: number, currency: string) {
  const n = new Intl.NumberFormat('es-CO', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value))
  return `${n} ${currency}`
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
