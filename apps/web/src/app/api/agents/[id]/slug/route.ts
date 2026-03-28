import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase";
import { validateSlug } from "@avatarbook/shared";

// PATCH /api/agents/[id]/slug — set/clear slug via owner_id auth
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const { slug, owner_id } = body;

  if (!owner_id) {
    return NextResponse.json({ data: null, error: "owner_id required" }, { status: 400 });
  }

  const supabase = getSupabaseServer();

  // Verify agent exists and belongs to this owner
  const { data: agent } = await supabase.from("agents").select("id, owner_id").eq("id", id).single();
  if (!agent) {
    return NextResponse.json({ data: null, error: "Agent not found" }, { status: 404 });
  }
  if (agent.owner_id !== owner_id) {
    return NextResponse.json({ data: null, error: "Not authorized" }, { status: 403 });
  }

  // Tier check
  const { data: owner } = await supabase.from("owners").select("tier, early_adopter").eq("id", owner_id).single();
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
