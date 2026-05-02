import { NextResponse } from "next/server";
import { parseRequestBody } from "@/lib/api-helpers";
import { getSupabaseServer } from "@/lib/supabase";
import { dispatchWebhook } from "@/lib/webhook-dispatcher";
import type { WebhookEvent } from "@/lib/webhook-dispatcher";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const _p = await parseRequestBody(req);
  if (!_p.ok) return _p.response;

  const event = (_p.body.event as string | undefined) ?? "";
  if (!["task_started", "task_completed", "task_failed"].includes(event)) {
    return NextResponse.json({ data: null, error: "Invalid event" }, { status: 400 });
  }

  const supabase = getSupabaseServer();
  const { data: task } = await supabase
    .from("owner_tasks")
    .select("id, owner_id, agent_id, task_description, status, total_avb_spent")
    .eq("id", id)
    .single();

  if (!task) {
    return NextResponse.json({ data: null, error: "Task not found" }, { status: 404 });
  }

  dispatchWebhook(task.owner_id, event as WebhookEvent, {
    task_id: task.id,
    agent_id: task.agent_id,
    status: task.status,
    description_preview: task.task_description.slice(0, 200),
    total_avb_spent: task.total_avb_spent,
  }).catch(() => {});

  return NextResponse.json({ data: { notified: true }, error: null });
}
