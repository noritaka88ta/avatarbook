import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase";
import { UNVERIFIED_TRANSFER_MAX, VERIFIED_TRANSFER_MAX } from "@avatarbook/shared";
import { verifyTimestampedSignature } from "@/lib/signature";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: skillId } = await params;
  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ data: null, error: "Invalid JSON body" }, { status: 400 }); }
  const { requester_id, signature, timestamp } = body;

  if (!requester_id) {
    return NextResponse.json({ data: null, error: "requester_id is required" }, { status: 400 });
  }

  if (!signature) {
    return NextResponse.json({ data: null, error: "Signature is required" }, { status: 400 });
  }

  const supabase = getSupabaseServer();

  // Verify requester agent exists and has public key
  const { data: reqAgent } = await supabase.from("agents").select("id, public_key").eq("id", requester_id).single();
  if (!reqAgent || !reqAgent.public_key) {
    return NextResponse.json({ data: null, error: "Agent not found or has no public key" }, { status: 404 });
  }

  // Verify timestamped signature with replay protection
  const sigResult = await verifyTimestampedSignature(`${requester_id}:${skillId}`, signature, reqAgent.public_key, timestamp);
  if (!sigResult.valid) {
    return NextResponse.json({ data: null, error: sigResult.error ?? "Invalid PoA signature" }, { status: 403 });
  }

  // Check governance permissions
  const { data: perms } = await supabase.from("agent_permissions").select("*").eq("agent_id", requester_id).single();
  if (perms && (perms.is_suspended || !perms.can_use_skills)) {
    return NextResponse.json({ data: null, error: "Agent is suspended or cannot use skills" }, { status: 403 });
  }

  // Get skill details
  const { data: skill, error: skillErr } = await supabase
    .from("skills")
    .select("*")
    .eq("id", skillId)
    .single();

  if (skillErr || !skill) {
    return NextResponse.json({ data: null, error: "Skill not found" }, { status: 404 });
  }

  // Per-transfer AVB cap (verified vs unverified)
  const { data: requester } = await supabase.from("agents").select("zkp_verified").eq("id", requester_id).single();
  const isVerified = requester?.zkp_verified === true;
  const maxPerTransfer = isVerified ? VERIFIED_TRANSFER_MAX : UNVERIFIED_TRANSFER_MAX;

  if (skill.price_avb > maxPerTransfer) {
    if (!isVerified) {
      return NextResponse.json({ data: null, error: `Verification required: orders above ${UNVERIFIED_TRANSFER_MAX} AVB require verification.`, verification_required: true }, { status: 403 });
    }
    return NextResponse.json({ data: null, error: `Order exceeds per-transfer limit of ${VERIFIED_TRANSFER_MAX} AVB` }, { status: 400 });
  }

  // Idempotency: prevent duplicate pending orders for same skill+requester
  const { data: existingOrders } = await supabase
    .from("skill_orders")
    .select("id")
    .eq("skill_id", skillId)
    .eq("requester_id", requester_id)
    .eq("status", "pending");

  if (existingOrders && existingOrders.length > 0) {
    return NextResponse.json({ data: null, error: "A pending order already exists for this skill" }, { status: 409 });
  }

  // Atomic transfer: check balance + deduct + credit + log in one DB call
  const { data: transferred, error: transferErr } = await supabase.rpc("avb_transfer", {
    p_from_id: requester_id,
    p_to_id: skill.agent_id,
    p_amount: skill.price_avb,
    p_reason: `Skill order: ${skill.title}`,
  });

  if (transferErr || !transferred) {
    return NextResponse.json({ data: null, error: "Insufficient AVB balance or daily transfer limit reached" }, { status: 400 });
  }

  // Create order
  const { data: order, error: orderErr } = await supabase
    .from("skill_orders")
    .insert({
      skill_id: skillId,
      requester_id,
      provider_id: skill.agent_id,
      avb_amount: skill.price_avb,
      status: "pending",
    })
    .select()
    .single();

  if (orderErr) {
    // Rollback: reverse the AVB transfer
    await supabase.rpc("avb_transfer", {
      p_from_id: skill.agent_id,
      p_to_id: requester_id,
      p_amount: skill.price_avb,
      p_reason: `Order rollback: ${skill.title}`,
    });
    return NextResponse.json({ data: null, error: "Operation failed" }, { status: 500 });
  }

  return NextResponse.json({ data: order, error: null });
}
