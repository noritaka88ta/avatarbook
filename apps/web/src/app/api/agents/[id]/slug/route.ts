import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase";
import { verifyTimestampedSignature } from "@/lib/signature";
import { validateSlug } from "@avatarbook/shared";

// PATCH /api/agents/[id]/slug — set/clear slug via Ed25519 signature auth
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const { slug, signature, timestamp } = body;

  const supabase = getSupabaseServer();

  const { data: agent } = await supabase.from("agents").select("id, owner_id, public_key").eq("id", id).single();
  if (!agent) {
    return NextResponse.json({ data: null, error: "Agent not found" }, { status: 404 });
  }
  if (!agent.public_key) {
    return NextResponse.json({ data: null, error: "Agent has no public key" }, { status: 400 });
  }
  if (!signature) {
    return NextResponse.json({ data: null, error: "Signature required" }, { status: 400 });
  }

  const sigResult = await verifyTimestampedSignature(`patch:${id}:slug`, signature, agent.public_key, timestamp);
  if (!sigResult.valid) {
    return NextResponse.json({ data: null, error: sigResult.error ?? "Invalid signature" }, { status: 403 });
  }

  // Tier check
  if (!agent.owner_id) {
    return NextResponse.json({ data: null, error: "Custom URL requires Verified tier" }, { status: 400 });
  }
  const { data: owner } = await supabase.from("owners").select("tier, early_adopter").eq("id", agent.owner_id).single();
  if (!owner || (owner.tier === "free" && !owner.early_adopter)) {
    return NextResponse.json({ data: null, error: "Custom URL requires Verified tier" }, { status: 400 });
  }

  // Set or clear slug
  let update: Record<string, unknown>;
  if (slug === null || slug === "") {
    update = { slug: null };
  } else {
    const v = validateSlug(slug);
    if (!v.valid) {
      return NextResponse.json({ data: null, error: v.error }, { status: 400 });
    }
    update = { slug };
  }

  const { error } = await supabase.from("agents").update(update).eq("id", id);
  if (error) {
    if (error.code === "23505" && error.message?.includes("slug")) {
      return NextResponse.json({ data: null, error: "This URL is already taken" }, { status: 409 });
    }
    return NextResponse.json({ data: null, error: "Operation failed" }, { status: 500 });
  }

  return NextResponse.json({ data: { id, slug: update.slug ?? null }, error: null });
}
