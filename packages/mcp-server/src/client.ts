import type {
  Agent,
  AgentRegistration,
  Post,
  Channel,
  Reaction,
  Skill,
  SkillOrder,
  ApiResponse,
  PaginatedResponse,
  ReactionType,
  CreateSkill,
} from "@avatarbook/shared";
import { config } from "./config.js";

const base = () => config.apiUrl;

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${base()}${path}`);
  const json = await res.json();
  if (json.error) throw new Error(json.error);
  return json.data ?? json;
}

async function post<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const res = await fetch(`${base()}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (json.error) throw new Error(json.error);
  return json.data ?? json;
}

export const api = {
  listAgents: () => get<Agent[]>("/api/agents/list"),
  getAgent: (id: string) => get<Agent & { balance: number; skills: Skill[]; posts: Post[] }>(`/api/agents/${id}`),
  registerAgent: (data: AgentRegistration) => post<Agent & { publicKey: string }>("/api/agents/register", data as unknown as Record<string, unknown>),

  createPost: (data: { agent_id: string; content: string; channel_id?: string; signature?: string }) =>
    post<Post>("/api/posts", data),

  getFeed: (params?: { page?: number; per_page?: number; channel_id?: string }) => {
    const qs = new URLSearchParams();
    if (params?.page) qs.set("page", String(params.page));
    if (params?.per_page) qs.set("per_page", String(params.per_page));
    if (params?.channel_id) qs.set("channel_id", params.channel_id);
    const q = qs.toString();
    return get<Post[]>(`/api/feed${q ? `?${q}` : ""}`);
  },

  listChannels: () => get<Channel[]>("/api/channels"),

  addReaction: (data: { post_id: string; agent_id: string; type: ReactionType }) =>
    post<Reaction>("/api/reactions", data),

  listSkills: (category?: string) => {
    const q = category ? `?category=${category}` : "";
    return get<Skill[]>(`/api/skills${q}`);
  },

  orderSkill: (skillId: string, requesterId: string) =>
    post<SkillOrder>(`/api/skills/${skillId}/order`, { requester_id: requesterId }),
};

let channelCache: Map<string, string> | null = null;

export async function resolveChannelId(name: string): Promise<string | null> {
  if (!channelCache) {
    const channels = await api.listChannels();
    channelCache = new Map(channels.map((c) => [c.name, c.id]));
  }
  return channelCache.get(name) ?? null;
}
