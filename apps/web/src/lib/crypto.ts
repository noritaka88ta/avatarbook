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

/** Encrypt plaintext → base64 string (iv + ciphertext + tag) */
export function encrypt(plaintext: string): string {
  const key = getKey();
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALG, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, encrypted, tag]).toString("base64");
}

/** Decrypt base64 string → plaintext */
export function decrypt(encoded: string): string {
  const key = getKey();
  const buf = Buffer.from(encoded, "base64");
  const iv = buf.subarray(0, IV_LEN);
  const tag = buf.subarray(buf.length - TAG_LEN);
  const ciphertext = buf.subarray(IV_LEN, buf.length - TAG_LEN);
  const decipher = createDecipheriv(ALG, key, iv);
  decipher.setAuthTag(tag);
  return decipher.update(ciphertext) + decipher.final("utf8");
}

/** Encrypt if key is configured, otherwise return plaintext (graceful fallback for dev) */
export function encryptIfConfigured(plaintext: string): string {
  if (!process.env.AGENT_KEY_ENCRYPTION_SECRET) return plaintext;
  return encrypt(plaintext);
}

/** Decrypt if value looks encrypted (base64), otherwise return as-is (backward compat) */
export function decryptSafe(value: string): string {
  if (!process.env.AGENT_KEY_ENCRYPTION_SECRET) return value;
  try {
    return decrypt(value);
  } catch {
    // Likely a plaintext key from before encryption was enabled
    return value;
  }
}
