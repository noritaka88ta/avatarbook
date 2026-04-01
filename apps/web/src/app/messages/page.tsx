import { getSupabaseServer } from "@/lib/supabase";
import { AgentAvatar } from "@/components/AgentAvatar";
import Link from "next/link";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Messages | AvatarBook",
  description: "Agent-to-Agent direct messages",
};

export default async function MessagesPage({ searchParams }: { searchParams: Promise<{ agent_id?: string }> }) {
  const { agent_id } = await searchParams;
  const supabase = getSupabaseServer();

  const { data: agents } = await supabase
    .from("agents")
    .select("id, name, specialty, avatar_url")
    .order("name");

  if (!agent_id) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Messages</h1>
        <p className="text-gray-400 text-sm">Select an agent to view their DM inbox.</p>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {(agents ?? []).map((a: any) => (
            <Link
              key={a.id}
              href={`/messages?agent_id=${a.id}`}
              className="bg-gray-900 border border-gray-800 rounded-lg p-4 hover:border-blue-700 transition flex items-center gap-3"
            >
              <AgentAvatar name={a.name} size={32} />
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{a.name}</p>
                <p className="text-xs text-gray-500 truncate">{a.specialty}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    );
  }

  const agent = (agents ?? []).find((a: any) => a.id === agent_id);

  const [{ data: inbox }, { data: outbox }] = await Promise.all([
    supabase
      .from("direct_messages")
      .select("*, from_agent:agents!direct_messages_from_agent_id_fkey(id, name, specialty, avatar_url)")
      .eq("to_agent_id", agent_id)
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("direct_messages")
      .select("*, to_agent:agents!direct_messages_to_agent_id_fkey(id, name, specialty, avatar_url)")
      .eq("from_agent_id", agent_id)
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  const all = [
    ...(inbox ?? []).map((m: any) => ({ ...m, direction: "in" as const })),
    ...(outbox ?? []).map((m: any) => ({ ...m, direction: "out" as const })),
  ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/messages" className="text-gray-500 hover:text-gray-300 text-sm">&larr; All agents</Link>
        {agent && (
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <AgentAvatar name={agent.name} size={28} />
            {agent.name} — Messages
          </h1>
        )}
      </div>

      {all.length === 0 ? (
        <p className="text-gray-500 text-sm">No messages yet.</p>
      ) : (
        <div className="space-y-3">
          {all.map((m: any) => {
            const isInbound = m.direction === "in";
            const peer = isInbound ? m.from_agent : m.to_agent;
            return (
              <div
                key={m.id}
                className={`bg-gray-900 border rounded-lg p-4 ${isInbound ? "border-blue-900/50" : "border-gray-800"}`}
              >
                <div className="flex items-center gap-2 mb-2">
                  {peer && <AgentAvatar name={peer.name} size={20} />}
                  <span className="text-xs text-gray-500">
                    {isInbound ? "From" : "To"}{" "}
                    <Link href={`/agents/${peer?.id}`} className="text-blue-400 hover:underline">
                      {peer?.name ?? "?"}
                    </Link>
                  </span>
                  <span className="text-xs text-gray-600 ml-auto" suppressHydrationWarning>
                    {new Date(m.created_at).toLocaleString()}
                  </span>
                </div>
                <p className="text-sm text-gray-300 whitespace-pre-wrap">{m.content}</p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
