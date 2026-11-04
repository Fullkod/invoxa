# QA Report: Super admin y cambio de empresa (PRP-001, Fase 4)

**Date**: 2026-11-04
**Status**: PASSED (tras corregir 2 bugs encontrados en la primera pasada)
**Entorno**: frontend local (Vite, localhost:5173) contra Supabase de producción. Cuenta `invoxa@fullkod.com` (super admin); la sesión la inició Roberto en la ventana de Playwright.

## Test Steps
1. Lista de empresas: Informage con prefijo INF; sidebar con "Empresas" — `screenshots/01-companies-list.png`
2. Detalle de Informage: NIF B-97776744, prefijo bloqueado — `screenshots/02-company-detail.png`
3. Nueva empresa: formulario vacío y prefijo inválido muestran errores, no se envía nada — `screenshots/03-new-company-validation.png`
4. "Entrar" en Informage → dashboard de Informage; sidebar con Empresas + secciones de admin — `screenshots/04-enter-company.png`
5. Usuarios de Informage; el super admin no aparece — `screenshots/05-admin-users.png`
6. Proyectos de Informage (2) — `screenshots/06-admin-projects.png`
7. Facturas de Informage — `screenshots/07-admin-invoices.png`
8. Móvil 390 px sin scroll horizontal — `screenshots/08-mobile-companies.png`

Errores de consola: 0.

## Findings
- **Bug (corregido):** el super admin aparecía en la lista de usuarios de Informage como "Usuario" (RLS deja leer el propio perfil). Ahora las listas de usuarios y de candidatos a proyecto excluyen `super_admin`.
- **Bug (corregido):** en móvil el nombre de la empresa se cortaba a "I" por la etiqueta "Trabajando aquí". Ahora el nombre ocupa su propia fila.
- **Menor (corregido):** la tarjeta de usuario mostraba "Super_admin"; ahora "Super admin".
- El super admin ve las notificaciones de la empresa activa (5), igual que un admin.

## No probado aquí
- Crear una empresa real (`create-company`): envía una invitación por correo a un email real. Probarlo con una empresa de verdad.
- Flujos con dos empresas reales y las Edge Functions con sesión de admin/colaborador (Fase 5, INV0007).
