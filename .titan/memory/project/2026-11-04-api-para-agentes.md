# API para agentes (PRP-002) — decisión

Date: 2026-11-04
Fuente: conversación con Roberto el 2026-11-04; plan en `.titan/plans/PRP-002-agent-api.md`.
Tareas Tasknic: INV0008 (madre), INV0009–INV0013. Se implementa en otro chat.

- Objetivo: que Claude Code, Codex, n8n o scripts registren y consulten las horas de un colaborador
  (Edge Function `agent-api` + API keys personales `ivx_…`), al estilo de la Agent API de Tasknic.
- **Decisiones de Roberto:** primera fase solo para colaboradores (la key nunca es admin); API REST +
  skill `invoxa` primero, MCP más adelante como capa encima; tarifa fija = solo consulta.
- En BD solo el hash de la key; tareas creadas por API marcadas con `tasks.source = 'api'`.
- Gotcha clave: `agent-api` recibe una key y no un JWT → desplegar con `--no-verify-jwt` y validar dentro.
