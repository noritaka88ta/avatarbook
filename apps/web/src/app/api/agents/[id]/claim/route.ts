import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase";

/**
 * POST /api/agents/{id}/claim
 *
 * Claim a Web-registered agent by providing the one-time claim token
 * and a new Ed25519 public key. The token is consumed on success.
 *
 * Body: { claim_token: string, public_key: string }
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ data: null, error: "Invalid JSON body" }, { status: 400 }); }
  const { claim_token, public_key } = body;

  if (!claim_token || typeof claim_token !== "string") {
    return NextResponse.json({ data: null, error: "claim_token is required" }, { status: 400 });
  }

  if (!public_key || typeof public_key !== "string") {
    return NextResponse.json({ data: null, error: "public_key is required" }, { status: 400 });
  }

  if (!/^[0-9a-f]{64}$/i.test(public_key)) {
    return NextResponse.json({ data: null, error: "public_key must be 64 hex characters" }, { status: 400 });
  }

  const supabase = getSupabaseServer();

  const { data: agent } = await supabase
    .from("agents")
    .select("id, name, claim_token, claim_token_expires_at, public_key, key_revoked_at")
    .eq("id", id)
    .single();

  if (!agent) {
    return NextResponse.json({ data: null, error: "Agent not found" }, { status: 404 });
  }

  if (!agent.claim_token) {
    return NextResponse.json({ data: null, error: "Agent has no pending claim token (already claimed or registered via MCP)" }, { status: 400 });
  }

  // TTL check (24h default)
  if (agent.claim_token_expires_at && new Date(agent.claim_token_expires_at) < new Date()) {
    return NextResponse.json({ data: null, error: "Claim token expired. Re-register the agent or request a new token." }, { status: 410 });
  }

  // Constant-time comparison
  const encoder = new TextEncoder();
  const a = encoder.encode(claim_token);
  const b = encoder.encode(agent.claim_token);
  if (a.length !== b.length) {
    return NextResponse.json({ data: null, error: "Invalid claim token" }, { status: 403 });
  }
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  if (diff !== 0) {
    return NextResponse.json({ data: null, error: "Invalid claim token" }, { status: 403 });
  }

  // Atomically set public_key and consume claim_token
  const { error } = await supabase
    .from("agents")
    .update({
      public_key,
      claim_token: null,
    })
    .eq("id", id)
    .eq("claim_token", agent.claim_token); // optimistic lock

  if (error) {
    return NextResponse.json({ data: null, error: "Claim failed (concurrent update?)" }, { status: 409 });
  }

  return NextResponse.json({
    data: {
      id,
      name: agent.name,
      public_key,
      claimed_at: new Date().toISOString(),
    },
    error: null,
  });
}
