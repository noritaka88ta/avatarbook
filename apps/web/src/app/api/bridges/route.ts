import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase";
import { verifyTimestampedSignature } from "@/lib/signature";
export const runtime = "nodejs";

const MAX_BRIDGES_PER_AGENT = 5;

// GET /api/bridges?agent_id=xxx
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const agentId = searchParams.get("agent_id");
  if (!agentId) {
    return NextResponse.json({ data: null, error: "agent_id required" }, { status: 400 });
  }

  const supabase = getSupabaseServer();
  const { data, error } = await supabase
    .from("agent_bridges")
    .select("id, agent_id, mcp_server_url, mcp_server_name, tools_imported, active, created_at")
    .eq("agent_id", agentId)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ data: null, error: "Failed to fetch bridges" }, { status: 500 });
  }
  return NextResponse.json({ data, error: null });
}

// POST /api/bridges — register a bridge
export async function POST(req: Request) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ data: null, error: "Invalid JSON body" }, { status: 400 });
  }

  const { agent_id, mcp_server_url, mcp_server_name, signature, timestamp } = body;

  if (!agent_id || !mcp_server_url || !mcp_server_name) {
    return NextResponse.json({ data: null, error: "agent_id, mcp_server_url, and mcp_server_name are required" }, { status: 400 });
  }
  if (typeof mcp_server_url !== "string" || mcp_server_url.length > 2000) {
    return NextResponse.json({ data: null, error: "Invalid mcp_server_url" }, { status: 400 });
  }
  // SSRF protection: validate URL scheme and block private IPs
  try {
    const parsed = new URL(mcp_server_url);
    if (!["https:"].includes(parsed.protocol)) {
      return NextResponse.json({ data: null, error: "Only HTTPS URLs allowed" }, { status: 400 });
    }
    const hostname = parsed.hostname.replace(/^\[|\]$/g, "");
    const blocked = /^(localhost|127\.|10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|169\.254\.|0\.|::1|0:0:0:0:0:0:0:1|fc|fd|fe80|::ffff:)/i;
    if (blocked.test(hostname)) {
      return NextResponse.json({ data: null, error: "URL not allowed" }, { status: 400 });
    }
  } catch {
    return NextResponse.json({ data: null, error: "Invalid mcp_server_url" }, { status: 400 });
  }
  if (typeof mcp_server_name !== "string" || mcp_server_name.length > 200) {
    return NextResponse.json({ data: null, error: "Invalid mcp_server_name" }, { status: 400 });
  }

  const supabase = getSupabaseServer();

  // Fetch agent + owner for tier check
  const { data: agent } = await supabase
    .from("agents")
    .select("id, owner_id, public_key")
    .eq("id", agent_id)
    .single();

  if (!agent) {
    return NextResponse.json({ data: null, error: "Agent not found" }, { status: 404 });
  }

  // Tier gate: Verified or Early Adopter only
  if (agent.owner_id) {
    const { data: owner } = await supabase.from("owners").select("tier, early_adopter").eq("id", agent.owner_id).single();
    if (!owner || (owner.tier === "free" && !owner.early_adopter)) {
      return NextResponse.json({ data: null, error: "Bridge requires Verified tier or Early Adopter status" }, { status: 403 });
    }
  } else {
    return NextResponse.json({ data: null, error: "Bridge requires an owner with Verified tier" }, { status: 403 });
  }

  // Ed25519 signature auth — mandatory
  if (!agent.public_key) {
    return NextResponse.json({ data: null, error: "Agent has no public key" }, { status: 400 });
  }
  if (!signature) {
    return NextResponse.json({ data: null, error: "Signature required" }, { status: 400 });
  }
  const sigResult = await verifyTimestampedSignature(
    `bridge:${agent_id}:${mcp_server_name}`,
    signature,
    agent.public_key,
    timestamp,
  );
  if (!sigResult.valid) {
    return NextResponse.json({ data: null, error: sigResult.error ?? "Invalid signature" }, { status: 403 });
  }

  // Max bridges per agent
  const { count } = await supabase
    .from("agent_bridges")
    .select("id", { count: "exact", head: true })
    .eq("agent_id", agent_id);

  if ((count ?? 0) >= MAX_BRIDGES_PER_AGENT) {
    return NextResponse.json({ data: null, error: `Maximum ${MAX_BRIDGES_PER_AGENT} bridges per agent` }, { status: 403 });
  }

  const { data: bridge, error: insertErr } = await supabase
    .from("agent_bridges")
    .insert({ agent_id, mcp_server_url: mcp_server_url, mcp_server_name })
    .select()
    .single();

  if (insertErr) {
    return NextResponse.json({ data: null, error: "Failed to create bridge" }, { status: 500 });
  }

  return NextResponse.json({ data: bridge, error: null });
}
