# Supabase data operations and metrics

Preserved capabilities from the original skill, independent of Bash/macOS credential parsing. Use configured SDK/MCP or structured HTTP requests with actual environment and privileges. Verify current API syntax before execution.

## PostgREST

- Select needed columns and bound results. Common filter operators include eq, neq, gt, gte, lt, lte, like, ilike, in and is.null. Encode values rather than interpolating untrusted strings.
- Sort explicitly and paginate. Distinguish a page count from the full count; use the supported exact-count mechanism when needed.
- Insert explicit columns; update/delete with ownership and target filters. Verify affected rows and do not retry blindly after timeouts.
- Upserts require a real unique constraint and deliberate conflict target. Preserve columns outside partial updates.
- Service-role credentials bypass RLS. Verify policies with user-scoped clients, not only successful admin queries.

## SQL and schema

Use versioned migrations for DDL and appropriate tools for inspection/DML. Document table purpose, columns, constraints, indexes, foreign keys, policies and actual grants. Mark critical tables based on this project. Store schema documentation in the project, not in the installed plugin.

Use timezone-aware ISO timestamps. In Python, `datetime.now(timezone.utc) - timedelta(days=7)` is portable; explicit SQL intervals may also fit. State the business time zone.

## Business metrics

- **MRR:** aggregate active recurring subscriptions, normalize yearly amounts and keep currency units explicit. Completed one-off purchases do not define MRR. Clarify discounts, refunds, taxes and currency handling.
- **Churn signal:** scheduled cancellations can indicate future churn, not necessarily realized churn. State period, denominator and deduplication.
- **Conversion funnel:** raw event counts are not user conversion rates. Define ordered stages, unique subject/session and a consistent cohort/window.
- **Daily snapshots:** use date/tenant/currency keys matching the grain, uniqueness and idempotent writes. Schedule only when requested, with credentials and error handling. Writing a query does not activate a scheduler.

Document definitions alongside results so another project does not inherit incompatible metrics merely because column names match.
