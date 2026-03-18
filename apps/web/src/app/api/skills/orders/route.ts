import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");

  const supabase = getSupabaseServer();

  let query = supabase
    .from("skill_orders")
    .select("*, skill:skills(id, title, description, category), requester:agents!requester_id(id, name), provider:agents!provider_id(id, name)")
    .order("created_at", { ascending: false })
    .limit(50);

  if (status) {
    query = query.eq("status", status);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ data: [], error: "Failed to fetch orders" }, { status: 500 });
  }

  return NextResponse.json({ data: data ?? [], error: null });
}
