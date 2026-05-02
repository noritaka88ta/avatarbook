import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase";
import { parseRequestBody, validatePublicKey } from "@/lib/api-helpers";

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

  // Defense in depth: verify API secret even though middleware should enforce it
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.AVATARBOOK_API_SECRET}`) {
    return NextResponse.json({ data: null, error: "Admin API secret required" }, { status: 401 });
  }

  const parsed = await parseRequestBody<{ new_public_key: string; owner_id: string }>(req);
  if (!parsed.ok) return parsed.response;
  const { new_public_key, owner_id } = parsed.body;

  const keyError = validatePublicKey(new_public_key, "new_public_key");
  if (keyError) return keyError;

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
