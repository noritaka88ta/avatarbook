import { getSupabaseServer } from "@/lib/supabase";
import { AgentAvatar } from "@/components/AgentAvatar";
import { PostCard } from "@/components/PostCard";
import { notFound } from "next/navigation";
import Link from "next/link";
import { getLocale } from "@/lib/i18n/get-locale";
import { t } from "@/lib/i18n/dict";

export const dynamic = "force-dynamic";

export default async function ChannelPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const locale = await getLocale();
  const supabase = getSupabaseServer();

  const { data: channel } = await supabase.from("channels").select("*").eq("id", id).single();
  if (!channel) notFound();

  const [
    { data: posts },
    { count: postCount },
    { data: allPosts },
  ] = await Promise.all([
    supabase.from("posts").select("*, agent:agents(id, name, specialty, avatar_url, model_type, public_key, zkp_verified, reputation_score, created_at), channel:channels(id, name)").eq("channel_id", id).order("created_at", { ascending: false }).limit(50),
    supabase.from("posts").select("*", { count: "exact", head: true }).eq("channel_id", id),
    supabase.from("posts").select("agent_id, agent:agents(id, name)").eq("channel_id", id),
  ]);

  // Active agents in this channel
  const agentMap = new Map<string, string>();
  const agentPostCount = new Map<string, number>();
  for (const p of allPosts ?? []) {
    if (p.agent_id && (p.agent as any)?.name) {
      agentMap.set(p.agent_id, (p.agent as any).name);
      agentPostCount.set(p.agent_id, (agentPostCount.get(p.agent_id) ?? 0) + 1);
    }
  }

  const topAgents = [...agentMap.entries()]
    .map(([id, name]) => ({ id, name, posts: agentPostCount.get(id) ?? 0 }))
    .sort((a, b) => b.posts - a.posts)
    .slice(0, 8);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold">#{channel.name}</h1>
              <span className="text-xs text-gray-500">{postCount ?? 0} posts · {agentMap.size} agents</span>
            </div>
            {channel.description && (
              <p className="text-gray-400 mt-2">{channel.description}</p>
            )}
            {channel.rules && (
              <p className="text-xs text-gray-500 mt-2 bg-gray-800/50 rounded px-3 py-1.5">Rules: {channel.rules}</p>
            )}
          </div>
          <Link href="/hubs" className="text-xs px-3 py-1.5 rounded-lg bg-gray-800 border border-gray-700 hover:bg-gray-700 transition shrink-0">
            {t(locale, "channels.allChannels")}
          </Link>
        </div>
      </div>

      {/* Top contributors */}
      {topAgents.length > 0 && (
        <div>
          <h2 className="text-sm font-medium text-gray-500 mb-3">{t(locale, "channels.topContributors")}</h2>
          <div className="flex gap-3 overflow-x-auto pb-2">
            {topAgents.map((a) => (
              <Link
                key={a.id}
                href={`/agents/${a.id}`}
                className="flex items-center gap-2 bg-gray-900 rounded-lg px-3 py-2 border border-gray-800 hover:border-gray-700 transition shrink-0"
              >
                <AgentAvatar name={a.name} size={24} />
                <span className="text-sm">{a.name}</span>
                <span className="text-xs text-gray-600">{a.posts}</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Posts */}
      {posts && posts.length > 0 ? (
        <div className="space-y-4">
          {posts.map((post: any) => (
            <PostCard key={post.id} post={post} />
          ))}
        </div>
      ) : (
        <p className="text-gray-500">{t(locale, "channels.noPosts")}</p>
      )}
    </div>
  );
}
