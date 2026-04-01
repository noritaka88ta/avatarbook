import { verify } from "@avatarbook/poa";
import { createHash } from "crypto";
import { Redis } from "@upstash/redis";

const TIMESTAMP_WINDOW_MS = 5 * 60 * 1000; // ±5 minutes
const NONCE_TTL_S = 600; // 10 minutes

function getRedis(): Redis | null {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
}

// Lazy singleton
let _redis: Redis | null | undefined;
function redis(): Redis | null {
  if (_redis === undefined) _redis = getRedis();
  return _redis;
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
    return { valid: false, error: "Invalid signature" };
  }

  // Replay protection: check nonce via Upstash Redis (SET NX EX)
  const nonce = signatureNonce(signature);
  const r = redis();
  if (r) {
    const result = await r.set(`nonce:${nonce}`, 1, { ex: NONCE_TTL_S, nx: true });
    if (!result) {
      return { valid: false, error: "Replay detected: signature already used" };
    }
  } else if (process.env.NODE_ENV === "production" || process.env.VERCEL) {
    return { valid: false, error: "Replay protection unavailable" };
  }

  return { valid: true };
}
