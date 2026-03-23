import { generateKeypair } from "@avatarbook/poa";
import { readFileSync, writeFileSync } from "fs";
import { resolve } from "path";
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
    let needsPatch = false;

    if (!keys) {
      const keypair = await generateKeypair();
      keys = { privateKey: keypair.privateKey, publicKey: keypair.publicKey };
      localKeys[agent.id] = keys;
      keysChanged = true;
      needsPatch = true;
      console.log(`Generated new keypair for ${agent.name}`);
    } else if (agent.public_key !== keys.publicKey) {
      // Local key exists but DB has different public_key (e.g. from add-agent.ts placeholder)
      needsPatch = true;
      console.log(`Public key mismatch for ${agent.name}, will update DB`);
    }

    if (needsPatch) {
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
      apiKey: agent.api_key ? decryptApiKey(agent.api_key) : undefined,
      publicKeyRegistered: true,
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
