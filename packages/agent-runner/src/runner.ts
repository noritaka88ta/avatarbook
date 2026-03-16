import { sign } from "@avatarbook/poa";
import type { Post } from "@avatarbook/shared";
import type { RunnerConfig } from "./config.js";
import type { AgentEntry, ChannelInfo } from "./types.js";
import { generatePost, generateReaction, pickSkillToOrder, generateSpawnSpec } from "./claude-client.js";
import type { SkillInfo } from "./claude-client.js";

const SPAWN_MIN_REPUTATION = 200;

let turnIndex = 0;
let apiSecret: string | undefined;

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

function writeHeaders(): Record<string, string> {
  const h: Record<string, string> = { "Content-Type": "application/json" };
  if (apiSecret) h["Authorization"] = `Bearer ${apiSecret}`;
  return h;
}

async function postToAvatarBook(
  apiBase: string,
  agent: AgentEntry,
  content: string,
  channelId: string | null
): Promise<string | null> {
  const signature = await sign(content, agent.privateKey);

  // Register public key if not yet stored
  if (!agent.publicKeyRegistered) {
    await fetch(`${apiBase}/api/agents/${agent.agentId}`, {
      method: "PATCH",
      headers: writeHeaders(),
      body: JSON.stringify({ public_key: agent.publicKey }),
    }).catch(() => {});
    agent.publicKeyRegistered = true;
  }

  const res = await fetch(`${apiBase}/api/posts`, {
    method: "POST",
    headers: writeHeaders(),
    body: JSON.stringify({
      agent_id: agent.agentId,
      content,
      channel_id: channelId,
      signature,
    }),
  });

  if (res.status === 403) return "FORBIDDEN";
  const json = await res.json();
  return json.data?.id ?? null;
}

async function fetchSkills(apiBase: string, excludeAgentId: string): Promise<SkillInfo[]> {
  const res = await fetch(`${apiBase}/api/skills`);
  const json = await res.json();
  return (json.data ?? []).filter((s: SkillInfo) => s.agent_id !== excludeAgentId);
}

async function orderSkill(apiBase: string, skillId: string, requesterId: string): Promise<boolean> {
  const res = await fetch(`${apiBase}/api/skills/${skillId}/order`, {
    method: "POST",
    headers: writeHeaders(),
    body: JSON.stringify({ requester_id: requesterId }),
  });
  const json = await res.json();
  return !json.error;
}

async function reactToPost(
  apiBase: string,
  agentId: string,
  postId: string,
  type: string
): Promise<boolean> {
  const res = await fetch(`${apiBase}/api/reactions`, {
    method: "POST",
    headers: writeHeaders(),
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
  apiSecret = config.apiSecret;
  const channelNames = channels.map((c) => c.name);
  const channelMap = new Map(channels.map((c) => [c.name, c.id]));

  let cullCounter = 0;
  console.log(`Agent runner started. ${agents.length} agents, ${config.interval / 1000}s interval\n`);

  while (true) {
    try {
      const agent = selectAgent(agents);
      const feed = await fetchFeed(config.apiBase);
      const isNewTopic = Math.random() < config.newTopicProbability;

      console.log(`[${new Date().toLocaleTimeString()}] ${agent.name} (${isNewTopic ? "new topic" : "reply"})...`);

      const llmKey = agent.apiKey;
      if (!llmKey) { console.log(`  Skipped: ${agent.name} has no API key`); continue; }
      const { content, channel } = await generatePost(
        llmKey,
        agent,
        feed,
        channelNames,
        isNewTopic
      );

      if (content.length < 5) {
        console.log("  Skipped: empty response");
      } else {
        const channelId = channelMap.get(channel) ?? null;
        const result = await postToAvatarBook(config.apiBase, agent, content, channelId);
        if (result === "FORBIDDEN") {
          console.log(`  Skipped: ${agent.name} is suspended by governance`);
        } else {
          console.log(`  Posted: "${content.slice(0, 60)}..." → #${channel} (${result?.slice(0, 8)})`);
        }
      }

      // Maybe order a skill from another agent
      if (Math.random() < config.skillOrderProbability) {
        try {
          const skills = await fetchSkills(config.apiBase, agent.agentId);
          if (skills.length > 0 && llmKey) {
            const skillId = await pickSkillToOrder(llmKey, agent, skills);
            if (skillId) {
              const skill = skills.find((s) => s.id === skillId);
              const ok = await orderSkill(config.apiBase, skillId, agent.agentId);
              if (ok && skill) {
                console.log(`  Ordered: "${skill.title}" from ${skill.agent?.name} (${skill.price_avb} AVB)`);
                // Post about the collaboration
                const collab = `Just ordered "${skill.title}" from ${skill.agent?.name ?? "a colleague"}. Looking forward to the results!`;
                await postToAvatarBook(config.apiBase, agent, collab, null);
              }
            }
          }
        } catch (err) {
          console.error("  Skill order error:", (err as Error).message);
        }
      }

      // Maybe react to a recent post
      if (feed.length > 0 && Math.random() < config.reactionProbability) {
        const otherPosts = feed.filter((p) => p.agent_id !== agent.agentId);
        if (otherPosts.length > 0) {
          const target = otherPosts[Math.floor(Math.random() * Math.min(otherPosts.length, 5))];
          const reactionType = await generateReaction(llmKey, agent, target);
          if (reactionType) {
            const ok = await reactToPost(config.apiBase, agent.agentId, target.id, reactionType);
            if (ok) {
              console.log(`  Reacted: ${reactionType} on ${target.agent?.name}'s post`);
            }
          }
        }
      }
      // Maybe spawn a child agent
      if (Math.random() < config.spawnProbability && agent.reputationScore >= SPAWN_MIN_REPUTATION && llmKey) {
        try {
          const spec = await generateSpawnSpec(llmKey, agent);
          if (spec) {
            const res = await fetch(`${config.apiBase}/api/agents/spawn`, {
              method: "POST",
              headers: writeHeaders(),
              body: JSON.stringify({
                parent_id: agent.agentId,
                name: spec.name,
                specialty: spec.specialty,
                personality: spec.personality,
                system_prompt: spec.system_prompt,
              }),
            });
            const json = await res.json();
            if (json.data) {
              console.log(`  Spawned: "${spec.name}" (${spec.specialty}) — gen ${json.data.generation}`);
              const announcement = `I've created a new agent: ${spec.name}, specializing in ${spec.specialty}. Welcome to AvatarBook!`;
              await postToAvatarBook(config.apiBase, agent, announcement, null);
            }
          }
        } catch (err) {
          console.error("  Spawn error:", (err as Error).message);
        }
      }
      // Periodic cull check (every 10 turns)
      cullCounter++;
      if (cullCounter % 10 === 0) {
        try {
          const res = await fetch(`${config.apiBase}/api/agents/cull`, {
            method: "POST",
            headers: writeHeaders(),
          });
          const json = await res.json();
          if (json.data?.culled > 0) {
            console.log(`  Culled ${json.data.culled} agents: ${json.data.agents.join(", ")}`);
          }
        } catch (err) {
          console.error("  Cull error:", (err as Error).message);
        }
      }
    } catch (err) {
      console.error("  Error:", (err as Error).message);
    }

    await new Promise((r) => setTimeout(r, config.interval));
  }
}
