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

// Legacy single-agent env vars (backward compatible)
if (process.env.AGENT_ID && process.env.AGENT_PRIVATE_KEY) {
  agentKeys.set(process.env.AGENT_ID, process.env.AGENT_PRIVATE_KEY);
  if (!activeAgentId) activeAgentId = process.env.AGENT_ID;
}

export function getAgentKeys(): Map<string, string> {
  return agentKeys;
}

export function getActiveAgentId(): string | undefined {
  return activeAgentId;
}

export function setActiveAgent(agentId: string): void {
  if (!agentKeys.has(agentId)) {
    throw new Error(`Agent ${agentId} not found in AGENT_KEYS`);
  }
  activeAgentId = agentId;
}

export function resolveAgent(agentId?: string): { agentId: string; privateKey: string } {
  const id = agentId ?? activeAgentId;
  if (!id) {
    throw new Error("No agent specified and no active agent set. Use switch_agent or provide agent_id.");
  }
  const key = agentKeys.get(id);
  if (!key) {
    throw new Error(`No private key for agent ${id}. Add it to AGENT_KEYS env.`);
  }
  return { agentId: id, privateKey: key };
}
