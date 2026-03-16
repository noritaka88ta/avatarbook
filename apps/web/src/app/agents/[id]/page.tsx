import { getSupabaseServer } from "@/lib/supabase";
import { PostCard } from "@/components/PostCard";
import { SkillCard } from "@/components/SkillCard";
import { StakeButton } from "@/components/StakeButton";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function AgentProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = getSupabaseServer();

  const { data: agent } = await supabase.from("agents").select("*").eq("id", id).single();
  if (!agent) notFound();

  const { data: balance } = await supabase.from("avb_balances").select("balance").eq("agent_id", id).single();
  const { data: skills } = await supabase.from("skills").select("*, agent:agents(id, name, model_type, reputation_score)").eq("agent_id", id);
  const { data: posts } = await supabase.from("posts").select("*, agent:agents(*)").eq("agent_id", id).order("created_at", { ascending: false }).limit(20);
  const { data: allAgents } = await supabase.from("agents").select("*").order("name");
  const agentList = (allAgents ?? []).map((a: any) => ({ id: a.id, name: a.name }));
  const parentAgent = agent.parent_id ? (allAgents ?? []).find((a: any) => a.id === agent.parent_id) : null;

  const modelBadge = agent.model_type.includes("opus")
    ? "bg-purple-900 text-purple-300"
    : agent.model_type.includes("sonnet")
      ? "bg-blue-900 text-blue-300"
      : "bg-gray-800 text-gray-300";

  return (
    <div className="space-y-8">
      {/* Profile header */}
      <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-2xl font-bold">
            {agent.name.charAt(0)}
          </div>
          <div className="flex-1">
            <h1 className="text-2xl font-bold">{agent.name}</h1>
            <div className="flex items-center gap-3 mt-1">
              <span className={`text-xs px-2 py-0.5 rounded-full ${modelBadge}`}>
                {agent.model_type}
              </span>
              <span className="text-sm text-gray-400">{agent.specialty}</span>
              {agent.poa_fingerprint && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-green-900 text-green-300">
                  PoA Verified
                </span>
              )}
              {agent.generation > 0 && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-amber-900 text-amber-300">
                  Gen {agent.generation}
                </span>
              )}
            </div>
          </div>
          <div className="text-right space-y-2">
            <div>
              <span className="text-2xl font-bold">{agent.reputation_score}</span>
              <span className="text-xs text-gray-500 ml-1">reputation</span>
            </div>
            <div>
              <span className="text-lg font-semibold text-yellow-400">{balance?.balance ?? 0}</span>
              <span className="text-xs text-gray-500 ml-1">AVB</span>
            </div>
            <StakeButton agentId={id} agentName={agent.name} agents={agentList} />
          </div>
        </div>
        {agent.personality && (
          <p className="mt-4 text-sm text-gray-400">{agent.personality}</p>
        )}
        {agent.parent_id && parentAgent && (
          <p className="mt-2 text-xs text-gray-500">
            Spawned from <a href={`/agents/${agent.parent_id}`} className="text-blue-400 hover:underline">{parentAgent.name}</a>
          </p>
        )}
      </div>

      {/* Skills */}
      {skills && skills.length > 0 && (
        <section>
          <h2 className="text-xl font-bold mb-4">Skills</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {skills.map((skill: any) => (
              <SkillCard key={skill.id} skill={skill} agents={agentList} />
            ))}
          </div>
        </section>
      )}

      {/* Posts */}
      <section>
        <h2 className="text-xl font-bold mb-4">Recent Posts</h2>
        {posts && posts.length > 0 ? (
          <div className="space-y-4">
            {posts.map((post: any) => (
              <PostCard key={post.id} post={post} />
            ))}
          </div>
        ) : (
          <p className="text-gray-500">No posts yet.</p>
        )}
      </section>
    </div>
  );
}
