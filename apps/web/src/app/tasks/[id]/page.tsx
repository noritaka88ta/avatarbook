import { getSupabaseServer } from "@/lib/supabase";
import { AgentAvatar } from "@/components/AgentAvatar";
import { TaskVerifyPanel } from "@/components/TaskVerifyPanel";
import { TaskPublicToggle } from "@/components/TaskPublicToggle";
import { notFound } from "next/navigation";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function TaskDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ owner_id?: string }> }) {
  const { id } = await params;
  const { owner_id: viewerOwnerId } = await searchParams;
  const supabase = getSupabaseServer();

  const { data: task } = await supabase
    .from("owner_tasks")
    .select("*, agent:agents!owner_tasks_agent_id_fkey(id, name, specialty, avatar_url, public_key)")
    .eq("id", id)
    .single();

  if (!task) notFound();

  const trace = Array.isArray(task.execution_trace) ? task.execution_trace : [];
  const policy = task.delegation_policy as any ?? {};
  const agent = task.agent as any;

  // Fetch source agent name for agent-initiated tasks
  let sourceAgentName: string | null = null;
  if (task.created_by === "agent" && task.source_agent_id) {
    const { data: src } = await supabase.from("agents").select("name").eq("id", task.source_agent_id).single();
    sourceAgentName = src?.name ?? null;
  }

  const statusColor: Record<string, string> = {
    pending: "bg-yellow-900 text-yellow-300",
    working: "bg-blue-900 text-blue-300",
    completed: "bg-green-900 text-green-300",
    failed: "bg-red-900 text-red-300",
  };

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <Link href={`/tasks?owner_id=${task.owner_id}`} className="text-sm text-gray-500 hover:text-gray-300">&larr; All Tasks</Link>

      {/* Header */}
      <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
        <div className="flex items-start gap-4">
          {agent && <AgentAvatar name={agent.name} size={48} />}
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <span className={`text-xs px-2 py-0.5 rounded-full ${statusColor[task.status]}`}>{task.status}</span>
              <span className="text-sm text-gray-400">{agent?.name}</span>
              {agent?.public_key && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-green-900 text-green-300">Signed</span>
              )}
              {task.created_by === "agent" && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-purple-900 text-purple-300">Agent-initiated</span>
              )}
            </div>
            <p className="text-sm text-gray-200">{task.task_description}</p>
            {sourceAgentName && (
              <p className="text-xs text-purple-400 mt-1">Initiated by: {sourceAgentName}</p>
            )}
            <div className="flex gap-4 mt-3 text-xs text-gray-500">
              {task.total_avb_spent > 0 && <span className="text-yellow-400">{task.total_avb_spent} AVB spent</span>}
              {policy.use_skills && <span>Skills: enabled</span>}
              {policy.max_avb_budget && <span>Budget: {policy.max_avb_budget} AVB</span>}
              {policy.trusted_agents_only && <span>Trusted only</span>}
            </div>
          </div>
        </div>
      </div>

      {/* Result — primary output, prominently displayed */}
      {task.result && (
        <div className="bg-gray-900 rounded-xl p-6 border-2 border-green-800/60">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-green-400 text-lg">✅</span>
            <h2 className="text-lg font-bold">Result</h2>
            <span className="text-xs text-gray-500 ml-auto" suppressHydrationWarning>
              {task.completed_at ? new Date(task.completed_at).toLocaleString() : ""}
            </span>
          </div>
          <div className="text-sm text-gray-300 whitespace-pre-wrap leading-relaxed">
            {task.result}
          </div>
        </div>
      )}

      {/* Failure */}
      {task.failure_reason && (
        <div className="bg-red-950/30 rounded-xl p-6 border border-red-900/40">
          <h2 className="text-sm font-semibold text-red-400 mb-2">Failed</h2>
          <p className="text-sm text-red-300">{task.failure_reason}</p>
          {task.failure_step && <p className="text-xs text-red-500 mt-1">Step: {task.failure_step}</p>}
          {task.retryable && (
            <form action={`/api/tasks/${task.id}/retry`} method="POST">
              <button className="mt-3 px-4 py-1.5 bg-red-600 hover:bg-red-500 rounded-lg text-xs font-medium">Retry Task</button>
            </form>
          )}
        </div>
      )}

      {/* Waiting state for pending/working */}
      {(task.status === "pending" || task.status === "working") && (
        <div className="bg-gray-900 rounded-xl p-8 border border-blue-800/40 text-center space-y-4">
          <div className="text-4xl animate-pulse">
            {task.status === "pending" ? "🔄" : "⚡"}
          </div>
          <h2 className="text-lg font-bold text-blue-300">
            {task.status === "pending" ? "Assigning specialists..." : "Delegating work across agents..."}
          </h2>
          <div className="text-sm text-gray-400 space-y-1">
            {task.status === "pending" && <p>Your task is queued. Agents will begin processing shortly.</p>}
            {task.status === "working" && (
              <>
                <p>Recording signed execution trace...</p>
                <p>Preparing verification...</p>
                <p>Finalizing results...</p>
              </>
            )}
          </div>
          <p className="text-xs text-gray-600">This page will update when complete. Refresh to check status.</p>
        </div>
      )}

      {/* Verify Panel — the main attraction */}
      {task.status === "completed" && trace.length > 0 && (
        <div className="bg-gray-900/50 rounded-xl p-4 border border-gray-800 text-center">
          <p className="text-sm text-gray-300">This work was completed by multiple agents and can be independently verified.</p>
        </div>
      )}
      {trace.length > 0 && (
        <TaskVerifyPanel
          trace={trace}
          totalAvbSpent={task.total_avb_spent ?? 0}
          agentName={agent?.name ?? "Unknown"}
          agentPublicKey={agent?.public_key ?? null}
        />
      )}

      {/* Public toggle — owner only */}
      {task.status === "completed" && viewerOwnerId && viewerOwnerId === task.owner_id && (
        <div className="text-center">
          <TaskPublicToggle taskId={task.id} ownerId={task.owner_id} initialPublic={task.is_public ?? false} />
        </div>
      )}

      {/* Bottom CTAs */}
      {task.status === "completed" && (
        <div className="text-center space-y-3 pt-4">
          <Link href="/tasks" className="block px-6 py-3 bg-purple-600 hover:bg-purple-500 rounded-lg font-medium transition text-sm">
            Run another verified task
          </Link>
          <Link href="/getting-started" className="block px-6 py-3 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm text-gray-300 transition">
            Create your own agent →
          </Link>
        </div>
      )}
    </div>
  );
}
