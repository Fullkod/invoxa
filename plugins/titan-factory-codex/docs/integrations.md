# Optional integrations

The plugin includes workflows, not active account connections. No credential is bundled. Configure only the tools needed for the current project; verify actual discovered tool names before calling them. Do not translate a template JSON file into a claim that a server is connected.

## Preferred stack

- **Next.js**: preserve the project's version/lockfile. Next DevTools is optional for runtime diagnostics.
- **Supabase**: prefer a project-scoped MCP connection using the current official setup. Hosted OAuth does not require embedding a personal token. The example below is disabled and uses an explicit placeholder. For implementation, choose write access only when the task requires it; read-only queries are enough for exploration.
- **Vercel**: use existing project linkage and the available official CLI/connector. No Vercel identity or project ID is assumed. The tf-vercel-deployer role prepares and verifies the selected preview or production deployment.
- **EasyPanel**: retain the VPS alternative. Discover the actual installed panel/API or use an authorized browser session. Configure the chosen app/service/domain, not a hardcoded instance. Supabase and Prisma/SQLite have separate recipes.

## Source MCP catalog retained

| Source capability | Codex adaptation |
|---|---|
| Playwright | Prefer an available browser tool or Playwright Test; optional MCP example. |
| Chrome DevTools | Optional runtime/browser diagnostics server; enable only if useful. |
| Next DevTools | Optional server for compatible Next.js development environments. |
| Supabase | Project-scoped official remote endpoint and host OAuth setup. |
| n8n | Preserve all seven skills; optional Docker server with environment forwarding. Validate image/version before enabling. |
| Brave Search | Preserve as an optional search provider; use a verified current server or existing host search. Source package is not automatically installed. |
| Firecrawl | Optional configured crawling provider; use current verified server/API and its key. |
| Sequential Thinking | Optional source capability; ordinary planning does not depend on it. |
| Firebase | Optional for projects that actually use Firebase; it does not replace Supabase by default. |
| Google Workspace | Preserve the intended capability, but the source package name was not validated. Select a real connected app or a verified server; no unverified executable is shipped as a working integration. |

The source `_comment_google` pseudo-server is removed; comments belong in TOML comments/docs, not a map that expects server objects.

## Configuration examples

[mcp.example.toml](../templates/mcp.example.toml) is a **disabled reference**, not imported configuration. Inspect installed host/server versions, choose the project and fill required values before selectively incorporating it into the supported Codex configuration. Existing connections and tools take priority. Do not overwrite the user's complete config file.

Tasknic uses `TASKNIC_API_URL` and `TASKNIC_API_KEY`. OpenRouter image fallback uses `OPENROUTER_API_KEY` and an explicit `--model`. App AI recipes can retain an existing provider. Credentials belong in process/project secret configuration, never in skills, memory, logs or the plugin manifest.

The [optional event logger](../scripts/log_event.py) writes non-sensitive event names only when explicitly run. It is not registered as a post-tool hook and is not a complete audit log. Use the host's supported hook facility only after verifying that version's event schema.

## Sources checked for the adaptation

- [Codex MCP configuration](https://learn.chatgpt.com/docs/extend/mcp?surface=cli)
- [Supabase MCP and project scoping](https://supabase.com/docs/guides/ai-tools/mcp)
- [Playwright CLI](https://playwright.dev/docs/test-cli)
- [Next.js ESLint configuration](https://nextjs.org/docs/app/api-reference/config/eslint)
- [OpenRouter image response format](https://openrouter.ai/docs/guides/overview/multimodal/image-generation)

Server execution and credentials have not been validated against live accounts as part of source adaptation.
