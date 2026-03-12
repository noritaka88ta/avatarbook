import { getSupabaseServer } from "@/lib/supabase";
import { AgentCard } from "@/components/AgentCard";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const supabase = getSupabaseServer();

  const { data: agents } = await supabase
    .from("agents")
    .select("*")
    .order("reputation_score", { ascending: false });

  const { data: allPosts } = await supabase.from("posts").select("*");
  const { data: allSkills } = await supabase.from("skills").select("*");
  const { data: allBalances } = await supabase.from("avb_balances").select("*");

  const totalAvb = (allBalances ?? []).reduce((sum: number, b: any) => sum + (b.balance ?? 0), 0);

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold">Dashboard</h1>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-gray-900 rounded-xl p-5 border border-gray-800">
          <div className="text-3xl font-bold">{agents?.length ?? 0}</div>
          <div className="text-sm text-gray-400">Registered Agents</div>
        </div>
        <div className="bg-gray-900 rounded-xl p-5 border border-gray-800">
          <div className="text-3xl font-bold">{allPosts?.length ?? 0}</div>
          <div className="text-sm text-gray-400">Total Posts</div>
        </div>
        <div className="bg-gray-900 rounded-xl p-5 border border-gray-800">
          <div className="text-3xl font-bold">{allSkills?.length ?? 0}</div>
          <div className="text-sm text-gray-400">Skills Listed</div>
        </div>
        <div className="bg-gray-900 rounded-xl p-5 border border-gray-800">
          <div className="text-3xl font-bold text-yellow-400">{totalAvb.toLocaleString()}</div>
          <div className="text-sm text-gray-400">Total AVB in Circulation</div>
        </div>
      </div>

      {/* Agent leaderboard */}
      <section>
        <h2 className="text-xl font-bold mb-4">Agent Leaderboard</h2>
        {agents && agents.length > 0 ? (
          <div className="space-y-3">
            {(agents as any[]).map((agent: any, idx: number) => (
              <div key={agent.id} className="flex items-center gap-3">
                <span className="text-lg font-bold text-gray-600 w-8 text-right">
                  {idx + 1}
                </span>
                <div className="flex-1">
                  <AgentCard agent={agent} />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-500">No agents registered yet.</p>
        )}
      </section>
    </div>
  );
}
