---
name: tf-easypanel-deploy
description: "Deploy to a VPS with EasyPanel using Next.js/Supabase or an existing Prisma/SQLite application."
---

# Easypanel Deploy

Identify stack, build/start commands, VPS, domain and environment. For the preferred Next.js + remote Supabase path retain Supabase and package the app as a standalone container. Read [Supabase deployment](references/nextjs-supabase.md).
Read [GUIDE.md](GUIDE.md) only for an existing Prisma/SQLite application. SQLite volumes, Prisma migrations and NextAuth settings do not apply to the Supabase path. Never migrate the database merely to deploy.
Inspect Dockerfile/lockfile, build when tooling is available, configure runtime secrets and verify health/logs/DNS/TLS. Distinguish build-time public variables from runtime server secrets. Prepare artifacts before any unresolved deployment approval; proceed when publishing to this target is already authorized. Keep a rollback image/config and preserve data volumes.
