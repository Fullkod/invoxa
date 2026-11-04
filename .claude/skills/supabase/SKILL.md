---
name: supabase
description: "Use when doing ANY task involving Supabase. Triggers: Supabase products (Database, Auth, Edge Functions, Realtime, Storage, Vectors, Cron, Queues); client libraries and SSR integrations (supabase-js, @supabase/ssr) in Next.js, React, SvelteKit, Astro, Remix; auth issues (login, logout, sessions, JWT, cookies, getSession, getUser, getClaims, RLS); Supabase CLI or MCP server; schema changes, migrations, declarative schemas, security audits, Postgres extensions (pg_graphql, pg_cron, pg_vector); debugging and troubleshooting errors or unexpected behavior on Supabase projects (HTTP errors, Postgres errors, RLS surprises, permission denied, schema cache issues, timeouts, Edge Function crashes, Realtime drops, Storage failures) and reading or querying logs (Logs Explorer, ClickHouse)."
---

# supabase (bridge for Claude Code)

This project vendors the `supabase` skill once, for every agent, under
`.agents/skills/supabase/` (tracked in `skills-lock.json` and updated with
`npx skills update --project --yes`). Claude Code only discovers `.claude/skills/`,
so this file is a thin bridge — do not copy the skill contents here.

Before doing the task:

1. Read `.agents/skills/supabase/SKILL.md` in full and follow it as the skill instructions.
2. Resolve every relative path it mentions (`references/`, `assets/`, `scripts/`,
   `templates/`) against `.agents/skills/supabase/`, not against this directory.
