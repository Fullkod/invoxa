# QA Report: Agent API (PRP-002)

**Date**: 2026-11-04
**Status**: PASSED (SQL 1/1 · API 17/17 · UI 10/10)
**Entorno**: frontend local (`localhost:5173`) contra Supabase de producción. Colaborador real
`roberto@commercecraft.ai` (CommerceCraft, proyecto por hora **Microscope**), sesión iniciada a mano por
Roberto en Playwright. Todas las keys y tareas de prueba se borraron al terminar.

## 1. Aislamiento SQL (`supabase/tests/company_isolation_test.sql`, ampliada)
Transacción revertida. Todo lo de PRP-001 sigue igual y además: key `ivx_` de 47 caracteres; el colaborador
ve solo su key; `key_hash` no se puede leer desde el cliente; insert directo bloqueado; otro colaborador y el
admin de otra empresa no la ven ni la revocan; un admin no puede crear keys; el admin de su empresa la
ve y la revoca; el hash guardado es el SHA-256 de la key.

## 2. API (`api.sh`, key temporal generada en local; solo el hash pasó por la BD)
| Caso | Resultado |
|---|---|
| Sin key / key falsa | 401 / 401 |
| `GET /`, `GET /projects` | 200 (Microscope y Agentes de CT, por hora, 5 USD) |
| `POST /tasks` "Microscope" 1.5 h; "microscope" con `"2,5"` | 201 / 201, `source = api` |
| Horas 30 · proyecto inexistente · campo extra `user_id` | 400 · 404 (con `available`) · 400 |
| `PATCH`/`DELETE` tarea de otro usuario | 404 / 404 |
| Ruta desconocida · mes `2026-13` | 404 · 400 |
| `PATCH` propia (horas + observaciones) | 200 |
| `PATCH`/`DELETE` facturada (`invoice_id` puesto temporalmente) | 409 / 409 |
| `GET /tasks?project=Microscope&billed=false` · `/summary` · `/invoices` | 200 (12 h, 60 USD estimado) · 200 · 200 |
| `DELETE` propias | 200 ×2 |
| Key revocada | 401 |

## 3. UI (`ui.mjs`, Playwright)
1. Sección "Acceso para agentes" en Datos de facturación — `screenshots/01-section.png`
2. Crear key → se muestra una vez (enmascarada en la captura) — `02-created.png`
3. Botón Copiar → la key queda en el portapapeles
4. La key funciona contra la API; tarea creada por API con la marca **Agente** en `/app/tasks` — `03-tasks-agent-pill.png`
5. Lista con prefijo `ivx_xxxxxxxx…` y "último uso"; la key completa ya no aparece — `04-list.png`
6. Móvil 390 px sin scroll horizontal — `05-mobile.png`
7. Revocar desde la UI → "1 key revocada" y la API responde 401 — `06-revoked.png`

## Findings
- **Corregido durante el QA:** la lista de keys mostraba "sin usar" tras usar la key (caché de React Query de
  30 s). `useMyApiKeys` ahora refresca siempre al abrir.
- La marca "Agente" del admin está en el detalle de proyecto (`/admin/projects/:id`); no se probó con sesión de admin.
- `task_date` por defecto es hoy en **UTC** (de noche en América sale el día siguiente); el skill obliga a mandarla.
- Advisors de Supabase: avisos previos a este PRP (funciones `security definer` ejecutables por `anon`, p. ej.
  `generate_user_invoice`, `next_invoice_number`); conviene revisarlos en otro PRP.

## No probado
- El skill `invoxa` usado desde otro repo por Claude Code (Fase 4, validación pendiente).
- Usuario `inactive` / empresa desactivada (lógica en `_shared/apiKey.ts`, no ejecutada en vivo).
