import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase";
import { verifyTimestampedSignature } from "@/lib/signature";
import { dispatchWebhookForAgent } from "@/lib/webhook-dispatcher";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const agentId = searchParams.get("agent_id");
  const direction = searchParams.get("direction") ?? "inbox";
  const limit = Math.min(50, parseInt(searchParams.get("limit") ?? "20", 10) || 20);

  if (!agentId) {
    return NextResponse.json({ data: [], error: "agent_id is required" }, { status: 400 });
  }

  const supabase = getSupabaseServer();
  const col = direction === "outbox" ? "from_agent_id" : "to_agent_id";

  const { data, error } = await supabase
    .from("direct_messages")
    .select("*, from_agent:agents!direct_messages_from_agent_id_fkey(id, name, specialty, avatar_url), to_agent:agents!direct_messages_to_agent_id_fkey(id, name, specialty, avatar_url)")
    .eq(col, agentId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    return NextResponse.json({ data: [], error: "Operation failed" }, { status: 500 });
  }

  return NextResponse.json({ data: data ?? [], error: null });
}

export async function POST(req: Request) {
  const body = await req.json();
  const { from_agent_id, to_agent_id, content, signature, timestamp } = body;

  if (!from_agent_id || !to_agent_id || !content) {
    return NextResponse.json({ data: null, error: "from_agent_id, to_agent_id, and content are required" }, { status: 400 });
  }
  if (from_agent_id === to_agent_id) {
    return NextResponse.json({ data: null, error: "Cannot DM yourself" }, { status: 400 });
  }
  if (typeof content !== "string" || content.length < 1 || content.length > 5000) {
    return NextResponse.json({ data: null, error: "content must be 1-5000 characters" }, { status: 400 });
  }
  if (!signature) {
    return NextResponse.json({ data: null, error: "Signature is required" }, { status: 400 });
  }

  const supabase = getSupabaseServer();

  const { data: sender } = await supabase.from("agents").select("id, public_key").eq("id", from_agent_id).single();
  if (!sender || !sender.public_key) {
    return NextResponse.json({ data: null, error: "Sender not found or has no public key" }, { status: 404 });
  }

  const { data: recipient } = await supabase.from("agents").select("id").eq("id", to_agent_id).single();
  if (!recipient) {
    return NextResponse.json({ data: null, error: "Recipient not found" }, { status: 404 });
  }

  const sigResult = await verifyTimestampedSignature(
    `dm:${from_agent_id}:${to_agent_id}:${content}`,
    signature,
    sender.public_key,
    timestamp
  );
  if (!sigResult.valid) {
    return NextResponse.json({ data: null, error: sigResult.error ?? "Invalid signature" }, { status: 403 });
  }

  const { data: perms } = await supabase.from("agent_permissions").select("*").eq("agent_id", from_agent_id).single();
  if (perms?.is_suspended) {
    return NextResponse.json({ data: null, error: "Agent is suspended" }, { status: 403 });
  }

  const { data: dm, error } = await supabase
    .from("direct_messages")
    .insert({ from_agent_id, to_agent_id, content, signature })
    .select("*, from_agent:agents!direct_messages_from_agent_id_fkey(id, name), to_agent:agents!direct_messages_to_agent_id_fkey(id, name)")
    .single();

  if (error) {
    return NextResponse.json({ data: null, error: "Operation failed" }, { status: 500 });
  }

  // Webhook: dm_received → recipient's owner
  dispatchWebhookForAgent(to_agent_id, "dm_received", {
    dm_id: dm.id, from_agent_id, to_agent_id, content: content.slice(0, 200),
  }).catch(() => {});

  return NextResponse.json({ data: dm, error: null });
}
