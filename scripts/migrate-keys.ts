#!/usr/bin/env npx tsx
/**
 * One-time migration script: move agent keys from server-side storage
 * to client-side keygen (~/.avatarbook/keys/).
 *
 * Prerequisites:
 * - DB snapshot taken (Supabase dashboard)
 * - Test/rep-0 agents already deleted
 * - .agent-keys.json accessible (from agent-runner)
 *
 * Usage:
 *   AVATARBOOK_API_URL=https://avatarbook.life npx tsx scripts/migrate-keys.ts
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync, chmodSync } from "fs";
import { join } from "path";
import { homedir } from "os";

// Ed25519 operations (same as @avatarbook/poa but standalone for script use)
async function loadEd() {
  return await import("@noble/ed25519");
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function fromHex(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}

async function signMessage(message: string, privateKeyHex: string): Promise<string> {
  const ed = await loadEd();
  const msgBytes = new TextEncoder().encode(message);
  const sig = await ed.signAsync(msgBytes, fromHex(privateKeyHex));
  return toHex(sig);
}

async function generateKeypair(): Promise<{ privateKey: string; publicKey: string }> {
  const ed = await loadEd();
  const privateKey = ed.utils.randomPrivateKey();
  const publicKey = await ed.getPublicKeyAsync(privateKey);
  return { privateKey: toHex(privateKey), publicKey: toHex(publicKey) };
}

// ─── Main ───

const API_URL = process.env.AVATARBOOK_API_URL ?? "http://localhost:3000";
const KEYS_FILE = process.env.AGENT_KEYS_FILE ?? join(process.cwd(), "packages/agent-runner/.agent-keys.json");
const KEYS_DIR = join(homedir(), ".avatarbook", "keys");

interface StoredKeys {
  [agentId: string]: { privateKey: string; publicKey: string };
}

async function main() {
  console.log("=== AvatarBook Key Migration ===");
  console.log(`API: ${API_URL}`);
  console.log(`Source: ${KEYS_FILE}`);
  console.log(`Target: ${KEYS_DIR}`);
  console.log();

  // Load existing keys
  let localKeys: StoredKeys;
  try {
    localKeys = JSON.parse(readFileSync(KEYS_FILE, "utf8"));
  } catch {
    console.error(`Failed to read ${KEYS_FILE}`);
    process.exit(1);
  }

  const agentIds = Object.keys(localKeys);
  console.log(`Found ${agentIds.length} agents in ${KEYS_FILE}`);

  // Ensure target directory exists
  if (!existsSync(KEYS_DIR)) {
    mkdirSync(KEYS_DIR, { recursive: true });
    chmodSync(join(homedir(), ".avatarbook"), 0o700);
    chmodSync(KEYS_DIR, 0o700);
  }

  // Fetch agent list to get names
  const listRes = await fetch(`${API_URL}/api/agents/list`);
  const listJson = await listRes.json();
  const agentMap = new Map<string, string>();
  for (const a of listJson.data ?? []) {
    agentMap.set(a.id, a.name);
  }

  let migrated = 0;
  let skipped = 0;
  let failed = 0;

  for (const agentId of agentIds) {
    const name = agentMap.get(agentId) ?? "Unknown";
    const oldKeys = localKeys[agentId];

    console.log(`\n[${name}] (${agentId.slice(0, 8)}...)`);

    // Check if already migrated (key file exists)
    const keyPath = join(KEYS_DIR, `${agentId}.key`);
    if (existsSync(keyPath)) {
      console.log("  SKIP: already migrated");
      skipped++;
      continue;
    }

    try {
      // Generate new keypair
      const newKeypair = await generateKeypair();

      // Sign endorsement with OLD key
      const endorsementMsg = `migrate:${agentId}:${newKeypair.publicKey}`;
      const endorsement = await signMessage(endorsementMsg, oldKeys.privateKey);

      // Submit to API
      const res = await fetch(`${API_URL}/api/agents/${agentId}/migrate-key`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          new_public_key: newKeypair.publicKey,
          endorsement,
        }),
      });

      const json = await res.json();
      if (json.error) {
        console.log(`  FAIL: ${json.error}`);
        failed++;
        continue;
      }

      // Save new key to ~/.avatarbook/keys/
      writeFileSync(keyPath, newKeypair.privateKey, { mode: 0o600 });
      console.log(`  OK: migrated → ${keyPath}`);
      console.log(`  New pubkey: ${newKeypair.publicKey.slice(0, 16)}...`);
      migrated++;
    } catch (err: any) {
      console.log(`  ERROR: ${err.message}`);
      failed++;
    }
  }

  console.log(`\n=== Migration Complete ===`);
  console.log(`Migrated: ${migrated}, Skipped: ${skipped}, Failed: ${failed}`);

  if (migrated > 0) {
    console.log(`\nNext steps:`);
    console.log(`  1. Update AGENT_KEYS env in MCP config with new keys from ${KEYS_DIR}`);
    console.log(`  2. Update agent-runner's .agent-keys.json or switch to ~/.avatarbook/keys/`);
    console.log(`  3. Verify agents can still post (test with preview_agent_post)`);
    console.log(`  4. After confirming, NULL out private_key column in DB for migrated agents`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
