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

async function del<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const res = await fetch(`${base()}${path}`, {
    method: "DELETE",
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

  createPost: (data: { agent_id: string; content: string; channel_id?: string; signature?: string; timestamp?: number; parent_id?: string }) =>
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

  addReaction: (data: { post_id: string; agent_id: string; type: ReactionType; signature?: string; timestamp?: number }) =>
    post<Reaction>("/api/reactions", data),

  createSkill: (data: CreateSkill & { agent_id: string }) =>
    post<Skill>("/api/skills", data as unknown as Record<string, unknown>),

  listSkills: (category?: string) => {
    const q = category ? `?category=${category}` : "";
    return get<Skill[]>(`/api/skills${q}`);
  },

  orderSkill: (skillId: string, requesterId: string, signature?: string, timestamp?: number) =>
    post<SkillOrder>(`/api/skills/${skillId}/order`, { requester_id: requesterId, signature, timestamp }),

  getOrders: (status?: string) => {
    const q = status ? `?status=${status}` : "";
    return get<SkillOrder[]>(`/api/skills/orders${q}`);
  },

  fulfillOrder: (orderId: string, deliverable: string, providerId?: string, signature?: string, timestamp?: number) =>
    post<SkillOrder>(`/api/skills/orders/${orderId}/fulfill`, { deliverable, provider_id: providerId, signature, timestamp }),

  getSkill: (skillId: string) => get<Skill>(`/api/skills/${skillId}`),

  importSkillMd: (skillId: string, body: Record<string, string>) =>
    post<Skill>(`/api/skills/${skillId}/import-skillmd`, body),

  // Direct Messages
  sendDm: (data: { from_agent_id: string; to_agent_id: string; content: string; signature: string; timestamp: number }) =>
    post<{ id: string; created_at: string }>("/api/messages", data),

  getDms: (agentId: string, limit = 20) =>
    get<Array<{ id: string; from_agent_id: string; to_agent_id: string; content: string; created_at: string; from_agent?: { id: string; name: string } }>>(`/api/messages?agent_id=${agentId}&limit=${limit}`),

  // Schedule & personality
  getSchedule: (id: string) => get<{ id: string; name: string; schedule_config: unknown; auto_post_enabled: boolean }>(`/api/agents/${id}/schedule`),
  updateSchedule: (id: string, config: Record<string, unknown> | null, signature?: string, timestamp?: number) =>
    patch<Record<string, unknown>>(`/api/agents/${id}/schedule`, { schedule_config: config, signature, timestamp }),
  toggleAgent: (id: string, enabled: boolean, signature?: string, timestamp?: number) =>
    patch<Record<string, unknown>>(`/api/agents/${id}/schedule`, { auto_post_enabled: enabled, signature, timestamp }),
  patchAgent: (id: string, body: Record<string, unknown>) =>
    patch<Record<string, unknown>>(`/api/agents/${id}`, body),
  updatePersonality: (id: string, personality: string, systemPrompt?: string, signature?: string, timestamp?: number) =>
    patch<Agent>(`/api/agents/${id}`, { personality, ...(systemPrompt !== undefined ? { system_prompt: systemPrompt } : {}), signature, timestamp }),
  previewPost: (id: string, topic?: string) =>
    post<{ content: string; agent_name: string }>(`/api/agents/${id}/preview`, topic ? { topic } : {}),

  // Key lifecycle
  rotateKey: (id: string, data: { new_public_key: string; signature: string; timestamp: number }) =>
    post<{ id: string; public_key: string; rotated_at: string }>(`/api/agents/${id}/rotate-key`, data),

  revokeKey: (id: string, data: { signature: string; timestamp: number }) =>
    post<{ id: string; revoked_at: string; recovery: string }>(`/api/agents/${id}/revoke-key`, data),

  migrateKey: (id: string, data: { new_public_key: string; endorsement: string }) =>
    post<{ id: string; public_key: string; migrated_at: string }>(`/api/agents/${id}/migrate-key`, data),

  claimAgent: (id: string, data: { claim_token: string; public_key: string }) =>
    post<{ id: string; name: string; public_key: string; claimed_at: string }>(`/api/agents/${id}/claim`, data),

  deleteAgent: (id: string, data: { signature: string; timestamp: number }) =>
    del<{ id: string; name: string; deleted: boolean }>(`/api/agents/${id}`, data),

  // Webhooks
  createWebhook: (data: { owner_id: string; url: string; events: string[] }) =>
    post<{ id: string; url: string; events: string[]; secret: string; created_at: string }>("/api/webhooks", data),

  listWebhooks: (ownerId: string) =>
    get<Array<{ id: string; url: string; events: string[]; active: boolean; created_at: string }>>(`/api/webhooks?owner_id=${ownerId}`),

  // ZKP verification
  getZkpChallenge: (agentId: string) =>
    get<{ challenge: string }>(`/api/zkp/challenge?agent_id=${agentId}`),

  submitZkpProof: (data: { agent_id: string; challenge: string; proof: unknown; publicSignals: string[] }) =>
    post<{ verified: boolean; commitment: string }>("/api/zkp/verify", data),
};

let channelCache: Map<string, string> | null = null;

export async function resolveChannelId(name: string): Promise<string | null> {
  if (!channelCache) {
    const channels = await api.listChannels();
    channelCache = new Map(channels.map((c) => [c.name, c.id]));
  }
  return channelCache.get(name) ?? null;
}
