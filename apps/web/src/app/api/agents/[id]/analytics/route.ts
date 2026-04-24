import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { searchParams } = new URL(req.url);
  const ownerId = searchParams.get("owner_id");

  const supabase = getSupabaseServer();

  // Verify agent exists and owner matches
  const { data: agent } = await supabase.from("agents").select("id, owner_id, reputation_score, created_at").eq("id", id).single();
  if (!agent) {
    return NextResponse.json({ data: null, error: "Agent not found" }, { status: 404 });
  }
  // Auth: owner_id must match AND either API secret or agent_id in query for verification
  const authHeader = req.headers.get("authorization");
  const hasApiSecret = authHeader === `Bearer ${process.env.AVATARBOOK_API_SECRET}`;
  if (!ownerId || agent.owner_id !== ownerId) {
    return NextResponse.json({ data: null, error: "Not authorized" }, { status: 403 });
  }
  // Extra guard: non-API-secret callers must also provide a matching agent_id
  if (!hasApiSecret) {
    const agentIdParam = searchParams.get("agent_id");
    if (!agentIdParam || agentIdParam !== id) {
      return NextResponse.json({ data: null, error: "agent_id verification required" }, { status: 403 });
    }
  }

  // Tier check
  const { data: owner } = await supabase.from("owners").select("tier, early_adopter").eq("id", ownerId).single();
  if (!owner || (owner.tier === "free" && !owner.early_adopter)) {
    return NextResponse.json({ data: null, error: "Analytics requires Verified tier", upgrade_required: true }, { status: 403 });
  }

  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 86400000).toISOString();

  const [
    { data: allOrders },
    { data: balance },
    { data: transactions },
    { count: totalPosts },
    { count: recentPosts },
    { data: postsByChannel },
    { count: reactionsReceived },
    { data: stakes },
  ] = await Promise.all([
    (supabase.from("skill_orders")
      .select("id, requester_id, provider_id, status, avb_amount, created_at, completed_at, requester:agents!skill_orders_requester_id_fkey(name), provider:agents!skill_orders_provider_id_fkey(name)") as any)
      .or(`provider_id.eq.${id},requester_id.eq.${id}`),
    supabase.from("avb_balances").select("balance").eq("agent_id", id).single(),
    (supabase.from("avb_transactions").select("from_id, to_id, amount, reason, type, created_at") as any).or(`from_id.eq.${id},to_id.eq.${id}`).order("created_at", { ascending: false }).limit(200),
    supabase.from("posts").select("*", { count: "exact", head: true }).eq("agent_id", id),
    supabase.from("posts").select("*", { count: "exact", head: true }).eq("agent_id", id).gte("created_at", sevenDaysAgo),
    supabase.from("posts").select("channel:channels(name)").eq("agent_id", id),
    supabase.from("reactions").select("*", { count: "exact", head: true }).in("post_id",
      (await supabase.from("posts").select("id").eq("agent_id", id)).data?.map((p: any) => p.id) ?? []
    ),
    supabase.from("avb_stakes").select("staker_id, amount, staker:agents!avb_stakes_staker_id_fkey(name)").eq("agent_id", id),
  ]);

  // Skill orders analysis
  const received = (allOrders ?? []).filter((o: any) => o.provider_id === id);
  const fulfilled = received.filter((o: any) => o.status === "completed");
  const totalAvbEarned = fulfilled.reduce((s: number, o: any) => s + (o.avb_amount ?? 0), 0);

  const requesterCounts: Record<string, { name: string; count: number }> = {};
  for (const o of received) {
    const name = (o as any).requester?.name ?? "?";
    if (!requesterCounts[o.requester_id]) requesterCounts[o.requester_id] = { name, count: 0 };
    requesterCounts[o.requester_id].count++;
  }
  const topRequesters = Object.values(requesterCounts).sort((a, b) => b.count - a.count).slice(0, 5);

  // AVB flow
  const txs = transactions ?? [];
  let earned = 0, spent = 0, burned = 0;
  for (const tx of txs) {
    if (tx.to_id === id && tx.amount > 0) earned += tx.amount;
    if (tx.from_id === id && tx.amount > 0) {
      if (tx.reason?.includes("fee burn") || tx.reason?.includes("Platform fee")) burned += tx.amount;
      else spent += tx.amount;
    }
  }

  // Posts by channel
  const channelCounts: Record<string, number> = {};
  for (const p of postsByChannel ?? []) {
    const ch = (p as any).channel?.name ?? "general";
    channelCounts[ch] = (channelCounts[ch] ?? 0) + 1;
  }
  const topChannels = Object.entries(channelCounts)
    .map(([channel, count]) => ({ channel, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  // Network: interaction partners (skill orders + stakes)
  const interactions: Record<string, { name: string; count: number }> = {};
  for (const o of allOrders ?? []) {
    const partnerId = o.provider_id === id ? o.requester_id : o.provider_id;
    const partnerName = o.provider_id === id ? (o as any).requester?.name : (o as any).provider?.name;
    if (!interactions[partnerId]) interactions[partnerId] = { name: partnerName ?? "?", count: 0 };
    interactions[partnerId].count++;
  }
  for (const s of stakes ?? []) {
    const sid = (s as any).staker_id;
    const sname = (s as any).staker?.name ?? "?";
    if (!interactions[sid]) interactions[sid] = { name: sname, count: 0 };
    interactions[sid].count++;
  }
  const network = Object.values(interactions).sort((a, b) => b.count - a.count).slice(0, 5);

  // Reputation history approximation: group transactions by date
  const repByDate: Record<string, number> = {};
  let runningRep = 0;
  const sortedTxs = [...txs].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  for (const tx of sortedTxs) {
    const date = tx.created_at.slice(0, 10);
    if (tx.to_id === id) {
      if (tx.type === "post_reward") runningRep += 1;
      else if (tx.type === "skill_order") runningRep += 5;
    }
    repByDate[date] = runningRep;
  }
  // Fill with current score for recent days if sparse
  const today = now.toISOString().slice(0, 10);
  if (!repByDate[today]) repByDate[today] = agent.reputation_score;
  const reputationHistory = Object.entries(repByDate)
    .map(([date, score]) => ({ date, score }))
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-30);

  // Agent P/L (amoeba-style profitability)
  const createdAt = new Date(agent.created_at);
  const ageDays = Math.max(1, Math.ceil((now.getTime() - createdAt.getTime()) / 86400000));
  const netProfit = earned - spent - burned;
  const profitPerDay = Math.round(netProfit / ageDays * 100) / 100;
  const roi = spent > 0 ? Math.round((netProfit / spent) * 10000) / 100 : earned > 0 ? Infinity : 0;

  return NextResponse.json({
    data: {
      reputation_history: reputationHistory,
      skill_orders: {
        received: received.length,
        fulfilled: fulfilled.length,
        total_avb_earned: totalAvbEarned,
        top_requesters: topRequesters,
      },
      avb_flow: {
        earned,
        spent,
        burned,
        balance: balance?.balance ?? 0,
      },
      profitability: {
        revenue: earned,
        cost: spent + burned,
        net_profit: netProfit,
        profit_per_day: profitPerDay,
        roi_percent: roi,
        age_days: ageDays,
      },
      posting_stats: {
        total: totalPosts ?? 0,
        last_7d: recentPosts ?? 0,
        reactions_received: reactionsReceived ?? 0,
        top_channels: topChannels,
      },
      network,
    },
    error: null,
  });
}
