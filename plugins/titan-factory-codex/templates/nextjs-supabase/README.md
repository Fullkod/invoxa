# Optional Next.js / Supabase starter

This is a source scaffold, not a finished SaaS. It contains App Router routes, feature-first directories, Supabase client helpers and basic pages. Login/signup/dashboard pages are scaffold placeholders and do not implement authentication or authorization. Use tf-add-login for actual auth when requested.

Preferred deployment: Vercel. Alternative: tf-easypanel-deploy with the Supabase path. AI, payments, email, PWA and n8n are optional and their dependencies are installed only when needed.

Requirements: Node.js 20.19.x, 22.13+ or 24+ and npm; verification used Node 24.8.0. Install with `npm ci` in the generated application, preserve its lockfile, configure the public Supabase URL/key via environment, and use:

```text
npm run dev
npm run lint
npm run typecheck
npm run build
```

ESLint runs independently from the Next.js build. This starter uses ESLint 10 with the official `@eslint/compat` bridge because some React/import rules bundled by eslint-config-next still use the old context API. npm currently emits peer-range warnings for those legacy plugins; the bridge fixes the observed runtime rule failure and the complete starter lint passes. Keep this limitation visible when updating the toolchain; do not blindly remove the bridge or force unrelated dependency upgrades. The lockfile records the verified resolution.

Tailwind remains version 3 with its matching `@tailwind` CSS directives and PostCSS configuration. No database, account or deployment is provisioned by copying this directory.

The toolkit's scaffold command rejects nonempty destinations. For existing applications, apply individual skills instead of copying this starter over the project.
