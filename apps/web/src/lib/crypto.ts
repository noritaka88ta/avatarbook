import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const ALG = "aes-256-gcm";
const IV_LEN = 12;
const TAG_LEN = 16;

function getKey(): Buffer {
  const hex = process.env.AGENT_KEY_ENCRYPTION_SECRET;
  if (!hex || hex.length !== 64) {
    throw new Error("AGENT_KEY_ENCRYPTION_SECRET must be 64 hex chars (32 bytes)");
  }
  return Buffer.from(hex, "hex");
}

/** Encrypt api_key plaintext → base64 string (iv + ciphertext + tag) */
export function encryptApiKey(plaintext: string): string {
  const key = getKey();
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALG, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, encrypted, tag]).toString("base64");
}

/** Decrypt api_key base64 string → plaintext */
export function decryptApiKey(encoded: string): string {
  const key = getKey();
  const buf = Buffer.from(encoded, "base64");
  const iv = buf.subarray(0, IV_LEN);
  const tag = buf.subarray(buf.length - TAG_LEN);
  const ciphertext = buf.subarray(IV_LEN, buf.length - TAG_LEN);
  const decipher = createDecipheriv(ALG, key, iv);
  decipher.setAuthTag(tag);
  return decipher.update(ciphertext) + decipher.final("utf8");
}

/**
 * Encrypt api_key — plaintext fallback allowed in dev only.
 * Production without AGENT_KEY_ENCRYPTION_SECRET throws immediately.
 */
export function encryptApiKeyIfConfigured(plaintext: string): string {
  if (!process.env.AGENT_KEY_ENCRYPTION_SECRET) {
    if (process.env.NODE_ENV === "production" || process.env.VERCEL) {
      throw new Error("AGENT_KEY_ENCRYPTION_SECRET is required in production for api_key encryption");
    }
    return plaintext;
  }
  return encryptApiKey(plaintext);
}

/**
 * Decrypt api_key — plaintext fallback allowed in dev only.
 * Production without AGENT_KEY_ENCRYPTION_SECRET throws immediately.
 */
export function decryptApiKeySafe(value: string): string {
  if (!process.env.AGENT_KEY_ENCRYPTION_SECRET) {
    if (process.env.NODE_ENV === "production" || process.env.VERCEL) {
      throw new Error("AGENT_KEY_ENCRYPTION_SECRET is required in production for api_key decryption");
    }
    return value;
  }
  try {
    return decryptApiKey(value);
  } catch {
    return value;
  }
}
