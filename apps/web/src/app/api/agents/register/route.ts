import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase";
import { AVB_INITIAL_BALANCE, TIER_LIMITS, isWithinLimit, HOSTED_MODEL } from "@avatarbook/shared";
import type { Tier } from "@avatarbook/shared";
import { generateFingerprint } from "@avatarbook/poa";
import { randomUUID } from "crypto";
import { encryptApiKeyIfConfigured } from "@/lib/crypto";
export const runtime = "nodejs";

function getSharedKey(): string | null {
  // Platform shared key from env (plaintext — will be encrypted before storage)
  const key = process.env.PLATFORM_LLM_API_KEY;
  if (key) return key;
  return null;
}

export async function POST(req: Request) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ data: null, error: "Invalid JSON body" }, { status: 400 });
  }
  const { name, model_type, specialty, personality, system_prompt, api_key, owner_id } = body;

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

  // Resolve or auto-create owner
  let resolvedOwnerId: string | null = owner_id || null;
  if (resolvedOwnerId) {
    const { data: owner } = await supabase.from("owners").select("id, tier").eq("id", resolvedOwnerId).single();
    if (owner) {
      const tier = (owner.tier || "free") as Tier;
      const limit = TIER_LIMITS[tier].agents;
      const { count } = await supabase.from("agents").select("id", { count: "exact", head: true }).eq("owner_id", resolvedOwnerId);
      if (!isWithinLimit(count ?? 0, limit)) {
        return NextResponse.json(
          { data: null, error: `Agent limit reached (${limit} for ${tier} tier). Upgrade to create more agents.` },
          { status: 403 },
        );
      }
    } else {
      resolvedOwnerId = null;
    }
  }
  if (!resolvedOwnerId) {
    const { data: newOwner } = await supabase.from("owners").insert({ tier: "free" }).select("id").single();
    if (newOwner) resolvedOwnerId = newOwner.id;
  }

  // Determine API key: BYOK or Hosted (shared key)
  let resolvedKey = api_key || null;
  let hosted = false;

  if (!resolvedKey) {
    // Hosted mode: force Haiku, encrypt and assign platform shared key
    const sharedKey = getSharedKey();
    if (sharedKey) {
      resolvedKey = encryptApiKeyIfConfigured(sharedKey);
      hosted = true;
    }
  } else {
    // BYOK: encrypt the provided key
    resolvedKey = encryptApiKeyIfConfigured(resolvedKey);
  }

  // Hosted agents are forced to Haiku
  const resolvedModel = hosted ? HOSTED_MODEL : model_type;

  // PoA keypair: client-side keygen only. Web UI registrations get public_key = null.
  const clientPubKey = typeof body.public_key === "string" && /^[0-9a-f]{64}$/i.test(body.public_key) ? body.public_key : null;
  const fingerprint = await generateFingerprint(model_type);

  // Generate claim token for registrations without client public key (Web UI, etc.)
  const claimToken = clientPubKey ? null : randomUUID();
  const claimTokenExpiresAt = claimToken ? new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() : null;

  // Create agent
  const insertData: Record<string, unknown> = {
    name,
    model_type: resolvedModel,
    specialty,
    personality: personality ?? "",
    system_prompt: system_prompt ?? "",
    public_key: clientPubKey,
    poa_fingerprint: fingerprint,
    api_key: resolvedKey,
    hosted,
    owner_id: resolvedOwnerId,
    ...(claimToken ? { claim_token: claimToken, claim_token_expires_at: claimTokenExpiresAt } : {}),
  };

  const { data: agent, error: agentErr } = await supabase
    .from("agents")
    .insert(insertData)
    .select()
    .single();

  if (agentErr) {
    const msg = agentErr.code === "23505" ? "An agent with this name already exists. Choose a different name." : "Failed to register agent";
    return NextResponse.json({ data: null, error: msg }, { status: agentErr.code === "23505" ? 409 : 400 });
  }

  // Initialize AVB balance
  const { error: balanceErr } = await supabase.from("avb_balances").insert({ agent_id: agent.id, balance: AVB_INITIAL_BALANCE });
  if (balanceErr) {
    // Cleanup: delete orphaned agent row
    await (supabase.from("agents") as any).delete().eq("id", agent.id);
    return NextResponse.json({ data: null, error: "Failed to initialize balance" }, { status: 500 });
  }

  // Log initial AVB grant
  const { error: txErr } = await supabase.from("avb_transactions").insert({
    from_id: null,
    to_id: agent.id,
    amount: AVB_INITIAL_BALANCE,
    reason: "Initial registration grant",
  });
  if (txErr) {
    await (supabase.from("avb_balances") as any).delete().eq("agent_id", agent.id);
    await (supabase.from("agents") as any).delete().eq("id", agent.id);
    return NextResponse.json({ data: null, error: "Failed to initialize agent" }, { status: 500 });
  }

  // Initialize permissions
  const { error: permErr } = await supabase.from("agent_permissions").insert({
    agent_id: agent.id,
    can_post: true,
    can_react: true,
    can_use_skills: true,
    is_suspended: false,
  });
  if (permErr) {
    await (supabase.from("avb_balances") as any).delete().eq("agent_id", agent.id);
    await (supabase.from("agents") as any).delete().eq("id", agent.id);
    return NextResponse.json({ data: null, error: "Failed to initialize permissions" }, { status: 500 });
  }

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

  const { api_key: _k, ...safeAgent } = agent;
  const responseData: Record<string, unknown> = {
    ...safeAgent,
    owner_id: resolvedOwnerId,
    publicKey: clientPubKey,
    hosted,
    tier: hosted ? "hosted" : "byok",
    avb_balance: AVB_INITIAL_BALANCE,
    keygen: clientPubKey ? "client" : "pending_claim",
  };
  // Include claim_token for Web registrations (allows MCP claim later)
  if (claimToken) {
    responseData.claim_token = claimToken;
  }
  return NextResponse.json({ data: responseData, error: null });
}
