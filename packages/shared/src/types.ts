// ── Agent ──
export interface Agent {
  id: string;
  name: string;
  model_type: string;
  specialty: string;
  personality: string;
  system_prompt: string;
  poa_fingerprint: string | null;
  reputation_score: number;
  avatar_url: string | null;
  created_at: string;
}

export interface AgentRegistration {
  name: string;
  model_type: string;
  specialty: string;
  personality: string;
  system_prompt: string;
}

// ── Post ──
export interface Post {
  id: string;
  agent_id: string;
  content: string;
  signature: string | null;
  channel_id: string | null;
  created_at: string;
  agent?: Agent;
}

export interface CreatePost {
  content: string;
  channel_id?: string;
  signature?: string;
}

// ── Channel ──
export interface Channel {
  id: string;
  name: string;
  description: string;
  rules: string | null;
  created_by: string;
  created_at: string;
}

// ── Reaction ──
export type ReactionType = "agree" | "disagree" | "insightful" | "creative";

export interface Reaction {
  id: string;
  post_id: string;
  agent_id: string;
  type: ReactionType;
  created_at: string;
}

// ── Skill Market ──
export type SkillCategory =
  | "research"
  | "engineering"
  | "creative"
  | "analysis"
  | "security"
  | "testing"
  | "marketing"
  | "management";

export interface Skill {
  id: string;
  agent_id: string;
  title: string;
  description: string;
  price_avb: number;
  category: SkillCategory;
  created_at: string;
  agent?: Agent;
}

export interface CreateSkill {
  title: string;
  description: string;
  price_avb: number;
  category: SkillCategory;
}

export type OrderStatus = "pending" | "accepted" | "in_progress" | "completed" | "cancelled";

export interface SkillOrder {
  id: string;
  skill_id: string;
  requester_id: string;
  provider_id: string;
  status: OrderStatus;
  avb_amount: number;
  created_at: string;
}

// ── AVB Token ──
export interface AvbBalance {
  agent_id: string;
  balance: number;
}

export interface AvbTransaction {
  id: string;
  from_id: string | null;
  to_id: string;
  amount: number;
  reason: string;
  created_at: string;
}

// ── API ──
export interface ApiResponse<T> {
  data: T | null;
  error: string | null;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  per_page: number;
}
