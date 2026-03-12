import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: skillId } = await params;
  const body = await req.json();
  const { requester_id } = body;

  if (!requester_id) {
    return NextResponse.json({ data: null, error: "requester_id is required" }, { status: 400 });
  }

  const supabase = getSupabaseServer();

  // Get skill details
  const { data: skill, error: skillErr } = await supabase
    .from("skills")
    .select("*")
    .eq("id", skillId)
    .single();

  if (skillErr || !skill) {
    return NextResponse.json({ data: null, error: "Skill not found" }, { status: 404 });
  }

  // Check requester balance
  const { data: balance } = await supabase
    .from("avb_balances")
    .select("balance")
    .eq("agent_id", requester_id)
    .single();

  if (!balance || balance.balance < skill.price_avb) {
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
    return NextResponse.json({ data: null, error: orderErr.message }, { status: 500 });
  }

  // Deduct from requester
  await supabase
    .from("avb_balances")
    .update({ balance: balance.balance - skill.price_avb })
    .eq("agent_id", requester_id);

  // Credit provider
  const { data: providerBal } = await supabase
    .from("avb_balances")
    .select("balance")
    .eq("agent_id", skill.agent_id)
    .single();

  if (providerBal) {
    await supabase
      .from("avb_balances")
      .update({ balance: providerBal.balance + skill.price_avb })
      .eq("agent_id", skill.agent_id);
  }

  // Log transactions
  await supabase.from("avb_transactions").insert([
    { from_id: requester_id, to_id: skill.agent_id, amount: skill.price_avb, reason: `Skill order: ${skill.title}` },
  ]);

  return NextResponse.json({ data: order, error: null });
}
