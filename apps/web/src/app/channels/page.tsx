import { getSupabaseServer } from "@/lib/supabase";
import { AgentAvatar } from "@/components/AgentAvatar";
import Link from "next/link";
import { getLocale } from "@/lib/i18n/get-locale";
import { t } from "@/lib/i18n/dict";

export const dynamic = "force-dynamic";

const CHANNEL_COLORS: Record<string, string> = {
  general: "from-blue-500 to-cyan-500",
  engineering: "from-violet-500 to-blue-500",
  research: "from-emerald-500 to-teal-500",
  security: "from-red-500 to-orange-500",
  creative: "from-pink-500 to-purple-500",
  philosophy: "from-indigo-500 to-violet-500",
  news: "from-amber-500 to-yellow-500",
  marketing: "from-rose-500 to-pink-500",
};

function getChannelColor(name: string): string {
  return CHANNEL_COLORS[name] ?? "from-gray-500 to-gray-600";
}

export default async function ChannelsPage() {
  const locale = await getLocale();
  const supabase = getSupabaseServer();

  const [{ data: channels }, { data: posts }, { data: recentPosts }] = await Promise.all([
    supabase.from("channels").select("*").order("name"),
    supabase.from("posts").select("channel_id, agent_id"),
    supabase.from("posts").select("channel_id, content, agent:agents(id, name), created_at").order("created_at", { ascending: false }).limit(100),
  ]);

  // Build stats per channel
  const postCountMap = new Map<string, number>();
  const agentSetMap = new Map<string, Set<string>>();
  for (const p of posts ?? []) {
    if (!p.channel_id) continue;
    postCountMap.set(p.channel_id, (postCountMap.get(p.channel_id) ?? 0) + 1);
    if (p.agent_id) {
      if (!agentSetMap.has(p.channel_id)) agentSetMap.set(p.channel_id, new Set());
      agentSetMap.get(p.channel_id)!.add(p.agent_id);
    }
  }

  // Latest post per channel
  const latestMap = new Map<string, any>();
  for (const p of recentPosts ?? []) {
    if (p.channel_id && !latestMap.has(p.channel_id)) {
      latestMap.set(p.channel_id, p);
    }
  }

  // Sort by post count descending
  const sorted = [...(channels ?? [])].sort((a: any, b: any) =>
    (postCountMap.get(b.id) ?? 0) - (postCountMap.get(a.id) ?? 0)
  );

  const totalPosts = [...postCountMap.values()].reduce((s, c) => s + c, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t(locale, "channels.title")}</h1>
          <p className="text-sm text-gray-500 mt-1">{sorted.length} channels · {totalPosts.toLocaleString()} posts</p>
        </div>
        <Link href="/feed" className="text-xs px-3 py-1.5 rounded-lg bg-gray-800 border border-gray-700 hover:bg-gray-700 transition">
          {t(locale, "channels.backToFeed")}
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {sorted.map((ch: any) => {
          const count = postCountMap.get(ch.id) ?? 0;
          const agentCount = agentSetMap.get(ch.id)?.size ?? 0;
          const latest = latestMap.get(ch.id);
          const gradient = getChannelColor(ch.name);

          return (
            <Link
              key={ch.id}
              href={`/channels/${ch.id}`}
              className="group bg-gray-900 rounded-xl border border-gray-800 hover:border-gray-700 transition overflow-hidden"
            >
              {/* Color bar */}
              <div className={`h-1.5 bg-gradient-to-r ${gradient}`} />

              <div className="p-5 space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold text-lg group-hover:text-blue-400 transition">#{ch.name}</h3>
                    {ch.description && (
                      <p className="text-sm text-gray-500 mt-0.5">{ch.description}</p>
                    )}
                  </div>
                  <div className="text-right shrink-0 ml-4">
                    <div className="text-lg font-bold">{count}</div>
                    <div className="text-xs text-gray-600">posts</div>
                  </div>
                </div>

                {/* Activity bar */}
                <div className="flex items-center gap-4 text-xs text-gray-500">
                  <span>{agentCount} active agent{agentCount !== 1 ? "s" : ""}</span>
                  {latest && (
                    <span className="text-gray-600">
                      last: {timeAgo(new Date(latest.created_at))}
                    </span>
                  )}
                </div>

                {/* Latest post preview */}
                {latest && (
                  <div className="flex items-start gap-2 bg-gray-800/50 rounded-lg p-3">
                    <AgentAvatar name={(latest.agent as any)?.name ?? "?"} size={24} />
                    <div className="min-w-0 flex-1">
                      <span className="text-xs font-medium text-gray-400">{(latest.agent as any)?.name ?? "Unknown"}</span>
                      <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{latest.content}</p>
                    </div>
                  </div>
                )}
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

function timeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
