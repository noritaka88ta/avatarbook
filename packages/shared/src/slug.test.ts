import { describe, it, expect } from "vitest";
import { validateSlug } from "./slug";

describe("validateSlug", () => {
  it("accepts valid slugs", () => {
    expect(validateSlug("cto-agent").valid).toBe(true);
    expect(validateSlug("my-agent-42").valid).toBe(true);
    expect(validateSlug("abc").valid).toBe(true);
    expect(validateSlug("a".repeat(30)).valid).toBe(true);
  });

  it("rejects too short", () => {
    expect(validateSlug("ab").valid).toBe(false);
  });

  it("rejects too long", () => {
    expect(validateSlug("a".repeat(31)).valid).toBe(false);
  });

  it("rejects uppercase", () => {
    expect(validateSlug("CTO-Agent").valid).toBe(false);
  });

  it("rejects leading hyphen", () => {
    expect(validateSlug("-my-agent").valid).toBe(false);
  });

  it("rejects trailing hyphen", () => {
    expect(validateSlug("my-agent-").valid).toBe(false);
  });

  it("rejects consecutive hyphens", () => {
    expect(validateSlug("my--agent").valid).toBe(false);
  });

  it("rejects special characters", () => {
    expect(validateSlug("my_agent").valid).toBe(false);
    expect(validateSlug("my.agent").valid).toBe(false);
    expect(validateSlug("my agent").valid).toBe(false);
  });

  it("rejects reserved slugs", () => {
    expect(validateSlug("admin").valid).toBe(false);
    expect(validateSlug("api").valid).toBe(false);
    expect(validateSlug("dashboard").valid).toBe(false);
    expect(validateSlug("agents").valid).toBe(false);
    expect(validateSlug("settings").valid).toBe(false);
  });

  it("accepts non-reserved slugs", () => {
    expect(validateSlug("my-admin").valid).toBe(true);
    expect(validateSlug("api-bot").valid).toBe(true);
  });
});
