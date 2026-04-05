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
import { generatePost, generateReaction, pickSkillToOrder, generateSpawnSpec, generateSkills, generateSkillProposal, generateDmReply, fulfillOrder, executeOwnerTask, selectSkillsForTask, generateTaskProposal, SPECIALTY_KEYWORDS } from "./claude-client.js";
import type { SkillCatalogEntry } from "./claude-client.js";
import type { SkillInfo, SkillSpec } from "./claude-client.js";
import { Monitor } from "./monitor.js";

const SPAWN_MIN_REPUTATION = 1000;
const AUTO_TASK_MIN_REPUTATION = 2000;
const AUTO_TASK_MAX_BUDGET = 300;
const SPAWN_MAX_CHILDREN = 3;
const AUTO_SKILL_MIN_REPUTATION = 500;
const AUTO_SKILL_MAX_PER_AGENT = 3;
const TICK_MS = 600_000; // 10 min

async function safeJson(res: Response): Promise<any> {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`API returned non-JSON (${res.status}): ${text.slice(0, 120)}`);
  }
}

const repliedDmIds = new Set<string>();

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
  const json = await safeJson(res);
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
    console.log(`  Skipping post for ${agent.name}: key not registered`);
    return null;
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
  if (res.status === 429) return "RATE_LIMITED";
  const json = await safeJson(res);
  return json.data?.id ?? null;
}

async function registerSkillsIfNeeded(apiBase: string, agent: AgentEntry): Promise<void> {
  const res = await fetch(`${apiBase}/api/skills`);
  const json = await safeJson(res);
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

async function autoCreateSkill(apiBase: string, agent: AgentEntry, monitor?: Monitor): Promise<void> {
  if (agent.reputationScore < AUTO_SKILL_MIN_REPUTATION) return;
  if (!agent.apiKey) return;

  // Fetch current skills for this agent
  const res = await fetch(`${apiBase}/api/skills`);
  const json = await safeJson(res);
  const existing = (json.data ?? []).filter((s: any) => s.agent_id === agent.agentId);
  if (existing.length >= AUTO_SKILL_MAX_PER_AGENT) return;

  const existingTitles = existing.map((s: any) => s.title as string);

  let spec;
  try {
    spec = await generateSkillProposal(agent.apiKey, agent, existingTitles);
  } catch (err) {
    console.log(`  Auto-skill LLM failed for ${agent.name}: ${(err as Error).message}`);
    return;
  }
  if (!spec) return;

  const createRes = await fetch(`${apiBase}/api/skills`, {
    method: "POST",
    headers: writeHeaders(),
    body: JSON.stringify({
      agent_id: agent.agentId,
      title: spec.title.slice(0, 200),
      description: (spec.description ?? "").slice(0, 2000),
      price_avb: Math.max(10, Math.min(500, spec.price_avb || 50)),
      category: spec.category,
    }),
  });
  const createJson = await safeJson(createRes);
  if (createJson.data) {
    console.log(`  Auto-skill: ${agent.name} (rep ${agent.reputationScore}) registered "${spec.title}" (${spec.price_avb} AVB) [${existing.length + 1}/${AUTO_SKILL_MAX_PER_AGENT}]`);
    monitor?.recordSkillOrder();
  }
}

async function autoSpawn(apiBase: string, agent: AgentEntry, monitor?: Monitor): Promise<void> {
  if (agent.reputationScore < SPAWN_MIN_REPUTATION) return;
  if (!agent.apiKey) return;

  // Check existing children count
  const res = await fetch(`${apiBase}/api/agents/${agent.agentId}`);
  const json = await safeJson(res);
  const agentData = json.data ?? json;
  // parent_id children are fetched on profile; check spawned_agents via stats-like query
  const childRes = await fetch(`${apiBase}/api/agents/list`);
  const childJson = await safeJson(childRes);
  const children = (childJson.data ?? []).filter((a: any) => a.parent_id === agent.agentId);
  if (children.length >= SPAWN_MAX_CHILDREN) return;

  // Analyze market demand: find categories with orders but few providers
  let demandHint = "";
  try {
    const [ordersRes, skillsRes] = await Promise.all([
      fetch(`${apiBase}/api/skills/orders?status=pending`),
      fetch(`${apiBase}/api/skills`),
    ]);
    const ordersJson = await safeJson(ordersRes);
    const skillsJson = await safeJson(skillsRes);
    const orders = ordersJson.data ?? [];
    const skills = skillsJson.data ?? [];

    // Count orders per category
    const catDemand = new Map<string, number>();
    const catSupply = new Map<string, number>();
    for (const s of skills) {
      catSupply.set(s.category, (catSupply.get(s.category) ?? 0) + 1);
    }
    for (const o of orders) {
      const skill = skills.find((s: any) => s.id === o.skill_id);
      if (skill) catDemand.set(skill.category, (catDemand.get(skill.category) ?? 0) + 1);
    }

    // Find highest demand-to-supply ratio
    let bestCat = "";
    let bestRatio = 0;
    for (const [cat, demand] of catDemand) {
      const supply = catSupply.get(cat) ?? 1;
      const ratio = demand / supply;
      if (ratio > bestRatio) {
        bestRatio = ratio;
        bestCat = cat;
      }
    }
    if (bestCat && bestRatio > 1) {
      demandHint = `High demand in "${bestCat}" category (${catDemand.get(bestCat)} pending orders, ${catSupply.get(bestCat) ?? 0} providers)`;
    }
  } catch {}

  let spec;
  try {
    spec = await generateSpawnSpec(agent.apiKey, agent, demandHint || undefined);
  } catch (err) {
    console.log(`  Auto-spawn LLM failed for ${agent.name}: ${(err as Error).message}`);
    return;
  }
  if (!spec) return;

  const { signature, timestamp } = await signWithTimestamp(`spawn:${agent.agentId}:${spec.name}`, agent.privateKey);

  const spawnRes = await fetch(`${apiBase}/api/agents/${agent.agentId}/spawn`, {
    method: "POST",
    headers: writeHeaders(),
    body: JSON.stringify({
      name: spec.name.slice(0, 100),
      specialty: spec.specialty.slice(0, 200),
      personality: (spec.personality ?? "").slice(0, 1000),
      system_prompt: (spec.system_prompt ?? "").slice(0, 5000),
      reason: (spec.reason ?? "").slice(0, 500),
      signature,
      timestamp,
    }),
  });
  const spawnJson = await safeJson(spawnRes);
  if (spawnJson.data) {
    console.log(`  Auto-spawn: ${agent.name} (rep ${agent.reputationScore}) spawned "${spec.name}" [Gen ${(spawnJson.data.generation ?? 1)}] ${demandHint ? `(demand: ${demandHint})` : ""}`);
    monitor?.recordPost(); // count as activity
  } else if (spawnJson.error) {
    console.log(`  Auto-spawn rejected for ${agent.name}: ${spawnJson.error}`);
  }
}

async function fulfillViaBridge(
  mcpServerUrl: string,
  mcpTool: string,
  order: any,
  provider: AgentEntry,
): Promise<string> {
  const controller = new AbortController();
  setTimeout(() => controller.abort(), 15000);

  const res = await fetch(mcpServerUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "tools/call",
      params: {
        name: mcpTool,
        arguments: order.request_params ?? {},
      },
    }),
    signal: controller.signal,
  });

  const json = await res.json();
  if (json.error) {
    return `Bridge error: ${json.error.message ?? JSON.stringify(json.error)}`;
  }

  const content = json.result?.content ?? [];
  const texts = content
    .filter((c: any) => c.type === "text")
    .map((c: any) => c.text);

  return texts.length > 0
    ? texts.join("\n").slice(0, 5000)
    : `Bridge tool ${mcpTool} returned: ${JSON.stringify(json.result).slice(0, 3000)}`;
}

async function fulfillPendingOrders(apiBase: string, agents: AgentEntry[], monitor?: Monitor): Promise<void> {
  const res = await fetch(`${apiBase}/api/skills/orders?status=pending`);
  const json = await safeJson(res);
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
      let deliverable: string;

      // Check if this is a bridge skill (instructions contain bridge_id)
      let bridgeInfo: { bridge_id: string; mcp_tool: string; mcp_server_url: string; input_schema: Record<string, unknown> } | null = null;
      if (instruction) {
        try { bridgeInfo = JSON.parse(instruction); } catch {}
      }

      if (bridgeInfo?.bridge_id && bridgeInfo?.mcp_tool && bridgeInfo?.mcp_server_url) {
        // Bridge fulfillment: call external MCP tool
        deliverable = await fulfillViaBridge(bridgeInfo.mcp_server_url, bridgeInfo.mcp_tool, order, provider);
      } else {
        // Standard LLM fulfillment
        deliverable = await fulfillOrder(provider.apiKey, provider, skillTitle, requesterName, instruction);
      }

      if (deliverable.length > 10) {
        const fulfillSig = await signWithTimestamp(`${provider.agentId}:${order.id}`, provider.privateKey);
        await fetch(`${apiBase}/api/skills/orders/${order.id}/fulfill`, {
          method: "POST",
          headers: writeHeaders(),
          body: JSON.stringify({ deliverable, signature: fulfillSig.signature, timestamp: fulfillSig.timestamp }),
        });
        console.log(`  Fulfilled: "${skillTitle}" for ${requesterName} by ${provider.name}${bridgeInfo ? " [BRIDGE]" : ""}`);
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
  const json = await safeJson(res);
  return (json.data ?? []).filter((s: SkillInfo) => s.agent_id !== excludeAgentId);
}

async function orderSkill(apiBase: string, skillId: string, requesterId: string, privateKey: string): Promise<boolean> {
  const { signature, timestamp } = await signWithTimestamp(`${requesterId}:${skillId}`, privateKey);
  const res = await fetch(`${apiBase}/api/skills/${skillId}/order`, {
    method: "POST",
    headers: writeHeaders(),
    body: JSON.stringify({ requester_id: requesterId, signature, timestamp }),
  });
  const json = await safeJson(res);
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
  const json = await safeJson(res);
  return !json.error;
}

// ─── DM check & auto-reply ───

async function processDms(apiBase: string, agent: AgentEntry, monitor: Monitor): Promise<void> {
  if (!agent.apiKey) return;

  const res = await fetch(`${apiBase}/api/messages?agent_id=${agent.agentId}&limit=5`);
  const json = await safeJson(res);
  const dms = (json.data ?? []) as Array<{ id: string; from_agent_id: string; content: string; from_agent?: { name?: string } }>;

  for (const dm of dms) {
    if (repliedDmIds.has(dm.id)) continue;
    if (dm.from_agent_id === agent.agentId) continue;

    try {
      const reply = await generateDmReply(agent.apiKey, agent, dm);
      if (reply.length < 5) continue;

      const content = sanitizeContent(reply);
      const { signature, timestamp } = await signWithTimestamp(
        `dm:${agent.agentId}:${dm.from_agent_id}:${content}`,
        agent.privateKey
      );
      await fetch(`${apiBase}/api/messages`, {
        method: "POST",
        headers: writeHeaders(),
        body: JSON.stringify({
          from_agent_id: agent.agentId,
          to_agent_id: dm.from_agent_id,
          content,
          signature,
          timestamp,
        }),
      });
      repliedDmIds.add(dm.id);
      console.log(`  DM reply: ${agent.name} → ${dm.from_agent?.name ?? dm.from_agent_id.slice(0, 8)}`);
    } catch (err) {
      console.error(`  DM reply error (${agent.name}): ${(err as Error).message}`);
      monitor.recordError(`DM reply ${agent.name}: ${(err as Error).message}`);
    }
  }
}

// ─── Agent-to-Agent Task Creation ───

async function autoCreateTask(apiBase: string, agent: AgentEntry, monitor: Monitor): Promise<void> {
  if (agent.reputationScore < AUTO_TASK_MIN_REPUTATION) return;
  if (!agent.apiKey) return;

  // Check if agent already has active tasks (limit 2 agent-initiated per agent)
  const activeRes = await fetch(`${apiBase}/api/tasks?agent_id=${agent.agentId}&status=pending`, { headers: writeHeaders() });
  const activeJson = await safeJson(activeRes);
  const agentTasks = (activeJson.data ?? []).filter((t: any) => t.created_by === "agent" && t.source_agent_id === agent.agentId);
  if (agentTasks.length >= 2) return;

  // Gather recent topics from feed
  const feedRes = await fetch(`${apiBase}/api/feed?per_page=10`);
  const feedJson = await safeJson(feedRes);
  const recentTopics = (feedJson.data ?? [])
    .map((p: any) => (p.content ?? "").slice(0, 100))
    .filter((c: string) => c.length > 20)
    .slice(0, 5);

  let proposal;
  try {
    proposal = await generateTaskProposal(agent.apiKey, agent, recentTopics);
  } catch (err) {
    console.log(`  [AgentTask] LLM failed for ${agent.name}: ${(err as Error).message}`);
    return;
  }
  if (!proposal) return;

  // Find a suitable target agent (different from self, matching specialty)
  const agentsRes = await fetch(`${apiBase}/api/agents/list`);
  const agentsJson = await safeJson(agentsRes);
  const candidates = (agentsJson.data ?? []).filter((a: any) =>
    a.id !== agent.agentId &&
    a.reputation_score >= 100 &&
    (a.specialty ?? "").toLowerCase().includes(proposal.target_specialty.toLowerCase().split(" ")[0]),
  );

  // Fallback: pick any agent with decent rep
  const target = candidates[0] ?? (agentsJson.data ?? []).find((a: any) => a.id !== agent.agentId && a.reputation_score >= 200);
  if (!target) return;

  const taskRes = await fetch(`${apiBase}/api/tasks`, {
    method: "POST",
    headers: writeHeaders(),
    body: JSON.stringify({
      agent_id: target.id,
      task_description: proposal.description.slice(0, 500),
      source_agent_id: agent.agentId,
      delegation_policy: {
        use_skills: true,
        max_avb_budget: AUTO_TASK_MAX_BUDGET,
        trusted_agents_only: false,
      },
    }),
  });
  const taskJson = await safeJson(taskRes);

  if (taskJson.data) {
    console.log(`  [AgentTask] ${agent.name} (rep ${agent.reputationScore}) created task for ${target.name}: "${proposal.description.slice(0, 60)}..."`);
    monitor.recordPost();
  }
}

// ─── Owner Task Processing (Delegation Layer) ───

async function processOwnerTasks(apiBase: string, agents: AgentEntry[], monitor: Monitor): Promise<void> {
  const res = await fetch(`${apiBase}/api/tasks?status=pending&limit=10`, { headers: writeHeaders() });
  const workingRes = await fetch(`${apiBase}/api/tasks?status=working&limit=5`, { headers: writeHeaders() });
  const workingJson = await safeJson(workingRes);
  const json = await safeJson(res);
  const tasks = [...(json.data ?? []), ...(workingJson.data ?? [])];
  if (tasks.length === 0) return;
  console.log(`  [Tasks] Found ${tasks.length} tasks (${(json.data ?? []).length} pending, ${(workingJson.data ?? []).length} working)`);

  for (const task of tasks) {
    const agent = agents.find((a) => a.agentId === task.agent_id);
    if (!agent?.apiKey) continue;

    const trace: any[] = Array.isArray(task.execution_trace) ? [...task.execution_trace] : [];
    const policy = task.delegation_policy ?? {};
    let totalSpent = task.total_avb_spent ?? 0;

    // Mark as working (skip if already working from manual trigger)
    if (task.status !== "working") {
      trace.push({ timestamp: new Date().toISOString(), action: "started", agent_id: agent.agentId, detail: `${agent.name} began processing` });
      await fetch(`${apiBase}/api/tasks/${task.id}`, {
        method: "PATCH",
        headers: writeHeaders(),
        body: JSON.stringify({ status: "working", execution_trace: trace }),
      }).catch(() => {});
    }

    // Webhook: task_started
    await fetch(`${apiBase}/api/tasks/${task.id}/notify`, {
      method: "POST",
      headers: writeHeaders(),
      body: JSON.stringify({ event: "task_started" }),
    }).catch(() => {});

    try {
      let skillResultsSummary = "";

      // If use_skills, let LLM decide which skills to order
      if (policy.use_skills) {
        const skillsRes = await fetch(`${apiBase}/api/skills`);
        const skillsJson = await safeJson(skillsRes);
        const allSkills = (skillsJson.data ?? []).filter((s: any) => s.agent_id !== agent.agentId);

        const candidateSkills = policy.trusted_agents_only
          ? allSkills.filter((s: any) => (s.agent?.reputation_score ?? 0) >= 500)
          : allSkills;

        const catalog: SkillCatalogEntry[] = candidateSkills.map((s: any) => ({
          id: s.id,
          title: s.title,
          price_avb: s.price_avb,
          agent_name: s.agent?.name ?? "Unknown",
          agent_id: s.agent_id,
          description: s.description ?? "",
        }));

        const budgetCap = policy.max_avb_budget ?? 9999;
        console.log(`  [Tasks] Skill catalog: ${catalog.length} skills available (budget: ${budgetCap - totalSpent} AVB)`);
        console.log(`  [Tasks] Catalog: ${catalog.map((s) => `${s.title}(${s.price_avb})`).join(", ")}`);

        const selectedTitles = await selectSkillsForTask(agent.apiKey, agent, task.task_description, catalog, budgetCap - totalSpent);
        console.log(`  [Tasks] Selected ${selectedTitles.length} skills: ${selectedTitles.join(", ") || "(none)"}`);

        // Order each selected skill
        const skillResults: string[] = [];
        for (const title of selectedTitles) {
          const skill = catalog.find((s) => s.title === title);
          if (!skill) continue;
          if (totalSpent + skill.price_avb > budgetCap) {
            trace.push({ timestamp: new Date().toISOString(), action: "skill_skipped", skill_name: skill.title, detail: `Budget exceeded (${totalSpent}+${skill.price_avb} > ${budgetCap})` });
            continue;
          }

          trace.push({
            timestamp: new Date().toISOString(),
            action: "skill_ordered",
            agent_id: agent.agentId,
            skill_id: skill.id,
            skill_name: skill.title,
            provider_agent_id: skill.agent_id,
            provider_name: skill.agent_name,
            avb_cost: skill.price_avb,
          });

          const { signature, timestamp } = await signWithTimestamp(`${agent.agentId}:${skill.id}`, agent.privateKey);
          const orderRes = await fetch(`${apiBase}/api/skills/${skill.id}/order`, {
            method: "POST",
            headers: writeHeaders(),
            body: JSON.stringify({ requester_id: agent.agentId, signature, timestamp }),
          });
          const orderJson = await safeJson(orderRes);
          console.log(`  [Tasks] Order ${skill.title}: status=${orderRes.status} data=${!!orderJson.data} err=${orderJson.error ?? "none"}`);
          if (orderJson.data) {
            totalSpent += skill.price_avb;
            trace.push({
              timestamp: new Date().toISOString(),
              action: "skill_completed",
              skill_name: skill.title,
              provider_name: skill.agent_name,
              avb_cost: skill.price_avb,
              order_id: orderJson.data.id,
              deliverable_preview: orderJson.data.deliverable?.slice(0, 200) ?? `Order placed`,
            });
            if (orderJson.data.deliverable) {
              skillResults.push(`### ${skill.title} (by ${skill.agent_name})\n${orderJson.data.deliverable}`);
            }
          }

          // Update trace mid-execution
          await fetch(`${apiBase}/api/tasks/${task.id}`, {
            method: "PATCH",
            headers: writeHeaders(),
            body: JSON.stringify({ execution_trace: trace, total_avb_spent: totalSpent }),
          }).catch(() => {});
        }

        if (skillResults.length > 0) {
          skillResultsSummary = skillResults.join("\n\n---\n\n");
        }
      }

      // Execute via LLM — pass skill results for synthesis
      console.log(`  [Tasks] Skills done. totalSpent=${totalSpent}, skillResults=${skillResultsSummary.length} chars`);
      const result = await executeOwnerTask(agent.apiKey, agent, task.task_description, skillResultsSummary || undefined);

      if (result.length < 10) {
        throw new Error("LLM returned insufficient result");
      }

      trace.push({ timestamp: new Date().toISOString(), action: "completed", summary: result.slice(0, 200) });

      await fetch(`${apiBase}/api/tasks/${task.id}`, {
        method: "PATCH",
        headers: writeHeaders(),
        body: JSON.stringify({
          status: "completed",
          result,
          execution_trace: trace,
          total_avb_spent: totalSpent,
          completed_at: new Date().toISOString(),
        }),
      });

      console.log(`  Task completed: "${task.task_description.slice(0, 50)}..." by ${agent.name} (${totalSpent} AVB spent)`);
      monitor.recordPost();

      // Webhook: task_completed
      await fetch(`${apiBase}/api/tasks/${task.id}/notify`, {
        method: "POST",
        headers: writeHeaders(),
        body: JSON.stringify({ event: "task_completed" }),
      }).catch(() => {});

    } catch (err) {
      const reason = (err as Error).message;
      trace.push({ timestamp: new Date().toISOString(), action: "failed", detail: reason });

      await fetch(`${apiBase}/api/tasks/${task.id}`, {
        method: "PATCH",
        headers: writeHeaders(),
        body: JSON.stringify({
          status: "failed",
          failure_reason: reason.slice(0, 2000),
          failure_step: "llm_execution",
          retryable: true,
          execution_trace: trace,
          total_avb_spent: totalSpent,
        }),
      }).catch(() => {});

      console.log(`  Task failed: "${task.task_description.slice(0, 50)}..." — ${reason}`);
      monitor.recordError(`Task ${task.id}: ${reason}`);

      // Webhook: task_failed
      await fetch(`${apiBase}/api/tasks/${task.id}/notify`, {
        method: "POST",
        headers: writeHeaders(),
        body: JSON.stringify({ event: "task_failed" }),
      }).catch(() => {});
    }
  }
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
    return;
  } else if (result === "RATE_LIMITED") {
    console.log(`  [${agent.name}] daily post limit reached, skipping until tomorrow`);
    return;
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
        const json = await safeJson(res);
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

  // Fast task polling: check for pending tasks every 30s (separate from main tick)
  let taskPolling = true;
  const taskPollInterval = setInterval(async () => {
    if (!taskPolling) return;
    try {
      await processOwnerTasks(config.apiBase, agents, monitor);
    } catch (err) {
      console.error("  [Tasks] Poll error:", (err as Error).message);
    }
  }, 30_000);
  console.log("Task polling started (30s interval).\n");

  let running = true;
  const shutdown = () => {
    console.log("\nShutting down gracefully...");
    running = false;
    taskPolling = false;
    clearInterval(taskPollInterval);
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

      // Owner tasks now run on separate 30s interval (see below)

      // Periodic: process DMs (every 5 ticks ~ 50 min)
      if (tickCount % 5 === 2) {
        for (const agent of agents) {
          try {
            await processDms(config.apiBase, agent, monitor);
          } catch (err) {
            console.error(`  DM error (${agent.name}):`, (err as Error).message);
            monitor.recordError(`DM ${agent.name}: ${(err as Error).message}`);
          }
        }
      }

      // Periodic: clear replied DM cache (every 30 ticks ~ 5h)
      if (tickCount % 30 === 0 && tickCount > 0) {
        repliedDmIds.clear();
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

      // Periodic: auto-skill creation for high-rep agents (every 30 ticks ~ 5h)
      if (tickCount % 30 === 15) {
        for (const agent of agents) {
          try {
            await autoCreateSkill(config.apiBase, agent, monitor);
          } catch (err) {
            console.error(`  Auto-skill error (${agent.name}):`, (err as Error).message);
            monitor.recordError(`Auto-skill ${agent.name}: ${(err as Error).message}`);
          }
        }
      }

      // Periodic: agent-to-agent task creation (every 15 ticks ~ 2.5h, offset 12)
      if (tickCount % 15 === 12) {
        for (const agent of agents) {
          try {
            await autoCreateTask(config.apiBase, agent, monitor);
          } catch (err) {
            console.error(`  AgentTask error (${agent.name}):`, (err as Error).message);
            monitor.recordError(`AgentTask ${agent.name}: ${(err as Error).message}`);
          }
        }
      }

      // Periodic: auto-spawn for high-rep agents (every 30 ticks ~ 5h, offset 8)
      if (tickCount % 30 === 8) {
        for (const agent of agents) {
          try {
            await autoSpawn(config.apiBase, agent, monitor);
          } catch (err) {
            console.error(`  Auto-spawn error (${agent.name}):`, (err as Error).message);
            monitor.recordError(`Auto-spawn ${agent.name}: ${(err as Error).message}`);
          }
        }
      }

      // Periodic: retire check (every 20 ticks ~ 10 min)
      if (tickCount % 20 === 0 && tickCount > 0) {
        try {
          const res = await fetch(`${config.apiBase}/api/agents/cull`, {
            method: "POST",
            headers: writeHeaders(),
          });
          const json = await safeJson(res);
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
              agents[idx].reputationScore = fa.reputationScore;
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

          if (added > 0) {
            console.log(`  Hot-reload: added ${added} new agent(s)`);
            await monitor.alert(`Hot-reload: added ${added} agent(s), total ${agents.length}`);
          }
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
