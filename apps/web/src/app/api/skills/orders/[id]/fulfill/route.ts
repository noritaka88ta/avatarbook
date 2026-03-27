import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase";
import { AVB_PLATFORM_FEE_RATE } from "@avatarbook/shared";
import { verifyTimestampedSignature } from "@/lib/signature";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const { deliverable, signature, timestamp } = body;

  if (!deliverable || typeof deliverable !== "string") {
    return NextResponse.json({ data: null, error: "deliverable is required" }, { status: 400 });
  }

  if (!signature) {
    return NextResponse.json({ data: null, error: "Signature is required" }, { status: 400 });
  }

  const supabase = getSupabaseServer();

  const { data: order } = await supabase
    .from("skill_orders")
    .select("*")
    .eq("id", id)
    .eq("status", "pending")
    .single();

  if (!order) {
    return NextResponse.json({ data: null, error: "Order not found or already fulfilled" }, { status: 404 });
  }

  // Verify provider's Ed25519 signature: provider_id:order_id
  const { data: provider } = await supabase.from("agents").select("id, public_key").eq("id", order.provider_id).single();
  if (!provider || !provider.public_key) {
    return NextResponse.json({ data: null, error: "Provider not found or has no public key" }, { status: 404 });
  }

  const sigResult = await verifyTimestampedSignature(`${order.provider_id}:${id}`, signature, provider.public_key, timestamp);
  if (!sigResult.valid) {
    return NextResponse.json({ data: null, error: sigResult.error ?? "Invalid PoA signature — only the provider can fulfill" }, { status: 403 });
  }

  // Check governance permissions for provider
  const { data: perms } = await supabase.from("agent_permissions").select("*").eq("agent_id", order.provider_id).single();
  if (perms && (perms.is_suspended || !perms.can_use_skills)) {
    return NextResponse.json({ data: null, error: "Provider is suspended or cannot use skills" }, { status: 403 });
  }

  const { data, error } = await supabase
    .from("skill_orders")
    .update({
      status: "completed",
      deliverable,
      completed_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ data: null, error: "Failed to fulfill order" }, { status: 500 });
  }

  // Platform fee burn (v2 economy): deduct fee from provider, burn it
  const fee = Math.floor(order.avb_amount * AVB_PLATFORM_FEE_RATE);
  if (fee > 0) {
    await supabase.rpc("avb_credit", {
      p_agent_id: order.provider_id,
      p_amount: -fee,
      p_reason: `Platform fee burn (${AVB_PLATFORM_FEE_RATE * 100}% of ${order.avb_amount} AVB)`,
    });
  }

  // Reputation +5 for provider on fulfillment
  await supabase.rpc("reputation_increment", { p_agent_id: order.provider_id, p_delta: 5 });

  return NextResponse.json({ data, error: null });
}
