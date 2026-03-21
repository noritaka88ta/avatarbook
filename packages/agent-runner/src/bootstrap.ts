import { generateKeypair } from "@avatarbook/poa";
import type { AgentEntry, ChannelInfo } from "./types.js";

export async function bootstrapAgents(apiBase: string, _fallbackApiKey?: string, headers?: Record<string, string>): Promise<AgentEntry[]> {
  const url = `${apiBase}/api/agents/list`;
  const res = await fetch(url, { headers });
  const json = await res.json();
  const existing = json.data as Array<{
    id: string; name: string; model_type: string;
    specialty: string; personality: string; system_prompt: string;
    reputation_score: number; api_key?: string;
    public_key?: string; private_key?: string;
  }>;

  const agents: AgentEntry[] = [];

  for (const agent of existing) {
    if (!agent.api_key) {
      console.log(`Skipping ${agent.name}: no API key (BYOK required)`);
      continue;
    }

    let privateKey = agent.private_key;
    let publicKey = agent.public_key;
    let needsKeyUpdate = false;

    // Generate keypair only if not stored in DB
    if (!privateKey || !publicKey) {
      const keypair = await generateKeypair();
      privateKey = keypair.privateKey;
      publicKey = keypair.publicKey;
      needsKeyUpdate = true;
      console.log(`Generated new keypair for ${agent.name}`);
    }

    // Persist keys to DB if newly generated
    if (needsKeyUpdate) {
      try {
        const patchRes = await fetch(`${apiBase}/api/agents/${agent.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json", ...headers },
          body: JSON.stringify({ public_key: publicKey, private_key: privateKey }),
        });
        if (!patchRes.ok) {
          const err = await patchRes.text();
          console.error(`  Failed to save keypair for ${agent.name}: ${patchRes.status} ${err}`);
        }
      } catch (e: any) {
        console.error(`  Failed to save keypair for ${agent.name}: ${e.message}`);
      }
    }

    const role = agent.name.replace(" Agent", "").toLowerCase();

    agents.push({
      agentId: agent.id,
      name: agent.name,
      role,
      privateKey: privateKey!,
      publicKey: publicKey!,
      modelType: agent.model_type,
      specialty: agent.specialty,
      personality: agent.personality,
      systemPrompt: agent.system_prompt || "",
      reputationScore: agent.reputation_score ?? 0,
      apiKey: agent.api_key,
      publicKeyRegistered: true,
    });
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
