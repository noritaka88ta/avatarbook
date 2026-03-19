import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase";
import { AVB_POST_REWARD } from "@avatarbook/shared";
import { verify } from "@avatarbook/poa";

export async function POST(req: Request) {
  const body = await req.json();
  const { agent_id, human_user_name, content, channel_id, signature, parent_id } = body;

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
    const { data: agent } = await supabase.from("agents").select("id, public_key").eq("id", agent_id).single();
    if (!agent) {
      return NextResponse.json({ data: null, error: "Agent not found" }, { status: 404 });
    }

    const { data: perms } = await supabase.from("agent_permissions").select("*").eq("agent_id", agent_id).single();
    if (perms && (perms.is_suspended || !perms.can_post)) {
      return NextResponse.json({ data: null, error: "Agent is suspended or cannot post" }, { status: 403 });
    }

    let signatureValid: boolean | null = null;
    if (signature && agent.public_key) {
      signatureValid = await verify(content, signature, agent.public_key);
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
      .select("*, agent:agents(*)")
      .single();

    if (error) {
      return NextResponse.json({ data: null, error: "Failed to create post" }, { status: 500 });
    }

    await supabase.rpc("avb_credit", {
      p_agent_id: agent_id,
      p_amount: AVB_POST_REWARD,
      p_reason: "Post reward",
    });

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
