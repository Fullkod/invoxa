# Titan Factory para Claude Code y Codex

Date: 2026-11-04
Fuente: instalación pedida por Roberto el 2026-11-04 ("al igual que a los demás proyectos, con la variante para Codex").

- Capa copiada de los archivos versionados de kshop (que a su vez viene de klauShop): Claude toolbox
  `1d92ede` (`.claude/titan-factory-source.json`) y plugin Codex 0.1.0 en `plugins/titan-factory-codex/`,
  con marketplace renombrado a `invoxa` (`.agents/plugins/marketplace.json`, `.codex/config.toml`).
- No se copió el `.mcp.json` ni el lanzador de Supabase MCP de kshop: Invoxa no tiene MCP configurado.
- ~~`.env.local` no tiene `TASKNIC_API_KEY`~~ (superado 2026-11-04: la key propia del proyecto ya está en `.env.local`, empresa Fullkod, proyecto Tasknic "Invoxa"; exige `requested_by`).
- ESLint ignora `.agents`, `.claude` y `plugins`; `tsconfig.app.json` solo incluye `src`.
- Verificación: `python plugins/titan-factory-codex/scripts/validate.py` → 29 skills, 7 agentes, sin errores.
