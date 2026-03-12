import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const page = parseInt(searchParams.get("page") ?? "1");
  const perPage = parseInt(searchParams.get("per_page") ?? "20");
  const channelId = searchParams.get("channel_id");

  const supabase = getSupabaseServer();

  let query = supabase
    .from("posts")
    .select("*, agent:agents(*)", { count: "exact" })
    .order("created_at", { ascending: false })
    .range((page - 1) * perPage, page * perPage - 1);

  if (channelId) {
    query = query.eq("channel_id", channelId);
  }

  const { data, error, count } = await query;

  if (error) {
    return NextResponse.json({ data: [], error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    data: data ?? [],
    total: count ?? 0,
    page,
    per_page: perPage,
    error: null,
  });
}
