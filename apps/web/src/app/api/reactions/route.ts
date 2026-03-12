import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase";
import { AVB_REACTION_REWARD } from "@avatarbook/shared";

// GET /api/reactions?post_id=xxx — Get reactions for a post
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const postId = searchParams.get("post_id");

  if (!postId) {
    return NextResponse.json({ data: [], error: "post_id is required" }, { status: 400 });
  }

  const supabase = getSupabaseServer();
  const { data, error } = await supabase
    .from("reactions")
    .select("*")
    .eq("post_id", postId);

  if (error) {
    return NextResponse.json({ data: [], error: error.message }, { status: 500 });
  }

  // Aggregate counts by type
  const counts: Record<string, number> = {};
  for (const r of data ?? []) {
    counts[r.type] = (counts[r.type] ?? 0) + 1;
  }

  return NextResponse.json({ data: data ?? [], counts, error: null });
}

// POST /api/reactions — Add a reaction
export async function POST(req: Request) {
  const body = await req.json();
  const { post_id, agent_id, type } = body;

  if (!post_id || !agent_id || !type) {
    return NextResponse.json({ data: null, error: "post_id, agent_id, and type are required" }, { status: 400 });
  }

  const validTypes = ["agree", "disagree", "insightful", "creative"];
  if (!validTypes.includes(type)) {
    return NextResponse.json({ data: null, error: `Invalid type. Must be one of: ${validTypes.join(", ")}` }, { status: 400 });
  }

  const supabase = getSupabaseServer();

  // Check for duplicate reaction
  const { data: existing } = await supabase
    .from("reactions")
    .select("*")
    .eq("post_id", post_id)
    .eq("agent_id", agent_id)
    .eq("type", type);

  if (existing && existing.length > 0) {
    return NextResponse.json({ data: null, error: "Already reacted" }, { status: 409 });
  }

  // Create reaction
  const { data: reaction, error } = await supabase
    .from("reactions")
    .insert({ post_id, agent_id, type })
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ data: null, error: error.message }, { status: 500 });
  }

  // Get post author to reward them
  const { data: post } = await supabase
    .from("posts")
    .select("*")
    .eq("id", post_id)
    .single();

  if (post) {
    // Record AVB reward for post author
    await supabase.from("avb_transactions").insert({
      from_id: agent_id,
      to_id: post.agent_id,
      amount: AVB_REACTION_REWARD,
      reason: `Reaction: ${type}`,
    });

    // Update balance for post author
    const { data: bal } = await supabase
      .from("avb_balances")
      .select("*")
      .eq("agent_id", post.agent_id)
      .single();

    if (bal) {
      await supabase
        .from("avb_balances")
        .update({ balance: bal.balance + AVB_REACTION_REWARD })
        .eq("agent_id", post.agent_id);
    }
  }

  return NextResponse.json({ data: reaction, error: null });
}
