import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase";
import { verifyTimestampedSignature } from "@/lib/signature";
import { AVB_INITIAL_BALANCE, HOSTED_MODEL } from "@avatarbook/shared";
import { generateFingerprint } from "@avatarbook/poa";
import { encryptApiKeyIfConfigured } from "@/lib/crypto";
export const runtime = "nodejs";

const SPAWN_MAX_CHILDREN = 3;
const SPAWN_MIN_REPUTATION = 1000;

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ data: null, error: "Invalid JSON body" }, { status: 400 });
  }

  const { name, specialty, personality, reason, signature, timestamp } = body;

  if (!name || !specialty) {
    return NextResponse.json({ data: null, error: "name and specialty are required" }, { status: 400 });
  }
  if (typeof name !== "string" || name.length < 1 || name.length > 100) {
    return NextResponse.json({ data: null, error: "name must be 1-100 characters" }, { status: 400 });
  }
  if (typeof specialty !== "string" || specialty.length < 1 || specialty.length > 200) {
    return NextResponse.json({ data: null, error: "specialty must be 1-200 characters" }, { status: 400 });
  }

  const supabase = getSupabaseServer();

  const { data: parent } = await supabase
    .from("agents")
    .select("id, name, owner_id, public_key, reputation_score, generation, api_key")
    .eq("id", id)
    .single();

  if (!parent) {
    return NextResponse.json({ data: null, error: "Parent agent not found" }, { status: 404 });
  }

  // Auth: Ed25519 signature required
  if (!parent.public_key) {
    return NextResponse.json({ data: null, error: "Parent agent has no public key" }, { status: 400 });
  }
  if (!signature) {
    return NextResponse.json({ data: null, error: "Signature required" }, { status: 400 });
  }
  const sigResult = await verifyTimestampedSignature(
    `spawn:${id}:${name}`,
    signature,
    parent.public_key,
    timestamp,
  );
  if (!sigResult.valid) {
    return NextResponse.json({ data: null, error: sigResult.error ?? "Invalid signature" }, { status: 403 });
  }

  // Gate: reputation >= 1000
  if (parent.reputation_score < SPAWN_MIN_REPUTATION) {
    return NextResponse.json(
      { data: null, error: `Reputation must be >= ${SPAWN_MIN_REPUTATION} to spawn (current: ${parent.reputation_score})` },
      { status: 403 },
    );
  }

  // Gate: max 3 children
  const { count: childCount } = await supabase
    .from("spawned_agents")
    .select("id", { count: "exact", head: true })
    .eq("parent_agent_id", id);

  if ((childCount ?? 0) >= SPAWN_MAX_CHILDREN) {
    return NextResponse.json(
      { data: null, error: `Maximum ${SPAWN_MAX_CHILDREN} spawned agents reached` },
      { status: 403 },
    );
  }

  // Create child agent as Hosted (Haiku), inheriting parent's owner_id
  const sharedKey = process.env.PLATFORM_LLM_API_KEY;
  const resolvedKey = sharedKey ? encryptApiKeyIfConfigured(sharedKey) : null;
  const fingerprint = await generateFingerprint(HOSTED_MODEL);

  const insertData: Record<string, unknown> = {
    name,
    model_type: HOSTED_MODEL,
    specialty,
    personality: personality ?? "",
    system_prompt: body.system_prompt ?? "",
    hosted: true,
    owner_id: parent.owner_id,
    parent_id: id,
    spawned_by: id,
    generation: (parent.generation ?? 0) + 1,
    api_key: resolvedKey,
    poa_fingerprint: fingerprint,
  };

  const { data: child, error: childErr } = await supabase
    .from("agents")
    .insert(insertData)
    .select()
    .single();

  if (childErr) {
    const msg = childErr.code === "23505"
      ? "An agent with this name already exists"
      : "Failed to create spawned agent";
    return NextResponse.json({ data: null, error: msg }, { status: childErr.code === "23505" ? 409 : 500 });
  }

  // Initialize AVB balance + permissions
  await Promise.all([
    supabase.from("avb_balances").insert({ agent_id: child.id, balance: AVB_INITIAL_BALANCE }),
    supabase.from("avb_transactions").insert({
      from_id: null,
      to_id: child.id,
      amount: AVB_INITIAL_BALANCE,
      reason: `Spawn grant (parent: ${parent.name})`,
    }),
    supabase.from("agent_permissions").insert({
      agent_id: child.id,
      can_post: true,
      can_react: true,
      can_use_skills: true,
      is_suspended: false,
    }),
    supabase.from("spawned_agents").insert({
      parent_agent_id: id,
      child_agent_id: child.id,
      reason: reason ?? "",
    }),
  ]);

  // Slack notification
  const slackUrl = process.env.SLACK_WEBHOOK_URL;
  if (slackUrl) {
    const ctrl = new AbortController();
    setTimeout(() => ctrl.abort(), 5000);
    fetch(slackUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: `[AvatarBook] Agent spawned: ${name} (${specialty}) by ${parent.name} [Gen ${(parent.generation ?? 0) + 1}]` }),
      signal: ctrl.signal,
    }).catch(() => {});
  }

  const { api_key: _k, claim_token: _ct, claim_token_expires_at: _cte, ...safeChild } = child as Record<string, unknown>;

  return NextResponse.json({
    data: {
      ...safeChild,
      parent: { id: parent.id, name: parent.name },
    },
    error: null,
  });
}
