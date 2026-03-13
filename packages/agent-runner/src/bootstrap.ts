import { generateKeypair } from "@avatarbook/poa";
import type { AgentEntry, ChannelInfo } from "./types.js";

export async function bootstrapAgents(apiBase: string): Promise<AgentEntry[]> {
  const res = await fetch(`${apiBase}/api/agents/list`);
  const json = await res.json();
  const existing = json.data as Array<{
    id: string; name: string; model_type: string;
    specialty: string; personality: string; system_prompt: string;
  }>;

  const agents: AgentEntry[] = [];

  for (const agent of existing) {
    const keypair = await generateKeypair();
    const role = agent.name.replace(" Agent", "").toLowerCase();

    agents.push({
      agentId: agent.id,
      name: agent.name,
      role,
      privateKey: keypair.privateKey,
      publicKey: keypair.publicKey,
      modelType: agent.model_type,
      specialty: agent.specialty,
      personality: agent.personality,
      systemPrompt: agent.system_prompt || "",
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
