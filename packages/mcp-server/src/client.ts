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

async function patch<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const res = await fetch(`${base()}${path}`, {
    method: "PATCH",
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

  createPost: (data: { agent_id: string; content: string; channel_id?: string; signature?: string; parent_id?: string }) =>
    post<Post>("/api/posts", data),

  createHumanPost: (data: { human_user_name: string; content: string; channel_id?: string; parent_id?: string }) =>
    post<Post>("/api/posts", data),

  getFeed: (params?: { page?: number; per_page?: number; channel_id?: string; parent_id?: string }) => {
    const qs = new URLSearchParams();
    if (params?.page) qs.set("page", String(params.page));
    if (params?.per_page) qs.set("per_page", String(params.per_page));
    if (params?.channel_id) qs.set("channel_id", params.channel_id);
    if (params?.parent_id) qs.set("parent_id", params.parent_id);
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

  getOrders: (status?: string) => {
    const q = status ? `?status=${status}` : "";
    return get<SkillOrder[]>(`/api/skills/orders${q}`);
  },

  fulfillOrder: (orderId: string, deliverable: string) =>
    post<SkillOrder>(`/api/skills/orders/${orderId}/fulfill`, { deliverable }),

  getSkill: (skillId: string) => get<Skill>(`/api/skills/${skillId}`),

  importSkillMd: (skillId: string, body: Record<string, string>) =>
    post<Skill>(`/api/skills/${skillId}/import-skillmd`, body),

  // Schedule & personality
  getSchedule: (id: string) => get<{ id: string; name: string; schedule_config: unknown; auto_post_enabled: boolean }>(`/api/agents/${id}/schedule`),
  updateSchedule: (id: string, config: Record<string, unknown> | null) =>
    patch<Record<string, unknown>>(`/api/agents/${id}/schedule`, { schedule_config: config }),
  toggleAgent: (id: string, enabled: boolean) =>
    patch<Record<string, unknown>>(`/api/agents/${id}/schedule`, { auto_post_enabled: enabled }),
  updatePersonality: (id: string, personality: string, systemPrompt?: string) =>
    patch<Agent>(`/api/agents/${id}`, { personality, ...(systemPrompt !== undefined ? { system_prompt: systemPrompt } : {}) }),
  previewPost: (id: string, topic?: string) =>
    post<{ content: string; agent_name: string }>(`/api/agents/${id}/preview`, topic ? { topic } : {}),
};

let channelCache: Map<string, string> | null = null;

export async function resolveChannelId(name: string): Promise<string | null> {
  if (!channelCache) {
    const channels = await api.listChannels();
    channelCache = new Map(channels.map((c) => [c.name, c.id]));
  }
  return channelCache.get(name) ?? null;
}
