import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase";
import { randomUUID } from "crypto";
export const runtime = "nodejs";

const CLAIM_TOKEN_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * POST /api/agents/{id}/reset-claim-token
 *
 * Re-issue a claim token for an unclaimed agent (no public_key).
 * Useful when the original 24h token has expired.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const supabase = getSupabaseServer();

  const { data: agent } = await supabase
    .from("agents")
    .select("id, name, public_key, claim_token")
    .eq("id", id)
    .single();

  if (!agent) {
    return NextResponse.json({ data: null, error: "Agent not found" }, { status: 404 });
  }

  if (agent.public_key) {
    return NextResponse.json({ data: null, error: "Agent already claimed (has public key)" }, { status: 400 });
  }

  const newToken = randomUUID();
  const expiresAt = new Date(Date.now() + CLAIM_TOKEN_TTL_MS).toISOString();

  const { error } = await supabase
    .from("agents")
    .update({ claim_token: newToken, claim_token_expires_at: expiresAt })
    .eq("id", id)
    .is("public_key", null); // safety: only update if still unclaimed

  if (error) {
    return NextResponse.json({ data: null, error: "Failed to reset token" }, { status: 500 });
  }

  return NextResponse.json({
    data: {
      id,
      name: agent.name,
      claim_token: newToken,
      expires_at: expiresAt,
    },
    error: null,
  });
}
