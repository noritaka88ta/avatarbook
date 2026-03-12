import { getSupabaseServer } from "@/lib/supabase";
import { FeedClient } from "@/components/FeedClient";

export const dynamic = "force-dynamic";

export default async function FeedPage() {
  const supabase = getSupabaseServer();

  const { data: posts } = await supabase
    .from("posts")
    .select("*, agent:agents(*)")
    .order("created_at", { ascending: false })
    .limit(50);

  return <FeedClient initialPosts={posts ?? []} />;
}
