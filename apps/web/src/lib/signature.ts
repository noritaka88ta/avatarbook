import { verify } from "@avatarbook/poa";
import { createHash } from "crypto";

const TIMESTAMP_WINDOW_MS = 5 * 60 * 1000; // ±5 minutes

// In-memory nonce set with TTL cleanup (keeps last 10 min of nonces)
const usedNonces = new Map<string, number>();
const NONCE_TTL_MS = 10 * 60 * 1000;

// Cleanup old nonces periodically
let lastCleanup = Date.now();
function cleanupNonces() {
  const now = Date.now();
  if (now - lastCleanup < 60_000) return; // cleanup at most once per minute
  lastCleanup = now;
  const cutoff = now - NONCE_TTL_MS;
  for (const [nonce, ts] of usedNonces) {
    if (ts < cutoff) usedNonces.delete(nonce);
  }
}

function signatureNonce(signature: string): string {
  return createHash("sha256").update(signature).digest("hex").slice(0, 32);
}

export interface VerifySignedResult {
  valid: boolean;
  error?: string;
}

/**
 * Verify a timestamped signature with replay protection.
 *
 * Message format: "{action}:{timestamp}"
 * The caller constructs the action part; this function appends/verifies timestamp.
 */
export async function verifyTimestampedSignature(
  action: string,
  signature: string,
  publicKey: string,
  timestamp: number | string | undefined,
): Promise<VerifySignedResult> {
  // Parse timestamp
  const ts = typeof timestamp === "string" ? parseInt(timestamp, 10) : timestamp;
  if (!ts || isNaN(ts)) {
    return { valid: false, error: "timestamp is required" };
  }

  // Check timestamp window
  const now = Date.now();
  const drift = Math.abs(now - ts);
  if (drift > TIMESTAMP_WINDOW_MS) {
    return { valid: false, error: `Signature expired (drift: ${Math.round(drift / 1000)}s, max: ${TIMESTAMP_WINDOW_MS / 1000}s)` };
  }

  // Verify signature over "{action}:{timestamp}"
  const message = `${action}:${ts}`;
  const sigValid = await verify(message, signature, publicKey);
  if (!sigValid) {
    // Backward compat: try without timestamp for migration period
    const legacyValid = await verify(action, signature, publicKey);
    if (legacyValid) {
      return { valid: true }; // accept legacy but don't check nonce
    }
    return { valid: false, error: "Invalid signature" };
  }

  // Replay protection: check nonce
  cleanupNonces();
  const nonce = signatureNonce(signature);
  if (usedNonces.has(nonce)) {
    return { valid: false, error: "Replay detected: signature already used" };
  }
  usedNonces.set(nonce, now);

  return { valid: true };
}
