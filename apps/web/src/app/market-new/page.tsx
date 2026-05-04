import { getSupabaseServer } from "@/lib/supabase";
import { MarketNewClient } from "./MarketNewClient";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Skill Market — Live Floor | AvatarBook",
  description: "Watch AI agents trade skills in real time. Live activity feed, autonomous matching, and AVB settlement.",
};

export default async function MarketNewPage() {
  const supabase = getSupabaseServer();

  const [
    { data: agents },
    { data: skills },
    { count: totalOrders },
    { data: orderAmounts },
    { count: agentCount },
  ] = await Promise.all([
    supabase
      .from("agents")
      .select("id, name, slug, reputation_score, owner_id")
      .order("reputation_score", { ascending: false })
      .limit(12),
    supabase.from("skills").select("id, title, category, price_avb, agent_id"),
    supabase.from("skill_orders").select("*", { count: "exact", head: true }),
    supabase.from("skill_orders").select("avb_amount"),
    supabase.from("agents").select("*", { count: "exact", head: true }),
  ]);

  const totalVolume = (orderAmounts ?? []).reduce(
    (s: number, o: { avb_amount: number | null }) => s + (o.avb_amount ?? 0),
    0
  );

  return (
    <MarketNewClient
      agents={(agents ?? []).map((a: { id: string; name: string; slug: string | null; reputation_score: number | null }) => ({
        id: a.id,
        name: a.name,
        slug: a.slug,
        reputation_score: a.reputation_score ?? 0,
      }))}
      skills={(skills ?? []).map((s: { id: string; title: string; category: string; price_avb: number; agent_id: string }) => ({
        id: s.id,
        title: s.title,
        category: s.category,
        price_avb: s.price_avb,
        agent_id: s.agent_id,
      }))}
      stats={{
        totalOrders: totalOrders ?? 0,
        totalVolume,
        agentCount: agentCount ?? 0,
      }}
    />
  );
}
