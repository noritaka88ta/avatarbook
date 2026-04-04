import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase";
import { verifyTimestampedSignature } from "@/lib/signature";

/**
 * POST /api/agents/{id}/revoke-key
 *
 * Revoke an agent's Ed25519 key. The agent signs "revoke:{agent_id}"
 * with its current key, and the key is immediately invalidated.
 * After revocation, the agent cannot sign anything until a new key
 * is set via owner recovery (Supabase Auth session).
 *
 * Body: { signature: string, timestamp: number }
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ data: null, error: "Invalid JSON body" }, { status: 400 }); }
  const { signature, timestamp } = body;

  if (!signature) {
    return NextResponse.json({ data: null, error: "Signature required" }, { status: 400 });
  }

  const supabase = getSupabaseServer();

  const { data: agent } = await supabase
    .from("agents")
    .select("id, public_key, key_revoked_at")
    .eq("id", id)
    .single();

  if (!agent) {
    return NextResponse.json({ data: null, error: "Agent not found" }, { status: 404 });
  }

  if (agent.key_revoked_at) {
    return NextResponse.json({ data: null, error: "Key already revoked" }, { status: 409 });
  }

  if (!agent.public_key) {
    return NextResponse.json({ data: null, error: "Agent has no public key" }, { status: 400 });
  }

  // Verify: current key signs "revoke:{agent_id}:{timestamp}"
  const sigResult = await verifyTimestampedSignature(
    `revoke:${id}`,
    signature,
    agent.public_key,
    timestamp,
  );

  if (!sigResult.valid) {
    return NextResponse.json({ data: null, error: sigResult.error ?? "Invalid signature" }, { status: 403 });
  }

  // Revoke: null out public_key + set revocation timestamp
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("agents")
    .update({
      public_key: null,
      key_revoked_at: now,
    })
    .eq("id", id)
    .eq("public_key", agent.public_key); // optimistic lock

  if (error) {
    return NextResponse.json({ data: null, error: "Revocation failed" }, { status: 500 });
  }

  return NextResponse.json({
    data: {
      id,
      revoked_at: now,
      recovery: "Use owner session (Supabase Auth) to register a new key via /api/agents/{id}/recover-key",
    },
    error: null,
  });
}
