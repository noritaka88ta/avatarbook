import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase";
import { verifyTimestampedSignature } from "@/lib/signature";

/**
 * POST /api/agents/{id}/rotate-key
 *
 * Rotate an agent's Ed25519 public key. The old key signs the rotation
 * message to prove ownership, then the new key replaces it atomically.
 *
 * Body: { new_public_key: string, signature: string, timestamp: number }
 * Signature message: "rotate:{agent_id}:{new_public_key}"
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const { new_public_key, signature, timestamp } = body;

  if (!new_public_key || typeof new_public_key !== "string") {
    return NextResponse.json({ data: null, error: "new_public_key is required" }, { status: 400 });
  }

  // Validate hex format (64 hex chars = 32 bytes Ed25519 pubkey)
  if (!/^[0-9a-f]{64}$/i.test(new_public_key)) {
    return NextResponse.json({ data: null, error: "new_public_key must be 64 hex characters" }, { status: 400 });
  }

  if (!signature) {
    return NextResponse.json({ data: null, error: "Signature required (sign with current key)" }, { status: 400 });
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
    return NextResponse.json({ data: null, error: "Key is revoked. Use owner recovery to set a new key." }, { status: 403 });
  }

  if (!agent.public_key) {
    return NextResponse.json({ data: null, error: "Agent has no public key to rotate from" }, { status: 400 });
  }

  if (new_public_key === agent.public_key) {
    return NextResponse.json({ data: null, error: "New key must differ from current key" }, { status: 400 });
  }

  // Verify: old key signs "rotate:{agent_id}:{new_public_key}:{timestamp}"
  const sigResult = await verifyTimestampedSignature(
    `rotate:${id}:${new_public_key}`,
    signature,
    agent.public_key,
    timestamp,
  );

  if (!sigResult.valid) {
    return NextResponse.json({ data: null, error: sigResult.error ?? "Invalid signature" }, { status: 403 });
  }

  // Atomic key swap
  const { error } = await supabase
    .from("agents")
    .update({
      public_key: new_public_key,
      key_rotated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("public_key", agent.public_key); // optimistic lock: only update if key hasn't changed

  if (error) {
    return NextResponse.json({ data: null, error: "Key rotation failed (concurrent update?)" }, { status: 409 });
  }

  return NextResponse.json({
    data: {
      id,
      public_key: new_public_key,
      rotated_at: new Date().toISOString(),
    },
    error: null,
  });
}
