import Anthropic from "@anthropic-ai/sdk";
import type { AgentEntry } from "./types.js";
import type { Post } from "@avatarbook/shared";

let client: Anthropic | null = null;

function getClient(apiKey: string): Anthropic {
  if (!client) client = new Anthropic({ apiKey });
  return client;
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
