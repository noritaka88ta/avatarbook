import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase";

// GET /api/tasks?owner_id=xxx&agent_id=yyy&status=pending
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const ownerId = searchParams.get("owner_id");
  const agentId = searchParams.get("agent_id");
  const status = searchParams.get("status");
  const limit = Math.min(50, parseInt(searchParams.get("limit") ?? "20", 10) || 20);

  if (!ownerId && !agentId) {
    return NextResponse.json({ data: [], error: "owner_id or agent_id required" }, { status: 400 });
  }

  const supabase = getSupabaseServer();
  let query = supabase
    .from("owner_tasks")
    .select("*, agent:agents(id, name, specialty, avatar_url)")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (ownerId) query = query.eq("owner_id", ownerId);
  if (agentId) query = query.eq("agent_id", agentId);
  if (status) query = query.eq("status", status);

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ data: [], error: "Operation failed" }, { status: 500 });
  }
  return NextResponse.json({ data: data ?? [], error: null });
}

// POST /api/tasks — create a task delegation
export async function POST(req: Request) {
  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ data: null, error: "Invalid JSON body" }, { status: 400 }); }
  const { owner_id, agent_id, task_description, delegation_policy } = body;

  if (!owner_id || !agent_id || !task_description) {
    return NextResponse.json({ data: null, error: "owner_id, agent_id, and task_description are required" }, { status: 400 });
  }
  if (typeof task_description !== "string" || task_description.length < 1 || task_description.length > 5000) {
    return NextResponse.json({ data: null, error: "task_description must be 1-5000 characters" }, { status: 400 });
  }

  const supabase = getSupabaseServer();

  // Verify agent belongs to owner
  const { data: agent } = await supabase.from("agents").select("id, owner_id, name").eq("id", agent_id).single();
  if (!agent) {
    return NextResponse.json({ data: null, error: "Agent not found" }, { status: 404 });
  }
  if (agent.owner_id !== owner_id) {
    return NextResponse.json({ data: null, error: "Agent does not belong to this owner" }, { status: 403 });
  }

  // Limit active tasks per agent (max 5)
  const { count } = await supabase
    .from("owner_tasks")
    .select("id", { count: "exact", head: true })
    .eq("agent_id", agent_id)
    .in("status", ["pending", "working"]);

  if ((count ?? 0) >= 5) {
    return NextResponse.json({ data: null, error: "Maximum 5 active tasks per agent" }, { status: 400 });
  }

  // Sanitize delegation_policy
  const policy = {
    use_skills: delegation_policy?.use_skills ?? false,
    max_avb_budget: typeof delegation_policy?.max_avb_budget === "number" ? delegation_policy.max_avb_budget : null,
    trusted_agents_only: delegation_policy?.trusted_agents_only ?? false,
  };

  const { data: task, error } = await supabase
    .from("owner_tasks")
    .insert({
      owner_id,
      agent_id,
      task_description,
      delegation_policy: policy,
      execution_trace: [{ timestamp: new Date().toISOString(), action: "created", detail: `Task delegated to ${agent.name}` }],
    })
    .select("*, agent:agents(id, name)")
    .single();

  if (error) {
    return NextResponse.json({ data: null, error: "Failed to create task" }, { status: 500 });
  }

  return NextResponse.json({ data: task, error: null });
}
