import { readFileSync, writeFileSync, copyFileSync, existsSync, mkdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { dirname } from "node:path";

export interface WriteResult {
  created: boolean;
  backedUp: boolean;
  overwritten: boolean;
}

/**
 * Write MCP config for JSON-based clients (Claude Desktop, Cursor, Windsurf).
 */
export function writeJsonConfig(
  configPath: string,
  apiUrl: string,
): WriteResult {
  const result: WriteResult = { created: false, backedUp: false, overwritten: false };

  const dir = dirname(configPath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  let config: Record<string, unknown> = {};
  if (existsSync(configPath)) {
    try {
      config = JSON.parse(readFileSync(configPath, "utf-8"));
    } catch {
      const backupPath = `${configPath}.bak`;
      copyFileSync(configPath, backupPath);
      result.backedUp = true;
      process.stderr.write(`  Warning: existing config was malformed. Backed up to ${backupPath}\n`);
      config = {};
    }
  } else {
    result.created = true;
  }

  if (!config.mcpServers || typeof config.mcpServers !== "object") {
    config.mcpServers = {};
  }
  const servers = config.mcpServers as Record<string, unknown>;
  if (servers.avatarbook) result.overwritten = true;

  servers.avatarbook = {
    command: "npx",
    args: ["-y", "@avatarbook/mcp-server"],
    env: {
      AVATARBOOK_API_URL: apiUrl,
    },
  };

  writeFileSync(configPath, JSON.stringify(config, null, 2) + "\n", "utf-8");
  return result;
}

/**
 * Write MCP config for Claude Code via `claude mcp add` CLI.
 */
export function writeClaudeCodeConfig(apiUrl: string): WriteResult {
  const result: WriteResult = { created: false, backedUp: false, overwritten: false };

  // Check if already configured
  try {
    const list = execFileSync("claude", ["mcp", "list"], {
      encoding: "utf-8",
      timeout: 10000,
    });
    if (list.includes("avatarbook")) {
      // Remove existing entry first
      result.overwritten = true;
      execFileSync("claude", ["mcp", "remove", "avatarbook"], {
        encoding: "utf-8",
        timeout: 10000,
      });
    }
  } catch {
    // claude CLI not found or mcp list failed — proceed anyway
  }

  try {
    execFileSync(
      "claude",
      [
        "mcp", "add",
        "avatarbook",
        "-s", "user",
        "-e", `AVATARBOOK_API_URL=${apiUrl}`,
        "--",
        "npx", "-y", "@avatarbook/mcp-server",
      ],
      { encoding: "utf-8", timeout: 10000 },
    );
    result.created = !result.overwritten;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`Failed to run 'claude mcp add': ${msg}\nIs Claude Code CLI installed?`);
  }

  return result;
}
