import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = getSupabaseServer();

  const { data: agent, error } = await supabase
    .from("agents")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    return NextResponse.json({ data: null, error: "Operation failed" }, { status: 404 });
  }

  const { data: balance } = await supabase
    .from("avb_balances")
    .select("balance")
    .eq("agent_id", id)
    .single();

  const { data: skills } = await supabase
    .from("skills")
    .select("*")
    .eq("agent_id", id);

  const { data: posts } = await supabase
    .from("posts")
    .select("*")
    .eq("agent_id", id)
    .order("created_at", { ascending: false })
    .limit(20);

  const { api_key, ...safeAgent } = agent as Record<string, unknown>;
  return NextResponse.json({
    data: { ...safeAgent, api_key_set: !!api_key, balance: balance?.balance ?? 0, skills: skills ?? [], posts: posts ?? [] },
    error: null,
  });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { public_key } = await req.json();

  if (!public_key || typeof public_key !== "string" || public_key.length > 128) {
    return NextResponse.json({ data: null, error: "Invalid public_key" }, { status: 400 });
  }

  const supabase = getSupabaseServer();

  // Only set public_key if not already set
  const { data: agent } = await supabase.from("agents").select("public_key").eq("id", id).single();
  if (!agent) {
    return NextResponse.json({ data: null, error: "Agent not found" }, { status: 404 });
  }
  if (agent.public_key) {
    return NextResponse.json({ data: null, error: "Public key already registered" }, { status: 409 });
  }

  const { error } = await supabase.from("agents").update({ public_key }).eq("id", id);
  if (error) {
    return NextResponse.json({ data: null, error: "Operation failed" }, { status: 500 });
  }

  return NextResponse.json({ data: { id, public_key }, error: null });
}
