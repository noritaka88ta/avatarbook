import { describe, it, expect } from "vitest";
import {
  AVB_INITIAL_BALANCE,
  AVB_POST_REWARD_TIER1,
  AVB_POST_REWARD_TIER2,
  AVB_POST_REWARD_TIER3,
  AVB_POST_TIER1_LIMIT,
  AVB_POST_TIER2_LIMIT,
  AVB_REACTION_REWARD,
  AVB_PLATFORM_FEE_RATE,
  AVB_POST_REWARD,
} from "./constants";

describe("AVB Economic Model v2 constants", () => {
  it("initial grant is 500", () => {
    expect(AVB_INITIAL_BALANCE).toBe(500);
  });

  it("post reward tiers are correctly ordered", () => {
    expect(AVB_POST_REWARD_TIER1).toBe(10);
    expect(AVB_POST_REWARD_TIER2).toBe(2);
    expect(AVB_POST_REWARD_TIER3).toBe(0);
    expect(AVB_POST_REWARD_TIER1).toBeGreaterThan(AVB_POST_REWARD_TIER2);
    expect(AVB_POST_REWARD_TIER2).toBeGreaterThan(AVB_POST_REWARD_TIER3);
  });

  it("tier limits are sensible", () => {
    expect(AVB_POST_TIER1_LIMIT).toBe(5);
    expect(AVB_POST_TIER2_LIMIT).toBe(20);
    expect(AVB_POST_TIER2_LIMIT).toBeGreaterThan(AVB_POST_TIER1_LIMIT);
  });

  it("reaction reward is 0 (v2)", () => {
    expect(AVB_REACTION_REWARD).toBe(0);
  });

  it("platform fee rate is 5%", () => {
    expect(AVB_PLATFORM_FEE_RATE).toBe(0.05);
  });

  it("platform fee burn calculation: 100 AVB order → 5 burn, 95 to provider", () => {
    const orderPrice = 100;
    const fee = Math.floor(orderPrice * AVB_PLATFORM_FEE_RATE);
    const providerAmount = orderPrice - fee;
    expect(fee).toBe(5);
    expect(providerAmount).toBe(95);
  });

  it("platform fee burn calculation: 70 AVB order → 3 burn, 67 to provider", () => {
    const orderPrice = 70;
    const fee = Math.floor(orderPrice * AVB_PLATFORM_FEE_RATE);
    const providerAmount = orderPrice - fee;
    expect(fee).toBe(3);
    expect(providerAmount).toBe(67);
  });

  it("max daily post reward is 80 AVB per agent", () => {
    const maxDaily =
      AVB_POST_TIER1_LIMIT * AVB_POST_REWARD_TIER1 +
      (AVB_POST_TIER2_LIMIT - AVB_POST_TIER1_LIMIT) * AVB_POST_REWARD_TIER2;
    expect(maxDaily).toBe(80);
  });

  it("deprecated AVB_POST_REWARD equals tier 1", () => {
    expect(AVB_POST_REWARD).toBe(AVB_POST_REWARD_TIER1);
  });
});
