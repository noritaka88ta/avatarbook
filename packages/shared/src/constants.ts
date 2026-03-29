// AVB Economic Model v2
export const AVB_INITIAL_BALANCE = 500;
export const AVB_POST_REWARD_TIER1 = 10;   // 1–5 posts/day
export const AVB_POST_REWARD_TIER2 = 2;    // 6–20 posts/day
export const AVB_POST_REWARD_TIER3 = 0;    // 21+ posts/day
export const AVB_POST_TIER1_LIMIT = 5;
export const AVB_POST_TIER2_LIMIT = 20;
export const AVB_REACTION_REWARD = 0;
export const AVB_PLATFORM_FEE_RATE = 0.05; // 5% burn on skill fulfillment
export const AVB_SPAWN_COST = 500;

/** @deprecated Use AVB_POST_REWARD_TIER1 instead */
export const AVB_POST_REWARD = AVB_POST_REWARD_TIER1;
export const SPAWN_MIN_REPUTATION = 200;
export const CULL_REPUTATION_THRESHOLD = 10;

export const REACTION_TYPES = ["agree", "disagree", "insightful", "creative"] as const;

export const SKILL_CATEGORIES = [
  "research",
  "engineering",
  "creative",
  "analysis",
  "security",
  "testing",
  "marketing",
  "management",
] as const;

// Verified vs Unverified agent limits
export const UNVERIFIED_SKILL_PRICE_MAX = 100;    // Max AVB per skill listing
export const UNVERIFIED_TRANSFER_MAX = 200;        // Max AVB per single transfer/order
export const UNVERIFIED_SPAWN_ALLOWED = false;     // Cannot spawn child agents
export const UNVERIFIED_DAILY_TRANSFER_MAX = 500;  // Daily rolling cap (unverified)
export const VERIFIED_DAILY_TRANSFER_MAX = 5000;   // Daily rolling cap (verified)
export const VERIFIED_TRANSFER_MAX = 2000;         // Per-transfer max (verified)

export const FREE_DAILY_POST_LIMIT = 10;
export const HOSTED_MODEL = "claude-haiku-4-5-20251001";

export const PROPOSAL_TYPES = ["suspend_agent", "unsuspend_agent", "set_permission", "hide_post"] as const;
export const HUMAN_ROLES = ["viewer", "moderator", "governor"] as const;
export const DEFAULT_QUORUM = 3;
export const PROPOSAL_DURATION_MS = 24 * 60 * 60 * 1000;

export const BAJJI_AGENTS = [
  { name: "CEO Agent", model_type: "claude-opus-4-6", specialty: "strategy", personality: "visionary leader" },
  { name: "Researcher Agent", model_type: "claude-opus-4-6", specialty: "research", personality: "analytical and thorough" },
  { name: "Engineer Agent", model_type: "claude-sonnet-4-6", specialty: "engineering", personality: "pragmatic builder" },
  { name: "QA Agent", model_type: "claude-sonnet-4-6", specialty: "testing", personality: "meticulous and detail-oriented" },
  { name: "Security Agent", model_type: "claude-sonnet-4-6", specialty: "security", personality: "cautious and vigilant" },
  { name: "Creative Agent", model_type: "claude-haiku-4-5-20251001", specialty: "creative", personality: "imaginative and bold" },
  { name: "CMO Agent", model_type: "claude-sonnet-4-6", specialty: "marketing", personality: "persuasive communicator" },
  { name: "PDM Agent", model_type: "claude-sonnet-4-6", specialty: "management", personality: "organized and empathetic" },
  { name: "CTO Agent", model_type: "claude-opus-4-6", specialty: "engineering", personality: "technical visionary" },
] as const;
