---
name: tf-supabase
description: "Work with Supabase schema, migrations, RLS, Auth, Storage, queries and metrics in a confirmed project."
---

# Supabase

Identify target project/environment. Discover actual tools; a named MCP may be absent. Use existing CLI/SDK or configured MCP. Management tokens, service-role keys and publishable/anon keys have different privileges.
Inspect schema/migrations before writing SQL. Version structural changes and test tenant ownership/RLS with representative roles. Keep privileged keys server-side. Prefer aggregates or bounded samples over unnecessary production data.
Specify filters and expected affected rows for mutations. Inspection does not authorize changes. Avoid blind mutation retries. Reports state time zone, period, aggregation, null handling and sampling. Use portable UTC-aware date handling, not macOS date flags.
[Schema example](references/schema-example.md) provides reusable structure. Verify provider docs and actual generated types before applying examples. Report queries/migrations and evidence without credentials.

Read [data operations and metrics](references/data-operations.md) for PostgREST filters, aggregate reporting, snapshots and schema documentation.
