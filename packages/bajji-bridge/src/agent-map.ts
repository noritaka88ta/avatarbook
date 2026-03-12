/**
 * Maps bajji-ai agent names (as they appear in Slack) to AvatarBook agent IDs.
 *
 * On first run, the bridge auto-registers agents and persists the mapping
 * to AGENT_MAP_FILE. On subsequent runs it loads from file.
 *
 * Environment variables (per-agent Ed25519 private keys):
 *   BAJJI_CEO_PRIVATE_KEY, BAJJI_RESEARCHER_PRIVATE_KEY, etc.
 */

import { readFileSync, writeFileSync, existsSync } from "fs";
import { BAJJI_AGENTS } from "@avatarbook/shared";

const AGENT_MAP_FILE = new URL("../.agent-map.json", import.meta.url).pathname;

export interface AgentEntry {
  agentId: string;
  name: string;
  privateKey: string;
  publicKey: string;
}

// Slack display name → bajji-ai role key
const SLACK_NAME_TO_ROLE: Record<string, string> = {
  "CEO Agent": "ceo",
  "Researcher Agent": "researcher",
  "Engineer Agent": "engineer",
  "QA Agent": "qa",
  "Security Agent": "security",
  "Creative Agent": "creative",
  "CMO Agent": "cmo",
  "PDM Agent": "pdm",
  "CTO Agent": "cto",
};

// Role key → env var prefix
function privateKeyEnvVar(role: string): string {
  return `BAJJI_${role.toUpperCase()}_PRIVATE_KEY`;
}

let cachedMap: Map<string, AgentEntry> | null = null;

/**
 * Load agent map from disk or return empty map.
 * Key: bajji role (e.g. "researcher"), Value: AgentEntry
 */
export function loadAgentMap(): Map<string, AgentEntry> {
  if (cachedMap) return cachedMap;

  if (existsSync(AGENT_MAP_FILE)) {
    const raw = JSON.parse(readFileSync(AGENT_MAP_FILE, "utf-8"));
    cachedMap = new Map(Object.entries(raw));
    return cachedMap;
  }

  cachedMap = new Map();
  return cachedMap;
}

/** Persist agent map to disk */
export function saveAgentMap(map: Map<string, AgentEntry>): void {
  const obj = Object.fromEntries(map);
  writeFileSync(AGENT_MAP_FILE, JSON.stringify(obj, null, 2));
  cachedMap = map;
}

/**
 * Register all bajji-ai agents on AvatarBook and store the mapping.
 * Skips agents that are already registered.
 */
export async function bootstrapAgents(apiBase: string): Promise<Map<string, AgentEntry>> {
  const { generateKeypair } = await import("@avatarbook/poa");

  const map = loadAgentMap();
  let changed = false;

  // Fetch existing agents first to avoid duplicates
  const listRes = await fetch(`${apiBase}/api/agents/list`);
  const listJson = await listRes.json();
  const existingAgents: { id: string; name: string }[] = listJson.data ?? [];

  for (const agent of BAJJI_AGENTS) {
    const role = SLACK_NAME_TO_ROLE[agent.name];
    if (!role) continue;
    if (map.has(role)) continue;

    // Generate keypair
    const keypair = await generateKeypair();

    // Override with env var if set
    const envKey = process.env[privateKeyEnvVar(role)];
    if (envKey) {
      keypair.privateKey = envKey;
    }

    // Check if agent already exists on the platform
    const existing = existingAgents.find((a) => a.name === agent.name);
    if (existing) {
      map.set(role, {
        agentId: existing.id,
        name: agent.name,
        privateKey: keypair.privateKey,
        publicKey: keypair.publicKey,
      });
      changed = true;
      console.log(`  [map] ${agent.name} → ${existing.id} (existing)`);
      continue;
    }

    // Register new agent on AvatarBook
    const res = await fetch(`${apiBase}/api/agents/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: agent.name,
        model_type: agent.model_type,
        specialty: agent.specialty,
        personality: agent.personality,
      }),
    });

    const json = await res.json();
    if (json.error) {
      console.error(`  [err] Failed to register ${agent.name}: ${json.error}`);
      continue;
    }

    map.set(role, {
      agentId: json.data.id,
      name: agent.name,
      privateKey: keypair.privateKey,
      publicKey: json.data.publicKey ?? keypair.publicKey,
    });
    changed = true;
    console.log(`  [new] ${agent.name} → ${json.data.id}`);
  }

  if (changed) saveAgentMap(map);
  return map;
}

/** Resolve a Slack username to a bajji role key */
export function resolveSlackUser(slackName: string): string | null {
  return SLACK_NAME_TO_ROLE[slackName] ?? null;
}
