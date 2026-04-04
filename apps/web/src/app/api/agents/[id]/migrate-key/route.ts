import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase";
import { verify } from "@avatarbook/poa";

/**
 * POST /api/agents/{id}/migrate-key
 *
 * Migration endpoint for transitioning from server-side key storage
 * to client-side keygen. The client proves ownership of the agent's
 * current private key by signing an endorsement message, then submits
 * a new client-generated public key.
 *
 * This is a one-time operation per agent. After migration, the server
 * no longer needs or stores the agent's private key.
 *
 * Body: { new_public_key: string, endorsement: string }
 * endorsement = sign("migrate:{agent_id}:{new_public_key}", current_private_key)
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ data: null, error: "Invalid JSON body" }, { status: 400 }); }
  const { new_public_key, endorsement } = body;

  if (!new_public_key || typeof new_public_key !== "string") {
    return NextResponse.json({ data: null, error: "new_public_key is required" }, { status: 400 });
  }

  if (!/^[0-9a-f]{64}$/i.test(new_public_key)) {
    return NextResponse.json({ data: null, error: "new_public_key must be 64 hex characters" }, { status: 400 });
  }

  if (!endorsement || typeof endorsement !== "string") {
    return NextResponse.json({ data: null, error: "endorsement signature is required" }, { status: 400 });
  }

  const supabase = getSupabaseServer();

  const { data: agent } = await supabase
    .from("agents")
    .select("id, public_key, key_rotated_at")
    .eq("id", id)
    .single();

  if (!agent) {
    return NextResponse.json({ data: null, error: "Agent not found" }, { status: 404 });
  }

  if (!agent.public_key) {
    return NextResponse.json({ data: null, error: "Agent has no current public key" }, { status: 400 });
  }

  // Verify endorsement: current key signs "migrate:{agent_id}:{new_public_key}"
  const message = `migrate:${id}:${new_public_key}`;
  const valid = await verify(message, endorsement, agent.public_key);
  if (!valid) {
    return NextResponse.json({ data: null, error: "Invalid endorsement — must be signed with current private key" }, { status: 403 });
  }

  // Swap to new key
  const { error } = await supabase
    .from("agents")
    .update({
      public_key: new_public_key,
      key_rotated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("public_key", agent.public_key); // optimistic lock

  if (error) {
    return NextResponse.json({ data: null, error: "Migration failed" }, { status: 500 });
  }

  return NextResponse.json({
    data: {
      id,
      public_key: new_public_key,
      migrated_at: new Date().toISOString(),
      keygen: "client",
    },
    error: null,
  });
}
