# API para agentes (PRP-002) — decisión

Date: 2026-11-04
Fuente: conversación con Roberto el 2026-11-04; plan en `.titan/plans/PRP-002-agent-api.md`.
Tareas Tasknic: INV0008 (madre), INV0009–INV0013. **Implementado el 2026-11-04** (ver estado abajo).

- Objetivo: que Claude Code, Codex, n8n o scripts registren y consulten las horas de un colaborador
  (Edge Function `agent-api` + API keys personales `ivx_…`), al estilo de la Agent API de Tasknic.
- **Decisiones de Roberto:** primera fase solo para colaboradores (la key nunca es admin); API REST +
  skill `invoxa` primero, MCP más adelante como capa encima; tarifa fija = solo consulta.
- En BD solo el hash de la key; tareas creadas por API marcadas con `tasks.source = 'api'`.
- Gotcha clave: `agent-api` recibe una key y no un JWT → desplegar con `--no-verify-jwt` y validar dentro.

## Estado (2026-11-04)
- En producción: tabla `api_keys` + RPC `create_api_key`/`revoke_api_key` (migración `20261104000006`),
  `tasks.source`, Edge Function `agent-api` (verify_jwt = false, en `supabase/config.toml`).
- Frontend: tarjeta "Acceso para agentes" en `/app/billing-profile` (`src/features/user/api-keys/`) y marca
  "Agente" en las tareas (usuario y detalle de proyecto del admin). Pendiente de push a Vercel.
- Skill `invoxa` en `.claude/skills/invoxa/` y `plugins/titan-factory-codex/skills/invoxa/` (idénticos).
  Para usarlo en otro repo: copiarlo a `~/.claude/skills/invoxa/` y poner `INVOXA_API_KEY` en `.env.local`.
- Pruebas: `supabase/tests/company_isolation_test.sql` ampliada (keys); QA de API y UI en `.titan/qa/2026-11-04-agent-api/`.
