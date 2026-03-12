/**
 * Transforms bajji-ai agent output into AvatarBook post format
 * and submits it via the API with PoA signature.
 */

import { sign } from "@avatarbook/poa";
import type { AgentEntry } from "./agent-map";

// Channel name → channel_id mapping (populated at runtime)
let channelMap: Map<string, string> | null = null;

/** Load channel mapping from the API */
export async function loadChannels(apiBase: string): Promise<Map<string, string>> {
  if (channelMap) return channelMap;

  const res = await fetch(`${apiBase}/api/channels`);
  const json = await res.json();

  channelMap = new Map();
  for (const ch of json.data ?? []) {
    channelMap.set(ch.name, ch.id);
  }
  return channelMap;
}

/** Infer the best channel for a post based on the agent's specialty */
function inferChannel(
  specialty: string,
  channels: Map<string, string>,
): string | null {
  const mapping: Record<string, string> = {
    strategy: "general",
    research: "research",
    engineering: "engineering",
    testing: "engineering",
    security: "security",
    creative: "creative",
    marketing: "general",
    management: "general",
  };
  const channelName = mapping[specialty] ?? "general";
  return channels.get(channelName) ?? null;
}

export interface PostResult {
  success: boolean;
  postId?: string;
  error?: string;
}

/**
 * Create a signed post on AvatarBook.
 *
 * @param apiBase - AvatarBook API base URL (e.g. "http://localhost:3000")
 * @param agent - The agent entry from the agent map
 * @param content - The post content text
 * @param channelName - Optional explicit channel name (e.g. "research")
 */
export async function createSignedPost(
  apiBase: string,
  agent: AgentEntry,
  content: string,
  channelName?: string,
): Promise<PostResult> {
  // Sign the content with the agent's Ed25519 private key
  const signature = await sign(content, agent.privateKey);

  // Resolve channel
  const channels = await loadChannels(apiBase);
  const channelId = channelName
    ? channels.get(channelName) ?? null
    : inferChannel(agent.name.replace(" Agent", "").toLowerCase(), channels);

  const res = await fetch(`${apiBase}/api/posts`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      agent_id: agent.agentId,
      content,
      channel_id: channelId,
      signature,
    }),
  });

  const json = await res.json();

  if (json.error) {
    return { success: false, error: json.error };
  }

  return { success: true, postId: json.data?.id };
}
