# Validation status — 0.1.0

This file distinguishes package checks from production integration testing.

## Completed checks

- Native Codex plugin validator: passed for `.codex-plugin/plugin.json` and package structure.
- Native Codex skill validator: all 29 entrypoints passed.
- Seven agent profiles parse as TOML with required native fields. No Claude model or permission overrides are embedded.
- All 21 lifecycle/provider unit tests passed in isolated temporary folders. They cover preview behavior, preservation of instructions/memory/custom profiles, ownership conflicts, selective removal/backups, path traversal, secret-file exclusion, empty-only scaffolding, provider response parsing and Tasknic credential destination checks.

## Starter verification

An isolated copy was installed and checked on Windows with Node 24.8.0:

- `npm run typecheck`: passed after correcting Supabase SSR cookie callback types.
- `npm run lint`: passed without lint warnings after adding ESLint's official compatibility bridge for legacy plugin context APIs.
- `npm run build`: passed with Next.js 16.3.4/Turbopack and generated the scaffold routes /, /login, /signup and /dashboard.
- `npm ci --ignore-scripts --no-audit --no-fund`: passed for the included lockfile. This verifies dependency resolution/reinstallation; package lifecycle scripts were deliberately excluded from this reproducibility check.
- Tailwind's CSS entry was corrected to match installed Tailwind 3 rather than the original version-4-style import.

Verified resolution: Next.js 16.3.4, React 19.3.0, TypeScript 5.9.3, Tailwind 3.4.19, Supabase JS 2.116.0, Supabase SSR 0.6.1, ESLint 10.10.0 and @eslint/compat 2.1.1. A lockfile is included. npm still reports peer-range warnings for some legacy React/import/accessibility plugins that declare support only through ESLint 9. The compatibility bridge is intentional; successful lint is not a claim that those upstream peer declarations have changed.

These checks verify the scaffold, not completed login or billing behavior. No UI acceptance test or live Supabase authentication was claimed.

## Package result

Package integrity checks report 29 skills, seven agents and zero broken local reference links. Native plugin and skill validators passed. The original 29 SKILL.md hashes still match the recorded upstream source; the original repository was not edited.

## Runtime boundaries

The plugin has not been activated globally by creating this source project. Native subagent spawning and implicit skill selection have not been exercised in a newly installed host session. The profile files and skill metadata are structurally validated.

No real Supabase migrations, payments, emails, Tasknic writes, n8n workflow executions, OpenRouter image charges, Vercel deployments or EasyPanel changes were performed. Domain recipes retain useful upstream content but require version-specific validation in the actual target application.

The file-based memory flow has been exercised with sample projects. It is not a guarantee of account-wide or cross-device conversation memory. Portable install/update operations preserve edited/foreign files by ownership hashes; backups assist recovery but are not a transactional rollback for power/disk failures.
