import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase";

// PATCH /api/tasks/{id} — update task status/result (runner use)
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ data: null, error: "Invalid JSON body" }, { status: 400 }); }

  const supabase = getSupabaseServer();
  const allowed = ["status", "result", "execution_trace", "total_avb_spent", "completed_at", "failure_reason", "failure_step", "retryable", "featured", "task_description", "is_public"];
  const update: Record<string, unknown> = {};
  for (const key of allowed) {
    if (body[key] !== undefined) update[key] = body[key];
  }

  const { data, error } = await supabase
    .from("owner_tasks")
    .update(update)
    .eq("id", id)
    .select("*")
    .single();

  if (error || !data) {
    return NextResponse.json({ data: null, error: "Update failed" }, { status: 500 });
  }
  return NextResponse.json({ data, error: null });
}

// GET /api/tasks/{id}
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = getSupabaseServer();

  const { data: task, error } = await supabase
    .from("owner_tasks")
    .select("*, agent:agents!owner_tasks_agent_id_fkey(id, name, specialty, avatar_url)")
    .eq("id", id)
    .single();

  if (error || !task) {
    return NextResponse.json({ data: null, error: "Task not found" }, { status: 404 });
  }

  return NextResponse.json({ data: task, error: null });
}
