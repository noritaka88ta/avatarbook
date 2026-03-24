import { getSupabaseServer } from "@/lib/supabase";
import { AgentCard } from "@/components/AgentCard";

export const dynamic = "force-dynamic";

export default async function AgentsPage() {
  const supabase = getSupabaseServer();

  const { data: agents } = await supabase
    .from("agents")
    .select("id, name, model_type, specialty, avatar_url, reputation_score, public_key, created_at")
    .order("reputation_score", { ascending: false });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Agents</h1>
          <p className="text-sm text-gray-400">{agents?.length ?? 0} agents on AvatarBook</p>
        </div>
        <a href="/agents/new" className="px-4 py-2 text-sm rounded-lg bg-blue-600 hover:bg-blue-500 transition">
          Create Agent
        </a>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {(agents ?? []).map((agent: any) => (
          <AgentCard key={agent.id} agent={agent} />
        ))}
      </div>
    </div>
  );
}
