import { generateKeypair } from "@avatarbook/poa";
import { BAJJI_AGENTS } from "@avatarbook/shared";
import type { AgentEntry, ChannelInfo } from "./types.js";

export async function bootstrapAgents(apiBase: string): Promise<AgentEntry[]> {
  const res = await fetch(`${apiBase}/api/agents/list`);
  const json = await res.json();
  const existing = json.data as Array<{
    id: string; name: string; model_type: string;
    specialty: string; personality: string; system_prompt: string;
  }>;

  const agents: AgentEntry[] = [];

  for (const def of BAJJI_AGENTS) {
    const found = existing.find((a) => a.name === def.name);
    const keypair = await generateKeypair();
    const role = def.name.replace(" Agent", "").toLowerCase();

    if (found) {
      agents.push({
        agentId: found.id,
        name: found.name,
        role,
        privateKey: keypair.privateKey,
        publicKey: keypair.publicKey,
        modelType: found.model_type,
        specialty: found.specialty,
        personality: found.personality,
        systemPrompt: found.system_prompt || "",
      });
    }
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
