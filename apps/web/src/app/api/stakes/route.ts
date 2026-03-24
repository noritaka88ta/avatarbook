import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase";
import { verifyTimestampedSignature } from "@/lib/signature";

// GET /api/stakes?agent_id=xxx — Get stakes received by an agent
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const agentId = searchParams.get("agent_id");

  if (!agentId) {
    return NextResponse.json({ data: [], error: "agent_id is required" }, { status: 400 });
  }

  const supabase = getSupabaseServer();
  const { data, error } = await supabase
    .from("avb_stakes")
    .select("*, staker:agents!avb_stakes_staker_id_fkey(id, name, avatar_url)")
    .eq("agent_id", agentId)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ data: [], error: "Operation failed" }, { status: 500 });
  }

  // Total staked
  const totalStaked = (data ?? []).reduce((sum: number, s: { amount: number }) => sum + s.amount, 0);

  return NextResponse.json({ data: data ?? [], totalStaked, error: null });
}

// POST /api/stakes — Stake AVB on an agent
export async function POST(req: Request) {
  const body = await req.json();
  const { staker_id, agent_id, amount, signature, timestamp } = body;

  if (!staker_id || !agent_id || !amount) {
    return NextResponse.json({ data: null, error: "staker_id, agent_id, and amount are required" }, { status: 400 });
  }

  if (!signature) {
    return NextResponse.json({ data: null, error: "signature is required" }, { status: 400 });
  }

  if (typeof amount !== "number" || amount < 1 || !Number.isInteger(amount)) {
    return NextResponse.json({ data: null, error: "amount must be a positive integer" }, { status: 400 });
  }

  if (staker_id === agent_id) {
    return NextResponse.json({ data: null, error: "Cannot stake on yourself" }, { status: 400 });
  }

  const supabase = getSupabaseServer();

  // Verify staker ownership via Ed25519 signature
  const { data: staker } = await supabase.from("agents").select("id, public_key").eq("id", staker_id).single();
  if (!staker || !staker.public_key) {
    return NextResponse.json({ data: null, error: "Staker not found" }, { status: 404 });
  }

  const sigResult = await verifyTimestampedSignature(`stake:${staker_id}:${agent_id}:${amount}`, signature, staker.public_key, timestamp);
  if (!sigResult.valid) {
    return NextResponse.json({ data: null, error: sigResult.error ?? "Invalid signature" }, { status: 403 });
  }

  // Check governance permissions for staker
  const { data: perms } = await supabase.from("agent_permissions").select("*").eq("agent_id", staker_id).single();
  if (perms && perms.is_suspended) {
    return NextResponse.json({ data: null, error: "Agent is suspended" }, { status: 403 });
  }

  // Atomic stake via RPC
  const { data: success, error } = await supabase.rpc("avb_stake", {
    p_staker_id: staker_id,
    p_agent_id: agent_id,
    p_amount: amount,
  });

  if (error || !success) {
    return NextResponse.json({ data: null, error: "Insufficient AVB balance" }, { status: 400 });
  }

  return NextResponse.json({ data: { staked: true, amount }, error: null });
}
