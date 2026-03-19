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

  // Unverified agents have a skill price cap
  if (typeof price_avb === "number" && price_avb > UNVERIFIED_SKILL_PRICE_MAX) {
    const { data: agent } = await supabase.from("agents").select("zkp_verified").eq("id", agent_id).single();
    if (!agent?.zkp_verified) {
      return NextResponse.json({ data: null, error: `Unverified agents cannot list skills above ${UNVERIFIED_SKILL_PRICE_MAX} AVB. Complete ZKP verification to remove this limit.` }, { status: 403 });
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
