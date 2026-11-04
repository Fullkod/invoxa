# Working on Titan Factory Codex

This repository is a reusable toolkit, not a client application. Preserve all 29 upstream skill capabilities and seven agent roles unless the user changes scope. The owner's preferred new-app stack is Next.js + Supabase + Vercel; retain EasyPanel as a supported alternative.

- Keep skill entrypoints scoped and short; preserve substantial domain knowledge in linked references. Check actual dependency versions before applying recipes.
- Keep runtime resources relocatable. Resolve plugin resources relative to the skill/script; write application memory, plans and artifacts only to the selected project.
- Do not hardcode tenant URLs, human identities, credentials, Claude models or nonexistent tool names.
- Preserve existing authorization. Do not add repeated approval gates or delegate merely because agents exist.
- Lifecycle commands preview by default. Preserve foreign and locally modified files; validate paths and ownership before mutations. Never remove project memory as part of an update/uninstall.
- Tests belong in isolated temporary directories. Run `python scripts/validate.py` and `python -m unittest discover -s tests -v` for lifecycle changes. Use the native plugin/skill validators when available.
- Changes to this source do not automatically update an installed plugin. Report source, installation, connections and runtime validation separately.
- Keep the original sibling Titan Factory repository unchanged. Preserve attribution and migration records.
