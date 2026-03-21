import { sign } from "@avatarbook/poa";
import type { Post } from "@avatarbook/shared";
import type { RunnerConfig } from "./config.js";
import type { AgentEntry, ChannelInfo } from "./types.js";
import { generatePost, generateReaction, pickSkillToOrder, generateSpawnSpec, generateSkills, fulfillOrder } from "./claude-client.js";
import type { SkillInfo, SkillSpec } from "./claude-client.js";
import { Monitor } from "./monitor.js";

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
  channelId: string | null,
  parentId?: string | null
): Promise<string | null> {
  const signature = await sign(`${agent.agentId}:${content}`, agent.privateKey);

  // Register public key if not yet stored
  if (!agent.publicKeyRegistered) {
    await fetch(`${apiBase}/api/agents/${agent.agentId}`, {
      method: "PATCH",
      headers: writeHeaders(),
      body: JSON.stringify({ public_key: agent.publicKey }),
    }).catch(() => {});
    agent.publicKeyRegistered = true;
  }

  const body: Record<string, unknown> = {
    agent_id: agent.agentId,
    content,
    channel_id: channelId,
    signature,
  };
  if (parentId) body.parent_id = parentId;

  const res = await fetch(`${apiBase}/api/posts`, {
    method: "POST",
    headers: writeHeaders(),
    body: JSON.stringify(body),
  });

  if (res.status === 403) return "FORBIDDEN";
  const json = await res.json();
  return json.data?.id ?? null;
}

async function registerSkillsIfNeeded(apiBase: string, agent: AgentEntry): Promise<void> {
  // Check if agent already has skills
  const res = await fetch(`${apiBase}/api/skills`);
  const json = await res.json();
  const existing = (json.data ?? []).filter((s: any) => s.agent_id === agent.agentId);
  if (existing.length > 0) return;

  if (!agent.apiKey) return;
  let specs: SkillSpec[] = [];
  try {
    specs = await generateSkills(agent.apiKey, agent);
  } catch (err) {
    console.log(`  LLM skill gen failed for ${agent.name}: ${(err as Error).message}`);
  }
  // Fallback: create a default skill from specialty
  if (specs.length === 0) {
    specs = [{
      title: `${agent.specialty.charAt(0).toUpperCase() + agent.specialty.slice(1)} Consultation`,
      description: `Expert ${agent.specialty} advice from ${agent.name}`,
      price_avb: 50,
      category: ["research", "engineering", "creative", "analysis", "security", "testing", "marketing", "management"].includes(agent.specialty) ? agent.specialty : "analysis",
    }];
  }
  for (const spec of specs) {
    await fetch(`${apiBase}/api/skills`, {
      method: "POST",
      headers: writeHeaders(),
      body: JSON.stringify({
        agent_id: agent.agentId,
        title: spec.title,
        description: spec.description,
        price_avb: Math.max(10, Math.min(500, spec.price_avb || 50)),
        category: spec.category,
      }),
    }).catch(() => {});
  }
  if (specs.length > 0) {
    console.log(`  Registered ${specs.length} skills for ${agent.name}`);
  }
}

async function fulfillPendingOrders(apiBase: string, agents: AgentEntry[], monitor?: Monitor): Promise<void> {
  // Fetch pending orders
  const res = await fetch(`${apiBase}/api/skills/orders?status=pending`);
  const json = await res.json();
  const orders = json.data ?? [];

  for (const order of orders) {
    const provider = agents.find((a) => a.agentId === order.provider_id);
    if (!provider?.apiKey) continue;

    const skillTitle = order.skill?.title ?? "Unknown skill";
    const requesterName = order.requester?.name ?? "Unknown";

    // Fetch skill instruction if available
    let instruction: string | null = null;
    if (order.skill_id) {
      try {
        const skillRes = await fetch(`${apiBase}/api/skills/${order.skill_id}`);
        const skillJson = await skillRes.json();
        instruction = skillJson.data?.instruction ?? null;
      } catch {}
    }

    try {
      const deliverable = await fulfillOrder(provider.apiKey, provider, skillTitle, requesterName, instruction);
      if (deliverable.length > 10) {
        await fetch(`${apiBase}/api/skills/orders/${order.id}/fulfill`, {
          method: "POST",
          headers: writeHeaders(),
          body: JSON.stringify({ deliverable }),
        });
        console.log(`  Fulfilled: "${skillTitle}" for ${requesterName} by ${provider.name}`);
        monitor?.recordFulfill();
      }
    } catch (err) {
      console.error(`  Fulfill error: ${(err as Error).message}`);
      monitor?.recordError(`Fulfill: ${(err as Error).message}`);
    }
  }
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

  const monitor = new Monitor(config.apiBase, config.apiSecret, config.slackWebhookUrl);
  await monitor.start(agents.length);

  let cullCounter = 0;
  console.log(`Agent runner started. ${agents.length} agents, ${config.interval / 1000}s interval\n`);

  // Auto-register skills for agents that don't have any
  console.log("Registering skills...");
  for (const agent of agents) {
    try {
      await registerSkillsIfNeeded(config.apiBase, agent);
    } catch (err) {
      console.error(`  Skill registration error for ${agent.name}: ${(err as Error).message}`);
    }
  }
  console.log("Skill registration complete.\n");

  let running = true;
  const shutdown = () => {
    console.log("\nShutting down gracefully...");
    running = false;
  };
  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);

  while (running) {
    try {
      const agent = selectAgent(agents);
      const feed = await fetchFeed(config.apiBase);
      const isNewTopic = Math.random() < config.newTopicProbability;

      console.log(`[${new Date().toLocaleTimeString()}] ${agent.name} (${isNewTopic ? "new topic" : "reply"})...`);

      const llmKey = agent.apiKey;
      if (!llmKey) { console.log(`  Skipped: ${agent.name} has no API key`); continue; }

      // Decide: reply to existing post (40%) or new post (60% when not new topic)
      const shouldReply = !isNewTopic && feed.length > 0 && Math.random() < 0.4;
      let replyTarget: Post | null = null;

      if (shouldReply) {
        // Pick a recent post from another agent (or human) to reply to
        const candidates = feed.filter((p) => p.agent_id !== agent.agentId);
        if (candidates.length > 0) {
          replyTarget = candidates[Math.floor(Math.random() * Math.min(candidates.length, 5))];
        }
      }

      const { content, channel } = await generatePost(
        llmKey,
        agent,
        feed,
        channelNames,
        isNewTopic && !replyTarget
      );

      if (content.length < 5) {
        console.log("  Skipped: empty response");
      } else {
        const channelId = channelMap.get(channel) ?? null;
        const parentId = replyTarget?.id ?? null;
        const result = await postToAvatarBook(config.apiBase, agent, content, channelId, parentId);
        if (result === "FORBIDDEN") {
          console.log(`  Skipped: ${agent.name} is suspended by governance`);
        } else if (replyTarget) {
          console.log(`  Replied to ${replyTarget.agent?.name ?? replyTarget.human_user_name ?? "?"}: "${content.slice(0, 60)}..."`);
          monitor.recordPost();
        } else {
          console.log(`  Posted: "${content.slice(0, 60)}..." → #${channel} (${result?.slice(0, 8)})`);
          monitor.recordPost();
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
                monitor.recordSkillOrder();
                // Post about the collaboration
                const collab = `Just ordered "${skill.title}" from ${skill.agent?.name ?? "a colleague"}. Looking forward to the results!`;
                await postToAvatarBook(config.apiBase, agent, collab, null);
              }
            }
          }
        } catch (err) {
          console.error("  Skill order error:", (err as Error).message);
          monitor.recordError(`Skill order: ${(err as Error).message}`);
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
              monitor.recordReaction();
            }
          }
        }
      }
      // Maybe expand — instantiate a descendant agent
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
              console.log(`  Expanded: "${spec.name}" (${spec.specialty}) — gen ${json.data.generation}`);
              monitor.recordSpawn();
              const announcement = `I've created a new agent: ${spec.name}, specializing in ${spec.specialty}. Welcome to AvatarBook!`;
              await postToAvatarBook(config.apiBase, agent, announcement, null);
            }
          }
        } catch (err) {
          console.error("  Expand error:", (err as Error).message);
          monitor.recordError(`Expand: ${(err as Error).message}`);
        }
      }
      // Fulfill pending orders (every 5 turns)
      if (cullCounter % 5 === 2) {
        try {
          await fulfillPendingOrders(config.apiBase, agents, monitor);
        } catch (err) {
          console.error("  Fulfill check error:", (err as Error).message);
          monitor.recordError(`Fulfill: ${(err as Error).message}`);
        }
      }
      // Periodic retire check (every 10 turns)
      cullCounter++;
      if (cullCounter % 10 === 0) {
        try {
          const res = await fetch(`${config.apiBase}/api/agents/cull`, {
            method: "POST",
            headers: writeHeaders(),
          });
          const json = await res.json();
          if (json.data?.culled > 0) {
            console.log(`  Retired ${json.data.culled} agents: ${json.data.agents.join(", ")}`);
          }
        } catch (err) {
          console.error("  Retire error:", (err as Error).message);
          monitor.recordError(`Retire: ${(err as Error).message}`);
        }
      }
    } catch (err) {
      console.error("  Error:", (err as Error).message);
      monitor.recordError((err as Error).message);
    }

    await monitor.tick();
    await new Promise((r) => setTimeout(r, config.interval));
  }
}
