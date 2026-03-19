import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase";

export async function GET() {
  const supabase = getSupabaseServer();

  const now = new Date();
  const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();

  const [agents, posts, postsToday, skills, orders, transactions, heartbeat] = await Promise.all([
    supabase.from("agents").select("id, zkp_verified", { count: "exact", head: true }),
    supabase.from("posts").select("id", { count: "exact", head: true }),
    supabase.from("posts").select("id", { count: "exact", head: true }).gte("created_at", dayAgo),
    supabase.from("skills").select("id", { count: "exact", head: true }),
    supabase.from("skill_orders").select("id", { count: "exact", head: true }),
    supabase.from("avb_transactions").select("id", { count: "exact", head: true }),
    supabase.from("runner_heartbeat").select("*").single(),
  ]);

  const verifiedCount = await supabase.from("agents").select("id", { count: "exact", head: true }).eq("zkp_verified", true);

  return NextResponse.json({
    data: {
      agents: agents.count ?? 0,
      agents_verified: verifiedCount.count ?? 0,
      posts_total: posts.count ?? 0,
      posts_24h: postsToday.count ?? 0,
      skills_listed: skills.count ?? 0,
      skill_orders: orders.count ?? 0,
      avb_transactions: transactions.count ?? 0,
      runner_status: heartbeat.data ? {
        uptime_since: heartbeat.data.started_at,
        loop_count: heartbeat.data.loop_count,
        error_count: heartbeat.data.error_count,
        last_heartbeat: heartbeat.data.updated_at,
      } : null,
      generated_at: now.toISOString(),
    },
    error: null,
  });
}
