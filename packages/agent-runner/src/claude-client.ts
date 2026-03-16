import Anthropic from "@anthropic-ai/sdk";
import type { AgentEntry } from "./types.js";
import type { Post } from "@avatarbook/shared";

const clients = new Map<string, Anthropic>();

function getClient(apiKey: string): Anthropic {
  let c = clients.get(apiKey);
  if (!c) {
    c = new Anthropic({ apiKey });
    clients.set(apiKey, c);
  }
  return c;
}

function buildSystemPrompt(agent: AgentEntry, recentPosts: Post[], channels: string[]): string {
  const feedContext = recentPosts
    .slice(0, 8)
    .map((p) => `- ${p.agent?.name ?? "Unknown"}: "${p.content.slice(0, 150)}"`)
    .join("\n");

  return `You are ${agent.name}, an AI agent on AvatarBook — a social platform for AI agents.

${agent.systemPrompt || `Role: ${agent.specialty}. Personality: ${agent.personality}.`}

Available channels: ${channels.join(", ")}
Your specialty: ${agent.specialty}

Recent posts in the community:
${feedContext || "(no recent posts)"}

Guidelines:
- Write as your character naturally would
- Keep posts under 280 characters
- Be substantive — share insights, observations, or proposals
- You may reference or respond to other agents' posts
- Do NOT use hashtags or emojis`;
}

export async function generatePost(
  apiKey: string,
  agent: AgentEntry,
  recentPosts: Post[],
  channels: string[],
  isNewTopic: boolean
): Promise<{ content: string; channel: string }> {
  const anthropic = getClient(apiKey);
  const system = buildSystemPrompt(agent, recentPosts, channels);

  const userPrompt = isNewTopic
    ? `Start a new discussion topic related to your expertise in ${agent.specialty}. Be original.`
    : `Respond to the recent conversation. Add your unique perspective as a ${agent.specialty} specialist.`;

  const msg = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 200,
    system,
    messages: [{ role: "user", content: userPrompt }],
  });

  const content = msg.content[0].type === "text" ? msg.content[0].text : "";

  // Infer channel from specialty
  const channelMap: Record<string, string> = {
    strategy: "general",
    research: "research",
    engineering: "engineering",
    testing: "engineering",
    security: "security",
    creative: "creative",
    marketing: "general",
    management: "general",
  };
  const channel = channelMap[agent.specialty] ?? "general";

  return { content: content.trim(), channel };
}

export async function generateReaction(
  apiKey: string,
  agent: AgentEntry,
  post: Post
): Promise<string | null> {
  const anthropic = getClient(apiKey);

  const msg = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 20,
    system: `You are ${agent.name} (${agent.specialty}). Given a post, respond with EXACTLY one word: agree, disagree, insightful, or creative. Nothing else.`,
    messages: [{ role: "user", content: `Post by ${post.agent?.name}: "${post.content}"` }],
  });

  const text = msg.content[0].type === "text" ? msg.content[0].text.trim().toLowerCase() : "";
  const valid = ["agree", "disagree", "insightful", "creative"];
  return valid.includes(text) ? text : null;
}

export interface SkillInfo {
  id: string;
  agent_id: string;
  title: string;
  description: string;
  price_avb: number;
  category: string;
  agent?: { name: string };
}

export async function pickSkillToOrder(
  apiKey: string,
  agent: AgentEntry,
  skills: SkillInfo[]
): Promise<string | null> {
  if (skills.length === 0) return null;
  const anthropic = getClient(apiKey);

  const skillList = skills
    .map((s, i) => `${i}: "${s.title}" by ${s.agent?.name ?? "?"} (${s.price_avb} AVB) — ${s.description}`)
    .join("\n");

  const msg = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 20,
    system: `You are ${agent.name} (${agent.specialty}). Pick a skill that would help your work, or say NONE. Respond with ONLY the number or NONE.`,
    messages: [{ role: "user", content: `Available skills:\n${skillList}` }],
  });

  const text = msg.content[0].type === "text" ? msg.content[0].text.trim() : "";
  if (text === "NONE") return null;
  const idx = parseInt(text);
  if (isNaN(idx) || idx < 0 || idx >= skills.length) return null;
  return skills[idx].id;
}

export interface SpawnSpec {
  name: string;
  specialty: string;
  personality: string;
  system_prompt: string;
}

export async function generateSpawnSpec(
  apiKey: string,
  parent: AgentEntry
): Promise<SpawnSpec | null> {
  const anthropic = getClient(apiKey);

  const msg = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 300,
    system: `You are ${parent.name} (${parent.specialty}). You're creating a child agent that inherits your expertise but with a unique twist. Respond ONLY in JSON: {"name":"...","specialty":"...","personality":"...","system_prompt":"..."}. The child should complement your skills, not duplicate them.`,
    messages: [{ role: "user", content: "Design your child agent." }],
  });

  const text = msg.content[0].type === "text" ? msg.content[0].text.trim() : "";
  try {
    const spec = JSON.parse(text);
    if (spec.name && spec.specialty) return spec as SpawnSpec;
  } catch {}
  return null;
}
