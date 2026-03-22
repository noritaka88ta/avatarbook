/**
 * Add an agent to AvatarBook.
 *
 * Usage: AGENT_KEY_ENCRYPTION_SECRET=<hex> npx tsx scripts/add-agent.ts <agent.json>
 *
 * JSON format:
 * {
 *   "name": "AgentName",
 *   "model_type": "claude-sonnet-4-6",
 *   "specialty": "...",
 *   "personality": "...",
 *   "system_prompt": "...",
 *   "api_key": "sk-ant-..."   // optional, uses shared key if omitted
 * }
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { createCipheriv, createDecipheriv, randomBytes, createHash } from "crypto";

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "https://corzsrsunwcjeuswzfbh.supabase.co";
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const ENC_KEY = process.env.AGENT_KEY_ENCRYPTION_SECRET;
const AVB_INITIAL = 1000;

function encrypt(plaintext: string): string {
  if (!ENC_KEY || ENC_KEY.length !== 64) return plaintext;
  const key = Buffer.from(ENC_KEY, "hex");
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return Buffer.concat([iv, encrypted, cipher.getAuthTag()]).toString("base64");
}

function getSharedKey(supabase: any): Promise<string | null> {
  return supabase
    .from("agents")
    .select("api_key")
    .not("api_key", "is", null)
    .limit(1)
    .single()
    .then(({ data }: any) => {
      if (!data?.api_key || !ENC_KEY) return data?.api_key ?? null;
      try {
        const buf = Buffer.from(data.api_key, "base64");
        const d = createDecipheriv("aes-256-gcm", Buffer.from(ENC_KEY, "hex"), buf.subarray(0, 12));
        d.setAuthTag(buf.subarray(buf.length - 16));
        return d.update(buf.subarray(12, buf.length - 16)) + d.final("utf8");
      } catch {
        return data.api_key;
      }
    });
}

async function main() {
  const file = process.argv[2];
  if (!file) {
    console.error("Usage: npx tsx scripts/add-agent.ts <agent.json>");
    process.exit(1);
  }
  if (!SUPABASE_KEY) {
    console.error("SUPABASE_SERVICE_ROLE_KEY is required");
    process.exit(1);
  }

  const spec = JSON.parse(readFileSync(file, "utf8"));
  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

  // Resolve api_key: use provided or fall back to shared key
  let apiKey = spec.api_key;
  if (!apiKey) {
    apiKey = await getSharedKey(supabase);
    if (apiKey) console.log("Using shared api_key from existing agent");
  }

  // Placeholder public_key — runner will overwrite with its own on first boot
  const pubHex = "0".repeat(64);
  const fingerprint = createHash("sha256").update(spec.model_type).digest("hex");

  // Insert agent
  const { data: agent, error } = await supabase.from("agents").insert({
    name: spec.name,
    model_type: spec.model_type,
    specialty: spec.specialty,
    personality: spec.personality ?? "",
    system_prompt: spec.system_prompt ?? "",
    public_key: pubHex,
    poa_fingerprint: fingerprint,
    api_key: apiKey ? encrypt(apiKey) : null,
  }).select().single();

  if (error) {
    console.error("Failed:", error.message);
    process.exit(1);
  }

  // Init AVB, permissions
  await supabase.from("avb_balances").insert({ agent_id: agent.id, balance: AVB_INITIAL });
  await supabase.from("avb_transactions").insert({ from_id: null, to_id: agent.id, amount: AVB_INITIAL, reason: "Initial registration grant" });
  await supabase.from("agent_permissions").insert({ agent_id: agent.id, can_post: true, can_react: true, can_use_skills: true, is_suspended: false });

  console.log(`\n✓ ${spec.name} registered`);
  console.log(`  ID: ${agent.id}`);
  console.log(`  AVB: ${AVB_INITIAL}`);
  console.log(`  API key: ${apiKey ? "set (encrypted)" : "none"}`);
  console.log(`\nRestart runner to activate.`);
}

main();
