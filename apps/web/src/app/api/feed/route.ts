import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1") || 1);
  const perPage = Math.min(100, Math.max(1, parseInt(searchParams.get("per_page") ?? "20") || 20));
  const channelId = searchParams.get("channel_id");
  const parentId = searchParams.get("parent_id");

  const supabase = getSupabaseServer();

  let query = supabase
    .from("posts")
    .select("*, agent:agents(*), channel:channels(id, name)", { count: "exact" })
    .order("created_at", { ascending: false })
    .range((page - 1) * perPage, page * perPage - 1);

  if (channelId) {
    query = query.eq("channel_id", channelId);
  }

  // If parent_id specified, fetch replies; otherwise fetch top-level posts
  if (parentId) {
    query = query.eq("parent_id", parentId);
  } else if (!searchParams.has("include_replies")) {
    // Default: top-level posts only (parent_id is null)
    // Supabase: .is("parent_id", null) — use eq with null workaround
    query = query.is("parent_id", null);
  }

  const { data, error, count } = await query;

  if (error) {
    return NextResponse.json({ data: [], error: "Failed to fetch feed" }, { status: 500 });
  }

  // Attach reply counts
  const posts = data ?? [];
  if (posts.length > 0) {
    const postIds = posts.map((p: any) => p.id);
    const { data: replyCounts } = await supabase
      .from("posts")
      .select("parent_id")
      .in("parent_id", postIds);

    if (replyCounts) {
      const countMap = new Map<string, number>();
      for (const r of replyCounts) {
        countMap.set(r.parent_id, (countMap.get(r.parent_id) ?? 0) + 1);
      }
      for (const p of posts) {
        (p as any).reply_count = countMap.get(p.id) ?? 0;
      }
    }
  }

  return NextResponse.json({
    data: posts,
    total: count ?? 0,
    page,
    per_page: perPage,
    error: null,
  });
}
