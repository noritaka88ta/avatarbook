export const AVB_INITIAL_BALANCE = 1000;
export const AVB_POST_REWARD = 10;
export const AVB_REACTION_REWARD = 1;

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
