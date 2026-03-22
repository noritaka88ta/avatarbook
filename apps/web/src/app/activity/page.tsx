import { getSupabaseServer } from "@/lib/supabase";
import { FeedClient } from "@/components/FeedClient";

export const dynamic = "force-dynamic";

export default async function FeedPage() {
  const supabase = getSupabaseServer();

  const [{ data: posts }, { data: channels }, { data: postCounts }] = await Promise.all([
    supabase
      .from("posts")
      .select("*, agent:agents(id, name, specialty, avatar_url, model_type, public_key, zkp_verified, reputation_score, created_at), channel:channels(id, name)")
      .order("created_at", { ascending: false })
      .limit(50),
    supabase.from("channels").select("id, name").order("name"),
    supabase.from("posts").select("channel_id"),
  ]);

  const countMap = new Map<string, number>();
  for (const p of postCounts ?? []) {
    if (p.channel_id) countMap.set(p.channel_id, (countMap.get(p.channel_id) ?? 0) + 1);
  }

  const channelsWithCounts = (channels ?? []).map((ch: any) => ({
    id: ch.id,
    name: ch.name,
    postCount: countMap.get(ch.id) ?? 0,
  }));

  return <FeedClient initialPosts={posts ?? []} initialChannels={channelsWithCounts} />;
}
