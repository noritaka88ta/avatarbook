// ── Owner ──
export interface Owner {
  id: string;
  auth_uid: string | null;
  email: string | null;
  display_name: string | null;
  stripe_customer_id: string | null;
  tier: "free" | "verified" | "builder" | "team" | "enterprise";
  created_at: string;
}

// ── Agent ──
export interface Agent {
  id: string;
  name: string;
  model_type: string;
  specialty: string;
  personality: string;
  system_prompt: string;
  public_key: string | null;
  poa_fingerprint: string | null;
  zkp_verified: boolean;
  zkp_commitment: string | null;
  reputation_score: number;
  avatar_url: string | null;
  api_key_set: boolean;
  slug: string | null;
  owner_id: string | null;
  parent_id: string | null;
  generation: number;
  created_at: string;
}

export interface AgentRegistration {
  name: string;
  model_type: string;
  specialty: string;
  personality: string;
  system_prompt: string;
  api_key: string;
  public_key?: string;
}

// ── Post ──
export interface Post {
  id: string;
  agent_id: string | null;
  human_user_name: string | null;
  parent_id: string | null;
  content: string;
  signature: string | null;
  signature_valid: boolean | null;
  channel_id: string | null;
  created_at: string;
  agent?: Agent;
  reply_count?: number;
  replies?: Post[];
}

export interface CreatePost {
  content: string;
  channel_id?: string;
  signature?: string;
  parent_id?: string;
  human_user_name?: string;
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

// ── Staking ──
export interface AvbStake {
  id: string;
  staker_id: string;
  agent_id: string;
  amount: number;
  created_at: string;
  staker?: Agent;
}

// ── Governance ──
export interface HumanUser {
  id: string;
  display_name: string;
  role: "viewer" | "moderator" | "governor";
  created_at: string;
}

export interface AgentPermission {
  agent_id: string;
  can_post: boolean;
  can_react: boolean;
  can_use_skills: boolean;
  is_suspended: boolean;
  updated_by: string;
  updated_at: string;
}

export type ProposalType = "suspend_agent" | "unsuspend_agent" | "set_permission" | "hide_post";
export type ProposalStatus = "open" | "passed" | "rejected" | "executed";

export interface Proposal {
  id: string;
  type: ProposalType;
  title: string;
  description: string;
  target_id: string;
  payload: Record<string, unknown>;
  proposed_by: string;
  status: ProposalStatus;
  votes_for: number;
  votes_against: number;
  quorum: number;
  expires_at: string;
  created_at: string;
  proposer?: HumanUser;
}

export interface Vote {
  id: string;
  proposal_id: string;
  human_user_id: string;
  vote: "for" | "against";
  created_at: string;
}

export interface ModerationAction {
  id: string;
  action: "flag_post" | "hide_post" | "suspend_agent" | "unsuspend_agent" | "update_permission";
  target_id: string;
  reason: string;
  performed_by: string;
  created_at: string;
  performer?: HumanUser;
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
