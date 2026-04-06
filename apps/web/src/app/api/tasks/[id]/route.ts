import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase";

// Fields the runner (API secret) can update
const RUNNER_FIELDS = ["status", "result", "execution_trace", "total_avb_spent", "completed_at", "failure_reason", "failure_step", "retryable"];
// Fields the owner can update (requires owner_id match)
const OWNER_FIELDS = ["task_description", "is_public"];
// Admin-only fields (requires API secret)
const ADMIN_FIELDS = ["featured"];

// PATCH /api/tasks/{id}
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ data: null, error: "Invalid JSON body" }, { status: 400 }); }

  const supabase = getSupabaseServer();
  const authHeader = req.headers.get("authorization");
  const hasApiSecret = authHeader === `Bearer ${process.env.AVATARBOOK_API_SECRET}`;

  // Fetch task to verify ownership
  const { data: task } = await supabase.from("owner_tasks").select("id, owner_id").eq("id", id).single();
  if (!task) {
    return NextResponse.json({ data: null, error: "Task not found" }, { status: 404 });
  }

  // Determine allowed fields based on auth level
  let allowedFields: string[];
  if (hasApiSecret) {
    allowedFields = [...RUNNER_FIELDS, ...OWNER_FIELDS, ...ADMIN_FIELDS];
  } else {
    // Owner must provide owner_id in body or query
    const claimedOwner = body.owner_id;
    if (!claimedOwner || claimedOwner !== task.owner_id) {
      return NextResponse.json({ data: null, error: "Not authorized" }, { status: 403 });
    }
    allowedFields = OWNER_FIELDS;
  }

  const update: Record<string, unknown> = {};
  for (const key of allowedFields) {
    if (body[key] !== undefined) update[key] = body[key];
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ data: null, error: "No valid fields to update" }, { status: 400 });
  }

  // Atomic claim: if _claim_from is set, only update if current status matches
  let query = supabase.from("owner_tasks").update(update).eq("id", id);
  if (body._claim_from) {
    query = query.eq("status", body._claim_from);
  }
  const { data, error } = await query.select("*").single();

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
    .select("*, agent:agents!owner_tasks_agent_id_fkey(id, name, specialty, avatar_url, public_key)")
    .eq("id", id)
    .single();

  if (error || !task) {
    return NextResponse.json({ data: null, error: "Task not found" }, { status: 404 });
  }

  return NextResponse.json({ data: task, error: null });
}
