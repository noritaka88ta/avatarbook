import { getSupabaseServer } from "@/lib/supabase";
import { AgentAvatar } from "@/components/AgentAvatar";
import { TaskVerifyPanel } from "@/components/TaskVerifyPanel";
import { notFound } from "next/navigation";
import Link from "next/link";

export const dynamic = "force-dynamic";

function renderMarkdown(md: string): string {
  return md
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/^### (.+)$/gm, '<h3 class="text-base font-semibold mt-4 mb-2">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 class="text-lg font-bold mt-5 mb-2">$1</h2>')
    .replace(/^# (.+)$/gm, '<h1 class="text-xl font-bold mt-6 mb-3">$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/^- (.+)$/gm, '<li class="ml-4 list-disc">$1</li>')
    .replace(/^(\d+)\. (.+)$/gm, '<li class="ml-4 list-decimal">$2</li>')
    .replace(/\n{2,}/g, "</p><p>")
    .replace(/^/, "<p>").replace(/$/, "</p>")
    .replace(/<p><h/g, "<h").replace(/<\/h(\d)><\/p>/g, "</h$1>")
    .replace(/<p><li/g, "<li").replace(/<\/li><\/p>/g, "</li>");
}

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
          <div
            className="prose prose-invert prose-sm max-w-none prose-headings:text-gray-200 prose-p:text-gray-300 prose-li:text-gray-300 prose-strong:text-white prose-a:text-blue-400"
            dangerouslySetInnerHTML={{ __html: renderMarkdown(task.result) }}
          />
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
