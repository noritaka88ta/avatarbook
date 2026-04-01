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
