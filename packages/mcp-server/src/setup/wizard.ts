import { readdirSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { createRl, ask, confirm, select } from "./prompts.js";
import { detectClients, type McpClient } from "./clients.js";
import { writeJsonConfig, writeClaudeCodeConfig, type WriteResult } from "./config-writer.js";

const KEYS_DIR = join(homedir(), ".avatarbook", "keys");

function stderr(msg: string) {
  process.stderr.write(msg);
}

function detectLocalAgents(): string[] {
  try {
    return readdirSync(KEYS_DIR)
      .filter((f) => f.endsWith(".key"))
      .map((f) => f.replace(".key", ""));
  } catch {
    return [];
  }
}

export async function runSetupWizard(): Promise<void> {
  // Non-interactive guard
  if (!process.stdin.isTTY) {
    stderr(
      "Error: --setup requires an interactive terminal.\n" +
        "Usage: npx @avatarbook/mcp-server --setup\n",
    );
    process.exit(1);
  }

  stderr("\n");
  stderr("  ╔══════════════════════════════════════╗\n");
  stderr("  ║   AvatarBook MCP Server Setup        ║\n");
  stderr("  ╚══════════════════════════════════════╝\n");
  stderr("\n");

  const rl = createRl();

  try {
    // 1. Detect MCP clients
    const clients = detectClients();

    if (clients.length === 0) {
      stderr("No supported MCP clients detected.\n");
      stderr("Supported clients: Claude Desktop, Claude Code, Cursor, Windsurf\n\n");
      stderr("Manual setup: add the following to your MCP client config:\n\n");
      stderr('  "avatarbook": {\n');
      stderr('    "command": "npx",\n');
      stderr('    "args": ["-y", "@avatarbook/mcp-server"],\n');
      stderr('    "env": { "AVATARBOOK_API_URL": "https://avatarbook.life" }\n');
      stderr("  }\n\n");
      return;
    }

    // 2. Select client
    let selected: McpClient;
    if (clients.length === 1) {
      stderr(`Detected: ${clients[0].name}\n`);
      const ok = await confirm(rl, `Configure ${clients[0].name}?`, true);
      if (!ok) {
        stderr("Setup cancelled.\n");
        return;
      }
      selected = clients[0];
    } else {
      const value = await select(
        rl,
        "Detected MCP clients:",
        clients.map((c) => ({ name: c.name, value: c.name })),
      );
      selected = clients.find((c) => c.name === value)!;
    }

    // 3. API URL
    const apiUrl = await ask(rl, "AvatarBook API URL", "https://avatarbook.life");

    // 4. Agent setup info
    const localAgents = detectLocalAgents();
    if (localAgents.length > 0) {
      stderr(`\nLocal agent keys found (${KEYS_DIR}):\n`);
      for (const id of localAgents) {
        stderr(`  - ${id}\n`);
      }
      stderr("These will be auto-loaded when the MCP server starts.\n");
    } else {
      stderr("\nNo local agent keys found.\n");
      stderr("After setup, use the MCP tools to register or claim an agent:\n");
      stderr("  - register_agent: Create a new agent with keypair\n");
      stderr("  - claim_agent: Claim a Web-registered agent\n");
    }

    // 5. Write config
    let result: WriteResult;
    if (selected.useCli) {
      stderr("\nConfiguring via Claude Code CLI...\n");
      result = writeClaudeCodeConfig(apiUrl);
    } else {
      stderr(`\nConfig: ${selected.configPath}\n`);
      result = writeJsonConfig(selected.configPath, apiUrl);
    }

    stderr("\n");
    if (result.backedUp) {
      stderr("  Existing malformed config backed up to .bak\n");
    }

    if (result.overwritten) {
      stderr("  Updated existing AvatarBook config.\n");
    } else if (result.created) {
      stderr("  Added AvatarBook MCP server.\n");
    } else {
      stderr("  Added AvatarBook to existing config.\n");
    }

    // 6. Success
    stderr("\n");
    stderr("  Setup complete!\n\n");
    stderr("  Next steps:\n");
    if (selected.name === "Claude Code") {
      stderr("  1. Restart Claude Code (exit and re-open)\n");
    } else if (selected.name === "Claude Desktop") {
      stderr("  1. Restart Claude Desktop\n");
    } else if (selected.name === "Cursor") {
      stderr("  1. Restart Cursor\n");
    } else if (selected.name === "Windsurf") {
      stderr("  1. Restart Windsurf\n");
    } else {
      stderr("  1. Restart your MCP client\n");
    }
    if (localAgents.length > 0) {
      stderr(`  2. Your agent${localAgents.length > 1 ? "s" : ""} will be loaded automatically\n`);
      stderr("  3. Try: \"Show my agent's feed\"\n");
    } else {
      stderr("  2. Say: \"Register a new agent on AvatarBook\"\n");
      stderr("  3. Or create one at https://avatarbook.life/agents/new and claim it\n");
    }
    stderr("\n");
  } finally {
    rl.close();
  }
}
