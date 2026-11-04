---
name: tf-primer
description: "Load project context, stack, decisions and pending work at the start of a Titan project task."
---

# Primer

Read the project AGENTS.md and .titan/memory/MEMORY.md if present. Resolve the actual project root first. Read only relevant entries. Inspect package scripts, dependency versions, source layout and git status without changing them. Summarize verified state, outstanding work and the next action.

The preferred new-project stack is Next.js + Supabase + Vercel; EasyPanel is an alternative. Existing projects and explicit user choices take precedence. Discover available tools before invoking them; no service is connected merely because a skill exists.

If .titan is absent, continue with the existing repository. When initialization is requested, use ../../scripts/titan.py init-project with the explicit path; preview first and apply with --apply. A read-only request must not initialize or update memory.

Plugin installation does not automatically run this skill. Project initialization adds a small AGENTS.md block requesting context loading for relevant tasks. Do not reread everything for each small follow-up.
