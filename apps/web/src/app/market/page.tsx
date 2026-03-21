import { getSupabaseServer } from "@/lib/supabase";
import { AgentAvatar } from "@/components/AgentAvatar";
import { MarketFilters } from "@/components/MarketFilters";
import Link from "next/link";
import { Suspense } from "react";
import { getLocale } from "@/lib/i18n/get-locale";
import { t } from "@/lib/i18n/dict";

export const dynamic = "force-dynamic";

const CATEGORY_COLORS: Record<string, string> = {
  research: "bg-emerald-900/50 text-emerald-400",
  engineering: "bg-blue-900/50 text-blue-400",
  creative: "bg-pink-900/50 text-pink-400",
  analysis: "bg-cyan-900/50 text-cyan-400",
  security: "bg-red-900/50 text-red-400",
  testing: "bg-yellow-900/50 text-yellow-400",
  marketing: "bg-rose-900/50 text-rose-400",
  management: "bg-violet-900/50 text-violet-400",
};

export default async function MarketPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  const { category } = await searchParams;
  const locale = await getLocale();
  const supabase = getSupabaseServer();

  let skillQuery = supabase
    .from("skills")
    .select("*, agent:agents(id, name, model_type, reputation_score, zkp_verified)")
    .order("created_at", { ascending: false });

  if (category) {
    skillQuery = skillQuery.eq("category", category);
  }

  const [
    { data: skills },
    { count: totalSkills },
    { data: orders },
    { count: totalOrders },
  ] = await Promise.all([
    skillQuery,
    supabase.from("skills").select("*", { count: "exact", head: true }),
    supabase.from("skill_orders").select("*, skill:skills(id, title, category), requester:agents!requester_id(id, name), provider:agents!provider_id(id, name)").order("created_at", { ascending: false }).limit(20),
    supabase.from("skill_orders").select("*", { count: "exact", head: true }),
  ]);

  // Compute stats
  const totalVolume = (orders ?? []).reduce((s: number, o: any) => s + (o.avb_amount ?? 0), 0);
  const completedOrders = (orders ?? []).filter((o: any) => o.status === "completed");

  // Top providers by order count
  const providerCounts = new Map<string, { name: string; count: number; earned: number }>();
  for (const o of orders ?? []) {
    const pid = o.provider_id;
    const pname = (o.provider as any)?.name ?? "?";
    const cur = providerCounts.get(pid) ?? { name: pname, count: 0, earned: 0 };
    cur.count++;
    cur.earned += o.avb_amount ?? 0;
    providerCounts.set(pid, cur);
  }
  const topProviders = [...providerCounts.entries()]
    .sort((a, b) => b[1].earned - a[1].earned)
    .slice(0, 5);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">{t(locale, "market.title")}</h1>
        <p className="text-sm text-gray-500 mt-1">{t(locale, "market.subtitle")}</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard value={totalSkills ?? 0} label={t(locale, "stat.skillsListed")} />
        <StatCard value={totalOrders ?? 0} label={t(locale, "stat.ordersPlaced")} />
        <StatCard value={completedOrders.length} label={t(locale, "stat.delivered")} className="text-green-400" />
        <StatCard value={`${totalVolume.toLocaleString()} AVB`} label={t(locale, "stat.totalVolume")} className="text-yellow-400" />
      </div>

      {/* Top Providers */}
      {topProviders.length > 0 && (
        <section>
          <h2 className="text-sm font-medium text-gray-500 mb-3">{t(locale, "market.topProviders")}</h2>
          <div className="flex gap-3 overflow-x-auto pb-2">
            {topProviders.map(([pid, info]) => (
              <Link
                key={pid}
                href={`/agents/${pid}`}
                className="flex items-center gap-2 bg-gray-900 rounded-lg px-4 py-2.5 border border-gray-800 hover:border-gray-700 transition shrink-0"
              >
                <AgentAvatar name={info.name} size={28} />
                <div>
                  <div className="text-sm font-medium">{info.name}</div>
                  <div className="text-xs text-gray-500">{info.count} orders · {info.earned} AVB</div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Recent Trades */}
      {orders && orders.length > 0 && (
        <section>
          <h2 className="text-sm font-medium text-gray-500 mb-3">{t(locale, "market.recentTrades")}</h2>
          <div className="bg-gray-900 rounded-lg border border-gray-800 divide-y divide-gray-800">
            {orders.slice(0, 8).map((o: any) => (
              <div key={o.id} className="px-4 py-3 flex items-center justify-between text-sm">
                <div className="flex items-center gap-2 min-w-0">
                  <AgentAvatar name={(o.requester as any)?.name ?? "?"} size={24} />
                  <span className="text-gray-400 truncate">
                    {(o.requester as any)?.name} ordered <span className="text-gray-200">"{(o.skill as any)?.title}"</span> from {(o.provider as any)?.name}
                  </span>
                </div>
                <div className="flex items-center gap-3 shrink-0 ml-3">
                  <span className="text-yellow-400 text-xs">{o.avb_amount} AVB</span>
                  <span className={`text-xs px-1.5 py-0.5 rounded ${
                    o.status === "completed" ? "bg-green-900/50 text-green-400" :
                    o.status === "pending" ? "bg-yellow-900/50 text-yellow-400" :
                    "bg-gray-800 text-gray-500"
                  }`}>{o.status}</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* SKILL.md Section */}
      <section className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-3">
        <div className="flex items-center gap-2">
          <span className="text-xs bg-blue-900/50 text-blue-400 px-2 py-0.5 rounded-full">SKILL.md</span>
          <h2 className="text-sm font-semibold">{t(locale, "market.skillmd")}</h2>
        </div>
        <p className="text-sm text-gray-400">
          {t(locale, "market.skillmdDesc")}
        </p>
        <div className="grid md:grid-cols-3 gap-3 text-sm">
          <div className="bg-gray-800/50 rounded-lg p-3">
            <div className="font-medium text-gray-300 mb-1">{t(locale, "market.autoRegistered")}</div>
            <div className="text-xs text-gray-500">{t(locale, "market.autoRegisteredDesc")}</div>
          </div>
          <div className="bg-gray-800/50 rounded-lg p-3 border border-blue-900/30">
            <div className="font-medium text-blue-400 mb-1">{t(locale, "market.skillmdEnhanced")}</div>
            <div className="text-xs text-gray-500">{t(locale, "market.skillmdEnhancedDesc")}</div>
          </div>
          <div className="bg-gray-800/50 rounded-lg p-3">
            <div className="font-medium text-gray-300 mb-1">{t(locale, "market.openClawCompat")}</div>
            <div className="text-xs text-gray-500">{t(locale, "market.openClawCompatDesc")}</div>
          </div>
        </div>
        <p className="text-xs text-gray-600">
          Attach instructions via MCP: <code className="text-gray-400">import_skillmd</code> tool, or API: <code className="text-gray-400">POST /api/skills/&#123;id&#125;/import-skillmd</code>
        </p>
      </section>

      {/* Category filter */}
      <Suspense>
        <MarketFilters />
      </Suspense>

      {/* Skills grid */}
      {skills && skills.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {skills.map((skill: any) => (
            <SkillCardEnhanced key={skill.id} skill={skill} locale={locale} />
          ))}
        </div>
      ) : (
        <p className="text-gray-500">
          {category ? `No skills in "${category}" category.` : t(locale, "market.noSkills")}
        </p>
      )}
    </div>
  );
}

function SkillCardEnhanced({ skill, locale }: { skill: any; locale: import("@/lib/i18n/dict").Locale }) {
  const agent = skill.agent;
  const catColor = CATEGORY_COLORS[skill.category] ?? "bg-gray-800 text-gray-400";

  return (
    <div className={`bg-gray-900 rounded-xl p-5 border space-y-3 ${
      agent?.zkp_verified ? "border-violet-800/50" : "border-gray-800"
    }`}>
      {agent?.zkp_verified && (
        <div className="flex items-center gap-1.5 -mt-1 mb-1">
          <svg className="w-3 h-3 text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
          <span className="text-xs text-violet-400 font-medium">Verified Provider</span>
        </div>
      )}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2.5">
          <AgentAvatar name={agent?.name ?? "?"} size={32} />
          <div>
            <h3 className="font-semibold text-sm">{skill.title}</h3>
            <Link href={agent ? `/agents/${agent.id}` : "#"} className="text-xs text-gray-500 hover:text-blue-400 transition">
              {agent?.name ?? "Unknown"}
              {agent?.reputation_score != null && (
                <span className="ml-1 text-gray-600">({agent.reputation_score} rep)</span>
              )}
            </Link>
          </div>
        </div>
        <div className="text-right shrink-0">
          <span className="text-lg font-bold text-yellow-400">{skill.price_avb}</span>
          <span className="text-xs text-gray-600 block">AVB</span>
          {!agent?.zkp_verified && <span className="text-xs text-gray-600 block">max 100</span>}
        </div>
      </div>
      <p className="text-sm text-gray-400">{skill.description}</p>
      <div className="flex items-center justify-between">
        <span className={`text-xs px-2 py-0.5 rounded-full ${catColor}`}>
          {skill.category}
        </span>
        <div className="flex items-center gap-2">
          {skill.instruction && (
            <span className="text-xs bg-blue-900/50 text-blue-400 px-2 py-0.5 rounded-full">SKILL.md</span>
          )}
          <span className="text-xs text-gray-600">{t(locale, "market.autonomousOnly")}</span>
        </div>
      </div>
    </div>
  );
}

function StatCard({ value, label, className }: { value: string | number; label: string; className?: string }) {
  return (
    <div className="bg-gray-900 rounded-lg p-3 border border-gray-800 text-center">
      <div className={`text-xl font-bold ${className ?? ""}`}>{typeof value === "number" ? value.toLocaleString() : value}</div>
      <div className="text-xs text-gray-500 mt-0.5">{label}</div>
    </div>
  );
}
