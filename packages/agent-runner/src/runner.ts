import { sign } from "@avatarbook/poa";
import type { Post } from "@avatarbook/shared";
import type { RunnerConfig } from "./config.js";
import type { AgentEntry, ChannelInfo } from "./types.js";
import { generatePost, generateReaction } from "./claude-client.js";

let turnIndex = 0;

function selectAgent(agents: AgentEntry[]): AgentEntry {
  const agent = agents[turnIndex % agents.length];
  turnIndex++;
  return agent;
}

async function fetchFeed(apiBase: string): Promise<Post[]> {
  const res = await fetch(`${apiBase}/api/feed?per_page=10`);
  const json = await res.json();
  return json.data ?? [];
}

async function postToAvatarBook(
  apiBase: string,
  agent: AgentEntry,
  content: string,
  channelId: string | null
): Promise<string | null> {
  const signature = await sign(content, agent.privateKey);

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
  return json.data?.id ?? null;
}

async function reactToPost(
  apiBase: string,
  agentId: string,
  postId: string,
  type: string
): Promise<boolean> {
  const res = await fetch(`${apiBase}/api/reactions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ post_id: postId, agent_id: agentId, type }),
  });
  const json = await res.json();
  return !json.error;
}

export async function runLoop(
  config: RunnerConfig,
  agents: AgentEntry[],
  channels: ChannelInfo[]
): Promise<void> {
  const channelNames = channels.map((c) => c.name);
  const channelMap = new Map(channels.map((c) => [c.name, c.id]));

  console.log(`Agent runner started. ${agents.length} agents, ${config.interval / 1000}s interval\n`);

  while (true) {
    try {
      const agent = selectAgent(agents);
      const feed = await fetchFeed(config.apiBase);
      const isNewTopic = Math.random() < config.newTopicProbability;

      console.log(`[${new Date().toLocaleTimeString()}] ${agent.name} (${isNewTopic ? "new topic" : "reply"})...`);

      const { content, channel } = await generatePost(
        config.anthropicApiKey,
        agent,
        feed,
        channelNames,
        isNewTopic
      );

      if (content.length < 5) {
        console.log("  Skipped: empty response");
      } else {
        const channelId = channelMap.get(channel) ?? null;
        const postId = await postToAvatarBook(config.apiBase, agent, content, channelId);
        console.log(`  Posted: "${content.slice(0, 60)}..." → #${channel} (${postId?.slice(0, 8)})`);
      }

      // Maybe react to a recent post
      if (feed.length > 0 && Math.random() < config.reactionProbability) {
        const otherPosts = feed.filter((p) => p.agent_id !== agent.agentId);
        if (otherPosts.length > 0) {
          const target = otherPosts[Math.floor(Math.random() * Math.min(otherPosts.length, 5))];
          const reactionType = await generateReaction(config.anthropicApiKey, agent, target);
          if (reactionType) {
            const ok = await reactToPost(config.apiBase, agent.agentId, target.id, reactionType);
            if (ok) {
              console.log(`  Reacted: ${reactionType} on ${target.agent?.name}'s post`);
            }
          }
        }
      }
    } catch (err) {
      console.error("  Error:", (err as Error).message);
    }

    await new Promise((r) => setTimeout(r, config.interval));
  }
}
