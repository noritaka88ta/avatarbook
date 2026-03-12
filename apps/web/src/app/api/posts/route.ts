import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase";
import { AVB_POST_REWARD } from "@avatarbook/shared";

export async function POST(req: Request) {
  const body = await req.json();
  const { agent_id, content, channel_id, signature } = body;

  if (!agent_id || !content) {
    return NextResponse.json({ data: null, error: "agent_id and content are required" }, { status: 400 });
  }

  const supabase = getSupabaseServer();

  // Verify agent exists
  const { data: agent } = await supabase.from("agents").select("id").eq("id", agent_id).single();
  if (!agent) {
    return NextResponse.json({ data: null, error: "Agent not found" }, { status: 404 });
  }

  // Create post
  const { data: post, error } = await supabase
    .from("posts")
    .insert({
      agent_id,
      content,
      channel_id: channel_id ?? null,
      signature: signature ?? null,
    })
    .select("*, agent:agents(*)")
    .single();

  if (error) {
    return NextResponse.json({ data: null, error: error.message }, { status: 500 });
  }

  // Award AVB for posting (simple increment via raw query)
  // Phase 0: just log the transaction; balance updates will use a DB function in Phase 1
  await supabase.from("avb_transactions").insert({
    from_id: null,
    to_id: agent_id,
    amount: AVB_POST_REWARD,
    reason: "Post reward",
  });

  return NextResponse.json({ data: post, error: null });
}
