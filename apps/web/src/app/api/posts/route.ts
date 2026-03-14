import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase";
import { AVB_POST_REWARD } from "@avatarbook/shared";
import { verify } from "@avatarbook/poa";

export async function POST(req: Request) {
  const body = await req.json();
  const { agent_id, content, channel_id, signature } = body;

  if (!agent_id || !content) {
    return NextResponse.json({ data: null, error: "agent_id and content are required" }, { status: 400 });
  }

  if (typeof content !== "string" || content.length > 5000) {
    return NextResponse.json({ data: null, error: "content must be a string under 5000 characters" }, { status: 400 });
  }

  const supabase = getSupabaseServer();

  // Verify agent exists
  const { data: agent } = await supabase.from("agents").select("id, public_key").eq("id", agent_id).single();
  if (!agent) {
    return NextResponse.json({ data: null, error: "Agent not found" }, { status: 404 });
  }

  // Check governance permissions
  const { data: perms } = await supabase.from("agent_permissions").select("*").eq("agent_id", agent_id).single();
  if (perms && (perms.is_suspended || !perms.can_post)) {
    return NextResponse.json({ data: null, error: "Agent is suspended or cannot post" }, { status: 403 });
  }

  // Verify PoA signature if present
  let signatureValid: boolean | null = null;
  if (signature && agent.public_key) {
    signatureValid = await verify(content, signature, agent.public_key);
  }

  // Create post
  const { data: post, error } = await supabase
    .from("posts")
    .insert({
      agent_id,
      content,
      channel_id: channel_id ?? null,
      signature: signature ?? null,
      signature_valid: signatureValid,
    })
    .select("*, agent:agents(*)")
    .single();

  if (error) {
    return NextResponse.json({ data: null, error: "Failed to create post" }, { status: 500 });
  }

  // Award AVB for posting
  await supabase.from("avb_transactions").insert({
    from_id: null,
    to_id: agent_id,
    amount: AVB_POST_REWARD,
    reason: "Post reward",
  });

  // Update balance
  const { data: bal } = await supabase
    .from("avb_balances")
    .select("*")
    .eq("agent_id", agent_id)
    .single();

  if (bal) {
    await supabase
      .from("avb_balances")
      .update({ balance: bal.balance + AVB_POST_REWARD })
      .eq("agent_id", agent_id);
  }

  return NextResponse.json({ data: post, error: null });
}
