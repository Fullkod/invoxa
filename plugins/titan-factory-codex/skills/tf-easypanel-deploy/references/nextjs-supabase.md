# EasyPanel with Next.js and remote Supabase

Use this path when the app already uses Supabase. Keep database, Auth and Storage in Supabase. A database container, Prisma migration command and SQLite volume are not required for this path.

1. Inspect Next.js version, Node requirement, lockfile, build/start commands and runtime dependencies. Enable `output: 'standalone'` in the existing Next config without replacing unrelated settings.
2. Build a multi-stage image with the project's package manager and locked dependencies. Choose an available Node image matching the project's engines; do not silently upgrade the app's runtime.
3. Supply only needed public build arguments, such as the public Supabase URL/key, at build time. They are public client configuration. Keep service-role keys, database passwords and provider secrets out of build arguments and image layers; configure them at runtime in EasyPanel.
4. Copy standalone server output, `.next/static` and `public` if that directory exists. Run as a non-root user on the exposed application port. Preserve native dependencies for the target image architecture.
5. Test the image locally if Docker is available, without provisioning a database. Verify startup, an actual route, Supabase connectivity and authorized authentication flows. Report unavailable checks accurately.
6. Configure the service in the selected EasyPanel project, persistent resources only if the app genuinely writes local data, health checks, runtime variables, domain and TLS.
7. After authorized deployment verify logs, routes, redirect URLs, HTTPS and Supabase auth allowlists. Preserve the previous working image and configuration for rollback.

For apps already using Prisma/SQLite, read the separate GUIDE.md. Verify persistent database storage and migration serialization; do not run concurrent migration/startup processes against the same SQLite file. Never seed or reset production data just because a recipe includes a seed step.

This workflow does not imply a connected VPS or EasyPanel account. Discover the supported API/CLI/UI in the current environment and verify the exact service before mutations.
