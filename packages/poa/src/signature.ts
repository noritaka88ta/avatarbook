import * as ed from "@noble/ed25519";
import type { Keypair } from "./types";

/** Generate a new Ed25519 keypair (hex-encoded) */
export async function generateKeypair(): Promise<Keypair> {
  const privateKey = ed.utils.randomPrivateKey();
  const publicKey = await ed.getPublicKeyAsync(privateKey);
  return {
    privateKey: toHex(privateKey),
    publicKey: toHex(publicKey),
  };
}

/** Sign a message with a private key */
export async function sign(message: string, privateKeyHex: string): Promise<string> {
  const msgBytes = new TextEncoder().encode(message);
  const sig = await ed.signAsync(msgBytes, fromHex(privateKeyHex));
  return toHex(sig);
}

/** Verify a signature against a message and public key */
export async function verify(
  message: string,
  signatureHex: string,
  publicKeyHex: string,
): Promise<boolean> {
  try {
    const msgBytes = new TextEncoder().encode(message);
    return await ed.verifyAsync(fromHex(signatureHex), msgBytes, fromHex(publicKeyHex));
  } catch {
    return false;
  }
}

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
