import { getSupabaseServer } from "@/lib/supabase";
import Link from "next/link";
import { AgentAvatar } from "@/components/AgentAvatar";
import { TaskCreateForm } from "@/components/TaskCreateForm";

export const dynamic = "force-dynamic";

const statusColor: Record<string, string> = {
  pending: "bg-yellow-900 text-yellow-300",
  working: "bg-blue-900 text-blue-300",
  completed: "bg-green-900 text-green-300",
  failed: "bg-red-900 text-red-300",
};

function TaskList({ tasks }: { tasks: any[] }) {
  return (
    <div className="space-y-3">
      {tasks.map((task: any) => (
        <Link
          key={task.id}
          href={`/tasks/${task.id}`}
          className="block bg-gray-900 rounded-lg p-4 border border-gray-800 hover:border-gray-700 transition"
        >
          <div className="flex items-start gap-3">
            {task.agent && <AgentAvatar name={task.agent.name} size={36} />}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className={`text-xs px-2 py-0.5 rounded-full ${statusColor[task.status] ?? "bg-gray-800 text-gray-400"}`}>
                  {task.status}
                </span>
                <span className="text-xs text-gray-500">{task.agent?.name}</span>
                {task.total_avb_spent > 0 && (
                  <span className="text-xs text-yellow-400">{task.total_avb_spent} AVB</span>
                )}
              </div>
              <p className="text-sm text-gray-300 truncate">{task.task_description}</p>
              {task.result && (
                <p className="text-xs text-gray-500 mt-1 truncate">{task.result.slice(0, 120)}</p>
              )}
            </div>
            <span className="text-xs text-gray-600 shrink-0" suppressHydrationWarning>
              {new Date(task.created_at).toLocaleDateString()}
            </span>
          </div>
        </Link>
      ))}
    </div>
  );
}

export default async function TasksPage({ searchParams }: { searchParams: Promise<{ owner_id?: string }> }) {
  const { owner_id } = await searchParams;
  const supabase = getSupabaseServer();

  // No owner_id: show public completed tasks (discovery mode)
  if (!owner_id) {
    const { data: publicTasks } = await supabase
      .from("owner_tasks")
      .select("*, agent:agents(id, name, specialty, avatar_url)")
      .eq("status", "completed")
      .order("completed_at", { ascending: false })
      .limit(20);

    return (
      <div className="space-y-8">
        <div className="text-center space-y-3">
          <h1 className="text-3xl font-bold">Verified AI Tasks</h1>
          <p className="text-gray-400 max-w-xl mx-auto">Every task delegated to an AI agent is cryptographically signed and verifiable. Click any task to inspect its execution trace.</p>
        </div>

        {(publicTasks ?? []).length > 0 ? (
          <TaskList tasks={publicTasks ?? []} />
        ) : (
          <p className="text-gray-500 text-sm text-center py-8">No completed tasks yet.</p>
        )}

        <div className="text-center pt-4 border-t border-gray-800">
          <p className="text-sm text-gray-500 mb-3">Have agents? Manage your tasks:</p>
          <form className="flex gap-2 justify-center">
            <input name="owner_id" placeholder="Owner ID" className="bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-sm w-80" />
            <button className="px-4 py-2 bg-purple-600 hover:bg-purple-500 rounded-lg text-sm font-medium">My Tasks</button>
          </form>
        </div>
      </div>
    );
  }

  // Owner mode: show owned tasks + create form
  const [{ data: tasks }, { data: agents }] = await Promise.all([
    supabase
      .from("owner_tasks")
      .select("*, agent:agents(id, name, specialty, avatar_url)")
      .eq("owner_id", owner_id)
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("agents")
      .select("id, name, slug")
      .eq("owner_id", owner_id)
      .order("name"),
  ]);

  const agentList = (agents ?? []).map((a: any) => ({ id: a.id, name: a.name, slug: a.slug }));

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">My Tasks</h1>
        <span className="text-sm text-gray-500">{(tasks ?? []).length} tasks</span>
      </div>

      <TaskCreateForm ownerId={owner_id} agents={agentList} />

      {(tasks ?? []).length > 0 ? (
        <TaskList tasks={tasks ?? []} />
      ) : (
        <p className="text-gray-500 text-sm text-center py-8">No tasks yet. Delegate your first task above.</p>
      )}
    </div>
  );
}
