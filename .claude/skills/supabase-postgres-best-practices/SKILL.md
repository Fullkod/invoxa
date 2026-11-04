---
name: supabase-postgres-best-practices
description: "Postgres best practices maintained by Supabase, for Postgres running anywhere. Load this skill BEFORE writing or changing anything that lives in a Postgres database: creating or altering tables and columns (including choosing column types), schema design, migrations and declarative schema files, RLS policies and the tests that verify them, indexes, triggers, database functions, queues and scheduled jobs (pg_cron, pgmq), vector/semantic search (pgvector), and restoring dumps (pg_restore) or importing data. Also load it when diagnosing slow queries, high CPU, timeouts, EXPLAIN plans, connection exhaustion, locking, bloat, or rows visible to the wrong user or tenant. This is not just a performance guide — schema, migration, security, and SQL authoring tasks need these rules too, even for a one-column change or a single query."
---

# supabase-postgres-best-practices (bridge for Claude Code)

This project vendors the `supabase-postgres-best-practices` skill once, for every agent, under
`.agents/skills/supabase-postgres-best-practices/` (tracked in `skills-lock.json` and updated with
`npx skills update --project --yes`). Claude Code only discovers `.claude/skills/`,
so this file is a thin bridge — do not copy the skill contents here.

Before doing the task:

1. Read `.agents/skills/supabase-postgres-best-practices/SKILL.md` in full and follow it as the skill instructions.
2. Resolve every relative path it mentions (`references/`, `assets/`, `scripts/`,
   `templates/`) against `.agents/skills/supabase-postgres-best-practices/`, not against this directory.
