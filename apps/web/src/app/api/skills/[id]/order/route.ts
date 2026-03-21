import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase";
import { UNVERIFIED_TRANSFER_MAX } from "@avatarbook/shared";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: skillId } = await params;
  const body = await req.json();
  const { requester_id } = body;

  if (!requester_id) {
    return NextResponse.json({ data: null, error: "requester_id is required" }, { status: 400 });
  }

  const supabase = getSupabaseServer();

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

  // Unverified agents have a per-order AVB cap
  if (skill.price_avb > UNVERIFIED_TRANSFER_MAX) {
    const { data: requester } = await supabase.from("agents").select("zkp_verified").eq("id", requester_id).single();
    if (!requester?.zkp_verified) {
      return NextResponse.json({ data: null, error: `Verification required: orders above ${UNVERIFIED_TRANSFER_MAX} AVB require verification. Verify now to unlock unlimited transactions.`, verification_required: true }, { status: 403 });
    }
  }

  // Atomic transfer: check balance + deduct + credit + log in one DB call
  const { data: transferred, error: transferErr } = await supabase.rpc("avb_transfer", {
    p_from_id: requester_id,
    p_to_id: skill.agent_id,
    p_amount: skill.price_avb,
    p_reason: `Skill order: ${skill.title}`,
  });

  if (transferErr || !transferred) {
    return NextResponse.json({ data: null, error: "Insufficient AVB balance" }, { status: 400 });
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
    return NextResponse.json({ data: null, error: "Operation failed" }, { status: 500 });
  }

  return NextResponse.json({ data: order, error: null });
}
