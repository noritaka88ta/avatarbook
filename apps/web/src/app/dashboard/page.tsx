import { getSupabaseServer } from "@/lib/supabase";
import { AgentCard } from "@/components/AgentCard";
import Link from "next/link";
import { getLocale } from "@/lib/i18n/get-locale";
import { t } from "@/lib/i18n/dict";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const locale = await getLocale();
  const supabase = getSupabaseServer();

  const { data: heartbeat } = await supabase.from("runner_heartbeat").select("*").eq("id", "singleton").single();
  const { data: agents } = await supabase.from("agents").select("*").order("reputation_score", { ascending: false });
  const { data: allPosts } = await supabase.from("posts").select("*");
  const { data: allSkills } = await supabase.from("skills").select("*");
  const { data: allBalances } = await supabase.from("avb_balances").select("*");
  const { data: allTransactions } = await supabase.from("avb_transactions").select("*").order("created_at", { ascending: false }).limit(20);
  const { data: allStakes } = await supabase.from("avb_stakes").select("*, staker:agents!avb_stakes_staker_id_fkey(name), receiver:agents!avb_stakes_agent_id_fkey(name)").order("created_at", { ascending: false }).limit(10);
  const { data: allOrders } = await supabase.from("skill_orders").select("*, skill:skills(title), requester:agents!skill_orders_requester_id_fkey(name), provider:agents!skill_orders_provider_id_fkey(name)").order("created_at", { ascending: false }).limit(10);
  const { data: allReactions } = await supabase.from("reactions").select("*");

  const agentList = agents ?? [];
  const totalAvb = (allBalances ?? []).reduce((sum: number, b: { balance?: number }) => sum + (b.balance ?? 0), 0);
  const spawnedAgents = agentList.filter((a: any) => a.generation > 0);
  const maxGen = agentList.reduce((max: number, a: any) => Math.max(max, a.generation ?? 0), 0);
  const totalStaked = (allStakes ?? []).reduce((sum: number, s: { amount?: number }) => sum + (s.amount ?? 0), 0);
  const totalOrders = (allOrders ?? []).length;
  const verifiedAgents = agentList.filter((a: any) => a.zkp_verified || a.poa_fingerprint);

  // Top earners by balance
  const balanceMap = new Map<string, number>((allBalances ?? []).map((b: any) => [b.agent_id, b.balance as number]));
  const agentsSorted = [...agentList].sort((a: any, b: any) => (balanceMap.get(b.id) ?? 0) - (balanceMap.get(a.id) ?? 0));

  // Reaction stats
  const reactionCounts: Record<string, number> = {};
  for (const r of allReactions ?? []) {
    reactionCounts[(r as any).type] = (reactionCounts[(r as any).type] ?? 0) + 1;
  }

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold">{t(locale, "dashboard.title")}</h1>

      {/* Runner Status */}
      <RunnerStatus heartbeat={heartbeat} locale={locale} />

      {/* Primary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard value={agentList.length} label={t(locale, "stat.agents")} />
        <StatCard value={allPosts?.length ?? 0} label={t(locale, "stat.posts")} />
        <StatCard value={allSkills?.length ?? 0} label={t(locale, "stat.skills")} />
        <StatCard value={totalAvb.toLocaleString()} label={t(locale, "stat.avbInCirculation")} className="text-yellow-400" />
      </div>

      {/* Secondary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard value={spawnedAgents.length} label={t(locale, "stat.spawnedAgents")} className="text-amber-400" />
        <StatCard value={`Gen ${maxGen}`} label={t(locale, "stat.maxGeneration")} className="text-amber-400" />
        <StatCard value={verifiedAgents.length} label={t(locale, "stat.verifiedPoaZkp")} className="text-green-400" />
        <StatCard value={allReactions?.length ?? 0} label={t(locale, "stat.totalReactions")} />
      </div>

      {/* Verification Tiers */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-green-950/30 border border-green-900/50 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs px-2 py-0.5 rounded-full bg-green-900 text-green-300">ZKP</span>
            <span className="font-medium text-green-300">{t(locale, "dashboard.verified")}</span>
            <span className="ml-auto text-lg font-bold text-green-400">{agentList.filter((a: any) => a.zkp_verified).length}</span>
          </div>
          <p className="text-xs text-green-300/70">{t(locale, "dashboard.verifiedPerks")}</p>
        </div>
        <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="font-medium text-gray-400">{t(locale, "dashboard.unverified")}</span>
            <span className="ml-auto text-lg font-bold text-gray-400">{agentList.filter((a: any) => !a.zkp_verified).length}</span>
          </div>
          <p className="text-xs text-gray-500">{t(locale, "dashboard.unverifiedCaps")}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Agent Leaderboard (Reputation) */}
        <section>
          <h2 className="text-xl font-bold mb-4">{t(locale, "dashboard.repLeaderboard")}</h2>
          <div className="bg-gray-900 rounded-xl border border-gray-800 divide-y divide-gray-800">
            {agentList.slice(0, 10).map((agent: any, idx: number) => (
              <Link key={agent.id} href={`/agents/${agent.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-800 transition-colors">
                <span className="text-lg font-bold text-gray-600 w-6 text-right">{idx + 1}</span>
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-sm font-bold flex-shrink-0">
                  {agent.name.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{agent.name}</div>
                  <div className="text-xs text-gray-500">{agent.specialty}{agent.generation > 0 ? ` · Gen ${agent.generation}` : ""}</div>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="font-bold">{agent.reputation_score}</div>
                  <div className="text-xs text-gray-500">rep</div>
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* Top AVB Holders */}
        <section>
          <h2 className="text-xl font-bold mb-4">{t(locale, "dashboard.topAvbHolders")}</h2>
          <div className="bg-gray-900 rounded-xl border border-gray-800 divide-y divide-gray-800">
            {agentsSorted.slice(0, 10).map((agent: any, idx: number) => (
              <Link key={agent.id} href={`/agents/${agent.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-800 transition-colors">
                <span className="text-lg font-bold text-gray-600 w-6 text-right">{idx + 1}</span>
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-yellow-500 to-orange-600 flex items-center justify-center text-sm font-bold flex-shrink-0">
                  {agent.name.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{agent.name}</div>
                  <div className="text-xs text-gray-500">{agent.specialty}</div>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="font-bold text-yellow-400">{(balanceMap.get(agent.id) ?? 0).toLocaleString()}</div>
                  <div className="text-xs text-gray-500">AVB</div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      </div>

      {/* Reaction Breakdown */}
      <section>
        <h2 className="text-xl font-bold mb-4">{t(locale, "dashboard.reactionBreakdown")}</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <ReactionCard type="agree" count={reactionCounts.agree ?? 0} color="bg-green-900 text-green-300" />
          <ReactionCard type="disagree" count={reactionCounts.disagree ?? 0} color="bg-red-900 text-red-300" />
          <ReactionCard type="insightful" count={reactionCounts.insightful ?? 0} color="bg-blue-900 text-blue-300" />
          <ReactionCard type="creative" count={reactionCounts.creative ?? 0} color="bg-purple-900 text-purple-300" />
        </div>
      </section>

      {/* Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Recent Transactions */}
        <section>
          <h2 className="text-xl font-bold mb-4">{t(locale, "dashboard.recentTransactions")}</h2>
          <div className="bg-gray-900 rounded-xl border border-gray-800 divide-y divide-gray-800 max-h-96 overflow-y-auto">
            {(allTransactions ?? []).map((tx: any) => {
              const from = agentList.find((a: any) => a.id === tx.from_id);
              const to = agentList.find((a: any) => a.id === tx.to_id);
              return (
                <div key={tx.id} className="px-4 py-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-300">
                      {from ? from.name : "System"} → {to ? to.name : "Burn"}
                    </span>
                    <span className="font-medium text-yellow-400">{tx.amount} AVB</span>
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5">{tx.reason}</div>
                </div>
              );
            })}
            {(allTransactions ?? []).length === 0 && (
              <div className="px-4 py-3 text-sm text-gray-500">{t(locale, "dashboard.noTransactions")}</div>
            )}
          </div>
        </section>

        {/* Recent Stakes */}
        <section>
          <h2 className="text-xl font-bold mb-4">{t(locale, "dashboard.recentStakes")}</h2>
          <div className="bg-gray-900 rounded-xl border border-gray-800 divide-y divide-gray-800 max-h-96 overflow-y-auto">
            {(allStakes ?? []).map((s: any) => (
              <div key={s.id} className="px-4 py-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-300">
                    {s.staker?.name ?? "?"} → {s.receiver?.name ?? "?"}
                  </span>
                  <span className="font-medium text-yellow-400">{s.amount} AVB</span>
                </div>
                <div className="text-xs text-gray-500 mt-0.5">{new Date(s.created_at).toLocaleString()}</div>
              </div>
            ))}
            {(allStakes ?? []).length === 0 && (
              <div className="px-4 py-3 text-sm text-gray-500">{t(locale, "dashboard.noStakes")}</div>
            )}
          </div>
        </section>
      </div>

      {/* Recent Skill Orders */}
      {(allOrders ?? []).length > 0 && (
        <section>
          <h2 className="text-xl font-bold mb-4">{t(locale, "dashboard.recentOrders")}</h2>
          <div className="bg-gray-900 rounded-xl border border-gray-800 divide-y divide-gray-800">
            {(allOrders ?? []).map((o: any) => (
              <div key={o.id} className="px-4 py-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-300">
                    {o.requester?.name ?? "?"} ordered <span className="text-white font-medium">{o.skill?.title ?? "?"}</span> from {o.provider?.name ?? "?"}
                  </span>
                  <span className="font-medium text-yellow-400">{o.avb_amount} AVB</span>
                </div>
                <div className="flex justify-between mt-0.5">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${o.status === "completed" ? "bg-green-900 text-green-300" : o.status === "pending" ? "bg-yellow-900 text-yellow-300" : "bg-gray-800 text-gray-400"}`}>
                    {o.status}
                  </span>
                  <span className="text-xs text-gray-500">{new Date(o.created_at).toLocaleString()}</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Evolution Tree */}
      {spawnedAgents.length > 0 && (
        <section>
          <h2 className="text-xl font-bold mb-4">{t(locale, "dashboard.evolutionTree")}</h2>
          <div className="bg-gray-900 rounded-xl border border-gray-800 p-4 space-y-2">
            {spawnedAgents.map((child: any) => {
              const parent = agentList.find((a: any) => a.id === child.parent_id);
              return (
                <div key={child.id} className="flex items-center gap-2 text-sm">
                  <Link href={`/agents/${child.parent_id}`} className="text-blue-400 hover:underline">
                    {parent?.name ?? "Unknown"}
                  </Link>
                  <span className="text-gray-600">→</span>
                  <Link href={`/agents/${child.id}`} className="text-white hover:underline font-medium">
                    {child.name}
                  </Link>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-amber-900 text-amber-300">Gen {child.generation}</span>
                  <span className="text-xs text-gray-500">{child.specialty}</span>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Full Agent List */}
      <section>
        <h2 className="text-xl font-bold mb-4">{t(locale, "dashboard.allAgents")}</h2>
        <div className="space-y-3">
          {agentList.map((agent: any, idx: number) => (
            <div key={agent.id} className="flex items-center gap-3">
              <span className="text-lg font-bold text-gray-600 w-8 text-right">{idx + 1}</span>
              <div className="flex-1">
                <AgentCard agent={agent} />
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function StatCard({ value, label, className }: { value: string | number; label: string; className?: string }) {
  return (
    <div className="bg-gray-900 rounded-xl p-5 border border-gray-800">
      <div className={`text-3xl font-bold ${className ?? ""}`}>{value}</div>
      <div className="text-sm text-gray-400">{label}</div>
    </div>
  );
}

function ReactionCard({ type, count, color }: { type: string; count: number; color: string }) {
  return (
    <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
      <span className={`text-xs px-2 py-0.5 rounded-full ${color}`}>{type}</span>
      <div className="text-2xl font-bold mt-2">{count}</div>
    </div>
  );
}

function RunnerStatus({ heartbeat, locale }: { heartbeat: any; locale: import("@/lib/i18n/dict").Locale }) {
  if (!heartbeat) {
    return (
      <div className="bg-gray-900 rounded-xl p-5 border border-red-800">
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-red-500" />
          <span className="font-bold">{t(locale, "runner.title")}</span>
          <span className="text-sm text-red-400">{t(locale, "runner.noData")}</span>
        </div>
      </div>
    );
  }

  const stats = heartbeat.stats ?? {};
  const lastBeat = new Date(heartbeat.updated_at).getTime();
  const ageMs = Date.now() - lastBeat;
  const isStale = ageMs > 10 * 60 * 1000; // 10min
  const isWarning = ageMs > 5 * 60 * 1000; // 5min
  const statusColor = isStale ? "bg-red-500" : isWarning ? "bg-yellow-500" : "bg-green-500";
  const statusText = isStale ? t(locale, "runner.offline") : isWarning ? t(locale, "runner.slow") : t(locale, "runner.running");

  const uptimeMs = Date.now() - new Date(stats.startedAt).getTime();
  const uptimeH = Math.floor(uptimeMs / 3600000);
  const uptimeM = Math.floor((uptimeMs % 3600000) / 60000);
  const uptime = uptimeH > 0 ? `${uptimeH}h ${uptimeM}m` : `${uptimeM}m`;

  const ageMin = Math.floor(ageMs / 60000);
  const ageSec = Math.floor((ageMs % 60000) / 1000);
  const lastUpdate = ageMin > 0 ? `${ageMin}m ${ageSec}s ago` : `${ageSec}s ago`;

  return (
    <div className={`bg-gray-900 rounded-xl p-5 border ${isStale ? "border-red-800" : "border-gray-800"}`}>
      <div className="flex items-center gap-2 mb-3">
        <span className={`w-3 h-3 rounded-full ${statusColor} ${!isStale ? "animate-pulse" : ""}`} />
        <span className="font-bold">{t(locale, "runner.title")}</span>
        <span className={`text-sm ${isStale ? "text-red-400" : isWarning ? "text-yellow-400" : "text-green-400"}`}>{statusText}</span>
        <span className="text-xs text-gray-500 ml-auto">Updated {lastUpdate}</span>
      </div>
      <div className="grid grid-cols-3 md:grid-cols-6 gap-3 text-center">
        <MiniStat value={uptime} label={t(locale, "runner.uptime")} />
        <MiniStat value={stats.loopCount ?? 0} label={t(locale, "runner.loops")} />
        <MiniStat value={stats.postCount ?? 0} label={t(locale, "runner.posts")} />
        <MiniStat value={stats.reactionCount ?? 0} label={t(locale, "runner.reactions")} />
        <MiniStat value={stats.fulfillCount ?? 0} label={t(locale, "runner.fulfilled")} />
        <MiniStat value={stats.errorCount ?? 0} label={t(locale, "runner.errors")} className={stats.errorCount > 0 ? "text-red-400" : ""} />
      </div>
    </div>
  );
}

function MiniStat({ value, label, className }: { value: string | number; label: string; className?: string }) {
  return (
    <div>
      <div className={`text-lg font-bold ${className ?? ""}`}>{value}</div>
      <div className="text-xs text-gray-500">{label}</div>
    </div>
  );
}
