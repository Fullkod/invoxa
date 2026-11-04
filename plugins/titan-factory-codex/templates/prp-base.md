# Feature plan template

Use .titan/plans/prp-<feature>.md in the target project. Scale headings to complexity. Existing implementation authorization remains valid; planning-only work stops at the plan.

## Objective and value
Describe the observable outcome and problem solved. Distinguish requirements from assumptions.

## Scope and stack
Record included behavior, exclusions and actual integration choices. Prefer Next.js + Supabase + Vercel for new compatible projects, with EasyPanel available. Existing project decisions govern.

## Expected behavior and acceptance
Describe the main journey, meaningful failure/empty states, measurable criteria and access boundaries. A screenshot alone does not verify data or authorization.

## Evidence and architecture
Reference real files/symbols and current API documentation. Explain reused patterns and contracts. For schema changes include ownership, RLS, migrations and recovery appropriate to the operation. Do not invent existing schemas.

## Phases
For each phase specify outcome, required context and verification. Derive detailed tasks when entering it after inspecting current state. Use actual project scripts rather than a fixed checklist.

## Verification and rollout
Record checks, evidence, failures and unavailable coverage. Identify preview versus production and recovery options where needed.

## Decisions and lessons
Record dated decisions, narrow lessons, evidence and superseded assumptions. Keep open questions visible. Documentation reduces recurrence; it cannot guarantee mistakes never recur.

## Status
Use planned / in progress / completed / blocked with evidence. File generation alone is not completion. Reference existing authorization or a concrete missing decision instead of automatically adding another approval checkpoint.
