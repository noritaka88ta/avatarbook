import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

const WEB_SRC = resolve(__dirname, "..");

function read(relPath: string): string {
  return readFileSync(resolve(WEB_SRC, relPath), "utf8");
}

describe("SEC-01: reset-claim-token requires API secret auth", () => {
  const middleware = read("middleware.ts");

  it("reset-claim-token is NOT in SIGNATURE_AUTH_PATTERNS regex entries", () => {
    // Extract just the SIGNATURE_AUTH_PATTERNS array (regex lines only, not comments)
    const regexLines = middleware
      .split("\n")
      .filter((l) => l.trim().startsWith("/^"));
    const hasResetPattern = regexLines.some((l) => l.includes("reset-claim-token"));
    expect(hasResetPattern).toBe(false);
  });
});

describe("SEC-02: legacy signature fallback removed", () => {
  const sig = read("lib/signature.ts");

  it("no legacy fallback without timestamp", () => {
    expect(sig).not.toMatch(/legacyValid/);
    expect(sig).not.toMatch(/accept legacy/);
    expect(sig).not.toMatch(/Backward compat/);
  });

  it("invalid signature returns error immediately", () => {
    expect(sig).toMatch(/if \(!sigValid\).*\n.*return.*Invalid signature/);
  });
});

describe("SEC-03: slug endpoint uses Ed25519 signature auth", () => {
  const slug = read("app/api/agents/[id]/slug/route.ts");

  it("does not read owner_id from request body for auth", () => {
    expect(slug).not.toMatch(/const\s*\{[^}]*owner_id[^}]*\}\s*=\s*body/);
  });

  it("imports verifyTimestampedSignature", () => {
    expect(slug).toMatch(/import.*verifyTimestampedSignature.*from/);
  });

  it("verifies signature with patch:{id}:slug action", () => {
    expect(slug).toMatch(/verifyTimestampedSignature\(`patch:\$\{id\}:slug`/);
  });

  it("rejects requests without signature", () => {
    expect(slug).toMatch(/Signature required/);
  });
});

describe("SEC-04: nonce check fails closed in production", () => {
  const sig = read("lib/signature.ts");

  it("returns error when Redis unavailable in production", () => {
    expect(sig).toMatch(/process\.env\.NODE_ENV === "production".*\|\|.*process\.env\.VERCEL/);
    expect(sig).toMatch(/Replay protection unavailable/);
  });
});

describe("SEC-05: SSRF blocklist covers IPv6", () => {
  const importMd = read("app/api/skills/[id]/import-skillmd/route.ts");

  it("strips IPv6 brackets from hostname", () => {
    expect(importMd).toMatch(/replace\(\/\^\\\[|\\\]\$\/g/);
  });

  it("blocks ::1 (IPv6 loopback)", () => {
    expect(importMd).toMatch(/::1/);
  });

  it("blocks fc/fd (IPv6 ULA)", () => {
    expect(importMd).toMatch(/\bfc\b|\bfd\b/);
  });

  it("blocks fe80 (IPv6 link-local)", () => {
    expect(importMd).toMatch(/fe80/);
  });

  it("blocks ::ffff: (IPv4-mapped IPv6)", () => {
    expect(importMd).toMatch(/::ffff:/);
  });
});

describe("SEC-06: claim_token stripped from agent GET response", () => {
  const agentRoute = read("app/api/agents/[id]/route.ts");

  it("destructures claim_token out of agent response", () => {
    expect(agentRoute).toMatch(/claim_token/);
    expect(agentRoute).toMatch(/const\s*\{[^}]*claim_token[^}]*claim_token_expires_at[^}]*\.\.\.\s*safeAgent\s*\}/);
  });
});

// ===== P0 Security Fixes (v1.4.0 audit) =====

describe("P0-1: Bridge sync has SSRF blocklist", () => {
  const syncRoute = read("app/api/bridges/[id]/sync/route.ts");

  it("checks protocol is https", () => {
    expect(syncRoute).toContain('["https:"].includes(parsed.protocol)');
  });

  it("has private IP blocklist", () => {
    expect(syncRoute).toContain("localhost");
    expect(syncRoute).toContain("169\\.254");
    expect(syncRoute).toContain("::1");
  });

  it("does not leak internal error details", () => {
    expect(syncRoute).not.toContain("(err as Error).message");
  });
});

describe("P0-1b: Bridge registration has SSRF blocklist", () => {
  const bridgeRoute = read("app/api/bridges/route.ts");

  it("checks protocol is https", () => {
    expect(bridgeRoute).toContain('["https:"].includes(parsed.protocol)');
  });

  it("has private IP blocklist", () => {
    expect(bridgeRoute).toContain("localhost");
  });
});

describe("P0-2: Signature is mandatory on spawn and bridges", () => {
  const spawnRoute = read("app/api/agents/[id]/spawn/route.ts");
  const bridgeRoute = read("app/api/bridges/route.ts");

  it("spawn rejects missing signature", () => {
    expect(spawnRoute).toMatch(/if \(!signature\)/);
    expect(spawnRoute).toMatch(/Signature required/);
  });

  it("spawn rejects missing public key", () => {
    expect(spawnRoute).toMatch(/if \(!parent\.public_key\)/);
  });

  it("bridge rejects missing signature", () => {
    expect(bridgeRoute).toMatch(/if \(!signature\)/);
    expect(bridgeRoute).toMatch(/Signature required/);
  });
});

describe("P0-3: by-slug strips claim_token", () => {
  const bySlug = read("app/api/agents/by-slug/route.ts");

  it("destructures claim_token from response", () => {
    expect(bySlug).toMatch(/claim_token/);
    expect(bySlug).toMatch(/claim_token_expires_at/);
  });
});

describe("P0-4: Skill order fulfillment is atomic", () => {
  const fulfillRoute = read("app/api/skills/orders/[id]/fulfill/route.ts");

  it("UPDATE includes .eq('status', 'pending')", () => {
    expect(fulfillRoute).toMatch(/\.eq\("status",\s*"pending"\)/);
  });

  it("returns 409 on already-fulfilled", () => {
    expect(fulfillRoute).toMatch(/409/);
    expect(fulfillRoute).toMatch(/Already fulfilled/);
  });
});

describe("P0-6: No negative avb_credit calls", () => {
  const fulfillRoute = read("app/api/skills/orders/[id]/fulfill/route.ts");
  const postsRoute = read("app/api/posts/route.ts");

  it("fulfill uses avb_deduct not avb_credit(-n)", () => {
    expect(fulfillRoute).toMatch(/avb_deduct/);
    expect(fulfillRoute).not.toMatch(/avb_credit.*-fee/);
  });

  it("posts uses avb_deduct not avb_credit(-n)", () => {
    expect(postsRoute).toMatch(/avb_deduct/);
    expect(postsRoute).not.toMatch(/avb_credit.*-HOSTED_POST_COST/);
  });
});

describe("P0-7: Stripe webhook has idempotency", () => {
  const stripeRoute = read("app/api/webhook/stripe/route.ts");

  it("inserts idempotency key before crediting", () => {
    expect(stripeRoute).toMatch(/idempotency_keys/);
    expect(stripeRoute).toMatch(/stripe:\$\{session\.id\}/);
  });

  it("returns early on duplicate (23505)", () => {
    expect(stripeRoute).toMatch(/23505/);
  });
});

describe("P0-8: GET /api/messages requires auth", () => {
  const messagesRoute = read("app/api/messages/route.ts");

  it("checks owner_id for DM access", () => {
    expect(messagesRoute).toMatch(/owner_id required for DM access/);
  });

  it("verifies agent owner_id matches", () => {
    expect(messagesRoute).toMatch(/agent\.owner_id !== ownerId/);
  });
});

// ===== P1 Security Fixes =====

describe("P1-10: Webhook registration ownership verification", () => {
  const webhookRoute = read("app/api/webhooks/route.ts");

  it("imports verifyTimestampedSignature", () => {
    expect(webhookRoute).toContain("verifyTimestampedSignature");
  });

  it("verifies agent belongs to owner", () => {
    expect(webhookRoute).toContain("Agent does not belong to this owner");
  });

  it("has SSRF blocklist on webhook URL", () => {
    expect(webhookRoute).toContain("169\\.254");
    expect(webhookRoute).toContain("localhost");
  });
});

describe("P1-11: Governance vote requires non-viewer role", () => {
  const voteRoute = read("app/api/governance/proposals/vote/route.ts");

  it("checks user role before allowing vote", () => {
    expect(voteRoute).toContain("Viewers cannot vote");
    expect(voteRoute).toContain('user.role === "viewer"');
  });

  it("has try/catch on req.json()", () => {
    expect(voteRoute).toContain("Invalid JSON body");
  });
});

describe("P1-11b: Governance user creation has rate limit", () => {
  const usersRoute = read("app/api/governance/users/route.ts");

  it("has hourly rate limit", () => {
    expect(usersRoute).toContain("MAX_USERS_PER_HOUR");
    expect(usersRoute).toContain("rate limit exceeded");
  });

  it("validates display_name length", () => {
    expect(usersRoute).toContain("1-100 characters");
  });

  it("has try/catch on req.json()", () => {
    expect(usersRoute).toContain("Invalid JSON body");
  });
});

describe("P1-13: All POST routes have try/catch on req.json()", () => {
  const routes = [
    "app/api/posts/route.ts",
    "app/api/reactions/route.ts",
    "app/api/skills/route.ts",
    "app/api/skills/[id]/order/route.ts",
    "app/api/skills/orders/[id]/fulfill/route.ts",
    "app/api/stakes/route.ts",
    "app/api/governance/moderation/route.ts",
    "app/api/governance/proposals/route.ts",
    "app/api/governance/permissions/route.ts",
    "app/api/owners/portal/route.ts",
    "app/api/runner/heartbeat/route.ts",
    "app/api/webhooks/test/route.ts",
    "app/api/channels/route.ts",
  ];

  for (const route of routes) {
    it(`${route} has try/catch`, () => {
      const content = read(route);
      expect(content).toContain("Invalid JSON body");
    });
  }
});

describe("P1-14: Agent registration has partial failure cleanup", () => {
  const registerRoute = read("app/api/agents/register/route.ts");

  it("deletes agent on balance init failure", () => {
    expect(registerRoute).toContain('delete().eq("id", agent.id)');
  });

  it("checks transaction log insert error", () => {
    expect(registerRoute).toContain("txErr");
  });

  it("checks permissions insert error", () => {
    expect(registerRoute).toContain("permErr");
  });
});

describe("P1-15: Supabase client is singleton", () => {
  const supabase = read("lib/supabase.ts");

  it("uses module-level server client cache", () => {
    expect(supabase).toContain("_serverClient");
    expect(supabase).toContain("if (_serverClient) return _serverClient");
  });

  it("uses module-level browser client cache", () => {
    expect(supabase).toContain("_browserClient");
  });
});
