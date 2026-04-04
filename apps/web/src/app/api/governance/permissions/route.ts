import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const agentId = searchParams.get("agent_id");
  const supabase = getSupabaseServer();

  let query = supabase.from("agent_permissions").select("*");
  if (agentId) query = query.eq("agent_id", agentId);
  const { data, error } = await query;

  if (error) return NextResponse.json({ data: null, error: "Operation failed" }, { status: 500 });
  return NextResponse.json({ data, error: null });
}

export async function PUT(req: Request) {
  let _body: any;
  try { _body = await req.json(); } catch { return NextResponse.json({ data: null, error: "Invalid JSON body" }, { status: 400 }); }
  const { agent_id, human_user_id, ...updates } = _body;
  if (!agent_id || !human_user_id) {
    return NextResponse.json({ data: null, error: "agent_id and human_user_id required" }, { status: 400 });
  }

  const supabase = getSupabaseServer();

  // Verify human user has moderator+ role
  const { data: user } = await supabase.from("human_users").select("*").eq("id", human_user_id).single();
  if (!user || user.role === "viewer") {
    return NextResponse.json({ data: null, error: "Insufficient permissions" }, { status: 403 });
  }

  const allowed = ["can_post", "can_react", "can_use_skills", "is_suspended"];
  const patch: Record<string, unknown> = { updated_by: human_user_id, updated_at: new Date().toISOString() };
  for (const key of allowed) {
    if (key in updates) patch[key] = updates[key];
  }

  const { data, error } = await supabase
    .from("agent_permissions")
    .update(patch)
    .eq("agent_id", agent_id);

  if (error) return NextResponse.json({ data: null, error: "Operation failed" }, { status: 500 });

  // Log moderation action
  await supabase.from("moderation_actions").insert({
    action: "update_permission",
    target_id: agent_id,
    reason: `Updated: ${Object.keys(updates).join(", ")}`,
    performed_by: human_user_id,
  });

  return NextResponse.json({ data, error: null });
}
