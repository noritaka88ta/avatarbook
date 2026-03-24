import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase";
import { AVB_POST_REWARD } from "@avatarbook/shared";
import { verifyTimestampedSignature } from "@/lib/signature";

const HOSTED_POST_COST = 10; // AVB per post for hosted agents

export async function POST(req: Request) {
  const body = await req.json();
  const { agent_id, human_user_name, content, channel_id, signature, timestamp, parent_id } = body;

  // Must have either agent_id or human_user_name
  if (!agent_id && !human_user_name) {
    return NextResponse.json({ data: null, error: "agent_id or human_user_name is required" }, { status: 400 });
  }

  if (!content || typeof content !== "string" || content.length > 5000) {
    return NextResponse.json({ data: null, error: "content must be a string under 5000 characters" }, { status: 400 });
  }

  const supabase = getSupabaseServer();

  // Agent post flow
  if (agent_id) {
    const { data: agent } = await supabase.from("agents").select("id, public_key, hosted").eq("id", agent_id).single();
    if (!agent) {
      return NextResponse.json({ data: null, error: "Agent not found" }, { status: 404 });
    }

    const { data: perms } = await supabase.from("agent_permissions").select("*").eq("agent_id", agent_id).single();
    if (perms && (perms.is_suspended || !perms.can_post)) {
      return NextResponse.json({ data: null, error: "Agent is suspended or cannot post" }, { status: 403 });
    }

    // Agent posts require a valid Ed25519 signature
    if (!signature) {
      return NextResponse.json({ data: null, error: "Signature is required for agent posts" }, { status: 400 });
    }

    if (!agent.public_key) {
      return NextResponse.json({ data: null, error: "Agent has no public key" }, { status: 400 });
    }

    // Verify timestamped signature with replay protection
    const sigResult = await verifyTimestampedSignature(`${agent_id}:${content}`, signature, agent.public_key, timestamp);
    if (!sigResult.valid) {
      return NextResponse.json({ data: null, error: sigResult.error ?? "Invalid PoA signature" }, { status: 403 });
    }
    const signatureValid = true;

    // Hosted agents pay AVB per post
    if (agent.hosted) {
      const { data: bal } = await supabase.from("avb_balances").select("balance").eq("agent_id", agent_id).single();
      if (!bal || bal.balance < HOSTED_POST_COST) {
        return NextResponse.json({ data: null, error: `Insufficient AVB balance. Posting costs ${HOSTED_POST_COST} AVB. Current: ${bal?.balance ?? 0}` }, { status: 402 });
      }
    }

    const { data: post, error } = await supabase
      .from("posts")
      .insert({
        agent_id,
        content,
        channel_id: channel_id ?? null,
        parent_id: parent_id ?? null,
        signature: signature ?? null,
        signature_valid: signatureValid,
      })
      .select("*, agent:agents(id, name, specialty, avatar_url, model_type, public_key, zkp_verified, reputation_score, created_at)")
      .single();

    if (error) {
      return NextResponse.json({ data: null, error: "Failed to create post" }, { status: 500 });
    }

    if (agent.hosted) {
      // Deduct AVB for hosted agent
      await supabase.rpc("avb_credit", {
        p_agent_id: agent_id,
        p_amount: -HOSTED_POST_COST,
        p_reason: "Hosted post cost",
      });
    } else {
      // BYOK agents earn AVB for posting
      await supabase.rpc("avb_credit", {
        p_agent_id: agent_id,
        p_amount: AVB_POST_REWARD,
        p_reason: "Post reward",
      });
    }

    // Reputation +1 for posting
    await supabase.rpc("reputation_increment", { p_agent_id: agent_id, p_delta: 1 });

    return NextResponse.json({ data: post, error: null });
  }

  // Human post flow
  const name = human_user_name.trim();
  if (name.length < 1 || name.length > 50) {
    return NextResponse.json({ data: null, error: "Name must be 1-50 characters" }, { status: 400 });
  }

  const { data: post, error } = await supabase
    .from("posts")
    .insert({
      human_user_name: name,
      content,
      channel_id: channel_id ?? null,
      parent_id: parent_id ?? null,
    })
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ data: null, error: "Failed to create post" }, { status: 500 });
  }

  return NextResponse.json({ data: post, error: null });
}
