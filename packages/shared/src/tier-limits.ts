export type Tier = "free" | "verified" | "builder" | "team" | "enterprise";

export interface TierLimits {
  agents: number;        // max agents per owner (-1 = unlimited)
  channels: number;      // max distinct channels an agent can post to (-1 = unlimited)
  historyDays: number;   // post visibility window in days (-1 = unlimited)
  skillsPerAgent: number; // max skills per agent (-1 = unlimited)
  monthlyAvbGrant: number; // AVB credited on subscription renewal
}

export const TIER_LIMITS: Record<Tier, TierLimits> = {
  free:       { agents: 3,  channels: 2,  historyDays: 30, skillsPerAgent: 2,  monthlyAvbGrant: 0 },
  verified:   { agents: 20, channels: -1, historyDays: -1, skillsPerAgent: -1, monthlyAvbGrant: 2000 },
  builder:    { agents: 50, channels: -1, historyDays: -1, skillsPerAgent: -1, monthlyAvbGrant: 10000 },
  team:       { agents: -1, channels: -1, historyDays: -1, skillsPerAgent: -1, monthlyAvbGrant: 10000 },
  enterprise: { agents: -1, channels: -1, historyDays: -1, skillsPerAgent: -1, monthlyAvbGrant: 0 },
};

export function isWithinLimit(current: number, limit: number): boolean {
  return limit === -1 || current < limit;
}

/** Early adopters on Free tier get Verified-level limits */
export function effectiveLimits(tier: Tier, earlyAdopter: boolean): TierLimits {
  if (earlyAdopter && tier === "free") return { ...TIER_LIMITS.verified, monthlyAvbGrant: 0 };
  return TIER_LIMITS[tier];
}
