import { generateKeypair } from "@avatarbook/poa";
import { readFileSync, writeFileSync } from "fs";
import { resolve } from "path";
import type { AgentEntry, ChannelInfo } from "./types.js";

const KEYS_FILE = resolve(process.env.AGENT_KEYS_FILE ?? ".agent-keys.json");

interface StoredKeys {
  [agentId: string]: { privateKey: string; publicKey: string };
}

function loadLocalKeys(): StoredKeys {
  try {
    return JSON.parse(readFileSync(KEYS_FILE, "utf8"));
  } catch {
    return {};
  }
}

function saveLocalKeys(keys: StoredKeys): void {
  writeFileSync(KEYS_FILE, JSON.stringify(keys, null, 2), { mode: 0o600 });
}

export async function bootstrapAgents(apiBase: string, _fallbackApiKey?: string, headers?: Record<string, string>): Promise<AgentEntry[]> {
  const url = `${apiBase}/api/agents/list`;
  const res = await fetch(url, { headers });
  const json = await res.json();
  const existing = json.data as Array<{
    id: string; name: string; model_type: string;
    specialty: string; personality: string; system_prompt: string;
    reputation_score: number; api_key?: string;
    public_key?: string;
  }>;

  const localKeys = loadLocalKeys();
  const agents: AgentEntry[] = [];
  let keysChanged = false;

  for (const agent of existing) {
    if (!agent.api_key) {
      console.log(`Skipping ${agent.name}: no API key (BYOK required)`);
      continue;
    }

    let keys = localKeys[agent.id];

    if (!keys) {
      const keypair = await generateKeypair();
      keys = { privateKey: keypair.privateKey, publicKey: keypair.publicKey };
      localKeys[agent.id] = keys;
      keysChanged = true;
      console.log(`Generated new keypair for ${agent.name}`);

      // Register public key with server
      try {
        await fetch(`${apiBase}/api/agents/${agent.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json", ...headers },
          body: JSON.stringify({ public_key: keys.publicKey }),
        });
      } catch (e: any) {
        console.error(`  Failed to register public key for ${agent.name}: ${e.message}`);
      }
    }

    const role = agent.name.replace(" Agent", "").toLowerCase();

    agents.push({
      agentId: agent.id,
      name: agent.name,
      role,
      privateKey: keys.privateKey,
      publicKey: keys.publicKey,
      modelType: agent.model_type,
      specialty: agent.specialty,
      personality: agent.personality,
      systemPrompt: agent.system_prompt || "",
      reputationScore: agent.reputation_score ?? 0,
      apiKey: agent.api_key,
      publicKeyRegistered: true,
    });
  }

  if (keysChanged) {
    saveLocalKeys(localKeys);
    console.log(`Saved keypairs to ${KEYS_FILE}`);
  }

  return agents;
}

export async function loadChannels(apiBase: string): Promise<ChannelInfo[]> {
  const res = await fetch(`${apiBase}/api/channels`);
  const json = await res.json();
  return (json.data ?? []).map((c: { id: string; name: string }) => ({
    id: c.id,
    name: c.name,
  }));
}
