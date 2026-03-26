export const config = {
  apiUrl: process.env.AVATARBOOK_API_URL ?? "http://localhost:3000",
  modelType: process.env.AGENT_MODEL_TYPE ?? "claude-sonnet-4-6",
} as const;

// Multi-agent key store: agentId -> privateKey
const agentKeys = new Map<string, string>();

// Active agent (switchable at runtime)
let activeAgentId: string | undefined;

// Parse AGENT_KEYS env: "id1:key1,id2:key2,..."
if (process.env.AGENT_KEYS) {
  for (const entry of process.env.AGENT_KEYS.split(",")) {
    const sep = entry.indexOf(":");
    if (sep > 0) {
      const id = entry.slice(0, sep).trim();
      const key = entry.slice(sep + 1).trim();
      agentKeys.set(id, key);
    }
  }
  // Default active = first key
  activeAgentId = agentKeys.keys().next().value;
}

// Keys from ~/.avatarbook/keys/ are loaded asynchronously via loadKeysFromDisk()

// Load keys from ~/.avatarbook/keys/ on startup
export async function loadKeysFromDisk(): Promise<void> {
  try {
    const { readdirSync, readFileSync } = await import("fs");
    const { join } = await import("path");
    const { homedir } = await import("os");
    const keysDir = join(homedir(), ".avatarbook", "keys");
    for (const file of readdirSync(keysDir)) {
      if (!file.endsWith(".key")) continue;
      const agentId = file.replace(".key", "");
      if (agentKeys.has(agentId)) continue; // env vars take precedence
      const key = readFileSync(join(keysDir, file), "utf-8").trim();
      if (key) agentKeys.set(agentId, key);
    }
    if (!activeAgentId && agentKeys.size > 0) {
      activeAgentId = agentKeys.keys().next().value;
    }
  } catch {
    // ~/.avatarbook/keys/ doesn't exist yet — that's fine
  }
}

export function getAgentKeys(): Map<string, string> {
  return agentKeys;
}

export function getActiveAgentId(): string | undefined {
  return activeAgentId;
}

export function setActiveAgent(agentId: string): void {
  if (!agentKeys.has(agentId)) {
    throw new Error(`Agent ${agentId} not found. Run register_agent or add to AGENT_KEYS env.`);
  }
  activeAgentId = agentId;
}

export function addAgentKey(agentId: string, privateKey: string): void {
  agentKeys.set(agentId, privateKey);
  if (!activeAgentId) activeAgentId = agentId;
}

export function resolveAgent(agentId?: string): { agentId: string; privateKey: string } {
  const id = agentId ?? activeAgentId;
  if (!id) {
    throw new Error("No agent specified and no active agent set. Use switch_agent or provide agent_id.");
  }
  const key = agentKeys.get(id);
  if (!key) {
    throw new Error(`No private key for agent ${id}. Run register_agent, claim_agent, or set AGENT_KEYS env.`);
  }
  return { agentId: id, privateKey: key };
}
