export type LandingLang = 'es' | 'en'

export type LandingStrings = {
  nav: { product: string; how: string; cases: string; faq: string; login: string }
  hero: {
    eyebrow: string
    title: string
    subtitle: string
    cta: string
    ctaSub: string
    terminal: string[]
  }
  manifest: {
    tag: string
    title: string
    body: string
    pillars: { k: string; v: string }[]
  }
  how: {
    tag: string
    title: string
    admin: { role: string; name: string; actions: string[] }
    user: { role: string; name: string; actions: string[] }
  }
  features: {
    tag: string
    title: string
    items: { t: string; d: string }[]
  }
  cases: {
    tag: string
    title: string
    items: { who: string; sit: string; res: string }[]
  }
  faq: {
    tag: string
    title: string
    items: { q: string; a: string }[]
  }
  cta: { title: string; sub: string; btn: string }
  footer: { by: string; cols: { t: string; l: string[] }[] }
}

export const LANDING_STRINGS: Record<LandingLang, LandingStrings> = {
  es: {
    nav: { product: 'Producto', how: 'Cómo funciona', cases: 'Casos', faq: 'FAQ', login: 'Entrar' },
    hero: {
      eyebrow: 'INVOXA · BY FULLKOD',
      title: 'Facturar deja\nde ser una pelea.',
      subtitle:
        'Invoxa centraliza las horas, los proyectos y las facturas de tu equipo creativo. Tú apruebas — el sistema entrega el PDF al cliente.',
      cta: 'Pedir acceso',
      ctaSub: 'Beta privada · cupos limitados',
      terminal: [
        '$ invoxa generate --month=mayo',
        '✓ 14 colaboradores listos',
        '✓ 9 proyectos consolidados',
        '✓ 23 facturas generadas',
        '$ invoxa send --to=clientes',
      ],
    },
    manifest: {
      tag: 'MANIFIESTO',
      title: 'Una factura no es papeleo. Es el cierre de un acuerdo humano.',
      body: 'Construimos Invoxa porque hartamos las hojas de cálculo, los pdf perdidos en correo y los meses cerrados a mano. Una herramienta para equipos pequeños que tratan a su gente como gente.',
      pillars: [
        { k: 'Cálido', v: 'Tipografía con curvas, palabras claras, ningún tecnicismo de contabilidad.' },
        { k: 'Soberano', v: 'Tu data, tu numeración, tus condiciones. Sin lock-in.' },
        { k: 'Humano', v: 'Diseñado pensando en el colaborador y en el admin como personas, no como roles.' },
      ],
    },
    how: {
      tag: 'CÓMO FUNCIONA',
      title: 'Dos personas. Un mes cerrado en minutos.',
      admin: {
        role: 'Admin',
        name: 'María',
        actions: [
          'Crea proyectos y suma colaboradores con un código.',
          'Define tarifas y modalidad: por hora o tarifa fija.',
          'Solicita la facturación a todo el equipo el día 25.',
          'Aprueba, ajusta números y firma los PDF.',
        ],
      },
      user: {
        role: 'Colaborador',
        name: 'Ricardo',
        actions: [
          'Recibe la invitación y completa su perfil de cobro.',
          'Registra horas o tareas durante el mes.',
          'Genera su factura propuesta cuando llega la solicitud.',
          'Recibe confirmación cuando el cliente pagó.',
        ],
      },
    },
    features: {
      tag: 'CARACTERÍSTICAS',
      title: 'Lo que el equipo gana.',
      items: [
        { t: 'Numeración soberana', d: 'Cada colaborador propone su número, el admin aprueba o ajusta. Cero choques en la DIAN.' },
        { t: 'Ciclo mensual', d: 'Calendario fijo: invitación, registro, generación, aprobación, envío, pago.' },
        { t: 'Doble modalidad', d: 'Por hora con timesheet integrado o tarifa fija con hitos. Mezclables por proyecto.' },
        { t: 'PDF entregable', d: 'Documento listo con tu marca, datos fiscales y observaciones. Descargable o enviado por correo.' },
        { t: 'Audit trail', d: 'Cada cambio de número, cada aprobación, cada envío queda registrado y exportable.' },
        { t: 'Bilingüe', d: 'Interfaz y plantillas de factura en español o inglés. Cambias por proyecto.' },
      ],
    },
    cases: {
      tag: 'EQUIPOS QUE LO USAN',
      title: 'Para estudios pequeños que ya no caben en la hoja de cálculo.',
      items: [
        { who: 'Estudio de diseño · 8 personas', sit: 'Cerraban el mes en 3 días, con errores de numeración.', res: 'Ahora cierran un viernes en la tarde.' },
        { who: 'Productora · 12 freelancers', sit: 'Cada freelancer enviaba una factura distinta.', res: 'Una sola plantilla, una sola conversación.' },
        { who: 'Agencia regional · 22 personas', sit: 'El admin armaba todo a mano en Excel.', res: 'El sistema arma; el admin firma.' },
      ],
    },
    faq: {
      tag: 'PREGUNTAS',
      title: 'Lo que nos preguntan.',
      items: [
        { q: '¿Quién emite la factura, ustedes o nosotros?', a: 'Tu colaborador la emite. Invoxa la prepara con su numeración, sus datos fiscales y su perfil. Tú apruebas y se envía al cliente final.' },
        { q: '¿Qué pasa si un colaborador no cumple el día 25?', a: 'El sistema le recuerda. Si no genera, el admin puede generar por él con base en las tareas/horas registradas.' },
        { q: '¿Soporta DIAN, SAT, IVA, retenciones?', a: 'Manejamos los campos fiscales más comunes en LATAM y el formato del PDF cumple con los requisitos básicos. Para facturación electrónica oficial, integramos con tu proveedor.' },
        { q: '¿Cuánto cuesta?', a: 'Beta privada gratuita hasta agosto 2026. Después, plan por equipo activo. Sin tarjeta para entrar a la beta.' },
        { q: '¿Y mis datos?', a: 'Tu data es tuya. Exportable en CSV/PDF en cualquier momento. Encriptación en reposo y en tránsito.' },
      ],
    },
    cta: {
      title: 'Cierra el próximo mes con Invoxa.',
      sub: 'Te damos onboarding, plantilla de factura con tu marca y un canal directo con el equipo.',
      btn: 'Pedir acceso a la beta',
    },
    footer: {
      by: 'INVOXA · UN PRODUCTO DE',
      cols: [
        { t: 'Producto', l: ['Características', 'Cómo funciona', 'Precios', 'Roadmap'] },
        { t: 'Empresa', l: ['Sobre nosotros', 'Casos', 'Contacto'] },
        { t: 'Legal', l: ['Términos', 'Privacidad', 'Tratamiento de datos'] },
      ],
    },
  },
  en: {
    nav: { product: 'Product', how: 'How it works', cases: 'Customers', faq: 'FAQ', login: 'Sign in' },
    hero: {
      eyebrow: 'INVOXA · BY FULLKOD',
      title: 'Billing stops\nbeing a fight.',
      subtitle:
        'Invoxa centralizes hours, projects and invoices for your creative team. You approve — the system delivers the PDF to the client.',
      cta: 'Request access',
      ctaSub: 'Private beta · limited seats',
      terminal: [
        '$ invoxa generate --month=may',
        '✓ 14 collaborators ready',
        '✓ 9 projects consolidated',
        '✓ 23 invoices generated',
        '$ invoxa send --to=clients',
      ],
    },
    manifest: {
      tag: 'MANIFESTO',
      title: 'An invoice is not paperwork. It is the close of a human agreement.',
      body: 'We built Invoxa because we were tired of spreadsheets, PDFs lost in email, and months closed by hand. A tool for small teams who treat their people like people.',
      pillars: [
        { k: 'Warm', v: 'Type with curves, plain words, zero accounting jargon.' },
        { k: 'Sovereign', v: 'Your data, your numbering, your terms. No lock-in.' },
        { k: 'Human', v: 'Designed thinking of the collaborator and the admin as people, not roles.' },
      ],
    },
    how: {
      tag: 'HOW IT WORKS',
      title: 'Two people. One month closed in minutes.',
      admin: {
        role: 'Admin',
        name: 'María',
        actions: [
          'Creates projects and adds collaborators with a code.',
          'Sets rates and mode: hourly or fixed fee.',
          'Requests billing from the whole team on the 25th.',
          'Approves, adjusts numbers and signs the PDFs.',
        ],
      },
      user: {
        role: 'Collaborator',
        name: 'Ricardo',
        actions: [
          'Receives the invite and completes their billing profile.',
          'Logs hours or tasks during the month.',
          'Generates their proposed invoice when the request arrives.',
          'Gets a confirmation when the client paid.',
        ],
      },
    },
    features: {
      tag: 'FEATURES',
      title: 'What the team gains.',
      items: [
        { t: 'Sovereign numbering', d: 'Each collaborator proposes their number, the admin approves or adjusts. No tax-office collisions.' },
        { t: 'Monthly cycle', d: 'Fixed calendar: invitation, logging, generation, approval, sending, payment.' },
        { t: 'Dual mode', d: 'Hourly with built-in timesheet or fixed fee with milestones. Mixable per project.' },
        { t: 'Deliverable PDF', d: 'Document ready with your brand, tax data and notes. Downloadable or emailed.' },
        { t: 'Audit trail', d: 'Every number change, every approval, every send is logged and exportable.' },
        { t: 'Bilingual', d: 'UI and invoice templates in Spanish or English. Switch per project.' },
      ],
    },
    cases: {
      tag: 'TEAMS THAT USE IT',
      title: 'For small studios who outgrew the spreadsheet.',
      items: [
        { who: 'Design studio · 8 people', sit: 'Closed the month in 3 days, with numbering errors.', res: 'Now they close on a Friday afternoon.' },
        { who: 'Production company · 12 freelancers', sit: 'Each freelancer sent a different invoice.', res: 'One template, one conversation.' },
        { who: 'Regional agency · 22 people', sit: 'The admin built everything by hand in Excel.', res: 'The system builds; the admin signs.' },
      ],
    },
    faq: {
      tag: 'QUESTIONS',
      title: 'What people ask.',
      items: [
        { q: 'Who issues the invoice, you or us?', a: 'Your collaborator issues it. Invoxa prepares it with their numbering, tax data and profile. You approve and it gets sent to the end client.' },
        { q: 'What if a collaborator misses the 25th?', a: "The system reminds them. If they don't generate, the admin can generate on their behalf based on logged tasks/hours." },
        { q: 'Does it support DIAN, SAT, VAT, withholdings?', a: 'We handle the most common fiscal fields across LATAM and the PDF format meets basic requirements. For official e-invoicing, we integrate with your provider.' },
        { q: 'How much does it cost?', a: 'Free private beta until August 2026. After that, per-active-team plan. No card required to join the beta.' },
        { q: 'And my data?', a: 'Your data is yours. Exportable as CSV/PDF anytime. Encrypted at rest and in transit.' },
      ],
    },
    cta: {
      title: 'Close next month with Invoxa.',
      sub: 'We give you onboarding, an invoice template with your brand and a direct channel with the team.',
      btn: 'Request beta access',
    },
    footer: {
      by: 'INVOXA · A PRODUCT BY',
      cols: [
        { t: 'Product', l: ['Features', 'How it works', 'Pricing', 'Roadmap'] },
        { t: 'Company', l: ['About', 'Cases', 'Contact'] },
        { t: 'Legal', l: ['Terms', 'Privacy', 'Data handling'] },
      ],
    },
  },
}
