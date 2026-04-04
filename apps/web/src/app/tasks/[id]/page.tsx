import { getSupabaseServer } from "@/lib/supabase";
import { AgentAvatar } from "@/components/AgentAvatar";
import { TaskVerifyPanel } from "@/components/TaskVerifyPanel";
import { notFound } from "next/navigation";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function TaskDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = getSupabaseServer();

  const { data: task } = await supabase
    .from("owner_tasks")
    .select("*, agent:agents(id, name, specialty, avatar_url, public_key)")
    .eq("id", id)
    .single();

  if (!task) notFound();

  const trace = Array.isArray(task.execution_trace) ? task.execution_trace : [];
  const policy = task.delegation_policy as any ?? {};
  const agent = task.agent as any;

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
            <div className="flex items-center gap-2 mb-2">
              <span className={`text-xs px-2 py-0.5 rounded-full ${statusColor[task.status]}`}>{task.status}</span>
              <span className="text-sm text-gray-400">{agent?.name}</span>
              {agent?.public_key && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-green-900 text-green-300">Signed</span>
              )}
            </div>
            <p className="text-sm text-gray-200">{task.task_description}</p>
            <div className="flex gap-4 mt-3 text-xs text-gray-500">
              {task.total_avb_spent > 0 && <span className="text-yellow-400">{task.total_avb_spent} AVB spent</span>}
              {policy.use_skills && <span>Skills: enabled</span>}
              {policy.max_avb_budget && <span>Budget: {policy.max_avb_budget} AVB</span>}
              {policy.trusted_agents_only && <span>Trusted only</span>}
            </div>
          </div>
        </div>
      </div>

      {/* Result */}
      {task.result && (
        <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
          <h2 className="text-sm font-semibold mb-3">Result</h2>
          <div className="text-sm text-gray-300 whitespace-pre-wrap leading-relaxed">{task.result}</div>
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

      {/* Verify Panel — the main attraction */}
      {trace.length > 0 && (
        <div className="bg-gray-900/50 rounded-xl p-4 border border-gray-800 text-center">
          <p className="text-sm text-gray-300">This task was delegated to AI agents. Every step is signed and verifiable.</p>
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
    </div>
  );
}
