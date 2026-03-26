import { generateKeypair, sign } from "@avatarbook/poa";
import { readFileSync, writeFileSync, readdirSync, existsSync } from "fs";
import { resolve, join } from "path";
import { homedir } from "os";
import { createDecipheriv } from "crypto";
import type { AgentEntry, ChannelInfo } from "./types.js";

function decryptApiKey(value: string): string {
  const keyHex = process.env.AGENT_KEY_ENCRYPTION_SECRET;
  if (!keyHex || keyHex.length !== 64) return value;
  try {
    const buf = Buffer.from(value, "base64");
    if (buf.length < 28) return value; // too short for iv+tag
    const iv = buf.subarray(0, 12);
    const tag = buf.subarray(buf.length - 16);
    const ciphertext = buf.subarray(12, buf.length - 16);
    const key = Buffer.from(keyHex, "hex");
    const decipher = createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(tag);
    return decipher.update(ciphertext) + decipher.final("utf8");
  } catch {
    return value; // plaintext fallback
  }
}

const KEYS_FILE = resolve(process.env.AGENT_KEYS_FILE ?? ".agent-keys.json");
const KEYS_DIR = join(homedir(), ".avatarbook", "keys");

interface StoredKeys {
  [agentId: string]: { privateKey: string; publicKey: string };
}

function loadLocalKeys(): StoredKeys {
  // Load from legacy .agent-keys.json
  let keys: StoredKeys = {};
  try {
    keys = JSON.parse(readFileSync(KEYS_FILE, "utf8"));
  } catch {}

  // Override with migrated keys from ~/.avatarbook/keys/
  if (existsSync(KEYS_DIR)) {
    for (const file of readdirSync(KEYS_DIR)) {
      if (!file.endsWith(".key")) continue;
      const agentId = file.replace(".key", "");
      try {
        const privateKey = readFileSync(join(KEYS_DIR, file), "utf8").trim();
        // Clear old publicKey — will be filled from DB
        keys[agentId] = { privateKey, publicKey: "" };
      } catch {}
    }
  }

  return keys;
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
    public_key?: string; private_key?: string;
    schedule_config?: { baseRate?: number; peakHour?: number; activeSpread?: number } | null;
    agent_permissions?: { auto_post_enabled?: boolean };
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
    let publicKeyRegistered = true;

    if (agent.private_key && agent.public_key) {
      // Use server-side keypair (returned via api-secret auth)
      keys = { privateKey: agent.private_key, publicKey: agent.public_key };
      if (!localKeys[agent.id] || localKeys[agent.id].privateKey !== agent.private_key) {
        localKeys[agent.id] = keys;
        keysChanged = true;
      }
    } else if (keys) {
      // Use local keys
      if (!keys.publicKey && agent.public_key) {
        keys.publicKey = agent.public_key;
        console.log(`Loaded migrated key for ${agent.name}`);
      } else if (agent.public_key && agent.public_key !== keys.publicKey) {
        // Local key doesn't match DB — try rotate-key
        try {
          const timestamp = Date.now();
          const signature = await sign(`rotate:${agent.id}:${keys.publicKey}:${timestamp}`, keys.privateKey);
          await fetch(`${apiBase}/api/agents/${agent.id}/rotate-key`, {
            method: "POST",
            headers: { "Content-Type": "application/json", ...headers },
            body: JSON.stringify({ new_public_key: keys.publicKey, signature, timestamp }),
          });
          console.log(`Rotated key for ${agent.name}`);
        } catch (e: any) {
          console.error(`  Failed to rotate key for ${agent.name}: ${e.message}`);
          publicKeyRegistered = false;
        }
      }
    } else {
      // No server key, no local key — generate new keypair
      const keypair = await generateKeypair();
      keys = { privateKey: keypair.privateKey, publicKey: keypair.publicKey };
      localKeys[agent.id] = keys;
      keysChanged = true;
      console.log(`Generated new keypair for ${agent.name}`);
      publicKeyRegistered = false;
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
      apiKey: agent.api_key ? decryptApiKey(agent.api_key) : undefined,
      publicKeyRegistered,
      scheduleConfig: agent.schedule_config ?? null,
      autoPostEnabled: agent.agent_permissions?.auto_post_enabled ?? true,
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
