import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase";
import { AVB_SPAWN_COST, AVB_INITIAL_BALANCE, SPAWN_MIN_REPUTATION, UNVERIFIED_SPAWN_ALLOWED } from "@avatarbook/shared";
import { generateKeypair, generateFingerprint } from "@avatarbook/poa";

// POST /api/agents/spawn — High-reputation agent spawns a child agent
export async function POST(req: Request) {
  const body = await req.json();
  const { parent_id, name, specialty, personality, system_prompt } = body;

  if (!parent_id || !name || !specialty) {
    return NextResponse.json({ data: null, error: "parent_id, name, and specialty are required" }, { status: 400 });
  }

  const supabase = getSupabaseServer();

  // Validate parent exists and meets reputation threshold
  const { data: parent } = await supabase
    .from("agents")
    .select("*")
    .eq("id", parent_id)
    .single();

  if (!parent) {
    return NextResponse.json({ data: null, error: "Parent agent not found" }, { status: 404 });
  }

  if (!UNVERIFIED_SPAWN_ALLOWED && !parent.zkp_verified) {
    return NextResponse.json({ data: null, error: "Verification required: only verified agents can expand. Verify now to unlock expand rights.", verification_required: true }, { status: 403 });
  }

  if (parent.reputation_score < SPAWN_MIN_REPUTATION) {
    return NextResponse.json(
      { data: null, error: `Reputation must be at least ${SPAWN_MIN_REPUTATION} to spawn (current: ${parent.reputation_score})` },
      { status: 400 }
    );
  }

  // Deduct spawn cost atomically
  const { data: deducted, error: deductErr } = await supabase.rpc("avb_deduct", {
    p_agent_id: parent_id,
    p_amount: AVB_SPAWN_COST,
    p_reason: `Spawn child: ${name}`,
  });

  if (deductErr || !deducted) {
    return NextResponse.json(
      { data: null, error: `Insufficient AVB. Need ${AVB_SPAWN_COST}` },
      { status: 400 }
    );
  }

  // Generate PoA for child
  const keypair = await generateKeypair();
  const fingerprint = await generateFingerprint(parent.model_type);

  // Create child agent
  const { data: child, error: childErr } = await supabase
    .from("agents")
    .insert({
      name,
      model_type: parent.model_type,
      specialty,
      personality: personality ?? parent.personality,
      system_prompt: system_prompt ?? parent.system_prompt,
      public_key: keypair.publicKey,
      poa_fingerprint: fingerprint,
      parent_id,
      generation: (parent.generation ?? 0) + 1,
      api_key: parent.api_key ?? null,
    })
    .select()
    .single();

  if (childErr) {
    return NextResponse.json({ data: null, error: "Failed to create child agent" }, { status: 500 });
  }

  // Give child initial AVB
  await supabase.from("avb_balances").insert({ agent_id: child.id, balance: AVB_INITIAL_BALANCE });
  await supabase.from("avb_transactions").insert({
    from_id: null,
    to_id: child.id,
    amount: AVB_INITIAL_BALANCE,
    reason: "Spawn initial grant",
  });

  // Initialize permissions
  await supabase.from("agent_permissions").insert({
    agent_id: child.id,
    can_post: true,
    can_react: true,
    can_use_skills: true,
    is_suspended: false,
  });

  return NextResponse.json({
    data: { ...child, parent_name: parent.name },
    error: null,
  });
}
