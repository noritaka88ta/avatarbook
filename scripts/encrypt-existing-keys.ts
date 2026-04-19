/**
 * One-time script: encrypt existing plaintext api_keys in DB.
 * Run on the server where AGENT_KEY_ENCRYPTION_SECRET is set.
 *
 * Usage: AGENT_KEY_ENCRYPTION_SECRET=<hex> SUPABASE_URL=<url> SUPABASE_SERVICE_ROLE_KEY=<key> npx tsx scripts/encrypt-existing-keys.ts
 */
import { createClient } from "@supabase/supabase-js";
import { createCipheriv, randomBytes } from "crypto";

const ALG = "aes-256-gcm";
const IV_LEN = 12;

function encrypt(plaintext: string, keyHex: string): string {
  const key = Buffer.from(keyHex, "hex");
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALG, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, encrypted, tag]).toString("base64");
}

function looksEncrypted(val: string): boolean {
  // Base64 encoded AES-GCM output is always longer and looks like base64
  // Anthropic keys start with "sk-ant-" — if it doesn't, assume already encrypted
  if (val.startsWith("sk-ant-") || val.startsWith("sk-")) return false;
  try {
    const buf = Buffer.from(val, "base64");
    return buf.length > IV_LEN + 16; // iv + tag minimum
  } catch {
    return false;
  }
}

async function main() {
  const encKey = process.env.AGENT_KEY_ENCRYPTION_SECRET;
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!encKey || encKey.length !== 64) {
    console.error("AGENT_KEY_ENCRYPTION_SECRET must be 64 hex chars");
    process.exit(1);
  }
  if (!url || !serviceKey) {
    console.error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required");
    process.exit(1);
  }

  const supabase = createClient(url, serviceKey);

  const { data: agents, error } = await supabase
    .from("agents")
    .select("id, name, api_key")
    .not("api_key", "is", null);

  if (error) {
    console.error("Failed to fetch agents:", error.message);
    process.exit(1);
  }

  let updated = 0;
  for (const agent of agents ?? []) {
    if (!agent.api_key || looksEncrypted(agent.api_key)) {
      console.log(`  Skip ${agent.name}: already encrypted or empty`);
      continue;
    }

    const encrypted = encrypt(agent.api_key, encKey);
    const { error: updateErr } = await supabase
      .from("agents")
      .update({ api_key: encrypted })
      .eq("id", agent.id);

    if (updateErr) {
      console.error(`  Failed to update ${agent.name}: ${updateErr.message}`);
    } else {
      console.log(`  Encrypted ${agent.name}`);
      updated++;
    }
  }

  console.log(`\nDone. ${updated} keys encrypted.`);
}

main();
