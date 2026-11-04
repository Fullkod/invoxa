---
name: tf-add-manual
description: |
  Inyecta un generador interno de manual de usuario para clientes finales: editor
  por formularios, vista previa, descarga en Markdown y descarga en PDF (via el
  dialogo de impresion del navegador). Un solo schema produce manuales separados
  por audiencia (trabajador / administracion) y por idioma (espanol / ingles).
  Sin backend nuevo, sin dependencias nuevas, 100% client-side.

  Usar cuando: "necesito un manual de usuario", "documentacion para clientes",
  "generar manual", "manual para trabajadores y admin", "quiero un PDF con el
  manual de la app", "user manual", "client documentation", "manual en ingles
  y espanol", "guia de usuario descargable".

  NO USAR para: documentacion tecnica autogenerada del codigo (rutas, API,
  componentes) — eso es para developers, esto es para el cliente final. NO USAR
  para ayuda in-app (tooltips, walkthroughs) — esto produce un PDF/MD
  descargable, no help contextual dentro de la UI.
allowed-tools: Read, Write, Edit, Bash, Glob, Grep
---

# Manual Generator (client-docs)

Pantalla interna `/manual` donde tu (o el admin del proyecto) edita los datos
reales del cliente — modulos, roles, flujos, FAQs — y obtiene una vista previa
navegable, descarga en Markdown y descarga en PDF con portada, indice y
headers/footers por pagina. Todo client-side: los datos viven en un archivo
TypeScript (el schema), editable en runtime con un editor por formularios.

Basado en la implementacion real de tres proyectos (RosetAI, ROBERSA,
control-horario-app) — los gotchas documentados en `references/checklist.md`
ya estan resueltos en el codigo que este skill copia. No los reintroduzcas.

**NO preguntes de mas. Ejecuta el flujo completo.** Las dos preguntas de scope
(Paso 0) son las unicas necesarias antes de escribir codigo — todo lo demas
(rutas, gate, sidebar) sigue el default documentado abajo salvo que el proyecto
ya tenga una convencion distinta.

---

## Arquitectura

```
src/features/client-docs/
├── generators/
│   ├── types.ts                    # Contratos: ClientDocsInput, DocSection, ManualAudience, ManualLocale
│   ├── copy.ts                     # Diccionario ES/EN de TODO el texto estatico de plantilla
│   └── generateClientDocs.ts       # Pure function: input + audiencia + locale → secciones Markdown
├── schemas/
│   └── clientDocsInput.ts          # UNICO archivo con datos reales del cliente
├── services/
│   └── exportDocs.ts               # docsToMarkdown + downloadTextFile
└── components/
    ├── ClientDocsGenerator.tsx     # UI principal: editor + selectores audiencia/idioma + preview
    ├── DocsPreview.tsx             # Renderiza UNA seccion (detecta ![alt](src) → <figure>)
    ├── DocsSectionNav.tsx          # Sidebar de secciones
    ├── PrintView.tsx               # Vista de impresion (todas las secciones, logo, portada)
    ├── print.css                   # @media print (@page headers/footers) + @media screen
    └── editor/
        ├── ManualEditor.tsx        # Datos generales + una ListSection por array
        ├── ListSection.tsx         # Seccion generica<T>: anadir/borrar(confirm)/reordenar + tarjeta plegable
        ├── fields.tsx               # TextField, TextAreaField, SelectField, StringListEditor, RowButton
        └── listOps.ts               # replaceAt / removeAt / insertAt / moveBy (inmutables)

src/app/manual/
├── page.tsx                        # Ruta /manual — SIN gate por defecto, ver integration-guide.md
└── print/
    └── page.tsx                    # Ruta /manual/print
```

**Dos dimensiones ortogonales, un solo schema:**

- `audience: 'worker' | 'admin'` — filtra QUE contenido aparece.
- `locale: 'es' | 'en'` — filtra en QUE idioma esta el texto de plantilla
  (titulos de seccion, pasos del flujo de acceso, avisos de seguridad...). El
  contenido que escribe el cliente en el schema (nombres de modulos,
  descripciones, FAQs) NUNCA se traduce solo — el idioma que se tipeo ahi es
  el que sale.

Cuatro manuales de un solo schema: `worker+es`, `worker+en`, `admin+es`,
`admin+en`. Ver `references/core-contract.md` para el porque de este diseño
frente a la alternativa mas simple (guia estatica traducida a mano aparte).

**Flujo de datos:**

```
[usuario edita en el editor por formularios]  [toggle audiencia]  [toggle idioma]
                    └───────────────────┬──────────────┴──────────────┘
                                        ↓
           useMemo → docs = generateClientDocs(input, audience, locale)
                                        ↓
        ┌───────────────────────────────┼───────────────────────────────┐
        ↓                               ↓                               ↓
   [Preview en vivo]         [Descarga Markdown]              [Descarga PDF]
                        manual-{audience}-{locale}-...md              ↓
                                                       localStorage.set({input, audience, locale})
                                                                        ↓
                                    window.open(`/manual/print?audience=${a}&locale=${l}`, '_blank', 'noopener')
                                                                        ↓
                                       PrintView lee localStorage + query params (query manda)
                                                                        ↓
                                                  window.print() automatico a los ~400ms
```

---

## Paso 0 — Confirmar scope con el usuario

Antes de escribir nada, si no es obvio del contexto de la conversacion,
pregunta (una sola vez, agrupado):

1. **Audiencia:** ¿el manual necesita split trabajador/admin, o alcanza con
   uno solo? (Default si no contesta: dual — es igual de barato mantenerlo y
   casi todo SaaS termina necesitando la version admin tarde o temprano.)
2. **Idioma(s):** ¿en que idioma(s) habla el cliente final de este proyecto?
   Si es un solo idioma, el toggle de locale en la UI se puede ocultar (dejar
   el codigo, simplemente no mostrar el `ToggleGroup` de idioma) — no hace
   falta borrar nada.

Si el proyecto ya tiene `BUSINESS_LOGIC.md` (via `tf-new-app`), leelo primero —
normalmente ya contesta el idioma y quien es el cliente.

## Paso 1 — Mapear el proyecto con el Explorer

Usa el prompt de `references/integration-guide.md` (seccion "Explorer
prompt") adaptado con las rutas reales del proyecto. Sin este paso el manual
sale generico. Lanza un agente `Explore` si el proyecto tiene muchas
pantallas; hazlo tu mismo si son pocas.

## Paso 2 — Crear el arbol de archivos

```bash
mkdir -p src/features/client-docs/{generators,schemas,services,components/editor}
mkdir -p src/app/manual/print
```

## Paso 3 — Copiar el nucleo portable (sin tocar)

Copia verbatim de `references/core-contract.md`:

- `generators/types.ts`
- `generators/copy.ts`
- `generators/generateClientDocs.ts`
- `services/exportDocs.ts`

Estos cuatro archivos son identicos en cualquier proyecto Titan Factory —
nunca mencionan una marca ni un vocabulario de negocio.

## Paso 4 — Escribir el schema con datos reales

Crea `src/features/client-docs/schemas/clientDocsInput.ts` con el output del
Explorer (Paso 1), siguiendo el contrato `ClientDocsInput` de `types.ts`.

Reglas (repetidas de `integration-guide.md` porque son las que mas se
rompen):

- Acciones en imperativo dirigido al usuario ("Pulsa…", "Revisa…"), nunca
  tercera persona.
- Una accion por bullet.
- Flujos (`workflows`) exhaustivos, end-to-end: de "Entra a X" a "Confirma
  con Y", nunca un fragmento.
- Todo el vocabulario de negocio vive SOLO aca. El resto del feature es
  agnostico.
- Usa `module.audience` / el campo `image` solo para los casos borde que
  documenta `types.ts` — no los agregues por costumbre.

## Paso 5 — Copiar y adaptar los componentes UI

Copia los 9 archivos de `references/ui-components.md` en
`components/` y `components/editor/`. Salen con Tailwind vanilla
(slate/blue) — funcionan sin tocar nada en un proyecto Titan Factory recien
scaffoldeado.

Si el proyecto ya tiene un design system elegido (uno de
`.claude/design-systems/*` o tokens propios), sigue la tabla de remapeo en
`integration-guide.md` ("Adaptando el design system") antes de darlo por
terminado — un manual con la paleta por defecto en una app con branding
propio se nota.

Si `src/lib/utils.ts` no existe todavia (proyecto sin shadcn/ui instalado
aun), crealo con el `cn` minimo que trae `ui-components.md` — no agregues
`clsx`/`tailwind-merge` solo para esto.

Si el usuario pidio un solo idioma en el Paso 0, en
`ClientDocsGenerator.tsx` deja el `ToggleGroup` de audiencia pero quita el de
idioma (o dejalo, es inofensivo mostrar un toggle de un solo idioma con
opciones deshabilitadas — usa tu criterio segun cuanto ruido visual moleste).

## Paso 6 — Crear las rutas

Copia `page.tsx` y `print/page.tsx` de `integration-guide.md` (seccion
"Routes"). **Default: sin gate de auth, ruta fuera de cualquier route group
con layout/sidebar**, con `robots: noindex`. Ver esa misma seccion para las
dos alternativas de gate (columna `role`, allowlist de emails) si el
proyecto ya tiene un patron de admin establecido — no inventes uno nuevo solo
para esta ruta.

## Paso 7 — Sidebar

**Default: no enlazar.** Coherente con "sin gate". Si en Paso 6 decidiste
gatear la ruta, agrega la entrada al nav siguiendo el snippet de
`integration-guide.md`.

## Paso 8 (opcional) — Screenshots reales con Playwright

Solo si el schema usa el campo `image` en modulos. Sigue
`references/screenshots.md` — adapta `ROUTES`, los selectores de login y la
heuristica de "primer recurso de la lista" a la app real. Requiere
`playwright` como devDependency (`npm i -D playwright && npx playwright
install chromium`).

## Paso 9 — Verificar

Corre `npx tsc --noEmit` (o el script de typecheck del proyecto) y arregla
cualquier error. Despues recorre `references/checklist.md` completo — marca
cada item y reporta al usuario cuales no pudiste verificar sin su
intervencion (login real, descarga real de PDF en su navegador).

---

## Cuando NO usar este skill

- Documentacion tecnica autogenerada del codigo (rutas, componentes, API) —
  esto es para el cliente final, no para developers.
- Ayuda in-app interactiva (tooltips, walkthroughs) — esto produce un
  PDF/Markdown descargable, no help contextual dentro de la UI.
- Edicion colaborativa multi-cliente sin tocar codigo — eso necesita BD +
  formulario admin persistente, una feature mas grande (usa `tf-prp` +
  `tf-bucle-agentico` si el proyecto realmente lo necesita).

## Alternativa mas liviana para el idioma

Si el proyecto solo necesita UNA seccion puntual traducida (no el manual
completo) — por ejemplo una guia corta para trabajadores migrantes que no
justifica traducir todo el schema — la alternativa real de
control-horario-app es valida: un Markdown traducido a mano en
`content/<guide>-en.ts`, renderizado con `react-markdown` + `remark-gfm` +
`@tailwindcss/typography` en una ruta separada (`/manual/worker-en`), fuera
del generador. Mas rapido de escribir, pero se desincroniza del contenido
real si no se actualiza a mano en cada cambio — usalo solo cuando el alcance
es chico y estatico, no como reemplazo del toggle de `locale` para el manual
completo.

## Mensaje final

Despues de crear todos los archivos y validar el checklist, muestra:

```
Manual generator instalado.

- /manual → editor + preview + descargas (Markdown / PDF)
- /manual/print → vista de impresion (portada + indice + headers por pagina)
- Audiencia: trabajador / admin — un mismo schema, filtrado en vivo
- Idioma: es / en — mismo schema, plantillas traducidas
- Sin gate de auth (ruta oculta, no enlazada) — ver
  .claude/skills/tf-add-manual/references/integration-guide.md si mas
  adelante quieres protegerla por rol

Siguiente paso: completa src/features/client-docs/schemas/clientDocsInput.ts
con los datos reales del cliente (modulos, roles, flujos, FAQs) y abre
/manual para verlo.
```
