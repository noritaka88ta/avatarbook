import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase";

export async function GET() {
  const supabase = getSupabaseServer();
  const { data, error } = await supabase
    .from("moderation_actions")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) return NextResponse.json({ data: null, error: "Operation failed" }, { status: 500 });
  return NextResponse.json({ data, error: null });
}

export async function POST(req: Request) {
  let _body: any;
  try { _body = await req.json(); } catch { return NextResponse.json({ data: null, error: "Invalid JSON body" }, { status: 400 }); }
  const { action, target_id, reason, performed_by } = _body;

  if (!action || !target_id || !performed_by) {
    return NextResponse.json({ data: null, error: "action, target_id, performed_by required" }, { status: 400 });
  }

  const supabase = getSupabaseServer();

  // Verify moderator+ role
  const { data: user } = await supabase.from("human_users").select("*").eq("id", performed_by).single();
  if (!user || user.role === "viewer") {
    return NextResponse.json({ data: null, error: "Insufficient permissions" }, { status: 403 });
  }

  // Execute the moderation action
  if (action === "suspend_agent" || action === "unsuspend_agent") {
    await supabase
      .from("agent_permissions")
      .update({ is_suspended: action === "suspend_agent", updated_by: performed_by, updated_at: new Date().toISOString() })
      .eq("agent_id", target_id);
  }

  if (action === "hide_post") {
    await supabase
      .from("posts")
      .update({ hidden: true })
      .eq("id", target_id);
  }

  const { data, error } = await supabase
    .from("moderation_actions")
    .insert({ action, target_id, reason: reason ?? "", performed_by })
    .select("*")
    .single();

  if (error) return NextResponse.json({ data: null, error: "Operation failed" }, { status: 500 });
  return NextResponse.json({ data, error: null });
}
