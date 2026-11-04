# Adaptation decisions

| Source finding | Resolution |
|---|---|
| README counts and aliases differed from the filesystem | Catalog generated from 29 actual SKILL.md files; landing/qa mapped explicitly; no fictional sprint skill. |
| CLAUDE.md mixed factory instructions and fixed product architecture | Repository AGENTS.md plus a small per-project block; preferred stack retained without migrating existing apps. |
| Claude frontmatter, tools and substitution | Codex name/description entrypoints, actual tool discovery and relative resources; no fork/model permission claims. |
| Seven Claude subagent files | Seven native TOML profiles inheriting model/permissions, plus supplemental role recipes. No automatic delegation. |
| Shared memory tied to Claude auto-memory settings | Project-local .titan files, explicit context reading and no edits to host memory configuration. |
| Hook existed but was not registered | Opt-in local logger; no claim of post-tool automatic execution. |
| Update overwrote same-name customized skills | Manifest hashes, preflight conflict detection and backups. Upstream imports require review. |
| Eject recursively removed factory state | Owned-file removal and project-block detachment; project knowledge remains. |
| Autoresearch had destructive rollback and indefinite language | Isolated candidate copies, finite limits and held-out evaluation; no Git reset. |
| Ordinary Playwright CLI examples used unsupported interactive commands | Playwright Test/browser-tool workflow and official command discovery. |
| Tasknic had a hardcoded tenant and assumed agent/admin identity | Environment URL/key, actual attribution and permission discovery, structured JSON helper. |
| Image provider used a fixed old preview model and fragile response parsing | Native image routing; optional explicit model, supported images field, MIME validation and overwrite refusal. |
| EasyPanel assumed Prisma/SQLite despite Supabase default | Separate Next.js/Supabase path; preserved Prisma/SQLite recipe only for matching projects. |
| Starter advertised missing typecheck and obsolete lint invocation | Typecheck script and ESLint flat config; starter status documented. |
| Starter mixed Tailwind 4 CSS import with Tailwind 3 dependencies | Matching Tailwind 3 directives; verified production build. |
| Supabase SSR cookie callback failed strict TypeScript | Type derived from the installed public SetAllCookies contract. |
| ESLint 9 was end-of-life; bundled legacy rules crashed under ESLint 10 | Official compatibility bridge, lockfile and successful lint; remaining npm peer-range warnings documented. |
| AI recipes assumed OpenRouter/one SDK for every app | Preserve recipes but select by actual provider/version and required capability. |
| Visual recipes imposed a mascot and language on all clients | Optional original assets, project brand/language priority. |

## Preservation and validation scope

All original skill capabilities have a Codex entrypoint. Large domain guides and their references are preserved where useful; orchestration, identity, updates and deletion workflows are rewritten. See migration-manifest.json for source hashes and rewrite classifications. Technical examples remain recipes, not version-independent production code. Actual auth, payments, external API execution and deployments must be checked in the target environment.

Next.js/Supabase/Vercel is the owner's preferred stack. Optional provider choices (Polar, Resend, OpenRouter) and EasyPanel do not silently replace an existing project integration.
