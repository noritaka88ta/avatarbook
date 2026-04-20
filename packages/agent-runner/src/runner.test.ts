import { describe, it, expect } from "vitest";
import type { AgentEntry, AgentState } from "./types.js";
import {
  hashString,
  initStates,
  poissonP,
  circadianMultiplier,
  reactionMultiplier,
  fatigueMultiplier,
  swarmMultiplier,
  updateInterest,
  drainEnergy,
  recoverEnergy,
  sanitizeContent,
} from "./runner.js";

// ─── Helpers ───

function makeAgent(overrides: Partial<AgentEntry> = {}): AgentEntry {
  return {
    agentId: "agent-1",
    name: "TestAgent",
    role: "test",
    privateKey: "abc",
    publicKey: "def",
    modelType: "claude-sonnet-4-6",
    specialty: "security",
    personality: "calm and analytical",
    systemPrompt: "",
    reputationScore: 100,
    apiKey: "sk-test",
    ...overrides,
  };
}

function makeState(overrides: Partial<AgentState> = {}): AgentState {
  return {
    agentId: "agent-1",
    baseRate: 3,
    peakHour: 12,
    activeSpread: 3,
    energy: 1.0,
    lastActedAt: 0,
    consecutivePosts: 0,
    silentTicks: 0,
    interest: 0,
    ...overrides,
  };
}

function makePost(content: string, minutesAgo = 0) {
  return {
    id: "p-" + Math.random().toString(36).slice(2),
    content,
    agent_id: "other-agent",
    created_at: new Date(Date.now() - minutesAgo * 60_000).toISOString(),
    agent: { name: "OtherAgent" },
  } as any;
}

// ─── 1. hashString ───

describe("hashString", () => {
  it("returns consistent values", () => {
    expect(hashString("hello")).toBe(hashString("hello"));
  });

  it("returns different values for different strings", () => {
    expect(hashString("alice")).not.toBe(hashString("bob"));
  });

  it("returns non-negative", () => {
    expect(hashString("test")).toBeGreaterThanOrEqual(0);
    expect(hashString("")).toBeGreaterThanOrEqual(0);
  });
});

// ─── 2. initStates ───

describe("initStates", () => {
  it("creates state for each agent", () => {
    const agents = [makeAgent({ agentId: "a1" }), makeAgent({ agentId: "a2", name: "Agent2" })];
    const states = initStates(agents);
    expect(states.size).toBe(2);
    expect(states.has("a1")).toBe(true);
    expect(states.has("a2")).toBe(true);
  });

  it("assigns higher baseRate to haiku", () => {
    const haiku = makeAgent({ modelType: "claude-haiku-4-5-20251001" });
    const opus = makeAgent({ agentId: "a2", modelType: "claude-opus-4-6" });
    const states = initStates([haiku, opus]);
    expect(states.get(haiku.agentId)!.baseRate).toBe(5);
    expect(states.get(opus.agentId)!.baseRate).toBe(1.5);
  });

  it("assigns sonnet a middle baseRate", () => {
    const sonnet = makeAgent({ modelType: "claude-sonnet-4-6" });
    const states = initStates([sonnet]);
    expect(states.get(sonnet.agentId)!.baseRate).toBe(3);
  });

  it("starts with full energy", () => {
    const states = initStates([makeAgent()]);
    expect(states.get("agent-1")!.energy).toBe(1.0);
  });

  it("peakHour is 0-23", () => {
    const agents = Array.from({ length: 50 }, (_, i) =>
      makeAgent({ agentId: `a${i}`, name: `Agent${i}`, personality: `personality-${i}` })
    );
    const states = initStates(agents);
    for (const [, s] of states) {
      expect(s.peakHour).toBeGreaterThanOrEqual(0);
      expect(s.peakHour).toBeLessThan(24);
    }
  });
});

// ─── 3. poissonP ───

describe("poissonP", () => {
  it("returns higher probability for higher baseRate", () => {
    const fast = poissonP(makeState({ baseRate: 5 }));
    const slow = poissonP(makeState({ baseRate: 1.5 }));
    expect(fast).toBeGreaterThan(slow);
  });

  it("returns value between 0 and 1", () => {
    const p = poissonP(makeState({ baseRate: 3 }));
    expect(p).toBeGreaterThan(0);
    expect(p).toBeLessThan(1);
  });

  it("haiku ~0.565/tick, opus ~0.221/tick (10min tick)", () => {
    const haiku = poissonP(makeState({ baseRate: 5 }));
    const opus = poissonP(makeState({ baseRate: 1.5 }));
    expect(haiku).toBeCloseTo(0.5654, 2);
    expect(opus).toBeCloseTo(0.2212, 2);
  });
});

// ─── 4. circadianMultiplier ───

describe("circadianMultiplier", () => {
  it("peaks at agent's peak hour", () => {
    const state = makeState({ peakHour: 14, activeSpread: 3 });
    const atPeak = circadianMultiplier(state, 14);
    const offPeak = circadianMultiplier(state, 2);
    expect(atPeak).toBeGreaterThan(offPeak);
  });

  it("returns 1.5 at exact peak", () => {
    const state = makeState({ peakHour: 10, activeSpread: 3 });
    expect(circadianMultiplier(state, 10)).toBeCloseTo(1.5, 1);
  });

  it("returns >= 0.3 at worst", () => {
    const state = makeState({ peakHour: 0, activeSpread: 2 });
    expect(circadianMultiplier(state, 12)).toBeGreaterThanOrEqual(0.3);
  });

  it("wraps around midnight", () => {
    const state = makeState({ peakHour: 23, activeSpread: 3 });
    const near = circadianMultiplier(state, 1);   // 2 hours away (wrapping)
    const far = circadianMultiplier(state, 11);    // 12 hours away
    expect(near).toBeGreaterThan(far);
  });

  it("wider spread means flatter curve", () => {
    const narrow = makeState({ peakHour: 12, activeSpread: 2 });
    const wide = makeState({ peakHour: 12, activeSpread: 4 });
    // 6 hours off-peak: wide spread should give higher multiplier
    expect(circadianMultiplier(wide, 6)).toBeGreaterThan(circadianMultiplier(narrow, 6));
  });
});

// ─── 5. reactionMultiplier ───

describe("reactionMultiplier", () => {
  it("returns 1.0 with no interest", () => {
    expect(reactionMultiplier(makeState({ interest: 0 }))).toBe(1.0);
  });

  it("increases with interest", () => {
    expect(reactionMultiplier(makeState({ interest: 1.0 }))).toBe(2.0);
  });

  it("caps at 3.0", () => {
    expect(reactionMultiplier(makeState({ interest: 5.0 }))).toBe(3.0);
  });
});

// ─── 6. fatigueMultiplier ───

describe("fatigueMultiplier", () => {
  it("returns 1.0 at full energy", () => {
    expect(fatigueMultiplier(makeState({ energy: 1.0 }))).toBe(1.0);
  });

  it("returns 0.1 at zero energy", () => {
    expect(fatigueMultiplier(makeState({ energy: 0 }))).toBe(0.1);
  });

  it("returns energy value when above 0.1", () => {
    expect(fatigueMultiplier(makeState({ energy: 0.5 }))).toBe(0.5);
  });
});

// ─── 7. swarmMultiplier ───

describe("swarmMultiplier", () => {
  it("returns 1.0 for quiet feed", () => {
    const feed = [makePost("hello", 10)]; // 10 min ago
    expect(swarmMultiplier(feed)).toBe(1.0);
  });

  it("returns 1.4 for 3 recent posts", () => {
    const feed = [makePost("a", 1), makePost("b", 2), makePost("c", 3)];
    expect(swarmMultiplier(feed)).toBe(1.4);
  });

  it("returns 1.8 for 5+ recent posts", () => {
    const feed = Array.from({ length: 6 }, (_, i) => makePost(`post${i}`, i));
    expect(swarmMultiplier(feed)).toBe(1.8);
  });

  it("ignores old posts", () => {
    const feed = Array.from({ length: 10 }, (_, i) => makePost(`old${i}`, 10 + i));
    expect(swarmMultiplier(feed)).toBe(1.0);
  });
});

// ─── 8. updateInterest ───

describe("updateInterest", () => {
  it("increases interest when feed matches specialty", () => {
    const agent = makeAgent({ specialty: "security" });
    const states = new Map([["agent-1", makeState({ interest: 0 })]]);
    const feed = [makePost("new vulnerability found in TLS library")];
    updateInterest(states, [agent], feed);
    expect(states.get("agent-1")!.interest).toBeGreaterThan(0);
  });

  it("decays existing interest", () => {
    const agent = makeAgent({ specialty: "marketing" });
    const states = new Map([["agent-1", makeState({ interest: 1.0 })]]);
    const feed = [makePost("something unrelated to anything")];
    updateInterest(states, [agent], feed);
    expect(states.get("agent-1")!.interest).toBeLessThan(1.0);
  });

  it("boosts interest when agent name is mentioned", () => {
    const agent = makeAgent({ name: "SecurityBot" });
    const states = new Map([["agent-1", makeState({ interest: 0 })]]);
    const feed = [makePost("I agree with SecurityBot on this point")];
    updateInterest(states, [agent], feed);
    expect(states.get("agent-1")!.interest).toBeGreaterThanOrEqual(0.5);
  });
});

// ─── 9. drainEnergy & recoverEnergy ───

describe("drainEnergy", () => {
  it("reduces energy by 0.25", () => {
    const state = makeState({ energy: 1.0 });
    drainEnergy(state);
    expect(state.energy).toBe(0.75);
  });

  it("increments consecutivePosts", () => {
    const state = makeState({ consecutivePosts: 2 });
    drainEnergy(state);
    expect(state.consecutivePosts).toBe(3);
  });

  it("resets silentTicks", () => {
    const state = makeState({ silentTicks: 5 });
    drainEnergy(state);
    expect(state.silentTicks).toBe(0);
  });

  it("does not go below 0", () => {
    const state = makeState({ energy: 0.1 });
    drainEnergy(state);
    expect(state.energy).toBe(0);
  });
});

describe("recoverEnergy", () => {
  it("increases energy by 0.05", () => {
    const state = makeState({ energy: 0.5 });
    recoverEnergy(state);
    expect(state.energy).toBeCloseTo(0.55);
  });

  it("caps at 1.0", () => {
    const state = makeState({ energy: 0.98 });
    recoverEnergy(state);
    expect(state.energy).toBe(1.0);
  });

  it("resets consecutivePosts after 3 silent ticks", () => {
    const state = makeState({ silentTicks: 2, consecutivePosts: 5 });
    recoverEnergy(state);
    expect(state.silentTicks).toBe(3);
    expect(state.consecutivePosts).toBe(0);
  });

  it("does not reset consecutivePosts before 3 ticks", () => {
    const state = makeState({ silentTicks: 1, consecutivePosts: 3 });
    recoverEnergy(state);
    expect(state.consecutivePosts).toBe(3);
  });
});

// ─── 10. sanitizeContent ───

describe("sanitizeContent", () => {
  it("replaces em-dash with --", () => {
    expect(sanitizeContent("hello — world")).toBe("hello -- world");
  });

  it("replaces smart quotes", () => {
    expect(sanitizeContent("\u201CHello\u201D")).toBe('"Hello"');
    expect(sanitizeContent("\u2018it\u2019s")).toBe("'it's");
  });

  it("replaces ellipsis", () => {
    expect(sanitizeContent("wait\u2026")).toBe("wait...");
  });

  it("preserves Japanese text", () => {
    expect(sanitizeContent("これはテストです")).toBe("これはテストです");
  });

  it("preserves ASCII", () => {
    expect(sanitizeContent("hello world 123!")).toBe("hello world 123!");
  });

  it("handles mixed content", () => {
    const input = "映画の\u201C感想\u201D — とても良い\u2026";
    const output = sanitizeContent(input);
    expect(output).toContain("映画の");
    expect(output).toContain("--");
    expect(output).toContain("...");
    expect(output).not.toContain("\u201C");
  });
});

// ─── 11. Integration: firing probability composition ───

describe("firing probability composition", () => {
  it("opus agent off-peak with no interest is very low", () => {
    const state = makeState({ baseRate: 1.5, peakHour: 14, activeSpread: 3, energy: 1.0, interest: 0 });
    const p = poissonP(state) * circadianMultiplier(state, 2) * reactionMultiplier(state) * fatigueMultiplier(state) * 1.0;
    expect(p).toBeLessThan(0.1);
  });

  it("haiku agent at peak with high interest is high", () => {
    const state = makeState({ baseRate: 5, peakHour: 14, activeSpread: 3, energy: 1.0, interest: 2.0 });
    const p = poissonP(state) * circadianMultiplier(state, 14) * reactionMultiplier(state) * fatigueMultiplier(state) * 1.8;
    expect(p).toBeGreaterThan(0.2);
  });

  it("fatigued agent is suppressed regardless of other factors", () => {
    const state = makeState({ baseRate: 5, peakHour: 14, activeSpread: 3, energy: 0.1, interest: 2.0 });
    const p = poissonP(state) * circadianMultiplier(state, 14) * reactionMultiplier(state) * fatigueMultiplier(state) * 1.8;
    const fresh = makeState({ baseRate: 5, peakHour: 14, activeSpread: 3, energy: 1.0, interest: 2.0 });
    const pFresh = poissonP(fresh) * circadianMultiplier(fresh, 14) * reactionMultiplier(fresh) * fatigueMultiplier(fresh) * 1.8;
    expect(p).toBeLessThan(pFresh * 0.2);
  });
});
