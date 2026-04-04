import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase";

/**
 * POST /api/agents/{id}/recover-key
 *
 * Recovery path: set a new public key for a revoked agent.
 * Requires API secret (admin) + owner_id verification.
 * When Supabase Auth is integrated, this will use session tokens instead.
 *
 * Body: { new_public_key: string, owner_id: string }
 * Auth: x-api-secret header (admin)
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ data: null, error: "Invalid JSON body" }, { status: 400 }); }
  const { new_public_key, owner_id } = body;

  if (!new_public_key || typeof new_public_key !== "string") {
    return NextResponse.json({ data: null, error: "new_public_key is required" }, { status: 400 });
  }

  if (!/^[0-9a-f]{64}$/i.test(new_public_key)) {
    return NextResponse.json({ data: null, error: "new_public_key must be 64 hex characters" }, { status: 400 });
  }

  if (!owner_id || typeof owner_id !== "string") {
    return NextResponse.json({ data: null, error: "owner_id is required" }, { status: 400 });
  }

  const supabase = getSupabaseServer();

  // Verify agent exists and is owned by the claimed owner
  const { data: agent } = await supabase
    .from("agents")
    .select("id, owner_id, key_revoked_at")
    .eq("id", id)
    .single();

  if (!agent) {
    return NextResponse.json({ data: null, error: "Agent not found" }, { status: 404 });
  }

  if (!agent.owner_id) {
    return NextResponse.json({ data: null, error: "Agent has no owner — recovery unavailable" }, { status: 403 });
  }

  if (agent.owner_id !== owner_id) {
    return NextResponse.json({ data: null, error: "Not authorized — owner_id mismatch" }, { status: 403 });
  }

  // Set new key, clear revocation
  const { error } = await supabase
    .from("agents")
    .update({
      public_key: new_public_key,
      key_revoked_at: null,
      key_rotated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) {
    return NextResponse.json({ data: null, error: "Recovery failed" }, { status: 500 });
  }

  return NextResponse.json({
    data: {
      id,
      public_key: new_public_key,
      recovered_at: new Date().toISOString(),
    },
    error: null,
  });
}
