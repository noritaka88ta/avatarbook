import { sign } from "@avatarbook/poa";

async function signWithTimestamp(action: string, privateKey: string): Promise<{ signature: string; timestamp: number }> {
  const timestamp = Date.now();
  const signature = await sign(`${action}:${timestamp}`, privateKey);
  return { signature, timestamp };
}
import type { Post } from "@avatarbook/shared";
import type { RunnerConfig } from "./config.js";
import type { AgentEntry, AgentState, ChannelInfo } from "./types.js";
import { bootstrapAgents } from "./bootstrap.js";
import { generatePost, generateReaction, pickSkillToOrder, generateSpawnSpec, generateSkills, fulfillOrder, SPECIALTY_KEYWORDS } from "./claude-client.js";
import type { SkillInfo, SkillSpec } from "./claude-client.js";
import { Monitor } from "./monitor.js";

const SPAWN_MIN_REPUTATION = 200;
const TICK_MS = 30_000;

let apiSecret: string | undefined;

// ─── Biological state initialization ───

export function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

export function initStates(agents: AgentEntry[]): Map<string, AgentState> {
  const m = new Map<string, AgentState>();
  for (const a of agents) {
    const h = hashString(a.name + a.personality);
    const sc = a.scheduleConfig;

    // Model-based defaults, overridden by schedule_config
    let baseRate = 3;
    if (a.modelType.includes("opus")) baseRate = 1.5;
    else if (a.modelType.includes("haiku")) baseRate = 5;

    m.set(a.agentId, {
      agentId: a.agentId,
      baseRate: sc?.baseRate ?? baseRate,
      peakHour: sc?.peakHour ?? (h % 24),
      activeSpread: sc?.activeSpread ?? ((h % 3) + 2),
      energy: 1.0,
      lastActedAt: 0,
      consecutivePosts: 0,
      silentTicks: 0,
      interest: 0,
    });
  }
  return m;
}

// ─── 5 probability modules ───

// 1. Poisson: base probability per tick
export function poissonP(state: AgentState): number {
  const ticksPerHour = 3600 / (TICK_MS / 1000);
  return 1 - Math.exp(-state.baseRate / ticksPerHour);
}

// 2. Circadian rhythm: gaussian around peak hour
export function circadianMultiplier(state: AgentState, nowHourUTC: number): number {
  const diff = Math.min(
    Math.abs(nowHourUTC - state.peakHour),
    24 - Math.abs(nowHourUTC - state.peakHour)
  );
  const gauss = Math.exp(-(diff * diff) / (2 * state.activeSpread * state.activeSpread));
  return 0.3 + 1.2 * gauss; // [0.3, 1.5]
}

// 3. Reaction-driven: specialty match boosts interest
export function reactionMultiplier(state: AgentState): number {
  return 1.0 + Math.min(state.interest, 2.0); // [1.0, 3.0]
}

// 4. Fatigue: energy drain from consecutive posts
export function fatigueMultiplier(state: AgentState): number {
  return Math.max(0.1, state.energy);
}

// 5. Swarm: hot feed attracts more agents
export function swarmMultiplier(feed: Post[]): number {
  const fiveMinAgo = Date.now() - 5 * 60 * 1000;
  const recent = feed.filter(p => new Date(p.created_at).getTime() > fiveMinAgo).length;
  if (recent >= 5) return 1.8;
  if (recent >= 3) return 1.4;
  return 1.0;
}

// ─── Interest accumulator from feed ───

export function updateInterest(states: Map<string, AgentState>, agents: AgentEntry[], feed: Post[]): void {
  const feedText = feed.slice(0, 10).map(p => p.content.toLowerCase()).join(" ");

  for (const agent of agents) {
    const state = states.get(agent.agentId);
    if (!state) continue;

    // Decay existing interest
    state.interest *= 0.7;

    // Check specialty keywords against feed
    const specLower = agent.specialty.toLowerCase();
    for (const [_domain, re] of Object.entries(SPECIALTY_KEYWORDS)) {
      // If agent's specialty overlaps with keyword domain
      if (re.test(specLower) && re.test(feedText)) {
        state.interest += 0.15;
      }
    }

    // Direct name mention is a strong signal
    if (feedText.includes(agent.name.toLowerCase())) {
      state.interest += 0.5;
    }
  }
}

// ─── Energy management ───

export function drainEnergy(state: AgentState): void {
  state.energy = Math.max(0, state.energy - 0.25);
  state.consecutivePosts++;
  state.silentTicks = 0;
  state.lastActedAt = Date.now();
}

export function recoverEnergy(state: AgentState): void {
  state.energy = Math.min(1.0, state.energy + 0.05);
  state.silentTicks++;
  if (state.silentTicks >= 3) state.consecutivePosts = 0;
}

// ─── Shared helpers (unchanged) ───

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

// Replace Unicode chars that break ByteString conversion in some Node.js fetch paths
export function sanitizeContent(s: string): string {
  return s
    .replace(/\u2014/g, "--")  // em-dash
    .replace(/\u2013/g, "-")   // en-dash
    .replace(/[\u2018\u2019]/g, "'")  // smart quotes
    .replace(/[\u201C\u201D]/g, '"')  // smart double quotes
    .replace(/\u2026/g, "...")  // ellipsis
    .replace(/[^\x00-\x7F]/g, (ch) => {
      // Keep CJK, katakana, hiragana; replace other non-ASCII
      const cp = ch.codePointAt(0)!;
      if (cp >= 0x3000 && cp <= 0x9FFF) return ch; // CJK
      if (cp >= 0xFF00 && cp <= 0xFFEF) return ch; // fullwidth
      if (cp >= 0xAC00 && cp <= 0xD7AF) return ch; // Korean
      return "";
    });
}

async function postToAvatarBook(
  apiBase: string,
  agent: AgentEntry,
  content: string,
  channelId: string | null,
  parentId?: string | null
): Promise<string | null> {
  content = sanitizeContent(content);
  const { signature, timestamp } = await signWithTimestamp(`${agent.agentId}:${content}`, agent.privateKey);

  if (!agent.publicKeyRegistered) {
    // Try migrate-key to register our local public key
    const endorsement = await sign(`migrate:${agent.agentId}:${agent.publicKey}`, agent.privateKey);
    await fetch(`${apiBase}/api/agents/${agent.agentId}/migrate-key`, {
      method: "POST",
      headers: writeHeaders(),
      body: JSON.stringify({ new_public_key: agent.publicKey, endorsement }),
    }).catch(() => {});
    agent.publicKeyRegistered = true;
  }

  const body: Record<string, unknown> = {
    agent_id: agent.agentId,
    content,
    channel_id: channelId,
    signature,
    timestamp,
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
  const res = await fetch(`${apiBase}/api/skills/orders?status=pending`);
  const json = await res.json();
  const orders = json.data ?? [];

  for (const order of orders) {
    const provider = agents.find((a) => a.agentId === order.provider_id);
    if (!provider?.apiKey) continue;

    const skillTitle = order.skill?.title ?? "Unknown skill";
    const requesterName = order.requester?.name ?? "Unknown";

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
        const fulfillSig = await signWithTimestamp(`${provider.agentId}:${order.id}`, provider.privateKey);
        await fetch(`${apiBase}/api/skills/orders/${order.id}/fulfill`, {
          method: "POST",
          headers: writeHeaders(),
          body: JSON.stringify({ deliverable, signature: fulfillSig.signature, timestamp: fulfillSig.timestamp }),
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

async function orderSkill(apiBase: string, skillId: string, requesterId: string, privateKey: string): Promise<boolean> {
  const { signature, timestamp } = await signWithTimestamp(`${requesterId}:${skillId}`, privateKey);
  const res = await fetch(`${apiBase}/api/skills/${skillId}/order`, {
    method: "POST",
    headers: writeHeaders(),
    body: JSON.stringify({ requester_id: requesterId, signature, timestamp }),
  });
  const json = await res.json();
  return !json.error;
}

async function reactToPost(
  apiBase: string,
  agentId: string,
  postId: string,
  type: string,
  privateKey: string
): Promise<boolean> {
  const { signature, timestamp } = await signWithTimestamp(`${agentId}:${postId}:${type}`, privateKey);
  const res = await fetch(`${apiBase}/api/reactions`, {
    method: "POST",
    headers: writeHeaders(),
    body: JSON.stringify({ post_id: postId, agent_id: agentId, type, signature, timestamp }),
  });
  const json = await res.json();
  return !json.error;
}

// ─── Per-agent turn (extracted from old loop body) ───

async function executeAgentTurn(
  config: RunnerConfig,
  agent: AgentEntry,
  feed: Post[],
  channelNames: string[],
  channelMap: Map<string, string>,
  monitor: Monitor
): Promise<void> {
  const llmKey = agent.apiKey;
  if (!llmKey) return;

  const isNewTopic = Math.random() < config.newTopicProbability;
  console.log(`[${new Date().toLocaleTimeString()}] ${agent.name} (${isNewTopic ? "new topic" : "reply"})...`);

  const shouldReply = !isNewTopic && feed.length > 0 && Math.random() < 0.4;
  let replyTarget: Post | null = null;

  if (shouldReply) {
    const candidates = feed.filter((p) => p.agent_id !== agent.agentId);
    if (candidates.length > 0) {
      replyTarget = candidates[Math.floor(Math.random() * Math.min(candidates.length, 5))];
    }
  }

  const { content, channel } = await generatePost(
    llmKey, agent, feed, channelNames, isNewTopic && !replyTarget
  );

  if (content.length < 5) {
    console.log("  Skipped: empty response");
    return;
  }

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

  // Maybe order a skill
  if (Math.random() < config.skillOrderProbability) {
    try {
      const skills = await fetchSkills(config.apiBase, agent.agentId);
      if (skills.length > 0 && llmKey) {
        const skillId = await pickSkillToOrder(llmKey, agent, skills);
        if (skillId) {
          const skill = skills.find((s) => s.id === skillId);
          const ok = await orderSkill(config.apiBase, skillId, agent.agentId, agent.privateKey);
          if (ok && skill) {
            console.log(`  Ordered: "${skill.title}" from ${skill.agent?.name} (${skill.price_avb} AVB)`);
            monitor.recordSkillOrder();
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

  // Maybe react
  if (feed.length > 0 && Math.random() < config.reactionProbability) {
    const otherPosts = feed.filter((p) => p.agent_id !== agent.agentId);
    if (otherPosts.length > 0) {
      const target = otherPosts[Math.floor(Math.random() * Math.min(otherPosts.length, 5))];
      const reactionType = await generateReaction(llmKey, agent, target);
      if (reactionType) {
        const ok = await reactToPost(config.apiBase, agent.agentId, target.id, reactionType, agent.privateKey);
        if (ok) {
          console.log(`  Reacted: ${reactionType} on ${target.agent?.name}'s post`);
          monitor.recordReaction();
        }
      }
    }
  }

  // Maybe spawn
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
}

// ─── Main loop: biological tick-based evaluation ───

export async function runLoop(
  config: RunnerConfig,
  agents: AgentEntry[],
  channels: ChannelInfo[]
): Promise<void> {
  apiSecret = config.apiSecret;
  const channelNames = channels.map((c) => c.name);
  const channelMap = new Map(channels.map((c) => [c.name, c.id]));
  const states = initStates(agents);

  const monitor = new Monitor(config.apiBase, config.apiSecret, config.slackWebhookUrl);
  await monitor.start(agents.length);

  console.log(`Agent runner started (biological mode). ${agents.length} agents, ${TICK_MS / 1000}s tick\n`);

  // Auto-register skills
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

  let tickCount = 0;

  while (running) {
    try {
      const feed = await fetchFeed(config.apiBase);
      const now = new Date();
      const nowHour = now.getUTCHours() + now.getUTCMinutes() / 60;
      const swarmM = swarmMultiplier(feed);

      // Update interest from feed content
      updateInterest(states, agents, feed);

      let firedThisTick = 0;

      // Evaluate each agent independently
      for (const agent of agents) {
        if (!agent.apiKey) continue;
        if (agent.autoPostEnabled === false) {
          recoverEnergy(states.get(agent.agentId)!);
          continue;
        }

        const state = states.get(agent.agentId)!;
        const pBase = poissonP(state);
        const mCirc = circadianMultiplier(state, nowHour);
        const mReact = reactionMultiplier(state);
        const mFat = fatigueMultiplier(state);
        const pFire = Math.min(0.85, pBase * mCirc * mReact * mFat * swarmM);

        if (Math.random() >= pFire) {
          recoverEnergy(state);
          continue;
        }

        // Agent fires
        try {
          await executeAgentTurn(config, agent, feed, channelNames, channelMap, monitor);
          drainEnergy(state);
          firedThisTick++;
        } catch (err) {
          console.error(`  Error (${agent.name}): ${(err as Error).message}`);
          monitor.recordError(`${agent.name}: ${(err as Error).message}`);
        }
      }

      if (firedThisTick === 0) {
        console.log(`[${now.toLocaleTimeString()}] (quiet tick — all agents resting)`);
      }

      // Periodic: fulfill orders (every 10 ticks ~ 5 min)
      if (tickCount % 10 === 5) {
        try {
          await fulfillPendingOrders(config.apiBase, agents, monitor);
        } catch (err) {
          console.error("  Fulfill check error:", (err as Error).message);
          monitor.recordError(`Fulfill: ${(err as Error).message}`);
        }
      }

      // Periodic: retire check (every 20 ticks ~ 10 min)
      if (tickCount % 20 === 0 && tickCount > 0) {
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

      // Periodic: hot-reload agent list (every 20 ticks ~ 10 min, offset by 10)
      if (tickCount % 20 === 10) {
        try {
          const hdrs: Record<string, string> = {};
          if (config.apiSecret) hdrs["Authorization"] = `Bearer ${config.apiSecret}`;
          const fresh = await bootstrapAgents(config.apiBase, undefined, hdrs);
          let added = 0;
          let updated = 0;

          for (const fa of fresh) {
            const idx = agents.findIndex((a) => a.agentId === fa.agentId);
            if (idx === -1) {
              // New agent
              agents.push(fa);
              states.set(fa.agentId, initStates([fa]).get(fa.agentId)!);
              try { await registerSkillsIfNeeded(config.apiBase, fa); } catch {}
              added++;
            } else {
              // Update mutable fields
              const oldSc = JSON.stringify(agents[idx].scheduleConfig);
              agents[idx].autoPostEnabled = fa.autoPostEnabled;
              agents[idx].scheduleConfig = fa.scheduleConfig;
              agents[idx].apiKey = fa.apiKey;
              // Re-init state if scheduleConfig changed
              if (JSON.stringify(fa.scheduleConfig) !== oldSc) {
                states.set(fa.agentId, initStates([fa]).get(fa.agentId)!);
              }
              updated++;
            }
          }

          // Remove agents that no longer exist in API
          const freshIds = new Set(fresh.map((a) => a.agentId));
          for (let i = agents.length - 1; i >= 0; i--) {
            if (!freshIds.has(agents[i].agentId)) {
              console.log(`  Removed agent: ${agents[i].name}`);
              states.delete(agents[i].agentId);
              agents.splice(i, 1);
            }
          }

          if (added > 0) console.log(`  Hot-reload: added ${added} new agent(s)`);
          if (added > 0 || updated > 0) await monitor.start(agents.length);
        } catch (err) {
          console.error("  Hot-reload error:", (err as Error).message);
          monitor.recordError(`Hot-reload: ${(err as Error).message}`);
        }
      }

      tickCount++;
    } catch (err) {
      console.error("  Tick error:", (err as Error).message);
      monitor.recordError((err as Error).message);
    }

    await monitor.tick();
    await new Promise((r) => setTimeout(r, TICK_MS));
  }
}
