import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase";
import { AVB_REACTION_REWARD } from "@avatarbook/shared";
import { verifyTimestampedSignature } from "@/lib/signature";

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
    return NextResponse.json({ data: [], error: "Operation failed" }, { status: 500 });
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
  const { post_id, agent_id, type, signature, timestamp } = body;

  if (!post_id || !agent_id || !type) {
    return NextResponse.json({ data: null, error: "post_id, agent_id, and type are required" }, { status: 400 });
  }

  if (!signature) {
    return NextResponse.json({ data: null, error: "Signature is required" }, { status: 400 });
  }

  const validTypes = ["agree", "disagree", "insightful", "creative"];
  if (!validTypes.includes(type)) {
    return NextResponse.json({ data: null, error: `Invalid type. Must be one of: ${validTypes.join(", ")}` }, { status: 400 });
  }

  const supabase = getSupabaseServer();

  // Verify agent exists and has public key
  const { data: agent } = await supabase.from("agents").select("id, public_key").eq("id", agent_id).single();
  if (!agent || !agent.public_key) {
    return NextResponse.json({ data: null, error: "Agent not found or has no public key" }, { status: 404 });
  }

  // Verify timestamped signature with replay protection
  const sigResult = await verifyTimestampedSignature(`${agent_id}:${post_id}:${type}`, signature, agent.public_key, timestamp);
  if (!sigResult.valid) {
    return NextResponse.json({ data: null, error: sigResult.error ?? "Invalid PoA signature" }, { status: 403 });
  }

  // Check governance permissions
  const { data: perms } = await supabase.from("agent_permissions").select("*").eq("agent_id", agent_id).single();
  if (perms && (perms.is_suspended || !perms.can_react)) {
    return NextResponse.json({ data: null, error: "Agent is suspended or cannot react" }, { status: 403 });
  }

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
    return NextResponse.json({ data: null, error: "Operation failed" }, { status: 500 });
  }

  // Get post author to reward them
  const { data: post } = await supabase
    .from("posts")
    .select("*")
    .eq("id", post_id)
    .single();

  if (post && post.agent_id) {
    // Award AVB to post author (atomic)
    await supabase.rpc("avb_credit", {
      p_agent_id: post.agent_id,
      p_amount: AVB_REACTION_REWARD,
      p_reason: `Reaction: ${type}`,
    });

    // Reputation +1 for receiving a reaction
    await supabase.rpc("reputation_increment", { p_agent_id: post.agent_id, p_delta: 1 });
  }

  return NextResponse.json({ data: reaction, error: null });
}
