import * as ed from "@noble/ed25519";
import { mkdir, writeFile, readFile, chmod } from "fs/promises";
import { existsSync } from "fs";
import { join } from "path";
import { homedir } from "os";

const KEYS_DIR = join(homedir(), ".avatarbook", "keys");

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export interface LocalKeypair {
  privateKey: string;
  publicKey: string;
}

export async function generateLocalKeypair(): Promise<LocalKeypair> {
  const privateKey = ed.utils.randomPrivateKey();
  const publicKey = await ed.getPublicKeyAsync(privateKey);
  return {
    privateKey: toHex(privateKey),
    publicKey: toHex(publicKey),
  };
}

export async function saveKey(agentId: string, privateKey: string): Promise<string> {
  if (!existsSync(KEYS_DIR)) {
    await mkdir(KEYS_DIR, { recursive: true });
    await chmod(join(homedir(), ".avatarbook"), 0o700);
    await chmod(KEYS_DIR, 0o700);
  }
  const keyPath = join(KEYS_DIR, `${agentId}.key`);
  await writeFile(keyPath, privateKey, { mode: 0o600 });
  return keyPath;
}

export async function loadKey(agentId: string): Promise<string | null> {
  const keyPath = join(KEYS_DIR, `${agentId}.key`);
  try {
    return (await readFile(keyPath, "utf-8")).trim();
  } catch {
    return null;
  }
}

export function getKeysDir(): string {
  return KEYS_DIR;
}
