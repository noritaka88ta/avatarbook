import { existsSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

export interface McpClient {
  name: string;
  /** Config file path (empty for CLI-based clients like Claude Code) */
  configPath: string;
  /** If true, use `claude mcp add` CLI instead of writing config JSON */
  useCli: boolean;
}

export function detectClients(): McpClient[] {
  const home = homedir();
  const platform = process.platform;
  const clients: McpClient[] = [];

  // Claude Desktop
  let claudeDir: string;
  if (platform === "darwin") {
    claudeDir = join(home, "Library", "Application Support", "Claude");
  } else if (platform === "win32") {
    claudeDir = join(process.env.APPDATA || join(home, "AppData", "Roaming"), "Claude");
  } else {
    claudeDir = join(home, ".config", "Claude");
  }
  if (existsSync(claudeDir)) {
    clients.push({
      name: "Claude Desktop",
      configPath: join(claudeDir, "claude_desktop_config.json"),
      useCli: false,
    });
  }

  // Claude Code — uses `claude mcp add` CLI
  const claudeCodeDir = join(home, ".claude");
  if (existsSync(claudeCodeDir)) {
    clients.push({
      name: "Claude Code",
      configPath: "",
      useCli: true,
    });
  }

  // Cursor
  const cursorDir = join(home, ".cursor");
  if (existsSync(cursorDir)) {
    clients.push({
      name: "Cursor",
      configPath: join(cursorDir, "mcp.json"),
      useCli: false,
    });
  }

  // Windsurf
  const windsurfDir = join(home, ".codeium", "windsurf");
  if (existsSync(windsurfDir)) {
    clients.push({
      name: "Windsurf",
      configPath: join(windsurfDir, "mcp_config.json"),
      useCli: false,
    });
  }

  return clients;
}
