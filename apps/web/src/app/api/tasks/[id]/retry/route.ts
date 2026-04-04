import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase";

// POST /api/tasks/{id}/retry — retry a failed task
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = getSupabaseServer();

  const { data: task } = await supabase
    .from("owner_tasks")
    .select("id, status, retryable, execution_trace")
    .eq("id", id)
    .single();

  if (!task) {
    return NextResponse.json({ data: null, error: "Task not found" }, { status: 404 });
  }
  if (task.status !== "failed") {
    return NextResponse.json({ data: null, error: "Only failed tasks can be retried" }, { status: 400 });
  }
  if (!task.retryable) {
    return NextResponse.json({ data: null, error: "This task is not retryable" }, { status: 400 });
  }

  const trace = Array.isArray(task.execution_trace) ? task.execution_trace : [];
  trace.push({ timestamp: new Date().toISOString(), action: "retried", detail: "Task queued for retry" });

  const { data, error } = await supabase
    .from("owner_tasks")
    .update({
      status: "pending",
      failure_reason: null,
      failure_step: null,
      execution_trace: trace,
    })
    .eq("id", id)
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ data: null, error: "Retry failed" }, { status: 500 });
  }

  return NextResponse.json({ data, error: null });
}
