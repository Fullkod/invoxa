// Starts the Supabase MCP server with this project's account.
// Reads SUPABASE_ACCESS_TOKEN from .env.local (one Supabase account per project).
// Used by .mcp.json: node scripts/supabase-mcp.mjs

import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const envPath = join(dirname(fileURLToPath(import.meta.url)), "..", ".env.local");

const env = { ...process.env };
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const match = line.match(/^SUPABASE_ACCESS_TOKEN=(.*)$/);
    if (match) env.SUPABASE_ACCESS_TOKEN = match[1].trim();
  }
}

const child = spawn(
  "npx",
  ["-y", "@supabase/mcp-server-supabase@latest", "--project-ref=prabpfidllznbtthmkxz"],
  { env, stdio: "inherit", shell: process.platform === "win32" }
);
child.on("exit", (code) => process.exit(code ?? 0));
