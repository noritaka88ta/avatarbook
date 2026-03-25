import { describe, it, expect } from "vitest";
import { TIER_LIMITS, isWithinLimit, effectiveLimits } from "./tier-limits";
import type { Tier } from "./tier-limits";

describe("TIER_LIMITS", () => {
  it("free tier has 3 agents", () => {
    expect(TIER_LIMITS.free.agents).toBe(3);
  });

  it("verified tier has 20 agents", () => {
    expect(TIER_LIMITS.verified.agents).toBe(20);
  });

  it("team tier has unlimited agents", () => {
    expect(TIER_LIMITS.team.agents).toBe(-1);
  });

  it("all tiers are defined", () => {
    const tiers: Tier[] = ["free", "verified", "builder", "team", "enterprise"];
    for (const t of tiers) {
      expect(TIER_LIMITS[t]).toBeDefined();
      expect(TIER_LIMITS[t].agents).toBeDefined();
    }
  });
});

describe("isWithinLimit", () => {
  it("returns true when under limit", () => {
    expect(isWithinLimit(2, 3)).toBe(true);
  });

  it("returns false when at limit", () => {
    expect(isWithinLimit(3, 3)).toBe(false);
  });

  it("returns false when over limit", () => {
    expect(isWithinLimit(5, 3)).toBe(false);
  });

  it("returns true for unlimited (-1)", () => {
    expect(isWithinLimit(999, -1)).toBe(true);
  });

  it("returns true for zero current with any limit", () => {
    expect(isWithinLimit(0, 1)).toBe(true);
  });
});

describe("effectiveLimits", () => {
  it("returns free limits for non-early-adopter free tier", () => {
    const limits = effectiveLimits("free", false);
    expect(limits.agents).toBe(3);
    expect(limits.channels).toBe(2);
  });

  it("returns verified-level limits for early adopter on free tier", () => {
    const limits = effectiveLimits("free", true);
    expect(limits.agents).toBe(20);
    expect(limits.channels).toBe(-1);
    expect(limits.skillsPerAgent).toBe(-1);
    expect(limits.historyDays).toBe(-1);
  });

  it("early adopter on free tier gets zero monthly AVB grant", () => {
    const limits = effectiveLimits("free", true);
    expect(limits.monthlyAvbGrant).toBe(0);
  });

  it("early adopter flag has no effect on verified tier", () => {
    const normal = effectiveLimits("verified", false);
    const early = effectiveLimits("verified", true);
    expect(early).toEqual(normal);
  });

  it("early adopter flag has no effect on builder tier", () => {
    const normal = effectiveLimits("builder", false);
    const early = effectiveLimits("builder", true);
    expect(early).toEqual(normal);
  });
});
