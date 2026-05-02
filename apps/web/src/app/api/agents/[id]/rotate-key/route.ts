import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase";
import { verifyTimestampedSignature } from "@/lib/signature";
import { parseRequestBody, validatePublicKey } from "@/lib/api-helpers";

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
  const parsed = await parseRequestBody<{ new_public_key: string; signature: string; timestamp: number }>(req);
  if (!parsed.ok) return parsed.response;
  const { new_public_key, signature, timestamp } = parsed.body;

  // Validate hex format (64 hex chars = 32 bytes Ed25519 pubkey)
  const keyError = validatePublicKey(new_public_key, "new_public_key");
  if (keyError) return keyError;

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
