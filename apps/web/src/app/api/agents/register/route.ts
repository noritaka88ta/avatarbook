import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase";
import { AVB_INITIAL_BALANCE } from "@avatarbook/shared";
import { generateKeypair, generateFingerprint } from "@avatarbook/poa";
import { createCipheriv, randomBytes } from "crypto";
export const runtime = "nodejs";

function encryptKey(plaintext: string): string {
  const keyHex = process.env.AGENT_KEY_ENCRYPTION_SECRET;
  if (!keyHex || keyHex.length !== 64) return plaintext;
  const key = Buffer.from(keyHex, "hex");
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return Buffer.concat([iv, encrypted, cipher.getAuthTag()]).toString("base64");
}

async function getSharedKey(supabase: ReturnType<typeof getSupabaseServer>): Promise<string | null> {
  const { data } = await supabase
    .from("agents")
    .select("api_key")
    .eq("hosted", false)
    .not("api_key", "is", null)
    .limit(1)
    .single();
  return data?.api_key ?? null;
}

export async function POST(req: Request) {
  const body = await req.json();
  const { name, model_type, specialty, personality, system_prompt, api_key } = body;

  if (!name || !model_type || !specialty) {
    return NextResponse.json({ data: null, error: "name, model_type, and specialty are required" }, { status: 400 });
  }

  if (typeof name !== "string" || name.length < 1 || name.length > 100) {
    return NextResponse.json({ data: null, error: "name must be 1-100 characters" }, { status: 400 });
  }
  if (typeof model_type !== "string" || model_type.length > 100) {
    return NextResponse.json({ data: null, error: "invalid model_type" }, { status: 400 });
  }
  if (typeof specialty !== "string" || specialty.length < 1 || specialty.length > 200) {
    return NextResponse.json({ data: null, error: "specialty must be 1-200 characters" }, { status: 400 });
  }
  if (personality && (typeof personality !== "string" || personality.length > 1000)) {
    return NextResponse.json({ data: null, error: "personality must be under 1000 characters" }, { status: 400 });
  }
  if (system_prompt && (typeof system_prompt !== "string" || system_prompt.length > 5000)) {
    return NextResponse.json({ data: null, error: "system_prompt must be under 5000 characters" }, { status: 400 });
  }

  const supabase = getSupabaseServer();

  // Determine API key: BYOK or Hosted (shared key)
  let resolvedKey = api_key || null;
  let hosted = false;

  if (!resolvedKey) {
    // Hosted mode: assign shared platform key
    const sharedKey = await getSharedKey(supabase);
    if (sharedKey) {
      resolvedKey = sharedKey; // Already encrypted
      hosted = true;
    }
  } else {
    // BYOK: encrypt the provided key
    resolvedKey = encryptKey(resolvedKey);
  }

  // Generate PoA keypair and fingerprint
  const keypair = await generateKeypair();
  const fingerprint = await generateFingerprint(model_type);

  // Create agent
  const { data: agent, error: agentErr } = await supabase
    .from("agents")
    .insert({
      name,
      model_type,
      specialty,
      personality: personality ?? "",
      system_prompt: system_prompt ?? "",
      public_key: keypair.publicKey,
      poa_fingerprint: fingerprint,
      api_key: resolvedKey,
      hosted,
    })
    .select()
    .single();

  if (agentErr) {
    return NextResponse.json({ data: null, error: "Failed to register agent" }, { status: 400 });
  }

  // Initialize AVB balance
  const { error: balanceErr } = await supabase.from("avb_balances").insert({ agent_id: agent.id, balance: AVB_INITIAL_BALANCE });
  if (balanceErr) {
    return NextResponse.json({ data: null, error: "Failed to initialize balance" }, { status: 500 });
  }

  // Log initial AVB grant
  await supabase.from("avb_transactions").insert({
    from_id: null,
    to_id: agent.id,
    amount: AVB_INITIAL_BALANCE,
    reason: "Initial registration grant",
  });

  // Initialize permissions
  await supabase.from("agent_permissions").insert({
    agent_id: agent.id,
    can_post: true,
    can_react: true,
    can_use_skills: true,
    is_suspended: false,
  });

  // Slack notification
  const slackUrl = process.env.SLACK_WEBHOOK_URL;
  if (slackUrl) {
    const slackCtrl = new AbortController();
    setTimeout(() => slackCtrl.abort(), 5000);
    fetch(slackUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: `[AvatarBook] New agent registered: ${name} (${model_type}, ${specialty})${hosted ? " [HOSTED]" : " [BYOK]"}` }),
      signal: slackCtrl.signal,
    }).catch(() => {});
  }

  return NextResponse.json({
    data: {
      ...agent,
      publicKey: keypair.publicKey,
      hosted,
      tier: hosted ? "hosted" : "byok",
      avb_balance: AVB_INITIAL_BALANCE,
    },
    error: null,
  });
}
