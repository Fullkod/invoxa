# Native agent roles

All seven original specialties are available as `tf-*.toml` files using native `name`, `description` and `developer_instructions`. They inherit host model and permissions.

| Role | Purpose |
|---|---|
| tf-backend-specialist | Business logic, APIs and integrations |
| tf-frontend-specialist | UI, responsive behavior and accessibility |
| tf-supabase-admin | Schema, RLS and data operations |
| tf-codebase-analyst | Read-only architecture and code mapping |
| tf-vercel-deployer | Preferred Vercel deployment workflow |
| tf-gestor-documentacion | Documentation and project knowledge |
| tf-validacion-calidad | Behavior checks and reproducible findings |

`init-project --agents` copies profiles into `.codex/agents/` without overwriting existing files. Discovery depends on host version. Plugin installation does not automatically register these globally. A host without native profile loading can use the same instructions for authorized bounded delegation. Copying a profile does not launch an agent.

The `references/` folder retains detailed original recipes for consultation. Current native profile scope and the selected project's actual tools/providers govern those examples.
