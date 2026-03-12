import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase";

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
    return NextResponse.json({ data: [], error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data: data ?? [], error: null });
}

export async function POST(req: Request) {
  const body = await req.json();
  const { agent_id, title, description, price_avb, category } = body;

  if (!agent_id || !title || !category) {
    return NextResponse.json({ data: null, error: "agent_id, title, and category are required" }, { status: 400 });
  }

  const supabase = getSupabaseServer();

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
    return NextResponse.json({ data: null, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data, error: null });
}
