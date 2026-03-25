import { describe, it, expect } from "vitest";
import { generateKeypair, sign, verify } from "./signature";

describe("generateKeypair", () => {
  it("returns 64-char hex strings", async () => {
    const kp = await generateKeypair();
    expect(kp.privateKey).toMatch(/^[0-9a-f]{64}$/);
    expect(kp.publicKey).toMatch(/^[0-9a-f]{64}$/);
  });

  it("generates unique keypairs", async () => {
    const a = await generateKeypair();
    const b = await generateKeypair();
    expect(a.privateKey).not.toBe(b.privateKey);
    expect(a.publicKey).not.toBe(b.publicKey);
  });
});

describe("sign + verify", () => {
  it("valid signature verifies", async () => {
    const kp = await generateKeypair();
    const sig = await sign("hello", kp.privateKey);
    expect(await verify("hello", sig, kp.publicKey)).toBe(true);
  });

  it("wrong message fails", async () => {
    const kp = await generateKeypair();
    const sig = await sign("hello", kp.privateKey);
    expect(await verify("world", sig, kp.publicKey)).toBe(false);
  });

  it("wrong public key fails", async () => {
    const kp1 = await generateKeypair();
    const kp2 = await generateKeypair();
    const sig = await sign("hello", kp1.privateKey);
    expect(await verify("hello", sig, kp2.publicKey)).toBe(false);
  });

  it("tampered signature fails", async () => {
    const kp = await generateKeypair();
    const sig = await sign("hello", kp.privateKey);
    const tampered = "ff" + sig.slice(2);
    expect(await verify("hello", tampered, kp.publicKey)).toBe(false);
  });

  it("empty message works", async () => {
    const kp = await generateKeypair();
    const sig = await sign("", kp.privateKey);
    expect(await verify("", sig, kp.publicKey)).toBe(true);
  });

  it("unicode message works", async () => {
    const kp = await generateKeypair();
    const msg = "こんにちは世界 🌍";
    const sig = await sign(msg, kp.privateKey);
    expect(await verify(msg, sig, kp.publicKey)).toBe(true);
  });

  it("signature is 128-char hex (64 bytes)", async () => {
    const kp = await generateKeypair();
    const sig = await sign("test", kp.privateKey);
    expect(sig).toMatch(/^[0-9a-f]{128}$/);
  });

  it("timestamped message format works", async () => {
    const kp = await generateKeypair();
    const ts = Date.now();
    const action = `post:content-hash:${ts}`;
    const sig = await sign(action, kp.privateKey);
    expect(await verify(action, sig, kp.publicKey)).toBe(true);
  });
});

describe("verify edge cases", () => {
  it("invalid hex returns false", async () => {
    const kp = await generateKeypair();
    expect(await verify("hello", "not-hex", kp.publicKey)).toBe(false);
  });

  it("short signature returns false", async () => {
    const kp = await generateKeypair();
    expect(await verify("hello", "abcd", kp.publicKey)).toBe(false);
  });
});
