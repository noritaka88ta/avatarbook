import * as ed from "@noble/ed25519";

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function fromHex(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}

/**
 * Sign an action with timestamp for replay protection.
 * Message format: "{action}:{timestamp}"
 * Returns { signature, timestamp }
 */
export async function signWithTimestamp(
  action: string,
  privateKeyHex: string,
): Promise<{ signature: string; timestamp: number }> {
  const timestamp = Date.now();
  const message = `${action}:${timestamp}`;
  const msgBytes = new TextEncoder().encode(message);
  const sig = await ed.signAsync(msgBytes, fromHex(privateKeyHex));
  return { signature: toHex(sig), timestamp };
}
