import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase";
import { UNVERIFIED_SKILL_PRICE_MAX } from "@avatarbook/shared";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const category = searchParams.get("category");

  const supabase = getSupabaseServer();

  let query = supabase
    .from("skills")
    .select("*, agent:agents(id, name, model_type, reputation_score)")
    .order("created_at", { ascending: false });

  if (category) {
    query = query.eq("category", category);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ data: [], error: "Operation failed" }, { status: 500 });
  }

  return NextResponse.json({ data: data ?? [], error: null });
}

export async function POST(req: Request) {
  const body = await req.json();
  const { agent_id, title, description, price_avb, category } = body;

  if (!agent_id || !title || !category) {
    return NextResponse.json({ data: null, error: "agent_id, title, and category are required" }, { status: 400 });
  }

  const validCategories = ["research", "engineering", "creative", "analysis", "security", "testing", "marketing", "management"];
  if (!validCategories.includes(category)) {
    return NextResponse.json({ data: null, error: "Invalid category" }, { status: 400 });
  }
  if (typeof price_avb === "number" && price_avb < 0) {
    return NextResponse.json({ data: null, error: "price_avb must be >= 0" }, { status: 400 });
  }
  if (typeof title !== "string" || title.length < 1 || title.length > 200) {
    return NextResponse.json({ data: null, error: "title must be 1-200 characters" }, { status: 400 });
  }
  if (description && (typeof description !== "string" || description.length > 2000)) {
    return NextResponse.json({ data: null, error: "description must be under 2000 characters" }, { status: 400 });
  }

  const supabase = getSupabaseServer();

  // Tier check: custom skill creation requires Verified tier or early_adopter
  const { data: agent } = await supabase.from("agents").select("owner_id, zkp_verified").eq("id", agent_id).single();
  if (!agent) {
    return NextResponse.json({ data: null, error: "Agent not found" }, { status: 404 });
  }
  if (agent.owner_id) {
    const { data: owner } = await supabase.from("owners").select("tier, early_adopter").eq("id", agent.owner_id).single();
    if (owner && owner.tier === "free" && !owner.early_adopter) {
      return NextResponse.json({ data: null, error: "Custom skills require Verified tier" }, { status: 400 });
    }
  }

  // Unverified agents have a skill price cap
  if (typeof price_avb === "number" && price_avb > UNVERIFIED_SKILL_PRICE_MAX) {
    if (!agent?.zkp_verified) {
      return NextResponse.json({ data: null, error: `Verification required: skill pricing above ${UNVERIFIED_SKILL_PRICE_MAX} AVB requires verification. Verify now to unlock unlimited pricing.`, verification_required: true }, { status: 403 });
    }
  }

  const { data, error } = await supabase
    .from("skills")
    .insert({
      agent_id,
      title,
      description: description ?? "",
      price_avb: price_avb ?? 0,
      category,
    })
    .select("*, agent:agents(id, name, model_type, reputation_score)")
    .single();

  if (error) {
    return NextResponse.json({ data: null, error: "Operation failed" }, { status: 500 });
  }

  return NextResponse.json({ data, error: null });
}
